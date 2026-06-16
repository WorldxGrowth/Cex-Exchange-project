const db             = require('../../config/database');
const binanceAdapter = require('./binanceAdapter');
const feeService     = require('../feeService');

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
      SELECT COALESCE(SUM(quantity * COALESCE(avg_fill_price, price, 0)), 0) as exposure
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

  // ── Average fill price from Binance result ─────
  // Multiple sources check karo — Binance format vary karta hai
  getAverageFillPrice(binanceResult) {
    const executedQty = parseFloat(binanceResult.executedQty || 0);

    const directAvg = parseFloat(binanceResult.avgPrice || 0);
    if (directAvg > 0) return directAvg;

    const cummulativeQuoteQty = parseFloat(binanceResult.cummulativeQuoteQty || 0);
    if (executedQty > 0 && cummulativeQuoteQty > 0) {
      return cummulativeQuoteQty / executedQty;
    }

    if (Array.isArray(binanceResult.fills) && binanceResult.fills.length > 0) {
      let totalQty = 0, totalQuote = 0;
      for (const fill of binanceResult.fills) {
        const qty   = parseFloat(fill.qty   || 0);
        const price = parseFloat(fill.price || 0);
        if (qty > 0 && price > 0) { totalQty += qty; totalQuote += qty * price; }
      }
      if (totalQty > 0) return totalQuote / totalQty;
    }

    const fallbackPrice = parseFloat(binanceResult.price || 0);
    return fallbackPrice > 0 ? fallbackPrice : 0;
  }

  // ── Main hedge function (unchanged) ───────────
  async hedge({ ourOrderId, symbol, side, orderType, quantity, price, binanceSymbol }) {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled) {
        console.log('[Hedge] Binance trading disabled');
        return { ok: false, reason: 'trading_disabled' };
      }

      const normalizedOrderType = String(orderType || 'limit').toLowerCase();
      const isMarket    = normalizedOrderType === 'market';
      const targetSymbol = binanceSymbol || symbol;

      const isAlive = await binanceAdapter.ping();
      if (!isAlive) {
        console.error('[Hedge] Binance unreachable!');
        await this.cancelFailedOrder(ourOrderId, 'binance_down');
        return { ok: false, reason: 'binance_down' };
      }

      let referencePrice = parseFloat(price || 0);
      if (isMarket) {
        const livePrice = await binanceAdapter.getPrice(targetSymbol);
        if (livePrice > 0) referencePrice = livePrice;
      }

      if (!referencePrice || referencePrice <= 0) {
        await this.cancelFailedOrder(ourOrderId, 'invalid_reference_price');
        return { ok: false, reason: 'invalid_reference_price' };
      }

      const orderValue = quantity * referencePrice;

      if (orderValue > settings.maxOrderUsdt) {
        await this.cancelFailedOrder(ourOrderId, 'order_too_large');
        return { ok: false, reason: 'order_too_large' };
      }

      const currentExposure = await this.getDailyExposure();
      if (currentExposure + orderValue > settings.dailyLimit) {
        await this.cancelFailedOrder(ourOrderId, 'daily_limit_reached');
        return { ok: false, reason: 'daily_limit_reached' };
      }

      const asset         = side === 'buy' ? 'USDT' : targetSymbol.replace(/USDT$/i, '');
      const binanceBalance = await binanceAdapter.getBalance(asset);
      const balanceBuffer  = isMarket ? 1.02 : 1.10;

      if (binanceBalance < (side === 'buy' ? orderValue * balanceBuffer : quantity)) {
        console.error(`[Hedge] Insufficient Binance balance: ${binanceBalance} ${asset}`);
        await this.cancelFailedOrder(ourOrderId, 'insufficient_binance_balance');
        return { ok: false, reason: 'insufficient_binance_balance' };
      }

      const clientOrderId = `VDX_${ourOrderId}`;

      let hedgePrice = referencePrice;
      if (!isMarket) {
        hedgePrice = this.applySpread(referencePrice, side, settings.spreadBuy, settings.spreadSell);
        console.log(`[Hedge] User price: ${referencePrice} → Hedge price: ${hedgePrice} (spread applied)`);
      } else {
        hedgePrice = null;
        console.log(`[Hedge] Market order → no spread, instant fill | estimated price: ${referencePrice}`);
      }

      const result = await binanceAdapter.placeOrder({
        symbol:        targetSymbol,
        side,
        orderType:     isMarket ? 'market' : 'limit',
        quantity,
        price:         hedgePrice,
        clientOrderId
      });

      console.log(`[Hedge] ✅ Binance order: ${result.orderId} | ${side} ${isMarket ? 'MARKET' : 'LIMIT'} ${quantity} ${symbol}`);

      await db.query(`
        INSERT INTO binance_orders
          (our_order_id, binance_order_id, client_order_id, symbol, side,
           order_type, quantity, price, status, binance_status, raw_response)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,$10)
        ON CONFLICT (client_order_id) DO UPDATE SET
          binance_order_id = $2, binance_status = $9,
          raw_response = $10, updated_at = NOW()
      `, [
        ourOrderId, result.orderId, clientOrderId, symbol, side,
        isMarket ? 'market' : 'limit', quantity,
        isMarket ? null : hedgePrice, result.status, JSON.stringify(result)
      ]);

      const executedQty = parseFloat(result.executedQty || 0);
      if (executedQty > 0 || result.status === 'FILLED' || result.status === 'PARTIALLY_FILLED') {
        await this.processFill(ourOrderId, result);
      }

      return { ok: true, binanceOrderId: result.orderId, status: result.status };

    } catch (e) {
      const code = e.response?.data?.code;
      const msg  = e.response?.data?.msg || e.message;
      console.error(`[Hedge] Error (${code}): ${msg}`);
      await this.cancelFailedOrder(ourOrderId, `binance_error_${code || 'unknown'}`);
      if (code === -2010) return { ok: false, reason: 'insufficient_balance' };
      if (code === -1013) return { ok: false, reason: 'invalid_quantity' };
      return { ok: false, reason: 'binance_error', error: msg };
    }
  }

  // ── Process fill — fee integrated ─────────────
  // v2: feeService se dynamic fee + treasury credit
  async processFill(ourOrderId, binanceResult) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const totalFilledQty = parseFloat(binanceResult.executedQty || 0);
      const avgPrice       = this.getAverageFillPrice(binanceResult);

      if (totalFilledQty <= 0) {
        await client.query('ROLLBACK');
        return;
      }

      const orderRes = await client.query(`
        SELECT o.*, tp.base_coin_id, tp.quote_coin_id, tp.id as pair_id,
               cb.symbol as base_symbol, cq.symbol as quote_symbol
        FROM orders o
        JOIN trading_pairs tp ON tp.id = o.pair_id
        JOIN coins cb ON cb.id = tp.base_coin_id
        JOIN coins cq ON cq.id = tp.quote_coin_id
        WHERE o.order_id = $1 FOR UPDATE
      `, [ourOrderId]);

      if (!orderRes.rows[0]) {
        await client.query('ROLLBACK');
        return;
      }

      const o = orderRes.rows[0];

      // Idempotency check
      const boRes = await client.query(`
        SELECT filled_qty FROM binance_orders
        WHERE our_order_id = $1 FOR UPDATE
      `, [ourOrderId]);

      const alreadySyncedQty = parseFloat(boRes.rows[0]?.filled_qty || 0);
      const deltaFilledQty   = Math.max(0, totalFilledQty - alreadySyncedQty);

      if (deltaFilledQty <= 0) {
        await client.query('COMMIT');
        return;
      }

      const userPriceRaw = parseFloat(o.price || 0);
      const userPrice    = userPriceRaw > 0 ? userPriceRaw : avgPrice;

      // ── v2: Dynamic fee from feeService ────────
      // Binance pass-through = always taker (market/instant fill)
      let feeRate = 0.001, feeType = 'percentage', feeSource = 'fallback';
      try {
        const feeInfo = await feeService.getFeeRate(o.user_id, o.pair_id, 'taker');
        feeRate   = feeInfo.rate;
        feeType   = feeInfo.type;
        feeSource = feeInfo.source;
      } catch (e) {
        console.error('[Hedge] feeService error, using fallback:', e.message);
      }

      // ── Fee calculation ─────────────────────────
      // BUY:  fee in base coin (BTC/XRP etc)
      // SELL: fee in quote coin (USDT)
      let feeAmount    = 0;
      let grossAmount  = 0;
      let netAmount    = 0;
      let feeCoinId    = 0;

      if (o.side === 'buy') {
        grossAmount = deltaFilledQty;                    // base coin
        feeAmount   = grossAmount * feeRate;
        netAmount   = grossAmount - feeAmount;
        feeCoinId   = o.base_coin_id;
      } else {
        grossAmount = deltaFilledQty * userPrice;        // USDT
        feeAmount   = grossAmount * feeRate;
        netAmount   = grossAmount - feeAmount;
        feeCoinId   = o.quote_coin_id;
      }

      console.log(`[Hedge] Fee: ${feeAmount.toFixed(8)} (rate:${feeRate} src:${feeSource})`);

      // ── Update binance_orders ──────────────────
      const binanceStatus =
        binanceResult.status === 'FILLED'           ? 'filled' :
        binanceResult.status === 'PARTIALLY_FILLED' ? 'partially_filled' : 'open';

      await client.query(`
        UPDATE binance_orders SET
          filled_qty = $1, avg_fill_price = $2,
          status = $3, binance_status = $4,
          raw_response = COALESCE($5, raw_response),
          updated_at = NOW()
        WHERE our_order_id = $6
      `, [
        totalFilledQty, avgPrice, binanceStatus,
        binanceResult.status || 'FILLED',
        JSON.stringify(binanceResult), ourOrderId
      ]);

      // ── Update orders table ────────────────────
      const newFilledQty = parseFloat(o.filled_qty || 0) + deltaFilledQty;
      const newRemaining = Math.max(0, parseFloat(o.quantity) - newFilledQty);
      const newStatus    = newRemaining <= 0 ? 'filled' : 'partially_filled';

      await client.query(`
        UPDATE orders SET
          filled_qty = $1, remaining_qty = $2,
          avg_fill_price = $3, status = $4,
          fee = COALESCE(fee,0) + $5,
          updated_at = NOW()
        WHERE order_id = $6
      `, [newFilledQty, newRemaining, avgPrice, newStatus, feeAmount, ourOrderId]);

      // ── User balance update (net amount after fee) ──
      if (o.side === 'buy') {
        // Credit base coin NET (gross - fee)
        await client.query(`
          INSERT INTO balances (user_id, coin_id, account_type, available, locked)
          VALUES ($1,$2,'spot',$3,0)
          ON CONFLICT (user_id, coin_id, account_type)
          DO UPDATE SET available = balances.available + $3, updated_at = NOW()
        `, [o.user_id, o.base_coin_id, netAmount]);

        // Release locked USDT
        const usedUsdt = deltaFilledQty * userPrice * 1.001;
        await client.query(`
          UPDATE balances
          SET locked = GREATEST(0, locked - $1), updated_at = NOW()
          WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
        `, [usedUsdt, o.user_id, o.quote_coin_id]);

      } else {
        // Credit USDT NET (gross - fee)
        await client.query(`
          INSERT INTO balances (user_id, coin_id, account_type, available, locked)
          VALUES ($1,$2,'spot',$3,0)
          ON CONFLICT (user_id, coin_id, account_type)
          DO UPDATE SET available = balances.available + $3, updated_at = NOW()
        `, [o.user_id, o.quote_coin_id, netAmount]);

        // Release locked base coin
        await client.query(`
          UPDATE balances
          SET locked = GREATEST(0, locked - $1), updated_at = NOW()
          WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
        `, [deltaFilledQty, o.user_id, o.base_coin_id]);
      }

      // ── Treasury: collect fee ──────────────────
      if (feeAmount > 0) {
        await feeService.creditToTreasury(
          client,
          feeCoinId,
          feeAmount,
          ourOrderId,
          `Binance fill fee: ${o.side} ${deltaFilledQty} ${o.base_symbol} @ ${avgPrice}`
        );
      }

      // ── Ledger: user trade_fill (net amount) ───
      const creditSymbol = o.side === 'buy' ? o.base_symbol : o.quote_symbol;
      await client.query(`
        INSERT INTO ledger (user_id, coin_id, type, amount, reference_id, description)
        VALUES ($1,$2,'trade_fill',$3,$4,$5)
      `, [
        o.user_id, feeCoinId, netAmount, ourOrderId,
        `${o.side.toUpperCase()} ${deltaFilledQty} ${o.base_symbol} @ ${avgPrice} | fee:${feeAmount.toFixed(8)} via Binance`
      ]).catch(() => {});

      // ── Mirror profit (spread profit tracking) ─
      const spreadProfit = o.side === 'buy'
        ? (userPrice - avgPrice) * deltaFilledQty
        : (avgPrice - userPrice) * deltaFilledQty;

      if (Math.abs(spreadProfit) > 0.0001 || Math.abs(feeAmount) > 0.0001) {
        await client.query(`
          INSERT INTO mirror_profits
            (our_order_id, binance_order_id, symbol, side,
             our_price, binance_price, quantity,
             profit_usdt, trading_fee_usdt, net_profit_usdt)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT DO NOTHING
        `, [
          ourOrderId, binanceResult.orderId,
          binanceResult.symbol || o.base_symbol + 'USDT',
          o.side, userPrice, avgPrice, deltaFilledQty,
          spreadProfit,
          feeAmount,
          spreadProfit + feeAmount
        ]).catch(() => {});
      }

      await client.query('COMMIT');

      console.log(
        `[Hedge] ✅ Fill: User ${o.user_id}` +
        ` +${netAmount.toFixed(6)} ${creditSymbol}` +
        ` | fee:${feeAmount.toFixed(6)} | spread:${spreadProfit.toFixed(6)}`
      );

      // ── WebSocket notify ───────────────────────
      try {
        const { getIO } = require('../../websocket/socket');
        const io = getIO();
        if (io) io.to(`user:${o.user_id}`).emit('order_filled', {
          order_id:   ourOrderId,
          filled_qty: deltaFilledQty,
          avg_price:  avgPrice,
          status:     newStatus,
          fee:        feeAmount
        });
      } catch (e) {}

      // ── Trade Email (non-blocking, min $10) ───
      try {
        const emailService = require('../../services/email/emailService');
        const minUsdtRes = await db.query(
          "SELECT value FROM system_settings WHERE key='trade_email_min_usdt'"
        );
        const minUsdt   = parseFloat(minUsdtRes.rows[0]?.value || 10);
        const tradeUsdt = o.side === 'buy'
          ? deltaFilledQty * avgPrice
          : deltaFilledQty * userPrice;

        if (tradeUsdt >= minUsdt) {
          db.query('SELECT email FROM users WHERE id=$1', [o.user_id])
            .then(u => {
              if (u.rows[0]) {
                emailService.sendTradeEmail(u.rows[0], {
                  side:        o.side,
                  symbol:      o.base_symbol + '/' + o.quote_symbol,
                  base_symbol: o.base_symbol,
                  qty:         deltaFilledQty,
                  price:       avgPrice,
                  total:       tradeUsdt,
                  fee:         feeAmount,
                  fee_symbol:  o.side === 'buy' ? o.base_symbol : o.quote_symbol,
                  order_id:    ourOrderId,
                }).catch(() => {});
              }
            }).catch(() => {});
        }
      } catch (e) {
        console.error('[Hedge Trade Email] Error (non-blocking):', e.message);
      }

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Hedge] processFill error:', err.message);
    } finally {
      client.release();
    }
  }

  // ── Cancel our order if hedge fails ───────────
  // (unchanged — same as before)
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

      const orderPrice   = parseFloat(o.price || 0);
      const refundCoinId = o.side === 'buy' ? o.quote_coin_id : o.base_coin_id;
      const refundAmt    = o.side === 'buy'
        ? parseFloat(o.remaining_qty) * orderPrice * 1.001
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

  // ── Cancel hedge on Binance ────────────────────
  // (unchanged)
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
