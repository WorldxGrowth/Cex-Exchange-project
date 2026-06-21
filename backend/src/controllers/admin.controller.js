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

    // VIP upgrade email (non-blocking)
    db.query('SELECT email, full_name FROM users WHERE id=$1', [id])
      .then(u => {
        if (u.rows[0]) {
          const emailService = require('../services/email/emailService');
          emailService.sendVipUpgradeEmail(u.rows[0], {
            old_level:  oldUser.rows[0]?.vip_level || 0,
            new_level:  vip_level,
            maker_fee:  'Updated',
            taker_fee:  'Updated',
          }).catch(() => {});
        }
      }).catch(() => {});

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
      // Non-blocking - never let a bonus-credit failure break KYC approval itself
      creditKycBonus(kyc.rows[0].user_id).catch(e => console.error('[KycBonus] error:', e.message));
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
      'SELECT key, value, type, category, label, description FROM system_settings ORDER BY category, key'
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
    const { key, value, type, category, label, description } = req.body;
    if (!key) return error(res, 'key required');
    await db.query(`INSERT INTO system_settings (key,value,type,category,label,description)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (key) DO UPDATE SET value=$2, type=$3, category=$4, label=$5, description=$6, updated_at=NOW()`,
      [key, value, type || 'string', category || 'general', label || key, description || null]);
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

// ── FORGOT PASSWORD ───────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return error(res, 'Email required');

    const user = await db.query(
      'SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );
    if (!user.rows[0]) return error(res, 'No account found with this email');

    const otpService = require('../services/otpService');
    const result = await otpService.sendOTP(email, 'password_reset');
    if (!result.ok) return error(res, result.error || 'Failed to send OTP');

    return success(res, {}, 'Password reset OTP sent to your email');
  } catch (err) {
    console.error('forgotPassword:', err.message);
    return error(res, 'Failed', 500);
  }
};

// ── RESET PASSWORD ────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password)
      return error(res, 'email, otp and new_password required');

    if (new_password.length < 8)
      return error(res, 'Password must be at least 8 characters');

    // Verify OTP
    const otpService = require('../services/otpService');
    const otpResult = await otpService.verifyOTP(email, otp, 'password_reset');
    if (!otpResult.ok) return error(res, otpResult.error || 'Invalid or expired OTP');

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(new_password, 12);

    // Update password
    const result = await db.query(
      'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE email=$2 RETURNING id',
      [hash, email.toLowerCase().trim()]
    );
    if (!result.rows[0]) return error(res, 'User not found');

    return success(res, {}, 'Password reset successful! Please login.');
  } catch (err) {
    console.error('resetPassword:', err.message);
    return error(res, 'Failed', 500);
  }
};

// ================================
// ADMIN STEP TOKEN HELPER
// ================================
const generateStepToken = (adminId, step) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { adminId: parseInt(adminId), step: parseInt(step) },
    process.env.JWT_SECRET + '_step',
    { expiresIn: '5m' }
  );
};

const verifyStepToken = (token, expectedStep) => {
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET + '_step');
    if (decoded.step !== expectedStep) return null;
    return decoded;
  } catch (e) {
    return null;
  }
};

