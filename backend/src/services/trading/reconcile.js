const db = require('../../config/database');
const binanceAdapter = require('./binanceAdapter');
const hedgeEngine = require('./hedgeEngine');

class ReconcileService {

  async run() {
    console.log('[Reconcile] Starting...');
    try {
      await this.syncPendingOrders();
      console.log('[Reconcile] ✅ Done');
    } catch (e) {
      console.error('[Reconcile] error:', e.message);
    }
  }

  async syncPendingOrders() {
    const pending = await db.query(`
      SELECT bo.*
      FROM binance_orders bo
      WHERE bo.status IN ('open', 'partially_filled')
        AND bo.created_at > NOW() - INTERVAL '24 hours'
    `);

    if (pending.rows.length === 0) return;
    console.log(`[Reconcile] ${pending.rows.length} pending orders to sync`);

    for (const bo of pending.rows) {
      try {
        const status = await binanceAdapter.getOrderStatus(
          bo.symbol, bo.client_order_id
        );
        if (!status) continue;

        const filledQty = parseFloat(status.executedQty || 0);
        const avgPrice  = parseFloat(status.avgPrice || status.price || 0);
        const newStatus = status.status === 'FILLED'            ? 'filled'
                        : status.status === 'CANCELED'          ? 'cancelled'
                        : status.status === 'PARTIALLY_FILLED'  ? 'partially_filled'
                        : 'open';

        // ✅ FIX: FILLED hone pe user balance bhi update karo
        if (newStatus === 'filled' && filledQty > 0) {
          console.log(`[Reconcile] Fill detected: ${bo.our_order_id} ${filledQty} @ ${avgPrice}`);
          await hedgeEngine.processFill(bo.our_order_id, {
            ...status,
            orderId:     bo.binance_order_id,
            executedQty: filledQty.toString(),
            avgPrice:    avgPrice.toString()
          });

        } else if (newStatus === 'cancelled') {
          // Cancelled on Binance → cancel our order too
          await db.query(
            "UPDATE binance_orders SET status='cancelled', updated_at=NOW() WHERE id=$1",
            [bo.id]
          );
          const ourOrder = await db.query(
            "SELECT status FROM orders WHERE order_id=$1", [bo.our_order_id]
          );
          if (['open','partially_filled'].includes(ourOrder.rows[0]?.status)) {
            await hedgeEngine.cancelFailedOrder(bo.our_order_id, 'cancelled_on_binance');
          }

        } else {
          // Just update status
          await db.query(`
            UPDATE binance_orders SET
              filled_qty = $1, avg_fill_price = $2,
              status = $3, binance_status = $4, updated_at = NOW()
            WHERE id = $5
          `, [filledQty, avgPrice, newStatus, status.status, bo.id]);
        }

      } catch (e) {
        console.error(`[Reconcile] sync error ${bo.our_order_id}:`, e.message);
      }

      await new Promise(r => setTimeout(r, 300));
    }
  }
}

const reconcileService = new ReconcileService();
module.exports = reconcileService;
