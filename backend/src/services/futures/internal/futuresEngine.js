/**
 * Internal Futures Matching Engine
 * For custom pairs (VDC futures, listed tokens)
 */
const db = require('../../../config/database');
const {
  calcInitialMargin, calcLiquidationPrice,
  calcFee, calcNotional
} = require('../shared/marginCalculator');

async function processOrder(order, pair) {
  if (order.order_type === 'market') {
    return await processMarketOrder(order, pair);
  } else if (order.order_type === 'limit') {
    return await processLimitOrder(order, pair);
  }
  throw new Error(`Unsupported order type: ${order.order_type}`);
}

async function processMarketOrder(order, pair) {
  const { rows: [feed] } = await db.query(
    `SELECT price_usdt FROM price_feeds
     WHERE coin_id=(SELECT base_coin_id FROM futures_pairs WHERE id=$1)
     ORDER BY updated_at DESC LIMIT 1`,
    [pair.id]
  );

  const markPrice = parseFloat(feed?.price_usdt || 0);
  if (!markPrice) throw new Error('No price available for internal pair');

  const filledQty = parseFloat(order.quantity);
  const avgPrice  = markPrice;
  const feeRate   = parseFloat(pair.taker_fee || 0.002);
  const fee       = calcFee(filledQty, avgPrice, feeRate);
  const notional  = calcNotional(filledQty, avgPrice);
  const margin    = calcInitialMargin(filledQty, avgPrice, order.leverage, order.margin_type);
  const posSide   = order.side === 'buy' ? 'long' : 'short';
  const mmr       = parseFloat(pair.maintenance_margin || 0.005);
  const liqPrice  = calcLiquidationPrice(posSide, avgPrice, order.leverage, mmr, null, order.margin_type);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // USDT coin id
    const { rows: [usdtCoin] } = await client.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    const usdtCoinId = usdtCoin ? parseInt(usdtCoin.id) : null;

    // Check existing open position
    const { rows: [existingPos] } = await client.query(
      `SELECT * FROM futures_positions
       WHERE user_id=$1 AND pair_id=$2 AND side=$3 AND status='open' LIMIT 1`,
      [order.user_id, pair.id, posSide]
    );

    let positionId;
    if (existingPos) {
      const oldQty    = parseFloat(existingPos.quantity);
      const oldPrice  = parseFloat(existingPos.entry_price);
      const newQty    = oldQty + filledQty;
      const avgEntry  = ((oldQty * oldPrice) + (filledQty * avgPrice)) / newQty;
      const newMargin = parseFloat(existingPos.margin) + margin;
      const newLiq    = calcLiquidationPrice(posSide, avgEntry, order.leverage, mmr, null, order.margin_type);

      await client.query(
        `UPDATE futures_positions SET
           quantity=$1, entry_price=$2, mark_price=$3,
           margin=$4, liquidation_price=$5,
           fee_paid=fee_paid+$6, notional=$7, updated_at=NOW()
         WHERE id=$8`,
        [newQty, avgEntry, avgPrice, newMargin, newLiq, fee, notional, existingPos.id]
      );
      positionId = existingPos.id;
    } else {
      const { rows: [newPos] } = await client.query(
        `INSERT INTO futures_positions
           (user_id, pair_id, symbol, side, margin_type, leverage,
            entry_price, mark_price, quantity, margin,
            unrealized_pnl, realized_pnl, liquidation_price,
            take_profit, stop_loss, fee_paid, is_custom,
            notional, status, opened_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,$11,$12,$13,$14,true,$15,'open',NOW(),NOW())
         RETURNING id`,
        [
          order.user_id, pair.id, order.symbol, posSide,
          order.margin_type, order.leverage,
          avgPrice, avgPrice, filledQty, margin,
          liqPrice,
          order.take_profit || null, order.stop_loss || null,
          fee, notional
        ]
      );
      positionId = newPos.id;
    }

    // Update order to filled
    await client.query(
      `UPDATE futures_orders SET
         status='filled', filled_qty=$1, avg_fill_price=$2,
         fee=$3, notional_value=$4, filled_at=NOW(), updated_at=NOW()
       WHERE id=$5`,
      [filledQty, avgPrice, fee, notional, order.id]
    );

    // Insert trade record
    await client.query(
      `INSERT INTO futures_trades
         (order_id, position_id, user_id, pair_id, symbol,
          side, position_side, price, quantity,
          realized_pnl, fee, fee_asset, is_maker, is_custom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,'USDT',false,true)`,
      [order.id, positionId, order.user_id, pair.id, order.symbol,
       order.side, posSide, avgPrice, filledQty, fee]
    );

    // Deduct fee from futures balance + ledger
    if (usdtCoinId) {
      await client.query(
        `UPDATE balances SET available=available-$1, updated_at=NOW()
         WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
        [fee, order.user_id, usdtCoinId]
      );

      const { rows: [balRow] } = await client.query(
        `SELECT available FROM balances
         WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'`,
        [order.user_id, usdtCoinId]
      );

      await client.query(
        `INSERT INTO ledger (user_id, coin_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'futures_fee', $3, $4, $5, $6)`,
        [
          order.user_id, usdtCoinId,
          -fee,
          parseFloat(balRow?.available || 0),
          String(order.id),
          `Futures fee ${order.symbol} ${order.side}`
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`[FuturesEngine] Fill → pos=${positionId} qty=${filledQty} @ ${avgPrice} fee=${fee.toFixed(6)}`);
    return { positionId, filledQty, avgPrice, fee };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function processLimitOrder(order, pair) {
  console.log(`[FuturesEngine] Limit order saved: ${order.symbol} ${order.side} @ ${order.price}`);
  return { status: 'open', orderId: order.id };
}

/**
 * Close position (fully or partially)
 */
async function closePosition(positionId, userId, closeQty, markPrice, isCustom = true) {
  const { rows: [pos] } = await db.query(
    `SELECT p.*, fp.taker_fee, fp.maintenance_margin
     FROM futures_positions p
     JOIN futures_pairs fp ON fp.id = p.pair_id
     WHERE p.id=$1 AND p.user_id=$2 AND p.status='open'`,
    [positionId, userId]
  );

  if (!pos) throw new Error('Position not found');

  const qty     = parseFloat(closeQty || pos.quantity);
  const ep      = parseFloat(pos.entry_price);
  const mp      = parseFloat(markPrice);
  const feeRate = parseFloat(pos.taker_fee || 0.002);
  const fee     = calcFee(qty, mp, feeRate);

  // PnL
  let realizedPnl;
  if (pos.side === 'long') {
    realizedPnl = (mp - ep) * qty - fee;
  } else {
    realizedPnl = (ep - mp) * qty - fee;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [usdtCoin] } = await client.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    const usdtCoinId = usdtCoin ? parseInt(usdtCoin.id) : null;

    const remainingQty = parseFloat(pos.quantity) - qty;
    const isFullClose  = remainingQty <= 0.0000001;

    if (isFullClose) {
      await client.query(
        `UPDATE futures_positions SET
           status='closed', realized_pnl=$1, mark_price=$2,
           closed_at=NOW(), updated_at=NOW()
         WHERE id=$3`,
        [realizedPnl, markPrice, positionId]
      );
    } else {
      const newMargin = (parseFloat(pos.margin) / parseFloat(pos.quantity)) * remainingQty;
      await client.query(
        `UPDATE futures_positions SET
           quantity=$1, margin=$2, realized_pnl=realized_pnl+$3,
           mark_price=$4, updated_at=NOW()
         WHERE id=$5`,
        [remainingQty, newMargin, realizedPnl, markPrice, positionId]
      );
    }

    // Credit PnL + return margin
    if (usdtCoinId) {
      const returnAmount = parseFloat(pos.margin) * (qty / parseFloat(pos.quantity));
      const creditAmount = returnAmount + realizedPnl;

      await client.query(
        `UPDATE balances SET
           available = available + $1,
           locked    = GREATEST(locked - $2, 0),
           updated_at = NOW()
         WHERE user_id=$3 AND coin_id=$4 AND account_type='futures'`,
        [creditAmount, returnAmount, userId, usdtCoinId]
      );

      // Ledger — direct VALUES, no subquery
      const { rows: [balRow] } = await client.query(
        `SELECT available FROM balances
         WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'`,
        [userId, usdtCoinId]
      );

      await client.query(
        `INSERT INTO ledger (user_id, coin_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          usdtCoinId,
          'futures_pnl',
          realizedPnl,
          parseFloat(balRow?.available || 0),
          String(positionId),
          `Close ${pos.side} ${pos.symbol} @ ${mp} PnL=${realizedPnl.toFixed(4)}`
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`[FuturesEngine] closePosition → pnl=${realizedPnl.toFixed(4)} fee=${fee.toFixed(6)} full=${isFullClose}`);
    return { realizedPnl, fee, closedQty: qty, isFullClose };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancelOrder(order, pair) {
  await db.query(
    `UPDATE futures_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
    [order.id]
  );

  if (order.margin_used) {
    const { rows: [usdt] } = await db.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    if (usdt) {
      await db.query(
        `UPDATE balances SET
           available = available + $1,
           locked    = GREATEST(locked - $1, 0),
           updated_at = NOW()
         WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
        [order.margin_used, order.user_id, parseInt(usdt.id)]
      );
    }
  }
  return { status: 'cancelled' };
}

module.exports = { processOrder, closePosition, cancelOrder };