// ================================
// STEP 1: VERIFY PIN
// ================================
const verifyAdminPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.toString().length !== 8) {
      return error(res, 'PIN must be 8 digits');
    }

    // Get admin (only 1 admin for now)
    const result = await db.query(
      'SELECT * FROM admin_users WHERE is_active = true LIMIT 1'
    );
    const admin = result.rows[0];
    if (!admin) return error(res, 'Invalid PIN');

    // Check lockout
    if (admin.pin_locked_until && new Date() < new Date(admin.pin_locked_until)) {
      const remaining = Math.ceil((new Date(admin.pin_locked_until) - new Date()) / 60000);
      return error(res, `Too many wrong attempts. Try after ${remaining} minutes.`);
    }

    // PIN not set
    if (!admin.pin) return error(res, 'PIN not configured. Contact system administrator.');

    // Verify PIN
    const isValid = await bcrypt.compare(pin.toString(), admin.pin);
    if (!isValid) {
      const attempts = (admin.pin_attempts || 0) + 1;
      if (attempts >= 3) {
        // Lock for 30 minutes
        await db.query(
          'UPDATE admin_users SET pin_attempts=$1, pin_locked_until=NOW()+INTERVAL\'30 minutes\' WHERE id=$2',
          [attempts, admin.id]
        );
        return error(res, 'Too many wrong attempts. Account locked for 30 minutes.');
      }
      await db.query(
        'UPDATE admin_users SET pin_attempts=$1 WHERE id=$2',
        [attempts, admin.id]
      );
      return error(res, `Wrong PIN. ${3 - attempts} attempts remaining.`);
    }

    // Reset attempts on success
    await db.query(
      'UPDATE admin_users SET pin_attempts=0, pin_locked_until=NULL WHERE id=$1',
      [admin.id]
    );

    // Generate step token (step 1 complete)
    const stepToken = generateStepToken(admin.id, 1);
    return success(res, { step_token: stepToken, next_step: 2 }, 'PIN verified');

  } catch (err) {
    console.error('[AdminAuth] verifyPin error:', err.message);
    return error(res, 'Verification failed', 500);
  }
};

