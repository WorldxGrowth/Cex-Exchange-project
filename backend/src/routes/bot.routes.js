const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { success, error } = require('../utils/response');

// GET all bots with stats
router.get('/', async (req, res) => {
  try {
    const bots = await db.query(`
      SELECT b.*,
        tp.symbol as pair_symbol,
        bc.symbol as base_symbol,
        qc.symbol as quote_symbol,
        u.email as owner_email,
        bu.email as bot_email,
        -- open orders count
        (SELECT COUNT(*) FROM orders o 
         WHERE o.bot_id = b.id AND o.status IN ('open','partially_filled')) as open_orders,
        (SELECT COUNT(*) FROM orders o 
         WHERE o.bot_id = b.id AND o.side='buy' AND o.status IN ('open','partially_filled')) as open_buy_orders,
        (SELECT COUNT(*) FROM orders o 
         WHERE o.bot_id = b.id AND o.side='sell' AND o.status IN ('open','partially_filled')) as open_sell_orders,
        -- bot balances
        (SELECT available FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.base_coin_id AND account_type='spot') as bot_token_available,
        (SELECT locked FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.base_coin_id AND account_type='spot') as bot_token_locked,
        (SELECT available FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.quote_coin_id AND account_type='spot') as bot_usdt_available,
        (SELECT locked FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.quote_coin_id AND account_type='spot') as bot_usdt_locked,
        -- today trades
        (SELECT COUNT(*) FROM trades t 
         WHERE (t.buyer_id = b.bot_user_id OR t.seller_id = b.bot_user_id)
         AND t.pair_id = b.pair_id
         AND t.created_at > CURRENT_DATE) as today_trades,
        (SELECT COALESCE(SUM(t.total_value),0) FROM trades t 
         WHERE (t.buyer_id = b.bot_user_id OR t.seller_id = b.bot_user_id)
         AND t.pair_id = b.pair_id
         AND t.created_at > CURRENT_DATE) as today_volume
      FROM market_making_bots b
      JOIN trading_pairs tp ON tp.id = b.pair_id
      JOIN coins bc ON bc.id = tp.base_coin_id
      JOIN coins qc ON qc.id = tp.quote_coin_id
      LEFT JOIN users u ON u.id = b.owner_user_id
      LEFT JOIN users bu ON bu.id = b.bot_user_id
      ORDER BY b.id DESC
    `);
    return success(res, bots.rows);
  } catch (err) {
    console.error(err);
    return error(res, 'Failed', 500);
  }
});

