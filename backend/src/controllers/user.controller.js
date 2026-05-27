const db = require('../config/database');
const { success, error } = require('../utils/response');
const bcrypt = require('bcryptjs');

const getProfile = async (req, res) => {
  try {
    const user = await db.query(`
      SELECT u.id, u.uid, u.email, u.phone, u.alias, u.kyc_level, u.vip_level,
             u.referral_code, u.language, u.theme, u.full_name, u.date_of_birth,
             u.nationality, u.address, u.avatar, u.two_fa_enabled,
             t.is_enabled as two_fa_enabled
      FROM users u
      LEFT JOIN two_factor_auth t ON t.user_id = u.id
      WHERE u.id = $1
    `, [req.user.id]);

    return success(res, user.rows[0]);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const updateProfile = async (req, res) => {
  try {
    const { full_name, phone, nationality, address, date_of_birth, language, theme } = req.body;

    // Phone unique check
    if (phone) {
      const existing = await db.query(
        'SELECT id FROM users WHERE phone = $1 AND id != $2', [phone, req.user.id]
      );
      if (existing.rows.length > 0) return error(res, 'Phone already in use');
    }

    await db.query(`
      UPDATE users SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        nationality = COALESCE($3, nationality),
        address = COALESCE($4, address),
        date_of_birth = COALESCE($5::date, date_of_birth),
        language = COALESCE($6, language),
        theme = COALESCE($7, theme),
        updated_at = NOW()
      WHERE id = $8
    `, [full_name || null, phone || null, nationality || null,
        address || null, date_of_birth || null,
        language || null, theme || null, req.user.id]);

    return success(res, {}, 'Profile updated');
  } catch (err) {
    console.error(err);
    return error(res, 'Update failed', 500);
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return error(res, 'Both passwords required');
    if (new_password.length < 8) return error(res, 'Min 8 characters');

    const user = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return error(res, 'Current password incorrect');

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    return success(res, {}, 'Password changed');
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const getLoginHistory = async (req, res) => {
  try {
    const logs = await db.query(`
      SELECT ip_address, device_type, status, created_at
      FROM security_logs
      WHERE user_id = $1 AND action = 'login'
      ORDER BY created_at DESC LIMIT 20
    `, [req.user.id]);
    return success(res, logs.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await db.query(`
      SELECT id, device_type, created_at, expires_at
      FROM user_sessions WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);
    return success(res, sessions.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

const submitKYC = async (req, res) => {
  try {
    const { full_name, date_of_birth, nationality, id_type, id_number,
            id_front_url, id_back_url, selfie_url, address } = req.body;

    // Check existing
    const existing = await db.query(
      'SELECT id, status FROM kyc_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (existing.rows[0]?.status === 'pending') return error(res, 'KYC already under review');
    if (existing.rows[0]?.status === 'approved') return error(res, 'KYC already approved');

    await db.query(`
      INSERT INTO kyc_verifications
        (user_id, full_name, date_of_birth, nationality, id_type, id_number,
         id_front_url, id_back_url, selfie_url, address, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
    `, [req.user.id, full_name, date_of_birth, nationality, id_type,
        id_number, id_front_url, id_back_url, selfie_url, address]);

    return success(res, {}, 'KYC submitted for review');
  } catch (err) {
    console.error(err);
    return error(res, 'Failed', 500);
  }
};

const getKYCStatus = async (req, res) => {
  try {
    const user = await db.query('SELECT kyc_level FROM users WHERE id = $1', [req.user.id]);
    const kyc = await db.query(`
      SELECT status, rejection_reason, created_at
      FROM kyc_verifications WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);

    return success(res, {
      kyc_level: user.rows[0]?.kyc_level || 0,
      submission: kyc.rows[0] || null
    });
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

module.exports = { getProfile, updateProfile, changePassword,
                   getLoginHistory, getSessions, submitKYC, getKYCStatus };

const setAntiPhishCode = async (req, res) => {
  try {
    const { code } = req.body;
    await db.query('UPDATE users SET anti_phish_code = $1 WHERE id = $2', [code, req.user.id]);
    return success(res, {}, 'Anti-phishing code set');
  } catch (err) { return error(res, 'Failed', 500); }
};

const revokeSession = async (req, res) => {
  try {
    await db.query('DELETE FROM user_sessions WHERE id = $1 AND user_id = $2',
      [req.params.session_id, req.user.id]);
    return success(res, {}, 'Session revoked');
  } catch (err) { return error(res, 'Failed', 500); }
};

module.exports = { getProfile, updateProfile, changePassword, setAntiPhishCode,
                   getLoginHistory, getSessions, revokeSession, submitKYC, getKYCStatus };
