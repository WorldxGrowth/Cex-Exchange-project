/**
 * Futures Binance Hedge Engine
 * Handles: place → DB save → processFill → balance update → TP/SL algo orders
 */
const db = require('../../../config/database');
const { getFuturesBinanceAdapter } = require('./futuresBinanceAdapter');
const { calcLiquidationPrice, calcFee, calcNotional } = require('../shared/marginCalculator');

async function placeOrder(order, pair) {
  const adapter = await getFuturesBinanceAdapter();

  const stepSize   = parseFloat(pair.step_size || 0.001);
  const roundedQty = adapter.roundQty(order.quantity, stepSize);
  if (roundedQty <= 0) throw new Error(`Quantity too small after rounding. stepSize=${stepSize}`);

  const binanceParams = {
    symbol:           order.symbol,
    side:             order.side.toUpperCase(),
    type:             mapOrderType(order.order_type),
    quantity:         roundedQty,
    positionSide:     'BOTH',
    reduceOnly:       order.reduce_only || false,
    newClientOrderId: order.client_order_id,
  };

  if (order.order_type === 'limit') {
    binanceParams.price       = parseFloat(order.price).toFixed(pair.price_precision || 2);
    binanceParams.timeInForce = 'GTC';
  }

  if (order.order_type === 'trailing_stop') {
    binanceParams.type         = 'TRAILING_STOP_MARKET';
    binanceParams.callbackRate = order.price_rate || 1;
  }

  // Auto-set leverage + margin type on Binance before order
  try {
    await adapter.changeLeverage(order.symbol, parseInt(order.leverage || 5));
    console.log(`[FuturesHedge] Leverage set: ${order.leverage}x on ${order.symbol}`);
  } catch(e) {
    console.warn(`[FuturesHedge] changeLeverage warning:`, e.message);
  }
  try {
    const binanceMarginType = (order.margin_type === 'cross') ? 'CROSSED' : 'ISOLATED';
    await adapter.changeMarginType(order.symbol, binanceMarginType);
  } catch(e) { /* already set */ }

  console.log(`[FuturesHedge] Placing on Binance:`, binanceParams);

  let binanceRes;
  try {
    binanceRes = await adapter.placeOrder(binanceParams);
  } catch (err) {
    await db.query(
      `UPDATE futures_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [order.id]
    );
    throw new Error(`Binance fapi error: ${err.message}`);
  }

  console.log(`[FuturesHedge] Binance response:`, binanceRes);

  await db.query(
    `UPDATE futures_orders SET binance_order_id=$1, updated_at=NOW() WHERE id=$2`,
    [binanceRes.orderId?.toString(), order.id]
  );

  if (order.order_type === 'market' && binanceRes.status === 'FILLED') {
    await processFill({
      orderId:    order.id,
      userId:     order.user_id,
      pairId:     order.pair_id,
      symbol:     order.symbol,
      side:       order.side,
      filledQty:  parseFloat(binanceRes.executedQty || binanceRes.cumQty || 0),
      avgPrice:   parseFloat(binanceRes.avgPrice || 0),
      leverage:   order.leverage,
      marginType: order.margin_type,
      marginUsed: order.margin_used,
      takeProfit: order.take_profit,
      stopLoss:   order.stop_loss,
      isCustom:   false,
      pair,
    });
    return { status: 'filled', binanceRes };
  }

  return { status: 'open', binanceRes };
}

async function processFill(data) {
  const {
    orderId, userId, pairId, symbol,
    side, filledQty, avgPrice,
    leverage, marginType, marginUsed,
    takeProfit, stopLoss, isCustom, pair
  } = data;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [usdtCoin] } = await client.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    const usdtCoinId = usdtCoin ? parseInt(usdtCoin.id) : null;

    const feeRate  = parseFloat(pair?.taker_fee || 0.0004);
    const fee      = calcFee(filledQty, avgPrice, feeRate);
    const notional = calcNotional(filledQty, avgPrice);
    const margin   = parseFloat(marginUsed) || (notional / parseFloat(leverage));
    const mmr      = parseFloat(pair?.maintenance_margin || 0.004);
    const posSide  = side === 'buy' ? 'long' : 'short';
    const liqPrice = calcLiquidationPrice(posSide, avgPrice, leverage, mmr, null, marginType);

    const { rows: [existingPos] } = await client.query(
      `SELECT * FROM futures_positions
       WHERE user_id=$1 AND pair_id=$2 AND side=$3 AND status='open' LIMIT 1`,
      [userId, pairId, posSide]
    );

    let positionId;
    if (existingPos) {
      const oldQty    = parseFloat(existingPos.quantity);
      const oldPrice  = parseFloat(existingPos.entry_price);
      const newQty    = oldQty + parseFloat(filledQty);
      const avgEntry  = ((oldQty * oldPrice) + (parseFloat(filledQty) * avgPrice)) / newQty;
      const newMargin = parseFloat(existingPos.margin) + margin;
      const newLiq    = calcLiquidationPrice(posSide, avgEntry, leverage, mmr, null, marginType);

      await client.query(
        `UPDATE futures_positions SET
           quantity=$1, entry_price=$2, mark_price=$3,
           margin=$4, liquidation_price=$5,
           fee_paid=fee_paid+$6, updated_at=NOW()
         WHERE id=$7`,
        [newQty, avgEntry, avgPrice, newMargin, newLiq, fee, existingPos.id]
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
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,$11,$12,$13,$14,$15,$16,'open',NOW(),NOW())
         RETURNING id`,
        [
          userId, pairId, symbol, posSide, marginType, leverage,
          avgPrice, avgPrice, filledQty, margin,
          liqPrice, takeProfit || null, stopLoss || null,
          fee, isCustom, notional
        ]
      );
      positionId = newPos.id;
    }

    await client.query(
      `UPDATE futures_orders SET
         status='filled', filled_qty=$1, avg_fill_price=$2,
         fee=$3, notional_value=$4, filled_at=NOW(), updated_at=NOW()
       WHERE id=$5`,
      [filledQty, avgPrice, fee, notional, orderId]
    );

    await client.query(
      `INSERT INTO futures_trades
         (order_id, position_id, user_id, pair_id, symbol,
          side, position_side, price, quantity,
          realized_pnl, fee, fee_asset, is_maker, is_custom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,'USDT',false,$11)`,
      [orderId, positionId, userId, pairId, symbol,
       side, posSide, avgPrice, filledQty, fee, isCustom]
    );

    if (usdtCoinId) {
      await client.query(
        `UPDATE balances SET available=available-$1, updated_at=NOW()
         WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
        [fee, userId, usdtCoinId]
      );
      const { rows: [balRow] } = await client.query(
        `SELECT available FROM balances WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'`,
        [userId, usdtCoinId]
      );
      await client.query(
        `INSERT INTO ledger (user_id, coin_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'futures_fee', $3, $4, $5, $6)`,
        [userId, usdtCoinId, -fee, parseFloat(balRow?.available || 0),
         String(orderId), `Futures fee ${symbol} ${side}`]
      );
    }

    await client.query('COMMIT');
    console.log(`[FuturesHedge] processFill done → positionId=${positionId} fee=${fee.toFixed(6)}`);

    // ── Place TP/SL on Binance after COMMIT (non-blocking) ──
    if (!isCustom && (takeProfit || stopLoss)) {
      setImmediate(async () => {
        try {
          const adapter   = await getFuturesBinanceAdapter();
          const closeSide = posSide === 'long' ? 'SELL' : 'BUY';

          if (takeProfit) {
            const tp = await adapter.placeAlgoOrder({
              symbol,
              side:         closeSide,
              type:         'TAKE_PROFIT_MARKET',
              quantity:     filledQty,
              triggerPrice: parseFloat(takeProfit),
              workingType:  'MARK_PRICE',
              reduceOnly:   true,
            });
            console.log(`[FuturesHedge] TP placed algoId=${tp.algoId} @ ${takeProfit}`);
            // Save algo order id to position
            await db.query(
              `UPDATE futures_positions SET updated_at=NOW() WHERE id=$1`,
              [positionId]
            );
          }

          if (stopLoss) {
            const sl = await adapter.placeAlgoOrder({
              symbol,
              side:         closeSide,
              type:         'STOP_MARKET',
              quantity:     filledQty,
              triggerPrice: parseFloat(stopLoss),
              workingType:  'MARK_PRICE',
              reduceOnly:   true,
            });
            console.log(`[FuturesHedge] SL placed algoId=${sl.algoId} @ ${stopLoss}`);
          }
        } catch(e) {
          console.error('[FuturesHedge] TP/SL place error:', e.message);
        }
      });
    }

    return { positionId, fee, notional };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[FuturesHedge] processFill ERROR:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function cancelOrder(order, pair) {
  const adapter = await getFuturesBinanceAdapter();
  try {
    const res = await adapter.cancelOrder(
      order.symbol,
      order.binance_order_id,
      order.client_order_id
    );
    await db.query(
      `UPDATE futures_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [order.id]
    );
    return res;
  } catch (err) {
    console.error('[FuturesHedge] cancelOrder error:', err.message);
    throw err;
  }
}

function mapOrderType(type) {
  const map = {
    'market':             'MARKET',
    'limit':              'LIMIT',
    'stop':               'STOP_MARKET',
    'stop_market':        'STOP_MARKET',
    'take_profit':        'TAKE_PROFIT_MARKET',
    'take_profit_market': 'TAKE_PROFIT_MARKET',
    'trailing_stop':      'TRAILING_STOP_MARKET',
  };
  return map[type?.toLowerCase()] || 'MARKET';
}

module.exports = { placeOrder, processFill, cancelOrder };
