const db = require('../../config/database');
const binanceAdapter = require('./binanceAdapter');

class HedgeEngine {

  async getSettings() {
    const res = await db.query(
      "SELECT key, value FROM system_settings WHERE category='trading' AND key LIKE 'binance_%'"
    );
    const settings = {};
    res.rows.forEach(r => { settings[r.key] = r.value; });
    return {
      enabled:      settings['binance_trading_enabled'] === 'true',
      maxOrderUsdt: parseFloat(settings['binance_max_order_usdt'] || 50),
      dailyLimit:   parseFloat(settings['binance_daily_exposure_limit'] || 800),
      spreadBuy:    parseFloat(settings['binance_spread_buy'] || 0.001),
      spreadSell:   parseFloat(settings['binance_spread_sell'] || 0.001),
    };
  }

  async getDailyExposure() {
    const res = await db.query(`
      SELECT COALESCE(SUM(quantity * avg_fill_price), 0) as exposure
      FROM binance_orders
      WHERE DATE(created_at) = CURRENT_DATE
        AND status IN ('filled', 'partially_filled')
    `);
    return parseFloat(res.rows[0]?.exposure || 0);
  }

  applySpread(price, side, spreadBuy, spreadSell) {
    if (side === 'buy') {
      return parseFloat((price * (1 - spreadBuy)).toFixed(2));
    } else {
      return parseFloat((price * (1 + spreadSell)).toFixed(2));
    }
  }

  // ── Main hedge function ────────────────────────
  async hedge({ ourOrderId, symbol, side, orderType, quantity, price, binanceSymbol }) {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled) {
        console.log('[Hedge] Binance trading disabled');
        return { ok: false, reason: 'trading_disabled' };
      }

      const isAlive = await binanceAdapter.ping();
      if (!isAlive) {
        console.error('[Hedge] Binance unreachable!');
        await this.cancelFailedOrder(ourOrderId, 'binance_down');
        return { ok: false, reason: 'binance_down' };
      }

      const orderValue = quantity * price;
      if (orderValue > settings.maxOrderUsdt) {
        await this.cancelFailedOrder(ourOrderId, 'order_too_large');
        return { ok: false, reason: 'order_too_large' };
      }

      const currentExposure = await this.getDailyExposure();
      if (currentExposure + orderValue > settings.dailyLimit) {
        await this.cancelFailedOrder(ourOrderId, 'daily_limit_reached');
        return { ok: false, reason: 'daily_limit_reached' };
      }

      // Balance check
      const asset = side === 'buy' ? 'USDT' : symbol.replace('USDT', '');
      const binanceBalance = await binanceAdapter.getBalance(asset);
      const balanceBuffer = isMarket ? 1.02 : 1.10;
      if (binanceBalance < (side === 'buy' ? orderValue * balanceBuffer : quantity)) {
        console.error(`[Hedge] Insufficient Binance balance: ${binanceBalance} ${asset}`);
        await this.cancelFailedOrder(ourOrderId, 'insufficient_binance_balance');
        return { ok: false, reason: 'insufficient_binance_balance' };
      }

      const isMarket = orderType?.toLowerCase() === 'market';
      const clientOrderId = `VDX_${ourOrderId}`;

      // ✅ Spread sirf LIMIT order pe lagao
      // Market order pe price matter nahi karta (instantly fills)
      let hedgePrice = price;
      if (!isMarket) {
        hedgePrice = this.applySpread(price, side, settings.spreadBuy, settings.spreadSell);
        console.log(`[Hedge] User price: ${price} → Hedge price: ${hedgePrice} (spread applied)`);
      } else {
        console.log(`[Hedge] Market order → no spread, instant fill`);
      }

      const result = await binanceAdapter.placeOrder({
        symbol:        binanceSymbol || symbol,
        side,
        orderType:     isMarket ? 'market' : 'limit',  // ✅ correct type
        quantity,
        price:         hedgePrice,
        clientOrderId
      });

      console.log(`[Hedge] ✅ Binance order: ${result.orderId} | ${side} ${isMarket ? 'MARKET' : 'LIMIT'} ${quantity} ${symbol}`);

