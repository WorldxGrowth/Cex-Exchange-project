const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { success, error } = require('../utils/response');
const { generateTokens } = require('../utils/jwt');

// Email helper - always safe
const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('../services/email/emailService');
    await emailService[fn](...args);
  } catch (e) {
    console.error(`Email ${fn} failed:`, e.message);
  }
};

// ================================
// ADMIN AUTH
// ================================
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password required');

    const admin = await db.query(
      'SELECT * FROM admin_users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    if (!admin.rows[0]) return error(res, 'Invalid credentials');

    if (admin.rows[0].password_hash === '$2a$12$placeholder_will_be_set_via_api') {
      const newHash = await bcrypt.hash(password, 12);
      await db.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2',
        [newHash, admin.rows[0].id]);
      const { accessToken } = generateTokens(admin.rows[0].id);
      return success(res, {
        access_token: accessToken,
        admin: { email: admin.rows[0].email, role: admin.rows[0].role },
        message: 'Password set successfully'
      }, 'Admin login successful');
    }

    const isValid = await bcrypt.compare(password, admin.rows[0].password_hash);
    if (!isValid) return error(res, 'Invalid credentials');

    await db.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.rows[0].id]);
    const { accessToken } = generateTokens(admin.rows[0].id);

    return success(res, {
      access_token: accessToken,
      admin: { id: admin.rows[0].id, email: admin.rows[0].email, role: admin.rows[0].role }
    }, 'Admin login successful');
  } catch (err) {
    return error(res, 'Login failed', 500);
  }
};

// ================================
// DASHBOARD STATS (upgraded)
// ================================
const getDashboard = async (req, res) => {
  try {
    const [users, orders, trades, deposits, withdrawals, listings,
           userGrowth, depositVolume, withdrawVolume, coinDist,
           treasuryBal, feeToday, spreadToday] = await Promise.all([
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > NOW()-INTERVAL '24h' THEN 1 END) as today FROM users WHERE uid != 'TREASURY001'"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='open' THEN 1 END) as open FROM orders"),
      db.query("SELECT COUNT(*) as total, COALESCE(SUM(total_value),0) as volume FROM trades WHERE created_at > NOW()-INTERVAL '24h'"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='pending' THEN 1 END) as pending FROM deposits"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='pending' THEN 1 END) as pending FROM withdrawals"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='pending' THEN 1 END) as pending FROM token_listings"),
      db.query(`SELECT TO_CHAR(DATE(created_at), 'Mon DD') as date, COUNT(*) as count
        FROM users WHERE created_at > NOW() - INTERVAL '7 days' AND uid != 'TREASURY001'
        GROUP BY DATE(created_at) ORDER BY DATE(created_at)`),
      db.query(`SELECT TO_CHAR(DATE(created_at), 'Mon DD') as date, COALESCE(SUM(amount), 0) as total
        FROM deposits WHERE created_at > NOW() - INTERVAL '7 days' AND status = 'completed'
        GROUP BY DATE(created_at) ORDER BY DATE(created_at)`),
      db.query(`SELECT TO_CHAR(DATE(created_at), 'Mon DD') as date, COALESCE(SUM(amount), 0) as total
        FROM withdrawals WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) ORDER BY DATE(created_at)`),
      db.query(`SELECT c.symbol, COUNT(d.id) as count FROM deposits d
        JOIN coins c ON c.id = d.coin_id WHERE d.status = 'completed'
        GROUP BY c.symbol ORDER BY count DESC LIMIT 5`),
      // Treasury balances
      db.query(`SELECT c.symbol, b.available
        FROM balances b JOIN coins c ON c.id=b.coin_id
        JOIN users u ON u.id=b.user_id
        WHERE u.uid='TREASURY001' ORDER BY b.available DESC`),
      // Fee income today
      db.query(`SELECT c.symbol, COALESCE(SUM(l.amount),0) as fee_today
        FROM ledger l JOIN coins c ON c.id=l.coin_id
        WHERE l.type='trading_fee' AND DATE(l.created_at)=CURRENT_DATE
        GROUP BY c.symbol ORDER BY fee_today DESC`),
      // Spread profit today
      db.query(`SELECT COALESCE(SUM(profit_usdt),0) as spread_today,
                       COALESCE(SUM(trading_fee_usdt),0) as fee_today,
                       COALESCE(SUM(net_profit_usdt),0) as net_today
        FROM mirror_profits WHERE DATE(created_at)=CURRENT_DATE`),
    ]);

    const allDates = new Set([
      ...depositVolume.rows.map(r => r.date),
      ...withdrawVolume.rows.map(r => r.date)
    ]);
    const volumeChart = Array.from(allDates).sort().map(date => ({
      date,
      deposit:  parseFloat(depositVolume.rows.find(r => r.date === date)?.total || 0),
      withdraw: parseFloat(withdrawVolume.rows.find(r => r.date === date)?.total || 0),
    }));

    return success(res, {
      users:       { total: users.rows[0].total, today: users.rows[0].today },
      orders:      { total: orders.rows[0].total, open: orders.rows[0].open },
      trades_24h:  { count: trades.rows[0].total, volume: trades.rows[0].volume },
      deposits:    { total: deposits.rows[0].total, pending: deposits.rows[0].pending },
      withdrawals: { total: withdrawals.rows[0].total, pending: withdrawals.rows[0].pending },
      listings:    { total: listings.rows[0].total, pending: listings.rows[0].pending },
      treasury:    treasuryBal.rows,
      income_today: {
        fees:   feeToday.rows,
        spread: parseFloat(spreadToday.rows[0]?.spread_today || 0),
        net:    parseFloat(spreadToday.rows[0]?.net_today || 0),
      },
      charts: {
        user_growth: userGrowth.rows.map(r => ({ date: r.date, users: parseInt(r.count) })),
        volume: volumeChart,
        coin_dist: coinDist.rows.map(r => ({ name: r.symbol, value: parseInt(r.count) })),
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    return error(res, 'Failed to get dashboard', 500);
  }
};

// ================================
// USER MANAGEMENT (existing - unchanged)
// ================================
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, kyc_level } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT id, uid, email, phone, status, kyc_level, vip_level,
             referral_code, email_verified, created_at, last_login_at
      FROM users WHERE uid != 'TREASURY001'`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (email ILIKE $${params.length} OR uid ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }
    if (status)     { params.push(status);     query += ` AND status = $${params.length}`; }
    if (kyc_level !== undefined) { params.push(kyc_level); query += ` AND kyc_level = $${params.length}`; }

    const countQ = `SELECT COUNT(*) FROM users WHERE uid != 'TREASURY001'` +
      (params.length ? query.split('TREASURY001\'')[1] : '');
    const countResult = await db.query(countQ.split('ORDER BY')[0], params);

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`;

    const users = await db.query(query, params);
    return success(res, { users: users.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    return error(res, 'Failed to get users', 500);
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active','suspended','banned'].includes(status))
      return error(res, 'Invalid status');
    await db.query('UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2', [status, id]);
    return success(res, {}, `User ${status} successfully`);
  } catch (err) { return error(res, 'Failed to update user', 500); }
};