// ================================
// STEP 2: EMAIL + PASSWORD LOGIN
// ================================
const adminLoginStep2 = async (req, res) => {
  try {
    const { email, password, step_token } = req.body;
    if (!email || !password || !step_token) {
      return error(res, 'Email, password and step_token required');
    }

    // Verify step token (must be step 1)
    const decoded = verifyStepToken(step_token, 1);
    if (!decoded) return error(res, 'Invalid or expired session. Start from PIN.');

    const result = await db.query(
      'SELECT * FROM admin_users WHERE id=$1 AND is_active=true',
      [decoded.adminId]
    );
    const admin = result.rows[0];
    if (!admin) return error(res, 'Invalid credentials');

    if (admin.email.toLowerCase() !== email.toLowerCase()) {
      return error(res, 'Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) return error(res, 'Invalid credentials');

    // Update last login
    await db.query('UPDATE admin_users SET last_login_at=NOW() WHERE id=$1', [admin.id]);

    // If OTP enabled → send OTP, go to step 3
    if (admin.otp_enabled) {
      const otpService = require('../services/otpService');
      const otpResult = await otpService.sendOTP(admin.email, 'admin_login');
      if (!otpResult.ok) return error(res, 'Failed to send OTP: ' + otpResult.error);

      const stepToken = generateStepToken(admin.id, 2);
      return success(res, {
        step_token: stepToken,
        next_step: 3,
        otp_sent: true,
        email_hint: admin.email.replace(/(.{2}).+(@.+)/, '$1***$2')
      }, 'Password verified. OTP sent to email.');
    }

    // If 2FA enabled → go to step 4
    if (admin.two_fa_enabled) {
      const stepToken = generateStepToken(admin.id, 3);
      return success(res, {
        step_token: stepToken,
        next_step: 4
      }, 'Password verified. Enter 2FA code.');
    }

    // No OTP, no 2FA → issue final token
    const { accessToken } = generateTokens(admin.id);
    return success(res, {
      access_token: accessToken,
      admin: { id: admin.id, email: admin.email, role: admin.role }
    }, 'Login successful');

  } catch (err) {
    console.error('[AdminAuth] loginStep2 error:', err.message);
    return error(res, 'Login failed', 500);
  }
};

// ================================
// STEP 3: VERIFY OTP
// ================================
const verifyAdminOTP = async (req, res) => {
  try {
    const { otp, step_token } = req.body;
    if (!otp || !step_token) return error(res, 'OTP and step_token required');

    // Verify step token (must be step 2)
    const decoded = verifyStepToken(step_token, 2);
    if (!decoded) return error(res, 'Invalid or expired session. Start from PIN.');

    const result = await db.query(
      'SELECT * FROM admin_users WHERE id=$1 AND is_active=true',
      [decoded.adminId]
    );
    const admin = result.rows[0];
    if (!admin) return error(res, 'Admin not found');

    // Verify OTP
    const otpService = require('../services/otpService');
    const otpResult = await otpService.verifyOTP(admin.email, otp, 'admin_login');
    if (!otpResult.ok) return error(res, otpResult.error);

    // If 2FA also enabled → go to step 4
    if (admin.two_fa_enabled) {
      const stepToken = generateStepToken(admin.id, 3);
      return success(res, {
        step_token: stepToken,
        next_step: 4
      }, 'OTP verified. Enter 2FA code.');
    }

    // OTP done, no 2FA → issue final token
    const { accessToken } = generateTokens(admin.id);
    return success(res, {
      access_token: accessToken,
      admin: { id: admin.id, email: admin.email, role: admin.role }
    }, 'Login successful');

  } catch (err) {
    console.error('[AdminAuth] verifyOTP error:', err.message);
    return error(res, 'OTP verification failed', 500);
  }
};

// ================================
// STEP 4: VERIFY 2FA TOTP
// ================================
const verifyAdmin2FA = async (req, res) => {
  try {
    const { totp_code, step_token } = req.body;
    if (!totp_code || !step_token) return error(res, 'TOTP code and step_token required');

    // Verify step token (must be step 3)
    const decoded = verifyStepToken(step_token, 3);
    if (!decoded) return error(res, 'Invalid or expired session. Start from PIN.');

    const result = await db.query(
      'SELECT * FROM admin_users WHERE id=$1 AND is_active=true',
      [decoded.adminId]
    );
    const admin = result.rows[0];
    if (!admin) return error(res, 'Admin not found');

    if (!admin.two_fa_secret) return error(res, '2FA not configured');

    // Verify TOTP
    const speakeasy = require('speakeasy');
    const isValid = speakeasy.totp.verify({
      secret: admin.two_fa_secret,
      encoding: 'base32',
      token: totp_code.toString(),
      window: 2
    });

    if (!isValid) return error(res, 'Invalid 2FA code');

    // All steps done → issue final token
    const { accessToken } = generateTokens(admin.id);
    return success(res, {
      access_token: accessToken,
      admin: { id: admin.id, email: admin.email, role: admin.role }
    }, 'Login successful');

  } catch (err) {
    console.error('[AdminAuth] verify2FA error:', err.message);
    return error(res, '2FA verification failed', 500);
  }
};

// ================================
// ADMIN 2FA MANAGEMENT
// ================================
const adminSetup2FA = async (req, res) => {
  try {
    const speakeasy = require('speakeasy');
    const QRCode = require('qrcode');
    const { cache } = require('../config/redis');

    const admin = await db.query(
      'SELECT * FROM admin_users WHERE id=$1 AND is_active=true',
      [req.adminId]
    );
    if (!admin.rows[0]) return error(res, 'Admin not found');

    const secret = speakeasy.generateSecret({
      name: `VDExchange Admin (${admin.rows[0].email})`,
      length: 32
    });

    // Redis mein temp store (10 min)
    await cache.set(`admin_2fa_setup:${req.adminId}`, {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url
    }, 600);

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return success(res, {
      secret: secret.base32,
      qr_code: qrCodeDataUrl,
      otpauth_url: secret.otpauth_url
    }, '2FA setup initiated. Scan QR code.');

  } catch (err) {
    console.error('[Admin2FA] setup error:', err.message);
    return error(res, 'Setup failed', 500);
  }
};

const adminEnable2FA = async (req, res) => {
  try {
    const speakeasy = require('speakeasy');
    const { cache } = require('../config/redis');
    const { totp_code } = req.body;

    if (!totp_code) return error(res, 'TOTP code required');

    // Redis se temp secret lo
    const setupData = await cache.get(`admin_2fa_setup:${req.adminId}`);
    if (!setupData) return error(res, 'Setup expired. Start again.');

    // Verify code
    const isValid = speakeasy.totp.verify({
      secret: setupData.secret,
      encoding: 'base32',
      token: totp_code.toString().replace(/\s/g, ''),
      window: 2
    });

    if (!isValid) return error(res, 'Invalid code. Try again.');

    // DB mein save + enable
    await db.query(
      'UPDATE admin_users SET two_fa_secret=$1, two_fa_enabled=true WHERE id=$2',
      [setupData.secret, req.adminId]
    );

    // Redis cleanup
    await cache.del(`admin_2fa_setup:${req.adminId}`);

    return success(res, {}, '2FA enabled successfully! Login will now require 2FA.');

  } catch (err) {
    console.error('[Admin2FA] enable error:', err.message);
    return error(res, 'Enable failed', 500);
  }
};

const adminDisable2FA = async (req, res) => {
  try {
    const speakeasy = require('speakeasy');
    const { totp_code } = req.body;

    if (!totp_code) return error(res, 'TOTP code required to disable 2FA');

    const admin = await db.query(
      'SELECT * FROM admin_users WHERE id=$1 AND is_active=true',
      [req.adminId]
    );
    if (!admin.rows[0]) return error(res, 'Admin not found');
    if (!admin.rows[0].two_fa_enabled) return error(res, '2FA is not enabled');
    if (!admin.rows[0].two_fa_secret) return error(res, '2FA secret not found');

    const isValid = speakeasy.totp.verify({
      secret: admin.rows[0].two_fa_secret,
      encoding: 'base32',
      token: totp_code.toString().replace(/\s/g, ''),
      window: 2
    });

    if (!isValid) return error(res, 'Invalid TOTP code');

    await db.query(
      'UPDATE admin_users SET two_fa_enabled=false, two_fa_secret=NULL WHERE id=$1',
      [req.adminId]
    );

    return success(res, {}, '2FA disabled successfully.');

  } catch (err) {
    console.error('[Admin2FA] disable error:', err.message);
    return error(res, 'Disable failed', 500);
  }
};

const adminGet2FAStatus = async (req, res) => {
  try {
    const admin = await db.query(
      'SELECT two_fa_enabled, otp_enabled, email FROM admin_users WHERE id=$1',
      [req.adminId]
    );
    if (!admin.rows[0]) return error(res, 'Admin not found');

    return success(res, {
      two_fa_enabled: admin.rows[0].two_fa_enabled || false,
      otp_enabled: admin.rows[0].otp_enabled || false,
      email: admin.rows[0].email
    });
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

// ================================
// ADMIN OTP TOGGLE
// ================================
const adminToggleOTP = async (req, res) => {
  try {
    const admin = await db.query(
      'SELECT otp_enabled FROM admin_users WHERE id=$1 AND is_active=true',
      [req.adminId]
    );
    if (!admin.rows[0]) return error(res, 'Admin not found');

    const newValue = !admin.rows[0].otp_enabled;
    await db.query(
      'UPDATE admin_users SET otp_enabled=$1 WHERE id=$2',
      [newValue, req.adminId]
    );

    return success(res, { otp_enabled: newValue },
      newValue ? 'Gmail OTP enabled' : 'Gmail OTP disabled');
  } catch (err) {
    console.error('[AdminSecurity] toggleOTP error:', err.message);
    return error(res, 'Toggle failed', 500);
  }
};

// ================================
// ADMIN CHANGE PIN
// Flow: current_pin verify → Gmail OTP verify → new_pin set
// Step A: POST /security/change-pin/verify-current → verify current PIN + send OTP
// Step B: POST /security/change-pin/confirm → verify OTP + set new PIN
// ================================
const adminChangePinStep1 = async (req, res) => {
  try {
    const { current_pin, new_pin, confirm_pin } = req.body;

    if (!current_pin || !new_pin || !confirm_pin)
      return error(res, 'current_pin, new_pin and confirm_pin required');

    if (new_pin.toString().length !== 8 || !/^\d+$/.test(new_pin.toString()))
      return error(res, 'New PIN must be exactly 8 digits');

    if (new_pin.toString() !== confirm_pin.toString())
      return error(res, 'New PIN and confirm PIN do not match');

    const admin = await db.query(
      'SELECT * FROM admin_users WHERE id=$1 AND is_active=true',
      [req.adminId]
    );
    if (!admin.rows[0]) return error(res, 'Admin not found');

    // Check lockout
    if (admin.rows[0].pin_locked_until && new Date() < new Date(admin.rows[0].pin_locked_until)) {
      const remaining = Math.ceil((new Date(admin.rows[0].pin_locked_until) - new Date()) / 60000);
      return error(res, `Account locked. Try after ${remaining} minutes.`);
    }

    // Verify current PIN
    const isValid = await bcrypt.compare(current_pin.toString(), admin.rows[0].pin);
    if (!isValid) {
      const attempts = (admin.rows[0].pin_attempts || 0) + 1;
      if (attempts >= 3) {
        await db.query(
          "UPDATE admin_users SET pin_attempts=$1, pin_locked_until=NOW()+INTERVAL'30 minutes' WHERE id=$2",
          [attempts, req.adminId]
        );
        return error(res, 'Too many wrong attempts. Account locked for 30 minutes.');
      }
      await db.query('UPDATE admin_users SET pin_attempts=$1 WHERE id=$2', [attempts, req.adminId]);
      return error(res, `Wrong current PIN. ${3 - attempts} attempts remaining.`);
    }

    // Reset attempts
    await db.query('UPDATE admin_users SET pin_attempts=0, pin_locked_until=NULL WHERE id=$1', [req.adminId]);

    // Send Gmail OTP for confirmation
    const otpService = require('../services/otpService');
    const otpResult = await otpService.sendOTP(admin.rows[0].email, 'admin_login');
    if (!otpResult.ok) return error(res, 'Failed to send OTP: ' + otpResult.error);

    // Store new_pin temporarily in Redis
    const { cache } = require('../config/redis');
    await cache.set(`admin_pin_change:${req.adminId}`, {
      new_pin: new_pin.toString()
    }, 300); // 5 min

    return success(res, {
      email_hint: admin.rows[0].email.replace(/(.{2}).+(@.+)/, '$1***$2')
    }, 'Current PIN verified. OTP sent to email.');

  } catch (err) {
    console.error('[AdminSecurity] changePinStep1 error:', err.message);
    return error(res, 'Failed', 500);
  }
};

const adminChangePinStep2 = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return error(res, 'OTP required');

    const admin = await db.query(
      'SELECT email FROM admin_users WHERE id=$1 AND is_active=true',
      [req.adminId]
    );
    if (!admin.rows[0]) return error(res, 'Admin not found');

    // Verify OTP
    const otpService = require('../services/otpService');
    const otpResult = await otpService.verifyOTP(admin.rows[0].email, otp, 'admin_login');
    if (!otpResult.ok) return error(res, otpResult.error);

    // Get new PIN from Redis
    const { cache } = require('../config/redis');
    const pinData = await cache.get(`admin_pin_change:${req.adminId}`);
    if (!pinData) return error(res, 'Session expired. Start PIN change again.');

    // Hash and save new PIN
    const newHash = await bcrypt.hash(pinData.new_pin, 12);
    await db.query(
      'UPDATE admin_users SET pin=$1, pin_attempts=0, pin_locked_until=NULL WHERE id=$2',
      [newHash, req.adminId]
    );

    // Cleanup Redis
    await cache.del(`admin_pin_change:${req.adminId}`);

    return success(res, {}, 'PIN changed successfully!');

  } catch (err) {
    console.error('[AdminSecurity] changePinStep2 error:', err.message);
    return error(res, 'Failed', 500);
  }
};

// ── FINAL MODULE EXPORTS (पूरी फाइल के सारे फंक्शन्स एक ही जगह) ──
module.exports = Object.assign(module.exports, {
  // Withdrawal & Networks
  getWithdrawalSettings, 
  updateWithdrawalSetting,
  getNetworks, 
  updateNetwork,

  // Announcements
  getAnnouncements, 
  updateAnnouncement, 
  deleteAnnouncement,

  // CMS Pages
  getCmsPages, 
  getCmsPage, 
  addCmsPage, 
  updateCmsPage, 
  deleteCmsPage,

  // OrderBook
  getAdminOrders, 
  createAdminOrders, 
  updateAdminOrder,
  deleteAdminOrder, 
  deleteAllAdminOrders, 

  // Reports
  getCoinHoldingsReport,

  // Auth / Password
  forgotPassword, 
  resetPassword,
  
  // === यहाँ आपके नए Step Auth फंक्शन्स जुड़ गए ===
  verifyAdminPin,
  adminLoginStep2,
  verifyAdminOTP,
  verifyAdmin2FA,
  
  //admin security
  adminSetup2FA,
  adminEnable2FA,
  adminDisable2FA,
  adminGet2FAStatus,
  adminToggleOTP,
  adminChangePinStep1,
  adminChangePinStep2
});
// ================================
// COIN_NETWORKS MANAGEMENT (NEW — multi-chain per-coin network mapping)
// ================================

const getCoinNetworksAdmin = async (req, res) => {
  try {
    const { coinId } = req.params;
    const result = await db.query(`
      SELECT cn.*, n.short_name, n.name as network_name, n.chain_type
      FROM coin_networks cn
      JOIN networks n ON n.id = cn.network_id
      WHERE cn.coin_id = $1
      ORDER BY n.id
    `, [coinId]);
    return success(res, result.rows);
  } catch (err) {
    console.error('getCoinNetworksAdmin:', err.message);
    return error(res, 'Failed', 500);
  }
};

const addCoinNetwork = async (req, res) => {
  try {
    const { coinId } = req.params;
    const { network_id, contract_address, decimals, min_confirmations,
            is_deposit_enabled, is_withdraw_enabled, withdraw_fee } = req.body;

    if (!network_id) return error(res, 'network_id required');

    const result = await db.query(`
      INSERT INTO coin_networks
        (coin_id, network_id, contract_address, decimals, min_confirmations,
         is_deposit_enabled, is_withdraw_enabled, withdraw_fee)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [coinId, network_id, contract_address || null, decimals || 18,
        min_confirmations || 3,
        is_deposit_enabled !== false, is_withdraw_enabled !== false,
        withdraw_fee || 0]);

    return success(res, result.rows[0], 'Network added to coin', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'This coin already supports this network');
    console.error('addCoinNetwork:', err.message);
    return error(res, 'Failed: ' + err.message, 500);
  }
};

const updateCoinNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const allowed = [
      'contract_address', 'decimals', 'min_confirmations',
      'is_deposit_enabled', 'is_withdraw_enabled', 'withdraw_fee'
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
      `UPDATE coin_networks SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows[0]) return error(res, 'Coin-network mapping not found');
    return success(res, result.rows[0], 'Coin network settings updated');
  } catch (err) {
    console.error('updateCoinNetwork:', err.message);
    return error(res, 'Failed: ' + err.message, 500);
  }
};

const deleteCoinNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM coin_networks WHERE id = $1 RETURNING id', [id]
    );
    if (!result.rows[0]) return error(res, 'Not found');
    return success(res, {}, 'Network removed from coin');
  } catch (err) {
    console.error('deleteCoinNetwork:', err.message);
    return error(res, 'Failed', 500);
  }
};

