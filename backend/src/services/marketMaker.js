const db = require('../config/database');

class MarketMaker {
  constructor() {
    this.running = false;
    this.interval = null;
    this.botUserId = null;
    this.activeBots = {}; // botId → timeout
  }

  async init() {
    try {
      // Get bot user ID
      const botUser = await db.query(
        "SELECT id FROM users WHERE email = 'bot@vdexchange.internal'"
      );
      if (!botUser.rows[0]) {
        console.error('❌ Bot user not found!');
        return;
      }
      this.botUserId = botUser.rows[0].id;
      console.log(`🤖 MarketMaker initialized | Bot User ID: ${this.botUserId}`);
    } catch (err) {
      console.error('MarketMaker init error:', err.message);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;

    // Check for active bots every 30 seconds
    this.interval = setInterval(() => {
      this.syncActiveBots().catch(e =>
        console.error('MarketMaker sync error:', e.message)
      );
    }, 30000);

    // Initial load after 10 sec
    setTimeout(() => this.syncActiveBots().catch(() => {}), 10000);

    console.log('🤖 MarketMaker started');
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    // Stop all active bots
    Object.values(this.activeBots).forEach(t => clearTimeout(t));
    this.activeBots = {};
  }

  async syncActiveBots() {
    try {
      // Load all active bots from DB
      const bots = await db.query(`
        SELECT mmb.*, tp.symbol, tp.base_coin_id, tp.quote_coin_id,
               bc.symbol as base_symbol, qc.symbol as quote_symbol,
               p.price_usdt as current_price
        FROM market_making_bots mmb
        JOIN trading_pairs tp ON tp.id = mmb.pair_id
        JOIN coins bc ON bc.id = tp.base_coin_id
        JOIN coins qc ON qc.id = tp.quote_coin_id
        LEFT JOIN price_feeds p ON p.coin_id = bc.id
        WHERE mmb.is_active = true
      `);

      // Schedule each bot
      for (const bot of bots.rows) {
        if (!this.activeBots[bot.id]) {
          this.scheduleBotRun(bot);
        }
      }

      // Stop removed bots
      const activeBotIds = bots.rows.map(b => b.id);
      for (const botId of Object.keys(this.activeBots)) {
        if (!activeBotIds.includes(parseInt(botId))) {
          clearTimeout(this.activeBots[botId]);
          delete this.activeBots[botId];
          console.log(`🛑 Bot ${botId} stopped`);
        }
      }
    } catch (err) {
      console.error('syncActiveBots error:', err.message);
    }
  }

  scheduleBotRun(bot) {
    // Random interval between min and max seconds
    const intervalSec = Math.floor(
      Math.random() * (bot.interval_max - bot.interval_min) + bot.interval_min
    );

    this.activeBots[bot.id] = setTimeout(async () => {
      delete this.activeBots[bot.id];

      // Re-check if still active
      const check = await db.query(
        'SELECT is_active FROM market_making_bots WHERE id = $1', [bot.id]
      ).catch(() => null);

      if (check?.rows[0]?.is_active) {
        await this.runBot(bot).catch(e =>
          console.error(`Bot ${bot.id} run error:`, e.message)
        );
        // Reload fresh bot config and reschedule
        const fresh = await db.query(`
          SELECT mmb.*, tp.symbol, tp.base_coin_id, tp.quote_coin_id,
                 bc.symbol as base_symbol, qc.symbol as quote_symbol,
                 p.price_usdt as current_price
          FROM market_making_bots mmb
          JOIN trading_pairs tp ON tp.id = mmb.pair_id
          JOIN coins bc ON bc.id = tp.base_coin_id
          JOIN coins qc ON qc.id = tp.quote_coin_id
          LEFT JOIN price_feeds p ON p.coin_id = bc.id
          WHERE mmb.id = $1 AND mmb.is_active = true
        `, [bot.id]).catch(() => null);

        if (fresh?.rows[0]) {
          this.scheduleBotRun(fresh.rows[0]);
        }
      }
    }, intervalSec * 1000);
  }

  async runBot(bot) {
    if (!this.botUserId) return;

    const currentPrice = parseFloat(bot.current_price || 0);
    if (currentPrice <= 0) {
      console.log(`⚠️ Bot ${bot.id}: No price for ${bot.symbol}`);
      return;
    }

    const minPrice = parseFloat(bot.min_price);
    const maxPrice = parseFloat(bot.max_price);
    const spreadPct = parseFloat(bot.spread_pct || 2) / 100;

    // Random quantity
    const qtyMin = parseFloat(bot.order_qty_min || 1);
    const qtyMax = parseFloat(bot.order_qty_max || 10);
    const qty = parseFloat((Math.random() * (qtyMax - qtyMin) + qtyMin).toFixed(6));

    // Price within range with spread
    const midPrice = Math.min(Math.max(currentPrice, minPrice), maxPrice);
    const spread = midPrice * spreadPct;

    const buyPrice = parseFloat((midPrice - spread / 2).toFixed(8));
    const sellPrice = parseFloat((midPrice + spread / 2).toFixed(8));

    // Check budget
    const usedUsdt = parseFloat(bot.used_usdt || 0);
    const usedToken = parseFloat(bot.used_token || 0);
    const budgetUsdt = parseFloat(bot.total_usdt_budget || 999999);
    const budgetToken = parseFloat(bot.total_token_budget || 999999);

    if (usedUsdt >= budgetUsdt || usedToken >= budgetToken) {
      console.log(`⚠️ Bot ${bot.id}: Budget exhausted for ${bot.symbol}`);
      return;
    }

    // Decide: place buy, sell, or both
    const action = Math.random();

    if (action < 0.4) {
      // Place buy order
      await this.placeBotOrder(bot, 'buy', buyPrice, qty);
    } else if (action < 0.8) {
      // Place sell order
      await this.placeBotOrder(bot, 'sell', sellPrice, qty);
    } else {
      // Place both (creates immediate match = trade volume)
      await this.placeBotOrder(bot, 'buy', buyPrice, qty);
      await this.placeBotOrder(bot, 'sell', sellPrice, qty * 0.9);
    }
  }

  async placeBotOrder(bot, side, price, quantity) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure bot has balance
      const coinId = side === 'buy' ? bot.quote_coin_id : bot.base_coin_id;
      const requiredAmt = side === 'buy' ? price * quantity : quantity;

      // Upsert bot balance (bot has infinite virtual balance)
      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1, $2, 'spot', $3, 0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = GREATEST(balances.available, $3)
      `, [this.botUserId, coinId, requiredAmt * 10]); // Give 10x buffer

      // Lock balance
      await client.query(`
        UPDATE balances SET
          available = available - $1,
          locked = locked + $1
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [requiredAmt, this.botUserId, coinId]);

      // Create order
      const orderId = 'BOT' + Date.now() + Math.random().toString(36).substr(2,4).toUpperCase();
      const totalValue = price * quantity;

      await client.query(`
        INSERT INTO orders
          (order_id, user_id, pair_id, side, order_type, price,
           quantity, remaining_qty, total_value, status, created_at)
        VALUES ($1,$2,$3,$4,'limit',$5,$6,$6,$7,'open',NOW())
      `, [orderId, this.botUserId, bot.pair_id, side, price, quantity, totalValue]);

      // Update bot usage
      await client.query(`
        UPDATE market_making_bots SET
          used_usdt = used_usdt + $1,
          used_token = used_token + $2,
          updated_at = NOW()
        WHERE id = $3
      `, [
        side === 'buy' ? totalValue : 0,
        side === 'sell' ? quantity : 0,
        bot.id
      ]);

      await client.query('COMMIT');

      console.log(`🤖 BOT ORDER: ${bot.symbol} ${side.toUpperCase()} ${quantity} @ ${price}`);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`placeBotOrder error: ${bot.symbol} ${side}:`, err.message);
    } finally {
      client.release();
    }
  }
}

const marketMaker = new MarketMaker();
module.exports = marketMaker;
