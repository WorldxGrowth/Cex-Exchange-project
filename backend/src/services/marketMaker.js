/**
 * VDExchange - Professional DB Driven Market Maker v2
 * ===================================================
 *
 * Purpose:
 *   ✅ Provide real orderbook liquidity
 *   ✅ Maintain buy/sell depth around target/current price
 *   ✅ Support token listing liquidity packages
 *   ✅ Keep spread controlled from DB
 *   ✅ Cancel stale bot orders automatically
 *   ✅ Use real allocated bot balance only
 *
 * Important:
 *   ❌ No infinite virtual balance
 *   ❌ No self-trade / wash trading logic
 *   ❌ No fake pump/dump logic
 *
 * Bot orders are normal LIMIT orders. Matching engine handles execution.
 */

const Decimal = require('decimal.js');
const db = require('../config/database');

Decimal.set({ precision: 28, rounding: Decimal.ROUND_DOWN });

class MarketMaker {
  constructor() {
    this.running = false;
    this.interval = null;
    this.botUserId = null;
    this.activeBots = {}; // botId -> timeout
  }

  // ─────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────

  async init() {
    try {
      const botUser = await db.query(
        "SELECT id FROM users WHERE email = 'bot@vdexchange.internal'"
      );

      if (!botUser.rows[0]) {
        console.error('❌ MarketMaker: bot@vdexchange.internal user not found');
        return;
      }

      this.botUserId = botUser.rows[0].id;
      console.log(`🤖 MarketMaker v2 initialized | Bot User ID: ${this.botUserId}`);
    } catch (err) {
      console.error('MarketMaker init error:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────
  // START / STOP
  // ─────────────────────────────────────────────────────

  start() {
    if (this.running) return;
    this.running = true;

    // Sync bot configs every 30 seconds
    this.interval = setInterval(() => {
      this.syncActiveBots().catch(e =>
        console.error('MarketMaker sync error:', e.message)
      );
    }, 30000);

    // Initial load
    setTimeout(() => this.syncActiveBots().catch(() => {}), 5000);

    console.log('🤖 MarketMaker v2 started');
  }

  stop() {
    this.running = false;

    if (this.interval) clearInterval(this.interval);

    Object.values(this.activeBots).forEach(t => clearTimeout(t));
    this.activeBots = {};

    console.log('🛑 MarketMaker v2 stopped');
  }

  // ─────────────────────────────────────────────────────
  // SMALL HELPERS
  // ─────────────────────────────────────────────────────

  D(v, fallback = 0) {
    try {
      if (v === null || v === undefined || v === '') return new Decimal(fallback);
      return new Decimal(v);
    } catch (_) {
      return new Decimal(fallback);
    }
  }

  n(v, fallback = 0) {
    const x = parseFloat(v);
    return Number.isFinite(x) ? x : fallback;
  }

  i(v, fallback = 0) {
    const x = parseInt(v, 10);
    return Number.isFinite(x) ? x : fallback;
  }

  bool(v, fallback = true) {
    if (v === null || v === undefined) return fallback;
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  clamp(value, min, max) {
    let v = this.D(value);
    if (min !== null && min !== undefined && this.D(min).greaterThan(0)) {
      v = Decimal.max(v, this.D(min));
    }
    if (max !== null && max !== undefined && this.D(max).greaterThan(0)) {
      v = Decimal.min(v, this.D(max));
    }
    return v;
  }

  randomBetween(min, max) {
    const a = this.n(min, 0);
    const b = this.n(max, a);
    if (b <= a) return a;
    return Math.random() * (b - a) + a;
  }

  randomPercent(pct) {
    const p = this.n(pct, 0);
    if (p <= 0) return 0;
    // returns -pct% to +pct%
    return (Math.random() * 2 - 1) * (p / 100);
  }

  roundDp(value, dp) {
    return this.D(value).toDecimalPlaces(this.i(dp, 8), Decimal.ROUND_DOWN);
  }

  // ─────────────────────────────────────────────────────
  // LOAD ACTIVE BOTS
  // ─────────────────────────────────────────────────────

  async syncActiveBots() {
    try {
      const bots = await db.query(`
        SELECT
          mmb.*,
          tp.symbol,
          tp.base_coin_id,
          tp.quote_coin_id,
          tp.price_precision,
          tp.qty_precision,
          tp.min_order_qty,
          tp.max_order_qty,
          tp.min_order_value,
          tp.maker_fee,
          tp.taker_fee,
          bc.symbol AS base_symbol,
          qc.symbol AS quote_symbol,
          p.price_usdt AS current_price
        FROM market_making_bots mmb
        JOIN trading_pairs tp ON tp.id = mmb.pair_id
        JOIN coins bc ON bc.id = tp.base_coin_id
        JOIN coins qc ON qc.id = tp.quote_coin_id
        LEFT JOIN price_feeds p ON p.coin_id = bc.id
        WHERE mmb.is_active = true
          AND tp.is_active = true
          AND (mmb.expires_at IS NULL OR mmb.expires_at > NOW())
      `);

      for (const bot of bots.rows) {
        if (!this.activeBots[bot.id]) {
          this.scheduleBotRun(bot);
        }
      }

      const activeBotIds = bots.rows.map(b => Number(b.id));
      for (const botId of Object.keys(this.activeBots)) {
        if (!activeBotIds.includes(Number(botId))) {
          clearTimeout(this.activeBots[botId]);
          delete this.activeBots[botId];
          console.log(`🛑 MarketMaker: Bot ${botId} stopped/disabled`);
        }
      }
    } catch (err) {
      console.error('syncActiveBots error:', err.message);
    }
  }

  scheduleBotRun(bot) {
    const minSec = Math.max(5, this.i(bot.interval_min, 60));
    const maxSec = Math.max(minSec, this.i(bot.interval_max, minSec));
    const intervalSec = Math.floor(this.randomBetween(minSec, maxSec));

    this.activeBots[bot.id] = setTimeout(async () => {
      delete this.activeBots[bot.id];

      try {
        const fresh = await this.loadBot(bot.id);
        if (!fresh) return;

        await this.runBot(fresh);

        const again = await this.loadBot(bot.id);
        if (again) this.scheduleBotRun(again);
      } catch (err) {
        console.error(`MarketMaker bot ${bot.id} schedule error:`, err.message);

        // Avoid dead bot loop; try again later
        const again = await this.loadBot(bot.id).catch(() => null);
        if (again) this.scheduleBotRun(again);
      }
    }, intervalSec * 1000);
  }

  async loadBot(botId) {
    const res = await db.query(`
      SELECT
        mmb.*,
        tp.symbol,
        tp.base_coin_id,
        tp.quote_coin_id,
        tp.price_precision,
        tp.qty_precision,
        tp.min_order_qty,
        tp.max_order_qty,
        tp.min_order_value,
        tp.maker_fee,
        tp.taker_fee,
        bc.symbol AS base_symbol,
        qc.symbol AS quote_symbol,
        p.price_usdt AS current_price
      FROM market_making_bots mmb
      JOIN trading_pairs tp ON tp.id = mmb.pair_id
      JOIN coins bc ON bc.id = tp.base_coin_id
      JOIN coins qc ON qc.id = tp.quote_coin_id
      LEFT JOIN price_feeds p ON p.coin_id = bc.id
      WHERE mmb.id = $1
        AND mmb.is_active = true
        AND tp.is_active = true
        AND (mmb.expires_at IS NULL OR mmb.expires_at > NOW())
    `, [botId]);

    return res.rows[0] || null;
  }

  // ─────────────────────────────────────────────────────
  // MAIN BOT CYCLE
  // ─────────────────────────────────────────────────────

  async runBot(bot) {
    if (!this.botUserId) return;

    const botId = Number(bot.id);
    const symbol = bot.symbol;

    // Daily counters reset
    await this.resetDailyCountersIfNeeded(bot);

    // Cancel stale orders first so locked balance comes back
    await this.cancelStaleOrders(bot);

    const stats = await this.getOpenOrderStats(bot);
    const balances = await this.getBotBalances(bot);

    const priceDp = this.i(bot.price_precision, 8);
    const qtyDp = this.i(bot.qty_precision, 6);

    const refPrice = this.getReferencePrice(bot);
    if (!refPrice || refPrice.lessThanOrEqualTo(0)) {
      console.log(`⚠️ Bot ${botId} ${symbol}: missing reference price`);
      return;
    }

    const minPrice = this.D(bot.min_price, 0);
    const maxPrice = this.D(bot.max_price, 0);

    if (this.bool(bot.pause_on_price_outside_range, true)) {
      if (minPrice.greaterThan(0) && refPrice.lessThan(minPrice)) {
        console.log(`⏸️ Bot ${botId} ${symbol}: price below min range`);
        return;
      }
      if (maxPrice.greaterThan(0) && refPrice.greaterThan(maxPrice)) {
        console.log(`⏸️ Bot ${botId} ${symbol}: price above max range`);
        return;
      }
    }

    if (this.bool(bot.pause_on_low_balance, true)) {
      const minUsdt = this.D(bot.min_balance_usdt, 0);
      const minToken = this.D(bot.min_balance_token, 0);

      if (balances.quoteAvailable.lessThan(minUsdt)) {
        console.log(`⏸️ Bot ${botId} ${symbol}: low ${bot.quote_symbol} balance`);
        return;
      }
      if (balances.baseAvailable.lessThan(minToken)) {
        console.log(`⏸️ Bot ${botId} ${symbol}: low ${bot.base_symbol} balance`);
        return;
      }
    }

    if (!this.checkDailyLimits(bot)) return;

    const maxOpen = this.i(bot.max_open_orders, 10);
    const maxBuy = this.i(bot.max_open_buy_orders, Math.ceil(maxOpen / 2));
    const maxSell = this.i(bot.max_open_sell_orders, Math.floor(maxOpen / 2));

    if (stats.totalOpen >= maxOpen) {
      console.log(`ℹ️ Bot ${botId} ${symbol}: max open orders reached (${stats.totalOpen}/${maxOpen})`);
      return;
    }

    const allowBuy = this.bool(bot.allow_buy, true);
    const allowSell = this.bool(bot.allow_sell, true);

    const canBuy = allowBuy && stats.openBuy < maxBuy;
    const canSell = allowSell && stats.openSell < maxSell;

    if (!canBuy && !canSell) {
      console.log(`ℹ️ Bot ${botId} ${symbol}: side limits reached`);
      return;
    }

    const plan = this.buildOrderPlan(bot, refPrice, { canBuy, canSell });
    if (!plan.length) {
      console.log(`ℹ️ Bot ${botId} ${symbol}: no valid order plan`);
      return;
    }

    for (const p of plan) {
      const ok = await this.placeBotOrder(bot, p.side, p.price, p.quantity, {
        priceDp,
        qtyDp,
        balances
      });

      if (ok) {
        // Reduce local balance estimate to avoid placing too much in same cycle
        const required = p.side === 'buy'
          ? this.D(p.price).mul(p.quantity).mul('1.001')
          : this.D(p.quantity);

        if (p.side === 'buy') {
          balances.quoteAvailable = balances.quoteAvailable.minus(required);
        } else {
          balances.baseAvailable = balances.baseAvailable.minus(required);
        }
      }
    }
  }

  getReferencePrice(bot) {
    // Priority:
    // 1. Admin target_price
    // 2. price_feeds.price_usdt
    // 3. min/max mid fallback
    let price = this.D(bot.target_price, 0);

    if (price.lessThanOrEqualTo(0)) {
      price = this.D(bot.current_price, 0);
    }

    if (price.lessThanOrEqualTo(0)) {
      const minP = this.D(bot.min_price, 0);
      const maxP = this.D(bot.max_price, 0);
      if (minP.greaterThan(0) && maxP.greaterThan(0)) {
        price = minP.plus(maxP).div(2);
      }
    }

    return this.clamp(price, bot.min_price, bot.max_price);
  }

  buildOrderPlan(bot, refPrice, caps) {
    const plan = [];

    const spreadPct = this.D(bot.spread_pct || 2).div(100);
    const halfSpread = spreadPct.div(2);

    const priceRandomPct = this.n(bot.price_random_pct, 0.30);
    const qtyMin = this.D(bot.order_qty_min || 1);
    const qtyMax = this.D(bot.order_qty_max || qtyMin);
    const qtyRandomPct = this.n(bot.qty_random_pct, 20);

    const priceDp = this.i(bot.price_precision, 8);
    const qtyDp = this.i(bot.qty_precision, 6);

    const mode = String(bot.mode || bot.strategy || 'liquidity_only').toLowerCase();

    // Base buy/sell price around reference price
    let buyPrice = refPrice.mul(this.D(1).minus(halfSpread));
    let sellPrice = refPrice.mul(this.D(1).plus(halfSpread));

    // Add controlled random variation
    buyPrice = buyPrice.mul(this.D(1).plus(this.randomPercent(priceRandomPct)));
    sellPrice = sellPrice.mul(this.D(1).plus(this.randomPercent(priceRandomPct)));

    buyPrice = this.clamp(buyPrice, bot.min_price, bot.max_price);
    sellPrice = this.clamp(sellPrice, bot.min_price, bot.max_price);

    // Ensure sell > buy if possible
    if (sellPrice.lessThanOrEqualTo(buyPrice)) {
      sellPrice = buyPrice.mul(this.D(1).plus(spreadPct));
      sellPrice = this.clamp(sellPrice, bot.min_price, bot.max_price);
    }

    buyPrice = this.roundDp(buyPrice, priceDp);
    sellPrice = this.roundDp(sellPrice, priceDp);

    const makeQty = () => {
      let q = this.D(this.randomBetween(qtyMin.toNumber(), qtyMax.toNumber()));
      q = q.mul(this.D(1).plus(this.randomPercent(qtyRandomPct)));
      q = Decimal.max(q, qtyMin);
      q = Decimal.min(q, qtyMax);
      return this.roundDp(q, qtyDp);
    };

    // DB-driven side decision.
    // liquidity_only/spread/price_stabilize currently place orderbook liquidity only.
    const r = Math.random();

    if (mode === 'price_stabilize') {
      // Still liquidity-focused. Slightly prefer both sides if possible.
      if (caps.canBuy && caps.canSell && r < 0.55) {
        plan.push({ side: 'buy', price: buyPrice, quantity: makeQty() });
        plan.push({ side: 'sell', price: sellPrice, quantity: makeQty() });
      } else if (caps.canBuy && r < 0.75) {
        plan.push({ side: 'buy', price: buyPrice, quantity: makeQty() });
      } else if (caps.canSell) {
        plan.push({ side: 'sell', price: sellPrice, quantity: makeQty() });
      }
    } else {
      // Default liquidity_only/spread mode
      if (caps.canBuy && caps.canSell && r < 0.35) {
        plan.push({ side: 'buy', price: buyPrice, quantity: makeQty() });
        plan.push({ side: 'sell', price: sellPrice, quantity: makeQty() });
      } else if (caps.canBuy && r < 0.65) {
        plan.push({ side: 'buy', price: buyPrice, quantity: makeQty() });
      } else if (caps.canSell) {
        plan.push({ side: 'sell', price: sellPrice, quantity: makeQty() });
      }
    }

    return plan;
  }

  // ─────────────────────────────────────────────────────
  // SAFETY / LIMITS
  // ─────────────────────────────────────────────────────

  async resetDailyCountersIfNeeded(bot) {
    await db.query(`
      UPDATE market_making_bots
      SET used_volume_today = 0,
          used_orders_today = 0,
          last_reset_date = CURRENT_DATE,
          updated_at = NOW()
      WHERE id = $1
        AND (last_reset_date IS NULL OR last_reset_date < CURRENT_DATE)
    `, [bot.id]).catch(() => {});
  }

  checkDailyLimits(bot) {
    const botId = bot.id;
    const symbol = bot.symbol;

    const dailyVolLimit = this.D(bot.daily_volume_limit, 0);
    const usedVol = this.D(bot.used_volume_today, 0);

    if (dailyVolLimit.greaterThan(0) && usedVol.greaterThanOrEqualTo(dailyVolLimit)) {
      console.log(`⏸️ Bot ${botId} ${symbol}: daily volume limit reached`);
      return false;
    }

    const dailyOrderLimit = this.i(bot.daily_order_limit, 0);
    const usedOrders = this.i(bot.used_orders_today, 0);

    if (dailyOrderLimit > 0 && usedOrders >= dailyOrderLimit) {
      console.log(`⏸️ Bot ${botId} ${symbol}: daily order limit reached`);
      return false;
    }

    return true;
  }

  async getOpenOrderStats(bot) {
    const res = await db.query(`
      SELECT
        COUNT(*)::int AS total_open,
        COUNT(*) FILTER (WHERE side='buy')::int AS open_buy,
        COUNT(*) FILTER (WHERE side='sell')::int AS open_sell,
        COALESCE(SUM(CASE WHEN side='buy' THEN remaining_qty * price ELSE 0 END),0) AS open_buy_value,
        COALESCE(SUM(CASE WHEN side='sell' THEN remaining_qty ELSE 0 END),0) AS open_sell_qty
      FROM orders
      WHERE pair_id = $1
        AND bot_id = $2
        AND is_bot_order = true
        AND status IN ('open','partially_filled')
    `, [bot.pair_id, bot.id]);

    const row = res.rows[0] || {};
    return {
      totalOpen: this.i(row.total_open, 0),
      openBuy: this.i(row.open_buy, 0),
      openSell: this.i(row.open_sell, 0),
      openBuyValue: this.D(row.open_buy_value, 0),
      openSellQty: this.D(row.open_sell_qty, 0),
    };
  }

  async getBotBalances(bot) {
    const res = await db.query(`
      SELECT coin_id, available, locked
      FROM balances
      WHERE user_id = $1
        AND coin_id IN ($2,$3)
        AND account_type = 'spot'
    `, [this.botUserId, bot.base_coin_id, bot.quote_coin_id]);

    let baseAvailable = this.D(0);
    let baseLocked = this.D(0);
    let quoteAvailable = this.D(0);
    let quoteLocked = this.D(0);

    for (const r of res.rows) {
      if (Number(r.coin_id) === Number(bot.base_coin_id)) {
        baseAvailable = this.D(r.available, 0);
        baseLocked = this.D(r.locked, 0);
      }
      if (Number(r.coin_id) === Number(bot.quote_coin_id)) {
        quoteAvailable = this.D(r.available, 0);
        quoteLocked = this.D(r.locked, 0);
      }
    }

    return { baseAvailable, baseLocked, quoteAvailable, quoteLocked };
  }

  // ─────────────────────────────────────────────────────
  // STALE ORDER CLEANUP
  // ─────────────────────────────────────────────────────

  async cancelStaleOrders(bot) {
    const lifetimeSec = this.i(bot.order_lifetime_sec, 120);
    if (lifetimeSec <= 0) return;

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const orders = await client.query(`
        SELECT id, order_id, side, price, remaining_qty
        FROM orders
        WHERE pair_id = $1
          AND bot_id = $2
          AND is_bot_order = true
          AND status IN ('open','partially_filled')
          AND created_at < NOW() - ($3 || ' seconds')::interval
        FOR UPDATE
      `, [bot.pair_id, bot.id, lifetimeSec]);

      for (const o of orders.rows) {
        const rem = this.D(o.remaining_qty, 0);
        if (rem.lessThanOrEqualTo(0)) continue;

        const refundCoinId = o.side === 'buy' ? bot.quote_coin_id : bot.base_coin_id;
        const refundAmount = o.side === 'buy'
          ? rem.mul(o.price || 0).mul('1.001')
          : rem;

        if (refundAmount.greaterThan(0)) {
          await client.query(`
            UPDATE balances
            SET available = available + $1,
                locked = GREATEST(0, locked - $1),
                updated_at = NOW()
            WHERE user_id = $2
              AND coin_id = $3
              AND account_type = 'spot'
          `, [refundAmount.toFixed(8), this.botUserId, refundCoinId]);
        }

        await client.query(`
          UPDATE orders
          SET status = 'cancelled',
              updated_at = NOW()
          WHERE id = $1
        `, [o.id]);

        console.log(
          `🧹 Bot ${bot.id} ${bot.symbol}: stale ${o.side} order cancelled` +
          ` | ${o.order_id} | refund=${refundAmount.toFixed(8)}`
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`cancelStaleOrders error bot ${bot.id}:`, err.message);
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────
  // PLACE BOT ORDER
  // ─────────────────────────────────────────────────────

  async placeBotOrder(bot, side, price, quantity, ctx = {}) {
    const priceDp = this.i(ctx.priceDp || bot.price_precision, 8);
    const qtyDp = this.i(ctx.qtyDp || bot.qty_precision, 6);

    const p = this.roundDp(price, priceDp);
    const q = this.roundDp(quantity, qtyDp);

    if (p.lessThanOrEqualTo(0) || q.lessThanOrEqualTo(0)) return false;

    const minQty = this.D(bot.min_order_qty, 0);
    const maxQty = this.D(bot.max_order_qty, 0);
    const minValue = this.D(bot.min_order_value, 0);

    if (minQty.greaterThan(0) && q.lessThan(minQty)) return false;
    if (maxQty.greaterThan(0) && q.greaterThan(maxQty)) return false;

    const totalValue = p.mul(q);
    if (minValue.greaterThan(0) && totalValue.lessThan(minValue)) return false;

    const maxSingleUsdt = this.D(bot.max_single_order_usdt, 0);
    if (maxSingleUsdt.greaterThan(0) && totalValue.greaterThan(maxSingleUsdt)) {
      console.log(`⚠️ Bot ${bot.id} ${bot.symbol}: single order value too high`);
      return false;
    }

    const dailyVolLimit = this.D(bot.daily_volume_limit, 0);
    const usedVol = this.D(bot.used_volume_today, 0);
    if (dailyVolLimit.greaterThan(0) && usedVol.plus(totalValue).greaterThan(dailyVolLimit)) {
      console.log(`⏸️ Bot ${bot.id} ${bot.symbol}: order skipped by daily volume cap`);
      return false;
    }

    const requiredCoinId = side === 'buy' ? bot.quote_coin_id : bot.base_coin_id;

    // Buy locks quote coin with 0.1% buffer, same pattern as normal order placement.
    // Sell locks base coin quantity.
    const requiredAmount = side === 'buy'
      ? totalValue.mul('1.001')
      : q;

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Lock exact bot balance row. No infinite virtual balance.
      const bal = await client.query(`
        SELECT available, locked
        FROM balances
        WHERE user_id = $1
          AND coin_id = $2
          AND account_type = 'spot'
        FOR UPDATE
      `, [this.botUserId, requiredCoinId]);

      if (!bal.rows[0]) {
        await client.query('ROLLBACK');
        console.log(`⚠️ Bot ${bot.id} ${bot.symbol}: no balance row for ${side}`);
        return false;
      }

      const available = this.D(bal.rows[0].available, 0);

      if (available.lessThan(requiredAmount)) {
        await client.query('ROLLBACK');
        console.log(
          `⚠️ Bot ${bot.id} ${bot.symbol}: insufficient ${side === 'buy' ? bot.quote_symbol : bot.base_symbol}` +
          ` | need=${requiredAmount.toFixed(8)} available=${available.toFixed(8)}`
        );
        return false;
      }

      await client.query(`
        UPDATE balances
        SET available = available - $1,
            locked = locked + $1,
            updated_at = NOW()
        WHERE user_id = $2
          AND coin_id = $3
          AND account_type = 'spot'
      `, [requiredAmount.toFixed(8), this.botUserId, requiredCoinId]);

      const orderId =
        'BOT' +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 8).toUpperCase();

      await client.query(`
        INSERT INTO orders
          (order_id, user_id, pair_id, side, order_type, price,
           quantity, remaining_qty, total_value, status, time_in_force,
           source, is_bot_order, bot_id, created_at, updated_at)
        VALUES
          ($1,$2,$3,$4,'limit',$5,$6,$6,$7,'open','GTC',
           'bot', true, $8, NOW(), NOW())
      `, [
        orderId,
        this.botUserId,
        bot.pair_id,
        side,
        p.toFixed(priceDp),
        q.toFixed(qtyDp),
        totalValue.toFixed(8),
        bot.id
      ]);

      await client.query(`
        UPDATE market_making_bots
        SET used_usdt = used_usdt + $1,
            used_token = used_token + $2,
            used_volume_today = used_volume_today + $3,
            used_orders_today = used_orders_today + 1,
            updated_at = NOW()
        WHERE id = $4
      `, [
        side === 'buy' ? totalValue.toFixed(8) : 0,
        side === 'sell' ? q.toFixed(qtyDp) : 0,
        totalValue.toFixed(8),
        bot.id
      ]);

      await client.query('COMMIT');

      console.log(
        `🤖 BOT ORDER v2: ${bot.symbol}` +
        ` | bot=${bot.id}` +
        ` | ${side.toUpperCase()} ${q.toFixed(qtyDp)} @ ${p.toFixed(priceDp)}` +
        ` | value=${totalValue.toFixed(8)} ${bot.quote_symbol}` +
        ` | locked=${requiredAmount.toFixed(8)}`
      );

      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`placeBotOrder error: ${bot.symbol} ${side}:`, err.message);
      return false;
    } finally {
      client.release();
    }
  }
}

const marketMaker = new MarketMaker();
module.exports = marketMaker;