module.exports = Object.assign(module.exports, {
  getCoinNetworksAdmin, addCoinNetwork, updateCoinNetwork, deleteCoinNetwork
});

// ================================
// FUTURES PAIRS MANAGEMENT (NEW)
// ================================

const getFuturesPairsAdmin = async (req, res) => {
  try {
    const { base_coin_id } = req.query;
    let where = '';
    const params = [];
    if (base_coin_id) {
      params.push(base_coin_id);
      where = `WHERE fp.base_coin_id = $${params.length}`;
    }
    const result = await db.query(`
      SELECT fp.*, cb.symbol as base_symbol, cb.name as base_name, cb.logo_url as base_logo
      FROM futures_pairs fp
      JOIN coins cb ON cb.id = fp.base_coin_id
      ${where}
      ORDER BY fp.sort_order, fp.id
    `, params);
    return success(res, result.rows);
  } catch (err) {
    console.error('getFuturesPairsAdmin:', err.message);
    return error(res, 'Failed', 500);
  }
};

const addFuturesPair = async (req, res) => {
  try {
    const {
      symbol, base_coin_id, quote_coin_id, contract_type, tick_size, lot_size,
      max_leverage, maintenance_margin, initial_margin, funding_interval,
      binance_symbol, is_custom, min_qty, max_qty, min_notional, step_size,
      maker_fee, taker_fee, futures_enabled, price_precision, qty_precision,
      settle_coin, order_types, time_in_force_types, liquidation_fee,
      market_take_bound, sort_order
    } = req.body;

    if (!symbol || !base_coin_id) return error(res, 'symbol and base_coin_id required');

    const result = await db.query(`
      INSERT INTO futures_pairs
        (symbol, base_coin_id, quote_coin_id, contract_type, tick_size, lot_size,
         max_leverage, maintenance_margin, initial_margin, funding_interval,
         binance_symbol, is_custom, min_qty, max_qty, min_notional, step_size,
         maker_fee, taker_fee, futures_enabled, price_precision, qty_precision,
         settle_coin, order_types, time_in_force_types, liquidation_fee,
         market_take_bound, sort_order, is_active, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
              $19,$20,$21,$22,$23,$24,$25,$26,$27,true,NOW())
      RETURNING *
    `, [symbol.toUpperCase(), base_coin_id, quote_coin_id || null,
        contract_type || 'perpetual', tick_size || 0.01, lot_size || 0.001,
        max_leverage || 20, maintenance_margin || 0.005, initial_margin || 0.01,
        funding_interval || 28800, binance_symbol || null, is_custom || false,
        min_qty || 0.001, max_qty || 1000000, min_notional || 5, step_size || 0.001,
        maker_fee || 0.0002, taker_fee || 0.0005, futures_enabled !== false,
        price_precision || 2, qty_precision || 3, settle_coin || 'USDT',
        order_types || null, time_in_force_types || null, liquidation_fee || 0.005,
        market_take_bound || 0.05, sort_order || 0]);

    return success(res, result.rows[0], 'Futures pair created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'This futures pair symbol already exists');
    console.error('addFuturesPair:', err.message);
    return error(res, 'Failed: ' + err.message, 500);
  }
};

const updateFuturesPair = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const allowed = [
      'contract_type', 'tick_size', 'lot_size', 'max_leverage',
      'maintenance_margin', 'initial_margin', 'funding_interval',
      'binance_symbol', 'is_custom', 'min_qty', 'max_qty', 'min_notional',
      'step_size', 'maker_fee', 'taker_fee', 'futures_enabled',
      'price_precision', 'qty_precision', 'settle_coin', 'order_types',
      'time_in_force_types', 'liquidation_fee', 'market_take_bound',
      'sort_order', 'is_active'
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
      `UPDATE futures_pairs SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows[0]) return error(res, 'Futures pair not found');
    return success(res, result.rows[0], 'Futures pair updated');
  } catch (err) {
    console.error('updateFuturesPair:', err.message);
    return error(res, 'Failed: ' + err.message, 500);
  }
};

const deleteFuturesPair = async (req, res) => {
  try {
    const { id } = req.params;
    // Soft delete - just disable, don't actually drop the row
    // (existing open positions/orders may reference it)
    const result = await db.query(
      `UPDATE futures_pairs SET futures_enabled=false, is_active=false WHERE id=$1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) return error(res, 'Not found');
    return success(res, {}, 'Futures pair disabled');
  } catch (err) {
    console.error('deleteFuturesPair:', err.message);
    return error(res, 'Failed', 500);
  }
};

