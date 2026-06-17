/**
 * Futures Reconcile Service
 * Fallback for limit orders that UserDataStream missed
 * Runs every 1 minute
 */
const db = require('../../../config/database');
const { getFuturesBinanceAdapter } = require('./futuresBinanceAdapter');
const { processFill } = require('./futuresBinanceHedge');

async function run() {
  return; // Disabled - UserDataStream handles this
  try {
    // Get all open Binance futures orders in DB
    const { rows: openOrders } = await db.query(
      `SELECT fo.*, fp.taker_fee, fp.maintenance_margin, fp.step_size, fp.price_precision
       FROM futures_orders fo
       JOIN futures_pairs fp ON fp.id = fo.pair_id
       WHERE fo.status IN ('open','partially_filled')
         AND fo.is_custom = false
         AND fo.binance_order_id IS NOT NULL
         AND fo.created_at > NOW() - INTERVAL '1 hour'`
    );

    if (!openOrders.length) return;

    const adapter = await getFuturesBinanceAdapter();
    console.log(`[FuturesReconcile] Checking ${openOrders.length} open orders...`);

    for (const order of openOrders) {
      try {
        const binanceOrder = await adapter.queryOrder(
          order.symbol,
          order.binance_order_id
        );

        if (binanceOrder.status === 'FILLED') {
          const filledQty = parseFloat(binanceOrder.executedQty || 0);
          const avgPrice  = parseFloat(binanceOrder.avgPrice || 0);

          if (filledQty > 0 && avgPrice > 0) {
            console.log(`[FuturesReconcile] Order ${order.id} FILLED @ ${avgPrice}`);
            await processFill({
              orderId:    order.id,
              userId:     order.user_id,
              pairId:     order.pair_id,
              symbol:     order.symbol,
              side:       order.side,
              filledQty,
              avgPrice,
              leverage:   order.leverage,
              marginType: order.margin_type,
              marginUsed: order.margin_used,
              takeProfit: order.take_profit,
              stopLoss:   order.stop_loss,
              isCustom:   false,
              pair: {
                taker_fee:          order.taker_fee,
                maintenance_margin: order.maintenance_margin,
                step_size:          order.step_size,
                price_precision:    order.price_precision,
              }
            });
          }
        } else if (binanceOrder.status === 'CANCELED' || binanceOrder.status === 'EXPIRED') {
          await db.query(
            `UPDATE futures_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
            [order.id]
          );
          // Refund margin
          const { rows: [usdt] } = await db.query(
            `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
          );
          if (usdt && order.margin_used) {
            await db.query(
              `UPDATE balances SET
                 available=available+$1,
                 locked=GREATEST(locked-$1,0),
                 updated_at=NOW()
               WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
              [order.margin_used, order.user_id, parseInt(usdt.id)]
            );
          }
        }
      } catch(e) {
        console.error(`[FuturesReconcile] Order ${order.id} check error:`, e.message);
      }
    }

    console.log('[FuturesReconcile] Done');
  } catch(err) {
    console.error('[FuturesReconcile] run error:', err.message);
  }
}

module.exports = { run };
