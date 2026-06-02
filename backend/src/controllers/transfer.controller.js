const db = require('../config/database');
const { success, error } = require('../utils/response');

const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('../services/email/emailService');
    await emailService[fn](...args);
  } catch (e) { console.error(`Email ${fn} failed:`, e.message); }
};

// ── SPOT ↔ FUTURES TRANSFER ───────────────────────
const transferBetweenAccounts = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { coin, amount, from_account, to_account } = req.body;

    if (!coin || !amount || !from_account || !to_account)
      return error(res, 'coin, amount, from_account, to_account required');

    const validAccounts = ['spot', 'futures', 'funding'];
    if (!validAccounts.includes(from_account) || !validAccounts.includes(to_account))
      return error(res, 'Invalid account type');

    if (from_account === to_account)
      return error(res, 'Cannot transfer to same account');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return error(res, 'Invalid amount');

    // Get coin
    const coinRow = await db.query(
      'SELECT id, symbol FROM coins WHERE symbol=$1 AND is_active=true',
      [coin.toUpperCase()]
    );
    if (!coinRow.rows[0]) return error(res, 'Coin not found');
    const coinId = coinRow.rows[0].id;

    // Check from balance
    const fromBal = await client.query(`
      SELECT available FROM balances
      WHERE user_id=$1 AND coin_id=$2 AND account_type=$3
      FOR UPDATE
    `, [req.user.id, coinId, from_account]);

    const available = parseFloat(fromBal.rows[0]?.available || 0);
    if (available < amt)
      return error(res, `Insufficient ${from_account} balance. Available: ${available.toFixed(6)} ${coin}`);

    // Deduct from
    await client.query(`
      UPDATE balances SET available=available-$1, updated_at=NOW()
      WHERE user_id=$2 AND coin_id=$3 AND account_type=$4
    `, [amt, req.user.id, coinId, from_account]);

    // Add to (upsert)
    await client.query(`
      INSERT INTO balances (user_id, coin_id, account_type, available, locked)
      VALUES ($1,$2,$3,$4,0)
      ON CONFLICT (user_id, coin_id, account_type)
      DO UPDATE SET available=balances.available+$4, updated_at=NOW()
    `, [req.user.id, coinId, to_account, amt]);

    // Log transfer
    const txId = 'TF' + Date.now() + Math.random().toString(36).substr(2,4).toUpperCase();
    await client.query(`
      INSERT INTO transfers (user_id, coin_id, from_account, to_account, amount, status, created_at)
      VALUES ($1,$2,$3,$4,$5,'completed',NOW())
    `, [req.user.id, coinId, from_account, to_account, amt]);

    await client.query('COMMIT');

    return success(res, {
      tx_id:        txId,
      coin,
      amount:       amt,
      from_account,
      to_account,
      status:       'completed'
    }, `Transferred ${amt} ${coin} from ${from_account} to ${to_account}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transfer error:', err.message);
    return error(res, err.message || 'Failed', 500);
  } finally { client.release(); }
};

// ── INTERNAL TRANSFER (by UID/email/phone) ────────
const internalTransfer = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { coin, amount, to_identifier } = req.body;
    // to_identifier = UID or email or phone

    if (!coin || !amount || !to_identifier)
      return error(res, 'coin, amount, to_identifier required');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return error(res, 'Invalid amount');
    if (amt < 0.0001) return error(res, 'Minimum transfer: 0.0001');

    // Find recipient
    const recipient = await db.query(`
      SELECT id, uid, email, full_name FROM users
      WHERE uid=$1 OR email=$1 OR phone=$1
      LIMIT 1
    `, [to_identifier.trim()]);

    if (!recipient.rows[0]) return error(res, 'User not found');
    if (recipient.rows[0].id === req.user.id)
      return error(res, 'Cannot transfer to yourself');

    // Get coin
    const coinRow = await db.query(
      'SELECT id, symbol FROM coins WHERE symbol=$1 AND is_active=true',
      [coin.toUpperCase()]
    );
    if (!coinRow.rows[0]) return error(res, 'Coin not found');
    const coinId = coinRow.rows[0].id;

    // Check sender balance
    const fromBal = await client.query(`
      SELECT available FROM balances
      WHERE user_id=$1 AND coin_id=$2 AND account_type='spot'
      FOR UPDATE
    `, [req.user.id, coinId]);

    const available = parseFloat(fromBal.rows[0]?.available || 0);
    if (available < amt)
      return error(res, `Insufficient balance. Available: ${available.toFixed(6)} ${coin}`);

    // Deduct sender
    await client.query(`
      UPDATE balances SET available=available-$1, updated_at=NOW()
      WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
    `, [amt, req.user.id, coinId]);

    // Add to recipient (upsert)
    await client.query(`
      INSERT INTO balances (user_id, coin_id, account_type, available, locked)
      VALUES ($1,$2,'spot',$3,0)
      ON CONFLICT (user_id, coin_id, account_type)
      DO UPDATE SET available=balances.available+$3, updated_at=NOW()
    `, [recipient.rows[0].id, coinId, amt]);

    const txId = 'IT' + Date.now() + Math.random().toString(36).substr(2,4).toUpperCase();

    await client.query(`
      INSERT INTO transfers (user_id, coin_id, from_account, to_account, amount, status, created_at)
      VALUES ($1,$2,'spot','spot',$3,'completed',NOW())
    `, [req.user.id, coinId, amt]);

    await client.query('COMMIT');

    return success(res, {
      tx_id:     txId,
      coin,
      amount:    amt,
      to_uid:    recipient.rows[0].uid,
      to_name:   recipient.rows[0].full_name || recipient.rows[0].email,
      status:    'completed'
    }, `Sent ${amt} ${coin} to ${recipient.rows[0].uid}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('internalTransfer error:', err.message);
    return error(res, err.message || 'Failed', 500);
  } finally { client.release(); }
};

// ── LOOKUP USER (for internal transfer) ──────────
const lookupUser = async (req, res) => {
  try {
    const { identifier } = req.query;
    if (!identifier) return error(res, 'identifier required');

    const user = await db.query(`
      SELECT uid, full_name, email, avatar
      FROM users WHERE uid=$1 OR email=$1 OR phone=$1
      LIMIT 1
    `, [identifier.trim()]);

    if (!user.rows[0]) return error(res, 'User not found');
    if (user.rows[0].id === req.user.id)
      return error(res, 'Cannot transfer to yourself');

    return success(res, {
      uid:      user.rows[0].uid,
      name:     user.rows[0].full_name || 'VDExchange User',
      avatar:   user.rows[0].avatar,
      email:    user.rows[0].email?.slice(0,3) + '****' +
                user.rows[0].email?.slice(user.rows[0].email.indexOf('@'))
    });
  } catch (err) { return error(res, 'Failed', 500); }
};

// ── TRANSFER HISTORY ──────────────────────────────
const getTransferHistory = async (req, res) => {
  try {
    const history = await db.query(`
      SELECT t.id, t.from_account, t.to_account, t.amount,
             t.status, t.created_at,
             c.symbol, c.name, c.logo_url
      FROM transfers t
      JOIN coins c ON c.id = t.coin_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC LIMIT 50
    `, [req.user.id]);
    return success(res, history.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

module.exports = {
  transferBetweenAccounts,
  internalTransfer,
  lookupUser,
  getTransferHistory
};
