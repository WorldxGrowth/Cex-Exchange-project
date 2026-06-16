/**
 * Futures Liquidation Engine
 * Runs every 5 seconds — checks all open positions
 * If markPrice crosses liquidation_price → liquidate
 */
const db = require('../../../config/database');

let liquidatorTimer = null;

async function runLiquidationCheck() {
  try {
    const { rows: positions } = await db.query(
      `SELECT
         p.*,
         pf.price_usdt as current_price,
         fp.maintenance_margin,
         fp.is_custom
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       LEFT JOIN price_feeds pf ON pf.coin_id = fp.base_coin_id
       WHERE p.status = 'open'
         AND p.liquidation_price IS NOT NULL
         AND pf.price_usdt IS NOT NULL`
    );

    for (const pos of positions) {
      const markPrice = parseFloat(pos.current_price);
      const liqPrice  = parseFloat(pos.liquidation_price);
      const side      = pos.side;

      const shouldLiq =
        (side === 'long'  && markPrice <= liqPrice) ||
        (side === 'short' && markPrice >= liqPrice);

      if (shouldLiq) {
        console.log(`[Liquidator] LIQUIDATING pos=${pos.id} ${side} @ liq=${liqPrice} mark=${markPrice}`);
        await liquidatePosition(pos, markPrice);
      }
    }
  } catch (err) {
    console.error('[Liquidator] runLiquidationCheck error:', err.message);
  }
}

async function liquidatePosition(pos, markPrice) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const qty    = parseFloat(pos.quantity);
    const ep     = parseFloat(pos.entry_price);
    const margin = parseFloat(pos.margin);
    const liqFee = margin * 0.015; // 1.5% liquidation fee

    // Realized PnL at liquidation (usually very negative)
    let realizedPnl;
    if (pos.side === 'long') {
      realizedPnl = (markPrice - ep) * qty - liqFee;
    } else {
      realizedPnl = (ep - markPrice) * qty - liqFee;
    }

    // Close position as liquidated
    await client.query(
      `UPDATE futures_positions SET
         status='liquidated', realized_pnl=$1, mark_price=$2,
         closed_at=NOW(), updated_at=NOW()
       WHERE id=$3`,
      [realizedPnl, markPrice, pos.id]
    );

    // Log liquidation
    await client.query(
      `INSERT INTO futures_liquidation_logs
         (user_id, position_id, pair_id, symbol, side, quantity,
          entry_price, liquidation_price, mark_price,
          margin_lost, realized_pnl, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'margin_call')`,
      [
        pos.user_id, pos.id, pos.pair_id, pos.symbol,
        pos.side, qty, ep, pos.liquidation_price, markPrice,
        margin, realizedPnl
      ]
    );

    // Get USDT coin
    const { rows: [usdt] } = await client.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );

    if (usdt) {
      const usdtId    = parseInt(usdt.id);
      // Return remaining margin after liquidation fee + PnL
      const returnAmt = Math.max(0, margin + realizedPnl);

      // Release locked margin + credit any remaining amount
      await client.query(
        `UPDATE balances SET
           locked    = GREATEST(locked - $1, 0),
           available = available + $2,
           updated_at = NOW()
         WHERE user_id=$3 AND coin_id=$4 AND account_type='futures'`,
        [margin, returnAmt, pos.user_id, usdtId]
      );

      // Ledger entry
      const { rows: [balRow] } = await client.query(
        `SELECT available FROM balances
         WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'`,
        [pos.user_id, usdtId]
      );

      await client.query(
        `INSERT INTO ledger (user_id, coin_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'futures_liquidation', $3, $4, $5, $6)`,
        [
          pos.user_id, usdtId,
          realizedPnl,
          parseFloat(balRow?.available || 0),
          String(pos.id),
          `Liquidated ${pos.side} ${pos.symbol} @ ${markPrice} margin_lost=${margin.toFixed(4)}`
        ]
      );
    }

    await client.query('COMMIT');

    // Notify user via Socket.io
    try {
      const io = require('../../../websocket/socket').getIO?.();
      if (io) {
        io.to(`user:${pos.user_id}`).emit('futures_update', {
          type:       'position_liquidated',
          positionId: pos.id,
          symbol:     pos.symbol,
          side:       pos.side,
          markPrice,
          realizedPnl,
          message:    `Your ${pos.side} ${pos.symbol} position was liquidated at $${markPrice}`
        });
      }
    } catch (e) {}

    console.log(`[Liquidator] pos=${pos.id} liquidated. PnL=${realizedPnl.toFixed(4)} returned=${Math.max(0, margin+realizedPnl).toFixed(4)}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Liquidator] liquidatePosition error:', err.message);
  } finally {
    client.release();
  }
}

function start() {
  console.log('[Liquidator] Starting liquidation engine (5s interval)...');
  liquidatorTimer = setInterval(runLiquidationCheck, 5000);
}

function stop() {
  clearInterval(liquidatorTimer);
}

module.exports = { start, stop, runLiquidationCheck, liquidatePosition };
