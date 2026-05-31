const db = require('../../config/database');
const hedgeEngine = require('./hedgeEngine');
const orderMatcher = require('../orderMatcher');

class TradingRouter {

  async routeOrder(orderId, pairId) {
    try {
      const pair = await db.query(
        'SELECT is_custom, binance_symbol, symbol FROM trading_pairs WHERE id=$1',
        [pairId]
      );
      if (!pair.rows[0]) return;

      const { is_custom, binance_symbol, symbol } = pair.rows[0];

      if (is_custom) {
        console.log(`[Router] Internal match: ${symbol}`);
        await orderMatcher.matchPairNow(pairId);

      } else {
        console.log(`[Router] Binance hedge: ${symbol}`);
        const order = await db.query(
          'SELECT * FROM orders WHERE order_id=$1', [orderId]
        );
        if (!order.rows[0]) return;

        const o = order.rows[0];
        const result = await hedgeEngine.hedge({
          ourOrderId:    orderId,
          symbol:        symbol,
          side:          o.side,
          orderType:     o.order_type,  // ✅ market/limit pass karo
          quantity:      parseFloat(o.quantity),
          price:         parseFloat(o.price),
          binanceSymbol: binance_symbol || symbol
        });

        if (!result.ok) {
          console.error(`[Router] Hedge failed: ${result.reason} — cancelling order ${orderId}`);
          await this.cancelFailedOrder(orderId, result.reason);
        } else {
          await db.query(
            'UPDATE orders SET is_binance_order=true WHERE order_id=$1',
            [orderId]
          );
        }
      }

    } catch (e) {
      console.error('[Router] routeOrder error:', e.message);
    }
  }

  async cancelFailedOrder(orderId, reason) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const order = await client.query(`
        SELECT o.*, tp.base_coin_id, tp.quote_coin_id
        FROM orders o
        JOIN trading_pairs tp ON tp.id = o.pair_id
        WHERE o.order_id=$1 FOR UPDATE
      `, [orderId]);

      if (!order.rows[0]) { await client.query('ROLLBACK'); return; }

      const o = order.rows[0];
      if (!['open', 'partially_filled'].includes(o.status)) {
        await client.query('ROLLBACK');
        return;
      }

      const refundCoinId = o.side === 'buy' ? o.quote_coin_id : o.base_coin_id;
      const refundAmt    = o.side === 'buy'
        ? parseFloat(o.remaining_qty) * parseFloat(o.price) * 1.001
        : parseFloat(o.remaining_qty);

      if (refundAmt > 0) {
        await client.query(`
          UPDATE balances
          SET available = available + $1,
              locked    = GREATEST(0, locked - $1),
              updated_at = NOW()
          WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
        `, [refundAmt, o.user_id, refundCoinId]);
      }

      await client.query(
        "UPDATE orders SET status='cancelled', updated_at=NOW() WHERE order_id=$1",
        [orderId]
      );

      await client.query('COMMIT');
      console.log(`[Router] Order ${orderId} cancelled (${reason}), refunded ${refundAmt}`);

    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[Router] cancelFailedOrder error:', e.message);
    } finally {
      client.release();
    }
  }
}

const tradingRouter = new TradingRouter();
module.exports = tradingRouter;