module.exports = Object.assign(module.exports, {
  getFuturesPairsAdmin, addFuturesPair, updateFuturesPair, deleteFuturesPair
});

// ================================
// BRANDING IMAGE UPLOAD (NEW — logos, favicon, OG image)
// ================================
const uploadBrandingImage = async (req, res) => {
  try {
    if (!req.file) return error(res, 'No file uploaded');

    const baseUrl = (process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}/api/v1`).replace(/\/api\/v1$/, '');
    const fullUrl = `${baseUrl}/uploads/branding/${req.file.filename}`;
    return success(res, { url: fullUrl }, 'Image uploaded successfully');
  } catch (err) {
    console.error('uploadBrandingImage:', err.message);
    return error(res, 'Upload failed: ' + err.message, 500);
  }
};

module.exports = Object.assign(module.exports, { uploadBrandingImage });

// ── KYC Bonus Helper ──────────────────────────────
// Reads system_settings dynamically - admin can enable/disable or
// change the amount anytime without any code/deploy needed.
const creditKycBonus = async (userId) => {
  const enabledRow = await db.query(
    `SELECT value FROM system_settings WHERE key='kyc_bonus_enabled'`
  );
  if (enabledRow.rows[0]?.value !== 'true') return; // feature off, do nothing

  const amountRow = await db.query(
    `SELECT value FROM system_settings WHERE key='kyc_bonus_amount'`
  );
  const bonusAmount = parseFloat(amountRow.rows[0]?.value || 0);
  if (bonusAmount <= 0) return;

  const coinRow = await db.query(`SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`);
  const coinId = coinRow.rows[0]?.id;
  if (!coinId) { console.error('[KycBonus] USDT coin not found'); return; }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const balRow = await client.query(`
      SELECT available FROM balances
      WHERE user_id=$1 AND coin_id=$2 AND account_type='spot' FOR UPDATE
    `, [userId, coinId]);
    const balBefore = parseFloat(balRow.rows[0]?.available || 0);

    await client.query(`
      INSERT INTO balances (user_id, coin_id, account_type, available, locked)
      VALUES ($1,$2,'spot',$3,0)
      ON CONFLICT (user_id, coin_id, account_type)
      DO UPDATE SET available = balances.available + $3, updated_at = NOW()
    `, [userId, coinId, bonusAmount]);

    await client.query(`
      INSERT INTO ledger (user_id, coin_id, type, amount, balance_before, balance_after, description)
      VALUES ($1,$2,'bonus',$3,$4,$5,$6)
    `, [userId, coinId, bonusAmount, balBefore, balBefore + bonusAmount,
        `KYC completion bonus: ${bonusAmount} USDT`]);

    await client.query('COMMIT');
    console.log(`[KycBonus] ✅ Credited ${bonusAmount} USDT to user ${userId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[KycBonus] creditKycBonus error:', err.message);
  } finally {
    client.release();
  }
};

module.exports = Object.assign(module.exports, { creditKycBonus });
