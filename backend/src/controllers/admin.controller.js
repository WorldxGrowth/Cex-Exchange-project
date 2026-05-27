const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { success, error } = require('../utils/response');
const { generateTokens } = require('../utils/jwt');

// ================================
// ADMIN AUTH
// admin.controller.js →
// Admin panel ka brain - users, coins,
// listings, withdrawals sab yahan se
// manage hota hai
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

    // First time login - set password
    if (admin.rows[0].password_hash === '$2a$12$placeholder_will_be_set_via_api') {
      const newHash = await bcrypt.hash(password, 12);
      await db.query(
        'UPDATE admin_users SET password_hash = $1 WHERE id = $2',
        [newHash, admin.rows[0].id]
      );
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
// DASHBOARD STATS
// ================================
const getDashboard = async (req, res) => {
  try {
    const [users, orders, trades, deposits, withdrawals, listings] = await Promise.all([
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > NOW()-INTERVAL '24h' THEN 1 END) as today FROM users"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='open' THEN 1 END) as open FROM orders"),
      db.query("SELECT COUNT(*) as total, COALESCE(SUM(total_value),0) as volume FROM trades WHERE created_at > NOW()-INTERVAL '24h'"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='pending' THEN 1 END) as pending FROM deposits"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='pending' THEN 1 END) as pending FROM withdrawals"),
      db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN status='pending' THEN 1 END) as pending FROM token_listings")
    ]);

    return success(res, {
      users: { total: users.rows[0].total, today: users.rows[0].today },
      orders: { total: orders.rows[0].total, open: orders.rows[0].open },
      trades_24h: { count: trades.rows[0].total, volume: trades.rows[0].volume },
      deposits: { total: deposits.rows[0].total, pending: deposits.rows[0].pending },
      withdrawals: { total: withdrawals.rows[0].total, pending: withdrawals.rows[0].pending },
      listings: { total: listings.rows[0].total, pending: listings.rows[0].pending }
    });
  } catch (err) {
    return error(res, 'Failed to get dashboard', 500);
  }
};

// ================================
// USER MANAGEMENT
// ================================
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, kyc_level } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, uid, email, phone, status, kyc_level, vip_level,
             referral_code, email_verified, created_at, last_login_at
      FROM users WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (email ILIKE $${params.length} OR uid ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    if (kyc_level !== undefined) { params.push(kyc_level); query += ` AND kyc_level = $${params.length}`; }

    const countResult = await db.query(query.replace('SELECT id, uid, email, phone, status, kyc_level, vip_level,\n             referral_code, email_verified, created_at, last_login_at', 'SELECT COUNT(*)'), params);

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
    const { status, reason } = req.body;

    if (!['active','suspended','banned'].includes(status)) {
      return error(res, 'Invalid status');
    }

    await db.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );

    return success(res, {}, `User ${status} successfully`);
  } catch (err) {
    return error(res, 'Failed to update user', 500);
  }
};

const approveKYC = async (req, res) => {
  try {
    const { kyc_id } = req.params;
    const { action, rejection_reason } = req.body;

    if (!['approved','rejected'].includes(action)) {
      return error(res, 'action must be approved or rejected');
    }

    const kyc = await db.query('SELECT * FROM kyc_verifications WHERE id = $1', [kyc_id]);
    if (!kyc.rows[0]) return error(res, 'KYC not found');

    await db.query(`
      UPDATE kyc_verifications SET
        status = $1, rejection_reason = $2,
        reviewed_by = $3, reviewed_at = NOW()
      WHERE id = $4
    `, [action, rejection_reason || null, req.adminId, kyc_id]);

    if (action === 'approved') {
      await db.query(
        'UPDATE users SET kyc_level = $1 WHERE id = $2',
        [kyc.rows[0].level, kyc.rows[0].user_id]
      );
    }

    return success(res, {}, `KYC ${action} successfully`);
  } catch (err) {
    return error(res, 'Failed to update KYC', 500);
  }
};