// ── NEW: Update user VIP level ─────────────────
const updateUserVip = async (req, res) => {
  try {
    const { id } = req.params;
    const { vip_level } = req.body;
    if (vip_level === undefined) return error(res, 'vip_level required');
    const oldUser = await db.query('SELECT vip_level FROM users WHERE id=$1', [id]);
    await db.query('UPDATE users SET vip_level=$1, updated_at=NOW() WHERE id=$2', [vip_level, id]);
    await db.query(`INSERT INTO vip_history (user_id,from_level,to_level,reason)
      VALUES ($1,$2,$3,'admin_override')`,
      [id, oldUser.rows[0]?.vip_level || 0, vip_level]).catch(()=>{});
    return success(res, {}, 'VIP level updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

const approveKYC = async (req, res) => {
  try {
    const { kyc_id } = req.params;
    const { action, rejection_reason } = req.body;
    if (!['approved','rejected'].includes(action))
      return error(res, 'action must be approved or rejected');
    const kyc = await db.query('SELECT * FROM kyc_verifications WHERE id=$1', [kyc_id]);
    if (!kyc.rows[0]) return error(res, 'KYC not found');
    await db.query(`UPDATE kyc_verifications SET status=$1, rejection_reason=$2,
      reviewed_by=$3, reviewed_at=NOW() WHERE id=$4`,
      [action, rejection_reason || null, req.adminId, kyc_id]);
    if (action === 'approved') {
      await db.query('UPDATE users SET kyc_level=$1 WHERE id=$2',
        [kyc.rows[0].level || 1, kyc.rows[0].user_id]);
    }
    const userRes = await db.query('SELECT email FROM users WHERE id=$1', [kyc.rows[0].user_id]);
    if (userRes.rows[0]) sendEmailSafe('sendKYCEmail', userRes.rows[0], action, rejection_reason);
    return success(res, {}, `KYC ${action} successfully`);
  } catch (err) { return error(res, 'Failed to update KYC', 500); }
};

// ================================
// COIN MANAGEMENT (upgraded)
// ================================
const getCoinsAdmin = async (req, res) => {
  try {
    const coins = await db.query(`
      SELECT c.*, n.name as network_name, p.price_usdt
      FROM coins c
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN price_feeds p ON p.coin_id = c.id
      ORDER BY c.sort_order, c.id
    `);
    return success(res, coins.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const addCoin = async (req, res) => {
  try {
    const { symbol, name, logo_url, coin_type, contract_address,
            decimals, network_id, min_deposit, min_withdraw,
            withdraw_fee, confirmations, price_source, price_symbol } = req.body;

    if (!symbol || !name || !network_id)
      return error(res, 'symbol, name, network_id required');

    const coin = await db.query(`
      INSERT INTO coins (symbol, name, logo_url, coin_type, contract_address,
        decimals, network_id, min_deposit, min_withdraw, withdraw_fee,
        confirmations, price_source, price_symbol,
        deposit_enabled_at, withdraw_enabled_at, trade_enabled_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW(),NOW()) RETURNING *
    `, [symbol.toUpperCase(), name, logo_url, coin_type || 'erc20',
        contract_address, decimals || 18, network_id,
        min_deposit || 0, min_withdraw || 0, withdraw_fee || 0,
        confirmations || 12, price_source || 'binance', price_symbol]);

    return success(res, coin.rows[0], 'Coin added successfully', 201);
  } catch (err) { return error(res, 'Failed to add coin: ' + err.message, 500); }
};

// ── UPGRADED: updateCoin with all new columns ──
const updateCoin = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    // All allowed fields including new Phase 1 columns
    const allowed = [
      // Basic
      'name', 'logo_url', 'is_active', 'is_deposit', 'is_withdraw', 'is_tradeable',
      'min_deposit', 'min_withdraw', 'withdraw_fee', 'withdraw_fee_type',
      'price_source', 'price_symbol', 'sort_order', 'confirmations',
      // Phase 1: Coin controls
      'maintenance_mode',
      'deposit_enabled_at', 'deposit_disabled_reason', 'deposit_notice',
      'withdraw_enabled_at', 'withdraw_disabled_reason', 'withdraw_notice',
      'trade_enabled_at', 'trade_disabled_reason', 'trade_notice',
      // Token info
      'contract_address', 'decimals'
    ];

    const updates = [];
    const values = [];
    let i = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = $${i++}`);
        values.push(val);
      }
    }

    if (updates.length === 0) return error(res, 'No valid fields to update');

    values.push(id);
    const result = await db.query(
      `UPDATE coins SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return success(res, result.rows[0], 'Coin updated successfully');
  } catch (err) { return error(res, 'Failed to update coin: ' + err.message, 500); }
};

// ================================
// TRADING PAIRS MANAGEMENT (upgraded)
// ================================
const getTradingPairs = async (req, res) => {
  try {
    const pairs = await db.query(`
      SELECT tp.*, cb.symbol as base_symbol, cq.symbol as quote_symbol,
             cb.name as base_name, cb.logo_url as base_logo,
             cb.maintenance_mode as base_maintenance
      FROM trading_pairs tp
      JOIN coins cb ON cb.id = tp.base_coin_id
      JOIN coins cq ON cq.id = tp.quote_coin_id
      ORDER BY tp.sort_order, tp.id
    `);
    return success(res, pairs.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const addTradingPair = async (req, res) => {
  try {
    const { base_coin_id, quote_coin_id, maker_fee, taker_fee,
            min_order_qty, min_order_value, listing_date,
            is_custom, binance_symbol, pre_listing_mode, show_countdown,
            trading_enabled_at, trading_notice } = req.body;

    const base  = await db.query('SELECT symbol FROM coins WHERE id=$1', [base_coin_id]);
    const quote = await db.query('SELECT symbol FROM coins WHERE id=$1', [quote_coin_id]);
    if (!base.rows[0] || !quote.rows[0]) return error(res, 'Coins not found');

    const symbol = base.rows[0].symbol + quote.rows[0].symbol;
    const isActive = listing_date ? new Date(listing_date) <= new Date() : true;

    const pair = await db.query(`
      INSERT INTO trading_pairs
        (base_coin_id, quote_coin_id, symbol, maker_fee, taker_fee,
         min_order_qty, min_order_value, listing_date, is_active,
         is_custom, binance_symbol, pre_listing_mode, show_countdown,
         trading_enabled_at, trading_notice)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [base_coin_id, quote_coin_id, symbol,
        maker_fee || 0.001, taker_fee || 0.001,
        min_order_qty || 0.0001, min_order_value || 1,
        listing_date || new Date(), isActive,
        is_custom || false, binance_symbol || null,
        pre_listing_mode || false, show_countdown || false,
        trading_enabled_at || new Date(), trading_notice || null]);

    return success(res, pair.rows[0], 'Trading pair added', 201);
  } catch (err) { return error(res, 'Failed to add pair: ' + err.message, 500); }
};

// ── NEW: Update trading pair ───────────────────
const updateTradingPair = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const allowed = [
      'is_active', 'maker_fee', 'taker_fee',
      'min_order_qty', 'max_order_qty', 'min_order_value',
      'price_precision', 'qty_precision', 'sort_order',
      'is_custom', 'binance_symbol',
      // Phase 1: Pair controls
      'trading_enabled_at', 'trading_disabled_at', 'trading_notice',
      'pre_listing_mode', 'show_countdown'
    ];

    const updates = [];
    const values = [];
    let i = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = $${i++}`); values.push(val); }
    }

    if (updates.length === 0) return error(res, 'No valid fields to update');

    values.push(id);
    const result = await db.query(
      `UPDATE trading_pairs SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return success(res, result.rows[0], 'Trading pair updated');
  } catch (err) { return error(res, 'Failed: ' + err.message, 500); }
};

// ================================
// FEE RULES MANAGEMENT (NEW)
// ================================
const getFeeRules = async (req, res) => {
  try {
    const { pair_id, vip_level, rule_type } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (pair_id)   { params.push(pair_id);   where += ` AND fr.pair_id=$${params.length}`; }
    if (vip_level !== undefined) { params.push(vip_level); where += ` AND fr.vip_level=$${params.length}`; }
    if (rule_type) { params.push(rule_type); where += ` AND fr.rule_type=$${params.length}`; }

    const rules = await db.query(`
      SELECT fr.*, tp.symbol as pair_symbol
      FROM fee_rules fr
      LEFT JOIN trading_pairs tp ON tp.id = fr.pair_id
      ${where}
      ORDER BY fr.pair_id, fr.vip_level, fr.priority
    `, params);
    return success(res, rules.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const addFeeRule = async (req, res) => {
  try {
    const { rule_type, pair_id, vip_level, fee_type, fee_value,
            priority, starts_at, ends_at, title } = req.body;

    if (!rule_type || fee_value === undefined)
      return error(res, 'rule_type, fee_value required');

    const rule = await db.query(`
      INSERT INTO fee_rules
        (rule_type, pair_id, vip_level, fee_type, fee_value,
         is_active, priority, starts_at, ends_at, title)
      VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,$9) RETURNING *
    `, [rule_type, pair_id || null, vip_level || 0,
        fee_type || 'percentage', fee_value,
        priority || 100, starts_at || null, ends_at || null,
        title || null]);

    return success(res, rule.rows[0], 'Fee rule added', 201);
  } catch (err) { return error(res, 'Failed: ' + err.message, 500); }
};

const updateFeeRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { fee_value, is_active, priority, starts_at, ends_at, title } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (fee_value !== undefined) { updates.push(`fee_value=$${i++}`); values.push(fee_value); }
    if (is_active !== undefined) { updates.push(`is_active=$${i++}`); values.push(is_active); }
    if (priority !== undefined)  { updates.push(`priority=$${i++}`); values.push(priority); }
    if (starts_at !== undefined) { updates.push(`starts_at=$${i++}`); values.push(starts_at); }
    if (ends_at !== undefined)   { updates.push(`ends_at=$${i++}`);   values.push(ends_at); }
    if (title !== undefined)     { updates.push(`title=$${i++}`);     values.push(title); }

    if (updates.length === 0) return error(res, 'No fields to update');

    values.push(id);
    const result = await db.query(
      `UPDATE fee_rules SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      values
    );
    return success(res, result.rows[0], 'Fee rule updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

const deleteFeeRule = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM fee_rules WHERE id=$1', [id]);
    return success(res, {}, 'Fee rule deleted');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// VIP LEVELS MANAGEMENT (NEW)
// ================================
const getVipLevels = async (req, res) => {
  try {
    const levels = await db.query('SELECT * FROM vip_levels ORDER BY level');
    return success(res, levels.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const updateVipLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const { name, spot_maker_fee, spot_taker_fee,
            required_volume_30d, withdraw_limit_daily } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (name)                 { updates.push(`name=$${i++}`);                 values.push(name); }
    if (spot_maker_fee !== undefined) { updates.push(`spot_maker_fee=$${i++}`); values.push(spot_maker_fee); }
    if (spot_taker_fee !== undefined) { updates.push(`spot_taker_fee=$${i++}`); values.push(spot_taker_fee); }
    if (required_volume_30d !== undefined) { updates.push(`required_volume_30d=$${i++}`); values.push(required_volume_30d); }
    if (withdraw_limit_daily !== undefined) { updates.push(`withdraw_limit_daily=$${i++}`); values.push(withdraw_limit_daily); }

    if (updates.length === 0) return error(res, 'No fields to update');

    values.push(level);
    const result = await db.query(
      `UPDATE vip_levels SET ${updates.join(',')} WHERE level=$${i} RETURNING *`,
      values
    );
    return success(res, result.rows[0], 'VIP level updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// REPORTS (NEW)
// ================================
const getTreasuryReport = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const [balances, feeHistory, spreadHistory, topCoins] = await Promise.all([
      // Current treasury balances
      db.query(`
        SELECT c.symbol, b.available, b.locked,
               b.available * COALESCE(p.price_usdt,0) as usdt_value
        FROM balances b
        JOIN coins c ON c.id=b.coin_id
        JOIN users u ON u.id=b.user_id
        LEFT JOIN price_feeds p ON p.coin_id=b.coin_id
        WHERE u.uid='TREASURY001'
        ORDER BY usdt_value DESC
      `),
      // Fee income per day
      db.query(`
        SELECT DATE(l.created_at) as date,
               c.symbol,
               SUM(l.amount) as total_fee
        FROM ledger l
        JOIN coins c ON c.id=l.coin_id
        WHERE l.type='trading_fee'
          AND l.created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY DATE(l.created_at), c.symbol
        ORDER BY date DESC
      `),
      // Spread profit per day
      db.query(`
        SELECT DATE(created_at) as date,
               SUM(profit_usdt) as spread,
               SUM(trading_fee_usdt) as fee,
               SUM(net_profit_usdt) as net
        FROM mirror_profits
        WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `),
      // Top earning coins
      db.query(`
        SELECT c.symbol, SUM(l.amount) as total_fee
        FROM ledger l
        JOIN coins c ON c.id=l.coin_id
        WHERE l.type='trading_fee'
          AND l.created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY c.symbol
        ORDER BY total_fee DESC LIMIT 10
      `),
    ]);

    return success(res, {
      balances:      balances.rows,
      fee_history:   feeHistory.rows,
      spread_history: spreadHistory.rows,
      top_coins:     topCoins.rows,
    });
  } catch (err) { return error(res, 'Failed: ' + err.message, 500); }
};

const getVolumeReport = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const [daily, byPair, byUser] = await Promise.all([
      db.query(`
        SELECT DATE(created_at) as date,
               COUNT(*) as trades,
               SUM(total_value) as volume
        FROM trades
        WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY DATE(created_at) ORDER BY date DESC
      `),
      db.query(`
        SELECT tp.symbol,
               COUNT(*) as trades,
               SUM(t.total_value) as volume
        FROM trades t JOIN trading_pairs tp ON tp.id=t.pair_id
        WHERE t.created_at > NOW() - INTERVAL '${parseInt(days)} days'
        GROUP BY tp.symbol ORDER BY volume DESC LIMIT 10
      `),
      db.query(`
        SELECT u.email, u.uid,
               COUNT(*) as trades,
               SUM(t.total_value) as volume
        FROM trades t JOIN users u ON (u.id=t.buyer_id OR u.id=t.seller_id)
        WHERE t.created_at > NOW() - INTERVAL '${parseInt(days)} days'
          AND u.uid != 'TREASURY001'
        GROUP BY u.email, u.uid ORDER BY volume DESC LIMIT 20
      `),
    ]);

    return success(res, { daily: daily.rows, by_pair: byPair.rows, by_user: byUser.rows });
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// BINANCE CREDENTIALS (NEW)
// ================================
const getBinanceCredentials = async (req, res) => {
  try {
    const creds = await db.query(`
      SELECT id, label, LEFT(api_key,10) as api_key_preview,
             is_active, max_order_value, daily_exposure_limit,
             trading_enabled, created_at
      FROM binance_credentials ORDER BY id
    `);
    return success(res, creds.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const updateBinanceCredential = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, trading_enabled, max_order_value, daily_exposure_limit, label } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (is_active !== undefined)           { updates.push(`is_active=$${i++}`);           values.push(is_active); }
    if (trading_enabled !== undefined)     { updates.push(`trading_enabled=$${i++}`);     values.push(trading_enabled); }
    if (max_order_value !== undefined)     { updates.push(`max_order_value=$${i++}`);     values.push(max_order_value); }
    if (daily_exposure_limit !== undefined){ updates.push(`daily_exposure_limit=$${i++}`);values.push(daily_exposure_limit); }
    if (label !== undefined)               { updates.push(`label=$${i++}`);               values.push(label); }

    if (updates.length === 0) return error(res, 'No fields to update');

    updates.push(`updated_at=NOW()`);
    values.push(id);
    await db.query(`UPDATE binance_credentials SET ${updates.join(',')} WHERE id=$${i}`, values);
    return success(res, {}, 'Credential updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// WITHDRAWAL MANAGEMENT (existing - unchanged)
// ================================
const getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await db.query(`
      SELECT w.*, u.email, u.uid, c.symbol, n.name as network_name
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      JOIN coins c ON c.id = w.coin_id
      JOIN networks n ON n.id = w.network_id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC
    `);
    return success(res, withdrawals.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, txhash, admin_note } = req.body;
    if (!['approve','reject'].includes(action))
      return error(res, 'action must be approve or reject');

    const withdrawal = await db.query('SELECT * FROM withdrawals WHERE id=$1', [id]);
    if (!withdrawal.rows[0]) return error(res, 'Withdrawal not found');
    const w = withdrawal.rows[0];

    if (action === 'approve') {
      await db.query(`UPDATE withdrawals SET status='completed', txhash=$1,
        admin_note=$2, updated_at=NOW() WHERE id=$3`, [txhash, admin_note, id]);
      await db.query(`UPDATE balances SET locked = locked - $1
        WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'`,
        [w.amount, w.user_id, w.coin_id]);
    } else {
      await db.query(`UPDATE withdrawals SET status='cancelled',
        admin_note=$1, updated_at=NOW() WHERE id=$2`, [admin_note, id]);
      await db.query(`UPDATE balances SET available=available+$1, locked=locked-$1
        WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'`,
        [w.amount, w.user_id, w.coin_id]);
    }
    return success(res, {}, `Withdrawal ${action}d successfully`);
  } catch (err) { return error(res, 'Failed to process withdrawal', 500); }
};

// ================================
// TOKEN LISTING (existing - unchanged)
// ================================
const getListings = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT tl.*, u.email, u.uid, n.name as network_name
      FROM token_listings tl
      JOIN users u ON u.id = tl.applicant_user_id
      LEFT JOIN networks n ON n.id = tl.network_id`;
    const params = [];
    if (status) { params.push(status); query += ` WHERE tl.status = $1`; }
    query += ' ORDER BY tl.created_at DESC';
    const listings = await db.query(query, params);
    return success(res, listings.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const processListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_notes } = req.body;
    if (!['approve','reject'].includes(action))
      return error(res, 'action must be approve or reject');

    const listing = await db.query('SELECT * FROM token_listings WHERE id=$1', [id]);
    if (!listing.rows[0]) return error(res, 'Listing not found');
    const l = listing.rows[0];

    await db.query(`UPDATE token_listings SET status=$1, admin_notes=$2, updated_at=NOW() WHERE id=$3`,
      [action === 'approve' ? 'approved' : 'rejected', admin_notes, id]);

    if (action === 'approve') {
      const coin = await db.query(`
        INSERT INTO coins (symbol, name, logo_url, coin_type, contract_address,
          network_id, price_source, is_active, listed_at,
          deposit_enabled_at, withdraw_enabled_at, trade_enabled_at)
        VALUES ($1,$2,$3,'custom',$4,$5,'custom',true,NOW(),NOW(),NOW(),NOW())
        ON CONFLICT (symbol) DO UPDATE SET is_active=true RETURNING id
      `, [l.token_symbol, l.token_name, l.token_logo_url, l.contract_address, l.network_id]);

      const usdtCoin = await db.query("SELECT id FROM coins WHERE symbol='USDT'");
      const symbol = l.token_symbol + 'USDT';

      await db.query(`INSERT INTO trading_pairs
        (base_coin_id, quote_coin_id, symbol, is_active, listing_date, trading_enabled_at)
        VALUES ($1,$2,$3,true,$4,$5) ON CONFLICT (symbol) DO NOTHING`,
        [coin.rows[0].id, usdtCoin.rows[0].id, symbol,
         l.listing_date || new Date(), l.listing_date || new Date()]);

      if (l.initial_price) {
        await db.query(`INSERT INTO price_feeds (coin_id, price_usdt, source)
          VALUES ($1,$2,'custom') ON CONFLICT (coin_id) DO UPDATE SET price_usdt=$2`,
          [coin.rows[0].id, l.initial_price]);
      }
    }
    return success(res, {}, `Listing ${action}d successfully`);
  } catch (err) { return error(res, 'Failed: ' + err.message, 500); }
};

// ================================
// SYSTEM SETTINGS (existing - unchanged)
// ================================
const getSettings = async (req, res) => {
  try {
    const settings = await db.query(
      'SELECT key, value, type, category FROM system_settings ORDER BY category, key'
    );
    return success(res, settings.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await db.query(`UPDATE system_settings SET value=$1, updated_at=NOW() WHERE key=$2`, [value, key]);
    return success(res, {}, 'Setting updated');
  } catch (err) { return error(res, 'Failed to update setting', 500); }
};

// ── NEW: Add new setting ───────────────────────
const addSetting = async (req, res) => {
  try {
    const { key, value, type, category } = req.body;
    if (!key) return error(res, 'key required');
    await db.query(`INSERT INTO system_settings (key,value,type,category)
      VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, value, type || 'string', category || 'general']);
    return success(res, {}, 'Setting saved');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// BANNER / POPUP / ANNOUNCEMENT (existing - unchanged)
// ================================
const addBanner = async (req, res) => {
  try {
    const { title, image_url, link_url, link_type, position, platform, sort_order, starts_at, ends_at } = req.body;
    const banner = await db.query(`
      INSERT INTO banners (title,image_url,link_url,link_type,position,platform,sort_order,starts_at,ends_at,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [title, image_url, link_url, link_type||'external',
        position||'home_top', platform||'all', sort_order||0,
        starts_at, ends_at, req.adminId]);
    return success(res, banner.rows[0], 'Banner added', 201);
  } catch (err) { return error(res, 'Failed to add banner', 500); }
};

const addPopup = async (req, res) => {
  try {
    const { title, content, image_url, button_text, button_url, popup_type, platform, show_once, starts_at, ends_at } = req.body;
    const popup = await db.query(`
      INSERT INTO app_popups (title,content,image_url,button_text,button_url,popup_type,platform,show_once,starts_at,ends_at,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [title, content, image_url, button_text, button_url,
        popup_type||'announcement', platform||'all',
        show_once!==false, starts_at, ends_at, req.adminId]);
    return success(res, popup.rows[0], 'Popup added', 201);
  } catch (err) { return error(res, 'Failed to add popup', 500); }
};

const addAnnouncement = async (req, res) => {
  try {
    const { title, content, type, expires_at } = req.body;
    const ann = await db.query(`
      INSERT INTO announcements (title,content,type,is_published,published_at,expires_at,created_by)
      VALUES ($1,$2,$3,true,NOW(),$4,$5) RETURNING *
    `, [title, content, type||'system', expires_at, req.adminId]);
    return success(res, ann.rows[0], 'Announcement published', 201);
  } catch (err) { return error(res, 'Failed to add announcement', 500); }
};

// ================================
// EXTENDED ADMIN APIs (existing - unchanged)
// ================================
const getDeposits = async (req, res) => {
  try {
    const { limit=20, page=1, search, coin, network, status, days } = req.query;
    const offset = (page-1)*limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (search) { params.push(`%${search}%`); where += ` AND (u.email ILIKE $${params.length} OR d.txhash ILIKE $${params.length} OR d.from_address ILIKE $${params.length})`; }
    if (coin)    { params.push(coin);         where += ` AND c.symbol=$${params.length}`; }
    if (network) { params.push(network);      where += ` AND n.short_name=$${params.length}`; }
    if (status)  { params.push(status);       where += ` AND d.status=$${params.length}`; }
    if (days)    { params.push(parseInt(days)); where += ` AND d.created_at > NOW() - ($${params.length} || ' days')::interval`; }

    const countQ = await db.query(
      `SELECT COUNT(*) FROM deposits d JOIN users u ON u.id=d.user_id
       JOIN coins c ON c.id=d.coin_id JOIN networks n ON n.id=d.network_id ${where}`, params);

    params.push(limit, offset);
    const deps = await db.query(
      `SELECT d.*, u.email, u.uid, c.symbol, n.short_name as network
       FROM deposits d JOIN users u ON u.id=d.user_id
       JOIN coins c ON c.id=d.coin_id JOIN networks n ON n.id=d.network_id
       ${where} ORDER BY d.created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`, params);

    return success(res, { deposits: deps.rows, total: parseInt(countQ.rows[0].count) });
  } catch (err) { return error(res, 'Failed', 500); }
};

const getWithdrawals = async (req, res) => {
  try {
    const { limit=20, page=1, status } = req.query;
    const offset = (page-1)*limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { params.push(status); where += ` AND w.status=$${params.length}`; }
    params.push(limit, offset);
    const wds = await db.query(
      `SELECT w.*, u.email, u.uid, c.symbol, n.name as network_name
       FROM withdrawals w JOIN users u ON u.id=w.user_id
       JOIN coins c ON c.id=w.coin_id JOIN networks n ON n.id=w.network_id
       ${where} ORDER BY w.created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    return success(res, wds.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getScannerState = async (req, res) => {
  try {
    const state = await db.query('SELECT * FROM scanner_state ORDER BY network');
    return success(res, state.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getKYCList = async (req, res) => {
  try {
    const { status='pending' } = req.query;
    const kycs = await db.query(`
      SELECT k.*, u.email, u.uid FROM kyc_verifications k
      JOIN users u ON u.id=k.user_id
      WHERE k.status=$1 ORDER BY k.created_at DESC
    `, [status]);
    return success(res, kycs.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getBannersAdmin = async (req, res) => {
  try {
    const banners = await db.query('SELECT * FROM banners ORDER BY sort_order, created_at DESC');
    return success(res, banners.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const adjustBalance = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { coin, amount, reason } = req.body;
    const coinData = await client.query('SELECT id FROM coins WHERE symbol=$1', [coin.toUpperCase()]);
    if (!coinData.rows[0]) return error(res, 'Coin not found');
    const coinId = coinData.rows[0].id;
    const amt = parseFloat(amount);

    await client.query(`INSERT INTO balances (user_id,coin_id,account_type,available,locked)
      VALUES ($1,$2,'spot',0,0) ON CONFLICT (user_id,coin_id,account_type) DO NOTHING`, [id, coinId]);

    if (amt > 0) {
      await client.query(`UPDATE balances SET available=available+$1
        WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'`, [amt, id, coinId]);
    } else {
      await client.query(`UPDATE balances SET available=GREATEST(0,available+$1)
        WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'`, [amt, id, coinId]);
    }

    await client.query(`INSERT INTO ledger (user_id,coin_id,type,amount,description)
      VALUES ($1,$2,'admin_adjust',$3,$4)`,
      [id, coinId, Math.abs(amt), reason||'Admin adjustment']);

    await client.query('COMMIT');
    return success(res, {}, 'Balance adjusted');
  } catch (err) {
    await client.query('ROLLBACK');
    return error(res, err.message, 500);
  } finally { client.release(); }
};

const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.query(`
      SELECT id, uid, email, phone, full_name, status, kyc_level,
             vip_level, referral_code, two_fa_enabled,
             email_verified, created_at, last_login_at
      FROM users WHERE id=$1`, [id]);
    if (!user.rows[0]) return error(res, 'User not found');
    return success(res, user.rows[0]);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getUserBalances = async (req, res) => {
  try {
    const { id } = req.params;
    const balances = await db.query(`
      SELECT b.*, c.symbol, c.name, c.logo_url
      FROM balances b JOIN coins c ON c.id=b.coin_id WHERE b.user_id=$1`, [id]);
    return success(res, balances.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getUserDeposits = async (req, res) => {
  try {
    const { id } = req.params;
    const deps = await db.query(`
      SELECT d.*, c.symbol, n.short_name as network FROM deposits d
      JOIN coins c ON c.id=d.coin_id JOIN networks n ON n.id=d.network_id
      WHERE d.user_id=$1 ORDER BY d.created_at DESC`, [id]);
    return success(res, deps.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getUserWithdrawals = async (req, res) => {
  try {
    const { id } = req.params;
    const wds = await db.query(`
      SELECT w.*, c.symbol, n.name as network_name FROM withdrawals w
      JOIN coins c ON c.id=w.coin_id JOIN networks n ON n.id=w.network_id
      WHERE w.user_id=$1 ORDER BY w.created_at DESC`, [id]);
    return success(res, wds.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getUserLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const ledger = await db.query(`
      SELECT l.*, c.symbol FROM ledger l JOIN coins c ON c.id=l.coin_id
      WHERE l.user_id=$1 ORDER BY l.created_at DESC LIMIT 100`, [id]);
    return success(res, ledger.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

module.exports = {
  // Auth
  adminLogin,
  // Dashboard
  getDashboard,
  // Users
  getUsers, updateUserStatus, updateUserVip, approveKYC,
  getUserDetail, getUserBalances, getUserDeposits,
  getUserWithdrawals, getUserLedger, adjustBalance,
  // Coins
  getCoinsAdmin, addCoin, updateCoin,
  // Trading Pairs
  getTradingPairs, addTradingPair, updateTradingPair,
  // Fee Rules
  getFeeRules, addFeeRule, updateFeeRule, deleteFeeRule,
  // VIP
  getVipLevels, updateVipLevel,
  // Reports
  getTreasuryReport, getVolumeReport,
  // Binance
  getBinanceCredentials, updateBinanceCredential,
  // Withdrawals
  getPendingWithdrawals, processWithdrawal,
  // Listings
  getListings, processListing,
  // Settings
  getSettings, updateSetting, addSetting,
  // Content
  addBanner, addPopup, addAnnouncement,
  // Deposits
  getDeposits, getWithdrawals, getScannerState, getKYCList,
  getBannersAdmin,
};
// ================================
// WITHDRAWAL SETTINGS (NEW)
// ================================
const getWithdrawalSettings = async (req, res) => {
  try {
    const settings = await db.query(`
      SELECT ws.*, c.symbol, c.name, c.logo_url
      FROM withdrawal_settings ws
      JOIN coins c ON c.id = ws.coin_id
      ORDER BY c.symbol
    `);
    return success(res, settings.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const updateWithdrawalSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const { min_amount, max_amount, fee_fixed, fee_percent,
            auto_approve_limit, is_enabled, low_balance_alert } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (min_amount !== undefined)       { updates.push(`min_amount=$${i++}`);       values.push(min_amount); }
    if (max_amount !== undefined)       { updates.push(`max_amount=$${i++}`);       values.push(max_amount); }
    if (fee_fixed !== undefined)        { updates.push(`fee_fixed=$${i++}`);        values.push(fee_fixed); }
    if (fee_percent !== undefined)      { updates.push(`fee_percent=$${i++}`);      values.push(fee_percent); }
    if (auto_approve_limit !== undefined){ updates.push(`auto_approve_limit=$${i++}`); values.push(auto_approve_limit); }
    if (is_enabled !== undefined)       { updates.push(`is_enabled=$${i++}`);       values.push(is_enabled); }
    if (low_balance_alert !== undefined){ updates.push(`low_balance_alert=$${i++}`); values.push(low_balance_alert); }

    if (updates.length === 0) return error(res, 'No fields');
    updates.push(`updated_at=NOW()`);
    values.push(id);

    await db.query(`UPDATE withdrawal_settings SET ${updates.join(',')} WHERE id=$${i}`, values);
    return success(res, {}, 'Updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// NETWORKS MANAGEMENT (NEW)
// ================================
const getNetworks = async (req, res) => {
  try {
    const networks = await db.query('SELECT * FROM networks ORDER BY id');
    return success(res, networks.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const updateNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rpc_url, explorer_url, is_active } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined)         { updates.push(`name=$${i++}`);         values.push(name); }
    if (rpc_url !== undefined)      { updates.push(`rpc_url=$${i++}`);      values.push(rpc_url); }
    if (explorer_url !== undefined) { updates.push(`explorer_url=$${i++}`); values.push(explorer_url); }
    if (is_active !== undefined)    { updates.push(`is_active=$${i++}`);    values.push(is_active); }

    if (updates.length === 0) return error(res, 'No fields');
    values.push(id);

    const result = await db.query(
      `UPDATE networks SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, values
    );
    return success(res, result.rows[0], 'Network updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// ANNOUNCEMENTS (NEW)
// ================================
const getAnnouncements = async (req, res) => {
  try {
    const anns = await db.query(`
      SELECT a.*, au.email as created_by_email
      FROM announcements a
      LEFT JOIN admin_users au ON au.id = a.created_by
      ORDER BY a.created_at DESC
    `);
    return success(res, anns.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_published, expires_at } = req.body;
    await db.query(
      'UPDATE announcements SET is_published=$1, expires_at=$2 WHERE id=$3',
      [is_published, expires_at, id]
    );
    return success(res, {}, 'Updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

const deleteAnnouncement = async (req, res) => {
  try {
    await db.query('DELETE FROM announcements WHERE id=$1', [req.params.id]);
    return success(res, {}, 'Deleted');
  } catch (err) { return error(res, 'Failed', 500); }
};

// Export Announcement and Setting functions
module.exports = Object.assign(module.exports, {
  getWithdrawalSettings, updateWithdrawalSetting,
  getNetworks, updateNetwork,
  getAnnouncements, updateAnnouncement, deleteAnnouncement,
});

// ================================
// CMS PAGES (NEW)
// ================================
const getCmsPages = async (req, res) => {
  try {
    const pages = await db.query(
      'SELECT * FROM cms_pages ORDER BY sort_order'
    );
    return success(res, pages.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getCmsPage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await db.query(
      'SELECT * FROM cms_pages WHERE id=$1', [id]
    );
    if (!page.rows[0]) return error(res, 'Page not found');
    return success(res, page.rows[0]);
  } catch (err) { return error(res, 'Failed', 500); }
};

const addCmsPage = async (req, res) => {
  try {
    const { slug, title, subtitle, icon, content, content_type,
            featured_image, meta_title, meta_desc, meta_keywords,
            og_image, is_published, show_in_footer, show_in_header,
            sort_order, page_type } = req.body;

    if (!slug || !title) return error(res, 'slug and title required');

    const page = await db.query(`
      INSERT INTO cms_pages
        (slug, title, subtitle, icon, content, content_type,
         featured_image, meta_title, meta_desc, meta_keywords,
         og_image, is_published, show_in_footer, show_in_header,
         sort_order, page_type, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [slug, title, subtitle, icon, content, content_type || 'html',
        featured_image, meta_title, meta_desc, meta_keywords,
        og_image, is_published !== false, show_in_footer !== false,
        show_in_header || false, sort_order || 0,
        page_type || 'info', req.adminId]);

    return success(res, page.rows[0], 'Page created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Slug already exists');
    return error(res, 'Failed: ' + err.message, 500);
  }
};

const updateCmsPage = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      'title', 'subtitle', 'icon', 'content', 'content_type',
      'featured_image', 'meta_title', 'meta_desc', 'meta_keywords',
      'og_image', 'is_published', 'show_in_footer', 'show_in_header',
      'sort_order', 'page_type'
    ];

    const updates = [];
    const values = [];
    let i = 1;

    for (const [key, val] of Object.entries(req.body)) {
      if (allowed.includes(key)) {
        updates.push(`${key}=$${i++}`);
        values.push(val);
      }
    }

    if (updates.length === 0) return error(res, 'No valid fields');
    updates.push(`updated_at=NOW()`, `updated_by=${req.adminId || 'NULL'}`);
    values.push(id);

    const result = await db.query(
      `UPDATE cms_pages SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      values
    );
    return success(res, result.rows[0], 'Page updated');
  } catch (err) { return error(res, 'Failed', 500); }
};

const deleteCmsPage = async (req, res) => {
  try {
    const { id } = req.params;
    // Default pages protect karo
    const page = await db.query('SELECT slug FROM cms_pages WHERE id=$1', [id]);
    const protectedSlugs = ['privacy-policy', 'terms', 'about'];
    if (protectedSlugs.includes(page.rows[0]?.slug)) {
      return error(res, 'Cannot delete protected pages');
    }
    await db.query('DELETE FROM cms_pages WHERE id=$1', [id]);
    return success(res, {}, 'Page deleted');
  } catch (err) { return error(res, 'Failed', 500); }
};

// Export CMS functions
module.exports = Object.assign(module.exports, {
  getCmsPages, getCmsPage, addCmsPage, updateCmsPage, deleteCmsPage,
});

// ================================
// ADMIN ORDERBOOK MANAGEMENT
// ================================
const getAdminOrders = async (req, res) => {
  try {
    const { pair_id, side, status = 'open' } = req.query;
    let where = "WHERE o.source = 'admin'";
    const params = [];
    if (pair_id) { params.push(pair_id); where += ` AND o.pair_id = $${params.length}`; }
    if (side)    { params.push(side);    where += ` AND o.side = $${params.length}`; }
    if (status)  { params.push(status);  where += ` AND o.status = $${params.length}`; }

    const result = await db.query(`
      SELECT o.*, tp.symbol, tp.price_precision, tp.qty_precision
      FROM orders o
      JOIN trading_pairs tp ON tp.id = o.pair_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT 200
    `, params);
    return success(res, result.rows);
  } catch (err) {
    console.error('getAdminOrders:', err.message);
    return error(res, 'Failed', 500);
  }
};

const createAdminOrders = async (req, res) => {
  try {
    const { pair_id, orders } = req.body;
    // orders = [{ side, price, quantity }, ...]
    if (!pair_id || !orders || !Array.isArray(orders) || orders.length === 0)
      return error(res, 'pair_id and orders[] required');
    if (orders.length > 50)
      return error(res, 'Max 50 orders at once');

    const pair = await db.query(
      'SELECT id, symbol FROM trading_pairs WHERE id = $1', [pair_id]
    );
    if (!pair.rows[0]) return error(res, 'Pair not found');

    const inserted = [];
    for (const ord of orders) {
      const { side, price, quantity } = ord;
      if (!side || !price || !quantity) continue;
      if (!['buy','sell'].includes(side)) continue;
      const p = parseFloat(price);
      const q = parseFloat(quantity);
      if (p <= 0 || q <= 0) continue;

      const orderId = 'ADM' + Date.now() + Math.random().toString(36).substr(2,6).toUpperCase();
      const totalValue = p * q;

      const row = await db.query(`
        INSERT INTO orders (
          order_id, user_id, pair_id, side, order_type,
          price, quantity, remaining_qty, filled_qty,
          total_value, status, is_bot_order, source,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,'limit',$5,$6,$6,0,$7,'open',false,'admin',NOW(),NOW())
        RETURNING *
      `, [orderId, 5, pair_id, side, p, q, totalValue]);

      inserted.push(row.rows[0]);
    }

    return success(res, { inserted: inserted.length, orders: inserted },
      `${inserted.length} orders created`);
  } catch (err) {
    console.error('createAdminOrders:', err.message);
    return error(res, 'Failed', 500);
  }
};

const updateAdminOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { price, quantity, status } = req.body;

    const existing = await db.query(
      "SELECT * FROM orders WHERE id = $1 AND source = 'admin'", [id]
    );
    if (!existing.rows[0]) return error(res, 'Order not found');

    const updates = [];
    const params = [];

    if (price !== undefined) {
      params.push(parseFloat(price));
      updates.push(`price = $${params.length}`);
      params.push(parseFloat(price) * parseFloat(existing.rows[0].quantity));
      updates.push(`total_value = $${params.length}`);
    }
    if (quantity !== undefined) {
      params.push(parseFloat(quantity));
      updates.push(`quantity = $${params.length}`);
      updates.push(`remaining_qty = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }

    if (updates.length === 0) return error(res, 'Nothing to update');

    params.push(id);
    const result = await db.query(`
      UPDATE orders SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length} AND source = 'admin'
      RETURNING *
    `, params);

    return success(res, result.rows[0], 'Order updated');
  } catch (err) {
    console.error('updateAdminOrder:', err.message);
    return error(res, 'Failed', 500);
  }
};

const deleteAdminOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1 AND source='admin' RETURNING id",
      [id]
    );
    if (!result.rows[0]) return error(res, 'Order not found');
    return success(res, {}, 'Order cancelled');
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const deleteAllAdminOrders = async (req, res) => {
  try {
    const { pair_id, side } = req.body;
    let where = "source='admin' AND status='open'";
    const params = [];
    if (pair_id) { params.push(pair_id); where += ` AND pair_id=$${params.length}`; }
    if (side)    { params.push(side);    where += ` AND side=$${params.length}`; }

    const result = await db.query(
      `UPDATE orders SET status='cancelled', updated_at=NOW() WHERE ${where} RETURNING id`,
      params
    );
    return success(res, { cancelled: result.rows.length }, `${result.rows.length} orders cancelled`);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

// ── COIN HOLDINGS REPORT ─────────────────────────
const getCoinHoldingsReport = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.symbol, c.name, c.logo_url,
        n.short_name as network,
        COALESCE(p.price_usdt, 0) as price_usdt,
        -- Total user holdings
        SUM(b.available + b.locked) as total_user_balance,
        SUM((b.available + b.locked) * COALESCE(p.price_usdt, 0)) as total_user_usdt,
        COUNT(DISTINCT CASE WHEN (b.available + b.locked) > 0 THEN b.user_id END) as holders,
        -- Total deposits
        COALESCE(dep.total_deposited, 0) as total_deposited,
        -- Total withdrawals
        COALESCE(wd.total_withdrawn, 0) as total_withdrawn
      FROM coins c
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN price_feeds p ON p.coin_id = c.id
      LEFT JOIN balances b ON b.coin_id = c.id AND b.account_type = 'spot'
      LEFT JOIN (
        SELECT coin_id, SUM(amount) as total_deposited
        FROM deposits WHERE status = 'completed'
        GROUP BY coin_id
      ) dep ON dep.coin_id = c.id
      LEFT JOIN (
        SELECT coin_id, SUM(receive_amount) as total_withdrawn
        FROM withdrawals WHERE status = 'completed'
        GROUP BY coin_id
      ) wd ON wd.coin_id = c.id
      WHERE c.is_active = true AND c.is_tradeable = true
      GROUP BY c.id, c.symbol, c.name, c.logo_url,
               n.short_name, p.price_usdt,
               dep.total_deposited, wd.total_withdrawn
      ORDER BY total_user_usdt DESC
    `);

    const totalUserUsdt = result.rows.reduce(
      (sum, r) => sum + parseFloat(r.total_user_usdt || 0), 0
    );

    return success(res, {
      coins: result.rows,
      summary: {
        total_coins: result.rows.length,
        total_user_holdings_usdt: totalUserUsdt.toFixed(2),
      }
    });
  } catch (err) {
    console.error('getCoinHoldingsReport:', err.message);
    return error(res, 'Failed', 500);
  }
};

// Export OrderBook functions
module.exports = Object.assign(module.exports, {
  getAdminOrders, createAdminOrders, updateAdminOrder,
  deleteAdminOrder, deleteAllAdminOrders, getCoinHoldingsReport,
});

