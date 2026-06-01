const db     = require('../config/database');
const { success, error } = require('../utils/response');
const bcrypt = require('bcryptjs');

// ================================
// GET PROFILE
// ================================
const getProfile = async (req, res) => {
  try {
    const user = await db.query(`
      SELECT u.id, u.uid, u.email, u.phone, u.alias, u.kyc_level, u.vip_level,
             u.referral_code, u.language, u.theme, u.full_name, u.date_of_birth,
             u.nationality, u.address, u.avatar, u.gender,
             u.email_verified, u.phone_verified, u.anti_phish_code,
             u.state, u.city, u.pincode,
             u.last_login_at, u.created_at,
             t.is_enabled as two_fa_enabled
      FROM users u
      LEFT JOIN two_factor_auth t ON t.user_id = u.id
      WHERE u.id = $1
    `, [req.user.id]);
    return success(res, user.rows[0]);
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// UPDATE PROFILE
// ================================
const updateProfile = async (req, res) => {
  try {
    const { full_name, nationality, address, date_of_birth,
            language, theme, gender, avatar,
            state, city, pincode } = req.body;

    await db.query(`
      UPDATE users SET
        full_name     = COALESCE($1,  full_name),
        nationality   = COALESCE($2,  nationality),
        address       = COALESCE($3,  address),
        date_of_birth = COALESCE($4::date, date_of_birth),
        language      = COALESCE($5,  language),
        theme         = COALESCE($6,  theme),
        gender        = COALESCE($7,  gender),
        avatar        = COALESCE($8,  avatar),
        state         = COALESCE($9,  state),
        city          = COALESCE($10, city),
        pincode       = COALESCE($11, pincode),
        updated_at    = NOW()
      WHERE id = $12
    `, [
      full_name     || null,
      nationality   || null,
      address       || null,
      date_of_birth || null,
      language      || null,
      theme         || null,
      gender        || null,
      avatar        || null,
      state         || null,
      city          || null,
      pincode       || null,
      req.user.id
    ]);

    return success(res, {}, 'Profile updated');
  } catch (err) {
    console.error('updateProfile error:', err);
    return error(res, 'Update failed', 500);
  }
};

// ================================
// AVATAR UPLOAD
// ================================
const uploadAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar) return error(res, 'Avatar required');

    const sizeInBytes = Buffer.byteLength(
      avatar.replace(/^data:image\/\w+;base64,/, ''), 'base64'
    );
    if (sizeInBytes > 2 * 1024 * 1024)
      return error(res, 'Image too large. Max 2MB');

    await db.query(
      'UPDATE users SET avatar=$1, updated_at=NOW() WHERE id=$2',
      [avatar, req.user.id]
    );

    return success(res, { avatar }, 'Avatar updated');
  } catch (err) {
    console.error('uploadAvatar error:', err);
    return error(res, 'Failed', 500);
  }
};

// ================================
// CHANGE PASSWORD
// ================================
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return error(res, 'Both passwords required');
    if (new_password.length < 8)
      return error(res, 'Min 8 characters');

    const user = await db.query(
      'SELECT password_hash FROM users WHERE id = $1', [req.user.id]
    );
    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return error(res, 'Current password incorrect');

    const hash = await bcrypt.hash(new_password, 12);
    await db.query(
      'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2',
      [hash, req.user.id]
    );
    return success(res, {}, 'Password changed');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// ANTI-PHISH CODE
// ================================
const setAntiPhishCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length < 4) return error(res, 'Min 4 characters');
    await db.query(
      'UPDATE users SET anti_phish_code=$1, updated_at=NOW() WHERE id=$2',
      [code, req.user.id]
    );
    return success(res, {}, 'Anti-phishing code set');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// LOGIN HISTORY
// ================================
const getLoginHistory = async (req, res) => {
  try {
    const logs = await db.query(`
      SELECT ip_address, device_type, user_agent, status, created_at
      FROM login_history
      WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 20
    `, [req.user.id]);
    return success(res, logs.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// SESSIONS
// ================================
const getSessions = async (req, res) => {
  try {
    const sessions = await db.query(`
      SELECT id, device_type, device_name, ip_address,
             created_at, expires_at, is_active
      FROM user_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 10
    `, [req.user.id]);
    return success(res, sessions.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

const revokeSession = async (req, res) => {
  try {
    await db.query(
      'UPDATE user_sessions SET is_active=false WHERE id=$1 AND user_id=$2',
      [req.params.session_id, req.user.id]
    );
    return success(res, {}, 'Session revoked');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ================================
// KYC SUBMIT
// ================================
const submitKYC = async (req, res) => {
  try {
    const { full_name, date_of_birth, nationality, address,
            id_type, id_number, id_front_url, id_back_url, selfie_url } = req.body;

    if (!full_name || !id_type || !id_number || !id_front_url || !selfie_url)
      return error(res, 'Required fields missing');

    const existing = await db.query(`
      SELECT id, status FROM kyc_verifications
      WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);

    if (existing.rows[0]?.status === 'pending')
      return error(res, 'KYC already under review');
    if (existing.rows[0]?.status === 'approved')
      return error(res, 'KYC already approved');

    // Update user profile too
    await db.query(`
      UPDATE users SET
        full_name     = COALESCE($1, full_name),
        date_of_birth = COALESCE($2::date, date_of_birth),
        nationality   = COALESCE($3, nationality),
        address       = COALESCE($4, address),
        updated_at    = NOW()
      WHERE id = $5
    `, [full_name, date_of_birth || null, nationality || null,
        address || null, req.user.id]);

    if (existing.rows[0]?.status === 'rejected') {
      await db.query(`
        UPDATE kyc_verifications SET
          full_name=$1, date_of_birth=$2, nationality=$3,
          address=$4, id_type=$5, id_number=$6,
          id_front_url=$7, id_back_url=$8, selfie_url=$9,
          status='pending', rejection_reason=NULL,
          reviewed_by=NULL, reviewed_at=NULL, created_at=NOW()
        WHERE id=$10
      `, [full_name, date_of_birth, nationality, address,
          id_type, id_number, id_front_url, id_back_url || null,
          selfie_url, existing.rows[0].id]);
    } else {
      await db.query(`
        INSERT INTO kyc_verifications
          (user_id, full_name, date_of_birth, nationality, address,
           id_type, id_number, id_front_url, id_back_url, selfie_url, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
      `, [req.user.id, full_name, date_of_birth, nationality, address,
          id_type, id_number, id_front_url, id_back_url || null, selfie_url]);
    }

    return success(res, {}, 'KYC submitted. Review takes 24-48 hours.');
  } catch (err) {
    console.error('submitKYC error:', err);
    return error(res, 'KYC submission failed', 500);
  }
};

// ================================
// KYC STATUS
// ================================
const getKYCStatus = async (req, res) => {
  try {
    const user = await db.query(
      'SELECT kyc_level FROM users WHERE id=$1', [req.user.id]
    );
    const kyc = await db.query(`
      SELECT id, status, rejection_reason, id_type,
             full_name, nationality, created_at, reviewed_at
      FROM kyc_verifications
      WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);

    return success(res, {
      kyc_level:  user.rows[0]?.kyc_level || 0,
      submission: kyc.rows[0] || null
    });
  } catch (err) { return error(res, 'Failed', 500); }
};

// ── Single module.exports ─────────────────────────
module.exports = {
  getProfile, updateProfile, uploadAvatar,
  changePassword, setAntiPhishCode,
  getLoginHistory, getSessions, revokeSession,
  submitKYC, getKYCStatus
};