// ================================
// COIN MANAGEMENT
// ================================
const getCoinsAdmin = async (req, res) => {
  try {
    const coins = await db.query(`
      SELECT c.*, n.name as network_name, p.price_usdt
      FROM coins c
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN price_feeds p ON p.coin_id = c.id
      ORDER BY c.sort_order
    `);
    return success(res, coins.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const addCoin = async (req, res) => {
  try {
    const {
      symbol, name, logo_url, coin_type, contract_address,
      decimals, network_id, min_deposit, min_withdraw,
      withdraw_fee, confirmations, price_source, price_symbol
    } = req.body;

    if (!symbol || !name || !network_id) {
      return error(res, 'symbol, name, network_id required');
    }

    const coin = await db.query(`
      INSERT INTO coins (symbol, name, logo_url, coin_type, contract_address,
        decimals, network_id, min_deposit, min_withdraw, withdraw_fee,
        confirmations, price_source, price_symbol)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [symbol.toUpperCase(), name, logo_url, coin_type, contract_address,
        decimals || 18, network_id, min_deposit || 0, min_withdraw || 0,
        withdraw_fee || 0, confirmations || 12, price_source || 'binance',
        price_symbol]);

    return success(res, coin.rows[0], 'Coin added successfully', 201);
  } catch (err) {
    return error(res, 'Failed to add coin: ' + err.message, 500);
  }
};

const updateCoin = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const allowed = ['name','logo_url','is_active','is_deposit','is_withdraw',
                     'min_deposit','min_withdraw','withdraw_fee','price_source',
                     'price_symbol','sort_order'];

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
    await db.query(
      `UPDATE coins SET ${updates.join(', ')} WHERE id = $${i}`,
      values
    );

    return success(res, {}, 'Coin updated successfully');
  } catch (err) {
    return error(res, 'Failed to update coin', 500);
  }
};

// ================================
// TRADING PAIRS MANAGEMENT
// ================================
const addTradingPair = async (req, res) => {
  try {
    const { base_coin_id, quote_coin_id, maker_fee, taker_fee,
            min_order_qty, min_order_value, listing_date } = req.body;

    // Get symbols
    const base = await db.query('SELECT symbol FROM coins WHERE id = $1', [base_coin_id]);
    const quote = await db.query('SELECT symbol FROM coins WHERE id = $1', [quote_coin_id]);

    if (!base.rows[0] || !quote.rows[0]) return error(res, 'Coins not found');

    const symbol = base.rows[0].symbol + quote.rows[0].symbol;

    const pair = await db.query(`
      INSERT INTO trading_pairs
        (base_coin_id, quote_coin_id, symbol, maker_fee, taker_fee,
         min_order_qty, min_order_value, listing_date, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9)
      RETURNING *
    `, [base_coin_id, quote_coin_id, symbol,
        maker_fee || 0.001, taker_fee || 0.001,
        min_order_qty || 0.0001, min_order_value || 1,
        listing_date || new Date(),
        listing_date ? new Date(listing_date) <= new Date() : true]);

    return success(res, pair.rows[0], 'Trading pair added', 201);
  } catch (err) {
    return error(res, 'Failed to add pair: ' + err.message, 500);
  }
};

// ================================
// WITHDRAWAL MANAGEMENT
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
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, txhash, admin_note } = req.body;

    if (!['approve','reject'].includes(action)) {
      return error(res, 'action must be approve or reject');
    }

    const withdrawal = await db.query('SELECT * FROM withdrawals WHERE id = $1', [id]);
    if (!withdrawal.rows[0]) return error(res, 'Withdrawal not found');

    const w = withdrawal.rows[0];

    if (action === 'approve') {
      await db.query(`
        UPDATE withdrawals SET status = 'completed', txhash = $1,
          admin_note = $2, updated_at = NOW()
        WHERE id = $3
      `, [txhash, admin_note, id]);

      // Release locked balance
      await db.query(`
        UPDATE balances SET locked = locked - $1
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [w.amount, w.user_id, w.coin_id]);

    } else {
      // Reject - refund
      await db.query(`
        UPDATE withdrawals SET status = 'cancelled', admin_note = $1, updated_at = NOW()
        WHERE id = $2
      `, [admin_note, id]);

      await db.query(`
        UPDATE balances SET available = available + $1, locked = locked - $1
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [w.amount, w.user_id, w.coin_id]);
    }

    return success(res, {}, `Withdrawal ${action}d successfully`);
  } catch (err) {
    return error(res, 'Failed to process withdrawal', 500);
  }
};

// ================================
// TOKEN LISTING MANAGEMENT
// ================================
const getListings = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT tl.*, u.email, u.uid, n.name as network_name
      FROM token_listings tl
      JOIN users u ON u.id = tl.applicant_user_id
      LEFT JOIN networks n ON n.id = tl.network_id
    `;
    const params = [];
    if (status) { params.push(status); query += ` WHERE tl.status = $1`; }
    query += ' ORDER BY tl.created_at DESC';

    const listings = await db.query(query, params);
    return success(res, listings.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const processListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_notes } = req.body;

    if (!['approve','reject'].includes(action)) {
      return error(res, 'action must be approve or reject');
    }

    const listing = await db.query('SELECT * FROM token_listings WHERE id = $1', [id]);
    if (!listing.rows[0]) return error(res, 'Listing not found');

    const l = listing.rows[0];
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.query(
      'UPDATE token_listings SET status = $1, admin_notes = $2, updated_at = NOW() WHERE id = $3',
      [newStatus, admin_notes, id]
    );

    if (action === 'approve') {
      // Add coin to coins table
      const coin = await db.query(`
        INSERT INTO coins (symbol, name, logo_url, coin_type, contract_address,
          network_id, price_source, is_active, listed_at)
        VALUES ($1,$2,$3,'custom',$4,$5,'custom',true,NOW())
        ON CONFLICT (symbol) DO UPDATE SET is_active = true
        RETURNING id
      `, [l.token_symbol, l.token_name, l.token_logo_url,
          l.contract_address, l.network_id]);

      // Create trading pair with USDT
      const usdtCoin = await db.query("SELECT id FROM coins WHERE symbol = 'USDT'");
      const symbol = l.token_symbol + 'USDT';

      await db.query(`
        INSERT INTO trading_pairs
          (base_coin_id, quote_coin_id, symbol, is_active, listing_date)
        VALUES ($1,$2,$3,true,$4)
        ON CONFLICT (symbol) DO NOTHING
      `, [coin.rows[0].id, usdtCoin.rows[0].id, symbol, l.listing_date || new Date()]);

      // Set initial price
      if (l.initial_price) {
        await db.query(`
          INSERT INTO price_feeds (coin_id, price_usdt, source)
          VALUES ($1,$2,'custom')
          ON CONFLICT (coin_id) DO UPDATE SET price_usdt = $2
        `, [coin.rows[0].id, l.initial_price]);
      }
    }

    return success(res, {}, `Listing ${action}d successfully`);
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to process listing: ' + err.message, 500);
  }
};

// ================================
// SYSTEM SETTINGS
// ================================
const getSettings = async (req, res) => {
  try {
    const settings = await db.query(
      'SELECT key, value, type, category FROM system_settings ORDER BY category, key'
    );
    return success(res, settings.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    await db.query(`
      UPDATE system_settings SET value = $1, updated_at = NOW()
      WHERE key = $2
    `, [value, key]);

    return success(res, {}, 'Setting updated');
  } catch (err) {
    return error(res, 'Failed to update setting', 500);
  }
};

// BANNER management
const addBanner = async (req, res) => {
  try {
    const { title, image_url, link_url, link_type, position, platform, sort_order, starts_at, ends_at } = req.body;

    const banner = await db.query(`
      INSERT INTO banners (title, image_url, link_url, link_type, position, platform, sort_order, starts_at, ends_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [title, image_url, link_url, link_type || 'external',
        position || 'home_top', platform || 'all',
        sort_order || 0, starts_at, ends_at, req.adminId]);

    return success(res, banner.rows[0], 'Banner added', 201);
  } catch (err) {
    return error(res, 'Failed to add banner', 500);
  }
};

const addPopup = async (req, res) => {
  try {
    const { title, content, image_url, button_text, button_url, popup_type, platform, show_once, starts_at, ends_at } = req.body;

    const popup = await db.query(`
      INSERT INTO app_popups (title, content, image_url, button_text, button_url, popup_type, platform, show_once, starts_at, ends_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [title, content, image_url, button_text, button_url,
        popup_type || 'announcement', platform || 'all',
        show_once !== false, starts_at, ends_at, req.adminId]);

    return success(res, popup.rows[0], 'Popup added', 201);
  } catch (err) {
    return error(res, 'Failed to add popup', 500);
  }
};

// ANNOUNCEMENT
const addAnnouncement = async (req, res) => {
  try {
    const { title, content, type, expires_at } = req.body;

    const ann = await db.query(`
      INSERT INTO announcements (title, content, type, is_published, published_at, expires_at, created_by)
      VALUES ($1,$2,$3,true,NOW(),$4,$5)
      RETURNING *
    `, [title, content, type || 'system', expires_at, req.adminId]);

    return success(res, ann.rows[0], 'Announcement published', 201);
  } catch (err) {
    return error(res, 'Failed to add announcement', 500);
  }
};

module.exports = {
  adminLogin, getDashboard,
  getUsers, updateUserStatus, approveKYC,
  getCoinsAdmin, addCoin, updateCoin,
  addTradingPair,
  getPendingWithdrawals, processWithdrawal,
  getListings, processListing,
  getSettings, updateSetting,
  addBanner, addPopup, addAnnouncement
};