      // DB log
      await db.query(`
        INSERT INTO binance_orders
          (our_order_id, binance_order_id, client_order_id, symbol, side,
           order_type, quantity, price, status, binance_status, raw_response)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,$10)
        ON CONFLICT (client_order_id) DO UPDATE SET
          binance_order_id = $2, binance_status = $9, updated_at = NOW()
      `, [ourOrderId, result.orderId, clientOrderId, symbol, side,
          isMarket ? 'market' : 'limit',
          quantity, isMarket ? null : hedgePrice,
          result.status, JSON.stringify(result)]);

      // Market order instantly filled hota hai
      if (result.status === 'FILLED') {
        await this.processFill(ourOrderId, result);
      }

      return { ok: true, binanceOrderId: result.orderId, status: result.status };

    } catch (e) {
      const code = e.response?.data?.code;
      const msg  = e.response?.data?.msg || e.message;
      console.error(`[Hedge] ❌ Error (${code}): ${msg}`);
      await this.cancelFailedOrder(ourOrderId, `binance_error_${code || 'unknown'}`);
      if (code === -2010) return { ok: false, reason: 'insufficient_balance' };
      if (code === -1013) return { ok: false, reason: 'invalid_quantity' };
      return { ok: false, reason: 'binance_error', error: msg };
    }
  }

  async processFill(ourOrderId, binanceResult) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const filledQty = parseFloat(binanceResult.executedQty || 0);
      const avgPrice  = parseFloat(binanceResult.avgPrice || binanceResult.price || binanceResult.fills?.[0]?.price || 0);

      if (filledQty <= 0) { await client.query('ROLLBACK'); return; }

      const orderRes = await client.query(`
        SELECT o.*, tp.base_coin_id, tp.quote_coin_id,
               cb.symbol as base_symbol, cq.symbol as quote_symbol
        FROM orders o
        JOIN trading_pairs tp ON tp.id = o.pair_id
        JOIN coins cb ON cb.id = tp.base_coin_id
        JOIN coins cq ON cq.id = tp.quote_coin_id
        WHERE o.order_id = $1 FOR UPDATE
      `, [ourOrderId]);

      if (!orderRes.rows[0]) { await client.query('ROLLBACK'); return; }

      const o = orderRes.rows[0];
      const ourPrice = parseFloat(o.price);

      await client.query(`
        UPDATE binance_orders SET
          filled_qty = $1, avg_fill_price = $2,
          status = 'filled', binance_status = 'FILLED', updated_at = NOW()
        WHERE our_order_id = $3
      `, [filledQty, avgPrice, ourOrderId]);

      const newFilledQty = parseFloat(o.filled_qty || 0) + filledQty;
      const newRemaining = Math.max(0, parseFloat(o.quantity) - newFilledQty);
      const newStatus    = newRemaining <= 0 ? 'filled' : 'partially_filled';

      await client.query(`
        UPDATE orders SET
          filled_qty = $1, remaining_qty = $2,
          avg_fill_price = $3, status = $4, updated_at = NOW()
        WHERE order_id = $5
      `, [newFilledQty, newRemaining, avgPrice, newStatus, ourOrderId]);

      if (o.side === 'buy') {
        await client.query(`
          INSERT INTO balances (user_id, coin_id, account_type, available, locked)
          VALUES ($1,$2,'spot',$3,0)
          ON CONFLICT (user_id, coin_id, account_type)
          DO UPDATE SET available = balances.available + $3, updated_at = NOW()
        `, [o.user_id, o.base_coin_id, filledQty]);

        const usedUsdt = filledQty * ourPrice * 1.001;
        await client.query(`
          UPDATE balances SET locked = GREATEST(0, locked - $1), updated_at = NOW()
          WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
        `, [usedUsdt, o.user_id, o.quote_coin_id]);

      } else {
        const usdtAmount = filledQty * ourPrice;
        await client.query(`
          INSERT INTO balances (user_id, coin_id, account_type, available, locked)
          VALUES ($1,$2,'spot',$3,0)
          ON CONFLICT (user_id, coin_id, account_type)
          DO UPDATE SET available = balances.available + $3, updated_at = NOW()
        `, [o.user_id, o.quote_coin_id, usdtAmount]);

        await client.query(`
          UPDATE balances SET locked = GREATEST(0, locked - $1), updated_at = NOW()
          WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
        `, [filledQty, o.user_id, o.base_coin_id]);
      }

      const creditCoin   = o.side === 'buy' ? o.base_coin_id : o.quote_coin_id;
      const creditAmount = o.side === 'buy' ? filledQty : filledQty * ourPrice;
      const creditSymbol = o.side === 'buy' ? o.base_symbol : o.quote_symbol;

      await client.query(`
        INSERT INTO ledger (user_id, coin_id, type, amount, reference_id, description)
        VALUES ($1,$2,'trade_fill',$3,$4,$5)
      `, [o.user_id, creditCoin, creditAmount, ourOrderId,
          `${o.side.toUpperCase()} ${filledQty} ${o.base_symbol} @ ${avgPrice} via Binance`
      ]).catch(() => {});

      const profit = o.side === 'buy'
        ? (ourPrice - avgPrice) * filledQty
        : (avgPrice - ourPrice) * filledQty;

      if (Math.abs(profit) > 0.0001) {
        await client.query(`
          INSERT INTO mirror_profits
            (our_order_id, binance_order_id, symbol, side,
             our_price, binance_price, quantity, profit_usdt)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [ourOrderId, binanceResult.orderId,
            binanceResult.symbol, o.side,
            ourPrice, avgPrice, filledQty, profit]).catch(() => {});
      }

      await client.query('COMMIT');
      console.log(`[Hedge] ✅ Fill processed: User ${o.user_id} +${creditAmount} ${creditSymbol}`);

      try {
        const { getIO } = require('../../websocket/socket');
        const io = getIO();
        if (io) io.to(`user:${o.user_id}`).emit('order_filled', {
          order_id: ourOrderId, filled_qty: filledQty,
          avg_price: avgPrice, status: newStatus
        });
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Hedge] processFill error:', err.message);
    } finally {
      client.release();
    }
  }

  async cancelFailedOrder(ourOrderId, reason) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const order = await client.query(`
        SELECT o.*, tp.base_coin_id, tp.quote_coin_id
        FROM orders o
        JOIN trading_pairs tp ON tp.id = o.pair_id
        WHERE o.order_id=$1 FOR UPDATE
      `, [ourOrderId]);

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
        [ourOrderId]
      );

      await client.query('COMMIT');
      console.log(`[Hedge] Order ${ourOrderId} cancelled (${reason}), refunded ${refundAmt}`);

    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[Hedge] cancelFailedOrder error:', e.message);
    } finally {
      client.release();
    }
  }

  async cancelHedge(ourOrderId) {
    try {
      const bo = await db.query(
        'SELECT * FROM binance_orders WHERE our_order_id=$1', [ourOrderId]
      );
      if (!bo.rows[0]) return { ok: true, reason: 'no_hedge_order' };

      const binanceOrder = bo.rows[0];
      if (['filled', 'cancelled'].includes(binanceOrder.status)) {
        return { ok: true, reason: 'already_done', status: binanceOrder.status };
      }

      const result = await binanceAdapter.cancelOrder(
        binanceOrder.symbol, binanceOrder.binance_order_id
      );

      if (result.status === 'ALREADY_FILLED_OR_CANCELLED') {
        const status = await binanceAdapter.getOrderStatus(
          binanceOrder.symbol, binanceOrder.client_order_id
        );
        if (status?.status === 'FILLED') {
          return { ok: false, reason: 'already_filled' };
        }
      }

      await db.query(
        "UPDATE binance_orders SET status='cancelled', updated_at=NOW() WHERE our_order_id=$1",
        [ourOrderId]
      );

      return { ok: true };

    } catch (e) {
      console.error('[Hedge] cancelHedge error:', e.message);
      return { ok: false, reason: e.message };
    }
  }
}

const hedgeEngine = new HedgeEngine();
module.exports = hedgeEngine;