// GET single bot
router.get('/:id', async (req, res) => {
  try {
    const bot = await db.query(`
      SELECT b.*, tp.symbol as pair_symbol,
        bc.symbol as base_symbol, qc.symbol as quote_symbol,
        u.email as owner_email, bu.email as bot_email,
        (SELECT available FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.base_coin_id AND account_type='spot') as bot_token_available,
        (SELECT available FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.quote_coin_id AND account_type='spot') as bot_usdt_available,
        (SELECT locked FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.base_coin_id AND account_type='spot') as bot_token_locked,
        (SELECT locked FROM balances WHERE user_id = b.bot_user_id 
         AND coin_id = tp.quote_coin_id AND account_type='spot') as bot_usdt_locked
      FROM market_making_bots b
      JOIN trading_pairs tp ON tp.id = b.pair_id
      JOIN coins bc ON bc.id = tp.base_coin_id
      JOIN coins qc ON qc.id = tp.quote_coin_id
      LEFT JOIN users u ON u.id = b.owner_user_id
      LEFT JOIN users bu ON bu.id = b.bot_user_id
      WHERE b.id = $1
    `, [req.params.id]);
    if (!bot.rows[0]) return error(res, 'Bot not found', 404);
    return success(res, bot.rows[0]);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
});

// CREATE bot
router.post('/', async (req, res) => {
  try {
    const {
      pair_id, owner_user_id, bot_user_id, is_active = false,
      strategy = 'spread', mode = 'liquidity_only',
      min_price, max_price, target_price, spread_pct = 2,
      price_random_pct = 0.5, qty_random_pct = 0.5,
      order_qty_min = 10, order_qty_max = 20,
      interval_min = 30, interval_max = 60,
      max_open_orders = 12, max_open_buy_orders = 6, max_open_sell_orders = 6,
      order_lifetime_sec = 1800, daily_volume_limit = 0, daily_order_limit = 1000,
      total_token_budget = 0, total_usdt_budget = 0,
      allow_buy = true, allow_sell = true,
      min_balance_usdt = 0, min_balance_token = 0,
      max_single_order_usdt = 0, pause_on_low_balance = false,
      pause_on_price_outside_range = false, expires_at, notes
    } = req.body;

    const result = await db.query(`
      INSERT INTO market_making_bots (
        pair_id, owner_user_id, bot_user_id, is_active,
        strategy, mode, min_price, max_price, target_price,
        spread_pct, price_random_pct, qty_random_pct,
        order_qty_min, order_qty_max, interval_min, interval_max,
        max_open_orders, max_open_buy_orders, max_open_sell_orders,
        order_lifetime_sec, daily_volume_limit, daily_order_limit,
        total_token_budget, total_usdt_budget,
        allow_buy, allow_sell, min_balance_usdt, min_balance_token,
        max_single_order_usdt, pause_on_low_balance,
        pause_on_price_outside_range, expires_at, notes,
        used_token, used_usdt, used_volume_today, used_orders_today,
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,0,0,0,0,NOW(),NOW()
      ) RETURNING *
    `, [pair_id, owner_user_id, bot_user_id, is_active,
        strategy, mode, min_price, max_price, target_price,
        spread_pct, price_random_pct, qty_random_pct,
        order_qty_min, order_qty_max, interval_min, interval_max,
        max_open_orders, max_open_buy_orders, max_open_sell_orders,
        order_lifetime_sec, daily_volume_limit, daily_order_limit,
        total_token_budget, total_usdt_budget,
        allow_buy, allow_sell, min_balance_usdt, min_balance_token,
        max_single_order_usdt, pause_on_low_balance,
        pause_on_price_outside_range, expires_at, notes]);

    return success(res, result.rows[0]);
  } catch (err) {
    console.error(err);
    return error(res, err.message, 500);
  }
});

// UPDATE bot
router.put('/:id', async (req, res) => {
  try {
    const fields = [
      'is_active','strategy','mode','min_price','max_price','target_price',
      'spread_pct','price_random_pct','qty_random_pct',
      'order_qty_min','order_qty_max','interval_min','interval_max',
      'max_open_orders','max_open_buy_orders','max_open_sell_orders',
      'order_lifetime_sec','daily_volume_limit','daily_order_limit',
      'total_token_budget','total_usdt_budget',
      'allow_buy','allow_sell','min_balance_usdt','min_balance_token',
      'max_single_order_usdt','pause_on_low_balance',
      'pause_on_price_outside_range','expires_at','notes'
    ];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        values.push(req.body[f]);
      }
    }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    await db.query(
      `UPDATE market_making_bots SET ${updates.join(',')} WHERE id = $${idx}`,
      values
    );

    // Reload bot in marketMaker service
    try {
      const marketMaker = require('../services/marketMaker');
      if (req.body.is_active === true) {
        await marketMaker.loadBot(parseInt(req.params.id));
      }
    } catch(e) {}

    return success(res, { message: 'Bot updated' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// TOGGLE bot active
router.post('/:id/toggle', async (req, res) => {
  try {
    const bot = await db.query(
      'SELECT is_active FROM market_making_bots WHERE id = $1', [req.params.id]
    );
    if (!bot.rows[0]) return error(res, 'Bot not found', 404);
    const newStatus = !bot.rows[0].is_active;
    await db.query(
      'UPDATE market_making_bots SET is_active=$1, updated_at=NOW() WHERE id=$2',
      [newStatus, req.params.id]
    );
    return success(res, { is_active: newStatus });
  } catch (err) {
    return error(res, 'Failed', 500);
  }
});

// CANCEL all bot orders
router.post('/:id/cancel-orders', async (req, res) => {
  try {
    const bot = await db.query(
      'SELECT bot_user_id, pair_id FROM market_making_bots WHERE id=$1',
      [req.params.id]
    );
    if (!bot.rows[0]) return error(res, 'Not found', 404);
    const { bot_user_id, pair_id } = bot.rows[0];

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Get open orders
      const orders = await client.query(`
        SELECT id, remaining_qty, price, side,
               tp.base_coin_id, tp.quote_coin_id
        FROM orders o
        JOIN trading_pairs tp ON tp.id = o.pair_id
        WHERE o.bot_id = $1 AND o.status IN ('open','partially_filled')
        FOR UPDATE
      `, [req.params.id]);

      for (const o of orders.rows) {
        const refundCoin = o.side === 'buy' ? o.quote_coin_id : o.base_coin_id;
        const refundAmt = o.side === 'buy'
          ? parseFloat(o.remaining_qty) * parseFloat(o.price)
          : parseFloat(o.remaining_qty);

        await client.query(`
          UPDATE balances SET available = available + $1, locked = locked - $1
          WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
        `, [refundAmt, bot_user_id, refundCoin]);

        await client.query(
          `UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
          [o.id]
        );
      }
      await client.query('COMMIT');
      return success(res, { cancelled: orders.rows.length });
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// RESET daily counters
router.post('/:id/reset-daily', async (req, res) => {
  try {
    await db.query(`
      UPDATE market_making_bots
      SET used_volume_today=0, used_orders_today=0,
          last_reset_date=CURRENT_DATE, updated_at=NOW()
      WHERE id=$1
    `, [req.params.id]);
    return success(res, { message: 'Daily counters reset' });
  } catch (err) {
    return error(res, 'Failed', 500);
  }
});

// ALLOCATE balance to bot
router.post('/:id/allocate', async (req, res) => {
  try {
    const { coin_id, amount, action = 'add' } = req.body;
    const bot = await db.query(
      'SELECT bot_user_id FROM market_making_bots WHERE id=$1', [req.params.id]
    );
    if (!bot.rows[0]) return error(res, 'Not found', 404);
    const { bot_user_id } = bot.rows[0];

    if (action === 'add') {
      await db.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1,$2,'spot',$3,0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at=NOW()
      `, [bot_user_id, coin_id, amount]);
    } else {
      await db.query(`
        UPDATE balances SET available = GREATEST(0, available - $1), updated_at=NOW()
        WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
      `, [amount, bot_user_id, coin_id]);
    }
    return success(res, { message: 'Balance updated' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// GET bot orders
router.get('/:id/orders', async (req, res) => {
  try {
    const { status, side, page = 1, limit = 50 } = req.query;
    let q = `
      SELECT o.*, tp.symbol as pair_symbol
      FROM orders o
      JOIN trading_pairs tp ON tp.id = o.pair_id
      WHERE o.bot_id = $1
    `;
    const params = [req.params.id];
    let idx = 2;
    if (status) { q += ` AND o.status = $${idx++}`; params.push(status); }
    if (side)   { q += ` AND o.side = $${idx++}`;   params.push(side); }
    q += ` ORDER BY o.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, (page - 1) * limit);

    const orders = await db.query(q, params);
    return success(res, orders.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
});

// GET bot trades
router.get('/:id/trades', async (req, res) => {
  try {
    const bot = await db.query(
      'SELECT bot_user_id, pair_id FROM market_making_bots WHERE id=$1',
      [req.params.id]
    );
    if (!bot.rows[0]) return error(res, 'Not found', 404);
    const { bot_user_id, pair_id } = bot.rows[0];

    const trades = await db.query(`
      SELECT t.*, tp.symbol as pair_symbol,
        CASE WHEN t.buyer_id = $1 THEN 'buy' ELSE 'sell' END as bot_side
      FROM trades t
      JOIN trading_pairs tp ON tp.id = t.pair_id
      WHERE (t.buyer_id = $1 OR t.seller_id = $1)
        AND t.pair_id = $2
      ORDER BY t.created_at DESC LIMIT 100
    `, [bot_user_id, pair_id]);
    return success(res, trades.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
});

// MANUAL bot order
router.post('/:id/manual-order', async (req, res) => {
  try {
    const { side, price, quantity } = req.body;
    const bot = await db.query(`
      SELECT b.*, tp.base_coin_id, tp.quote_coin_id
      FROM market_making_bots b
      JOIN trading_pairs tp ON tp.id = b.pair_id
      WHERE b.id = $1
    `, [req.params.id]);
    if (!bot.rows[0]) return error(res, 'Bot not found', 404);
    const b = bot.rows[0];

    const lockCoin = side === 'buy' ? b.quote_coin_id : b.base_coin_id;
    const lockAmt  = side === 'buy'
      ? parseFloat(price) * parseFloat(quantity)
      : parseFloat(quantity);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const balCheck = await client.query(`
        SELECT available FROM balances
        WHERE user_id=$1 AND coin_id=$2 AND account_type='spot' FOR UPDATE
      `, [b.bot_user_id, lockCoin]);

      if (!balCheck.rows[0] || parseFloat(balCheck.rows[0].available) < lockAmt) {
        await client.query('ROLLBACK');
        return error(res, 'Insufficient bot balance', 400);
      }

      await client.query(`
        UPDATE balances SET available=available-$1, locked=locked+$1
        WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
      `, [lockAmt, b.bot_user_id, lockCoin]);

      const orderId = `BOT-MANUAL-${Date.now()}`;
      await client.query(`
        INSERT INTO orders (
          order_id, user_id, pair_id, side, order_type, price, quantity,
          remaining_qty, total_value, status, source, is_bot_order, bot_id,
          time_in_force, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,'limit',$5,$6,$6,$7,'open','bot',true,$8,'GTC',NOW(),NOW())
      `, [orderId, b.bot_user_id, b.pair_id, side, price, quantity,
          parseFloat(price) * parseFloat(quantity), b.id]);

      await client.query('COMMIT');
      return success(res, { order_id: orderId, message: 'Manual bot order placed' });
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// Dashboard stats
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_bots,
        COUNT(*) FILTER (WHERE is_active=true) as active_bots,
        COUNT(*) FILTER (WHERE is_active=false) as paused_bots,
        COUNT(*) FILTER (WHERE expires_at < NOW() AND expires_at IS NOT NULL) as expired_bots
      FROM market_making_bots
    `);
    const orders = await db.query(`
      SELECT COUNT(*) as total_open_bot_orders
      FROM orders WHERE is_bot_order=true AND status IN ('open','partially_filled')
    `);
    const today = await db.query(`
      SELECT COUNT(*) as today_trades,
             COALESCE(SUM(total_value),0) as today_volume
      FROM trades
      WHERE created_at > CURRENT_DATE
    `);
    return success(res, {
      ...stats.rows[0],
      ...orders.rows[0],
      ...today.rows[0]
    });
  } catch (err) {
    return error(res, 'Failed', 500);
  }
});

module.exports = router;
