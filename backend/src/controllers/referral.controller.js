const db = require('../config/database');
const { success, error } = require('../utils/response');

// referral.controller.js →
// Referral system handle karta hai - referral
// link, commission history, total earnings

// GET referral info
const getReferralInfo = async (req, res) => {
  try {
    const user = await db.query(
      'SELECT uid, referral_code, referred_by FROM users WHERE id = $1',
      [req.user.id]
    );

    const u = user.rows[0];

    // Get commission rate from system settings
    const setting = await db.query(
      "SELECT value FROM system_settings WHERE key = 'referral_rate'",
    );
    const rate = parseFloat(setting.rows[0]?.value || 0.40) * 100;

    // Total referrals count
    const referrals = await db.query(
      'SELECT COUNT(*) as total FROM users WHERE referred_by = $1',
      [req.user.id]
    );

    // Total commission earned
    const earnings = await db.query(`
      SELECT COALESCE(SUM(commission_usdt), 0) as total_earned,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_usdt END), 0) as pending,
             COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_usdt END), 0) as paid
      FROM referral_commissions
      WHERE referrer_id = $1
    `, [req.user.id]);

    return success(res, {
      referral_code: u.referral_code,
      referral_link: `https://vdexchange.com/register?ref=${u.referral_code}`,
      commission_rate: `${rate}%`,
      total_referrals: parseInt(referrals.rows[0].total),
      total_earned: earnings.rows[0].total_earned,
      pending_commission: earnings.rows[0].pending,
      paid_commission: earnings.rows[0].paid
    });
  } catch (err) {
    return error(res, 'Failed to get referral info', 500);
  }
};

// GET referral list
const getReferralList = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const referrals = await db.query(`
      SELECT uid, email, kyc_level, vip_level, created_at,
             (SELECT COALESCE(SUM(commission_usdt), 0)
              FROM referral_commissions
              WHERE referee_id = u.id AND referrer_id = $1) as commission_earned
      FROM users u
      WHERE referred_by = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    return success(res, referrals.rows);
  } catch (err) {
    return error(res, 'Failed to get referrals', 500);
  }
};

// GET commission history
const getCommissionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const commissions = await db.query(`
      SELECT rc.*, c.symbol as coin_symbol,
             u.uid as referee_uid
      FROM referral_commissions rc
      JOIN coins c ON c.id = rc.coin_id
      JOIN users u ON u.id = rc.referee_id
      WHERE rc.referrer_id = $1
      ORDER BY rc.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    return success(res, commissions.rows);
  } catch (err) {
    return error(res, 'Failed to get commission history', 500);
  }
};

module.exports = { getReferralInfo, getReferralList, getCommissionHistory };
