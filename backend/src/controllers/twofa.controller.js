const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../config/database');
const { success, error } = require('../utils/response');
const { cache } = require('../config/redis');

// STEP 1: Generate secret + QR code
const setup2FA = async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `VDExchange (${req.user.email || req.user.uid})`,
      length: 32
    });

    // Temp store secret (not saved to DB yet - user must verify first)
    await cache.set(`2fa_setup:${req.user.id}`, {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url
    }, 600); // 10 min

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return success(res, {
      secret: secret.base32,
      qr_code: qrCodeDataUrl,
      manual_entry: secret.base32,
      otpauth_url: secret.otpauth_url
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to setup 2FA', 500);
  }
};

// STEP 2: Verify OTP and enable 2FA
const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return error(res, 'OTP token required');

    // Get temp secret
    const setupData = await cache.get(`2fa_setup:${req.user.id}`);
    if (!setupData) return error(res, 'Setup expired. Please start again.');

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: setupData.secret,
      encoding: 'base32',
      token: token.replace(/\s/g, ''),
      window: 2
    });

    if (!verified) return error(res, 'Invalid OTP code. Please try again.');

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    // Save to DB
    await db.query(`
      UPDATE two_factor_auth SET
        secret_key = $1, is_enabled = true,
        method = 'google_auth', backup_codes = $2,
        updated_at = NOW()
      WHERE user_id = $3
    `, [setupData.secret, backupCodes, req.user.id]);

    // Clear temp
    await cache.del(`2fa_setup:${req.user.id}`);

    // Log security
    await db.query(`
      INSERT INTO security_logs (user_id, action, ip_address, status)
      VALUES ($1, '2fa_enabled', $2, 'success')
    `, [req.user.id, req.ip]);

    return success(res, {
      backup_codes: backupCodes,
      message: '2FA enabled successfully!'
    }, '2FA Enabled!');
  } catch (err) {
    console.error(err);
    return error(res, 'Verification failed', 500);
  }
};

// STEP 3: Disable 2FA
const disable2FA = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) return error(res, 'OTP required to disable');

    // Get current secret
    const twoFA = await db.query(
      'SELECT * FROM two_factor_auth WHERE user_id = $1 AND is_enabled = true',
      [req.user.id]
    );
    if (!twoFA.rows[0]) return error(res, '2FA not enabled');

    // Verify OTP
    const verified = speakeasy.totp.verify({
      secret: twoFA.rows[0].secret_key,
      encoding: 'base32',
      token: token.replace(/\s/g, ''),
      window: 2
    });

    if (!verified) return error(res, 'Invalid OTP code');

    await db.query(`
      UPDATE two_factor_auth SET is_enabled = false, updated_at = NOW()
      WHERE user_id = $1
    `, [req.user.id]);

    await db.query(`
      INSERT INTO security_logs (user_id, action, ip_address, status)
      VALUES ($1, '2fa_disabled', $2, 'success')
    `, [req.user.id, req.ip]);

    return success(res, {}, '2FA disabled successfully');
  } catch (err) {
    return error(res, 'Failed to disable 2FA', 500);
  }
};

// LOGIN: Verify 2FA token
const verifyLogin2FA = async (req, res) => {
  try {
    const { temp_token, otp_token } = req.body;
    if (!temp_token || !otp_token) return error(res, 'temp_token and otp_token required');

    // Get temp data
    const tempData = await cache.get(`2fa_temp:${temp_token}`);
    if (!tempData) return error(res, 'Session expired. Please login again.');

    // Get secret
    const twoFA = await db.query(
      'SELECT secret_key, backup_codes FROM two_factor_auth WHERE user_id = $1 AND is_enabled = true',
      [tempData.userId]
    );
    if (!twoFA.rows[0]) return error(res, '2FA not found');

    const cleanToken = otp_token.replace(/\s/g, '');

    // Check TOTP
    const verified = speakeasy.totp.verify({
      secret: twoFA.rows[0].secret_key,
      encoding: 'base32',
      token: cleanToken,
      window: 2
    });

    // Check backup codes
    let isBackupCode = false;
    if (!verified && twoFA.rows[0].backup_codes) {
      const idx = twoFA.rows[0].backup_codes.indexOf(cleanToken.toUpperCase());
      if (idx !== -1) {
        isBackupCode = true;
        // Remove used backup code
        const newCodes = twoFA.rows[0].backup_codes.filter((_, i) => i !== idx);
        await db.query(
          'UPDATE two_factor_auth SET backup_codes = $1 WHERE user_id = $2',
          [newCodes, tempData.userId]
        );
      }
    }

    if (!verified && !isBackupCode) return error(res, 'Invalid OTP code');

    // Clear temp
    await cache.del(`2fa_temp:${temp_token}`);

    // Generate real session
    const { generateTokens } = require('../utils/jwt');
    const { accessToken, refreshToken } = generateTokens(tempData.userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(`
      INSERT INTO user_sessions (user_id, token, device_type, expires_at)
      VALUES ($1, $2, 'web', $3)
    `, [tempData.userId, accessToken, expiresAt]);

    // Get user
    const user = await db.query(
      'SELECT uid, email, phone, kyc_level, vip_level, theme, language FROM users WHERE id = $1',
      [tempData.userId]
    );

    return success(res, {
      user: user.rows[0],
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: '7d'
    }, 'Login successful');
  } catch (err) {
    console.error(err);
    return error(res, '2FA verification failed', 500);
  }
};

// GET 2FA status
const get2FAStatus = async (req, res) => {
  try {
    const twoFA = await db.query(
      'SELECT is_enabled, method FROM two_factor_auth WHERE user_id = $1',
      [req.user.id]
    );
    return success(res, {
      is_enabled: twoFA.rows[0]?.is_enabled || false,
      method: twoFA.rows[0]?.method || 'google_auth'
    });
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

module.exports = { setup2FA, verify2FA, disable2FA, verifyLogin2FA, get2FAStatus };
