const db = require('../config/database');
const { success, error } = require('../utils/response');
const otpService = require('../services/otpService');

// ── Check if email/phone exists ───────────────────
// Used in login step 1: check DB before sending OTP
const checkIdentifier = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return error(res, 'identifier required');

    const isEmail = identifier.includes('@');
    let user;

    if (isEmail) {
      user = await db.query(
        'SELECT id, email, status FROM users WHERE email=$1',
        [identifier.toLowerCase()]
      );
    } else {
      const phone = identifier.replace(/\D/g, '');
      user = await db.query(
        'SELECT id, phone, status FROM users WHERE phone=$1 OR phone=$2',
        [phone, '+' + phone]
      );
    }

    if (user.rows.length === 0) {
      return success(res, { exists: false, type: isEmail ? 'email' : 'phone' });
    }

    const u = user.rows[0];
    if (u.status === 'banned')     return error(res, 'Account banned');
    if (u.status === 'suspended')  return error(res, 'Account suspended');

    return success(res, {
      exists: true,
      type:   isEmail ? 'email' : 'phone',
    });
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

// ── Send OTP ──────────────────────────────────────
const sendOTPHandler = async (req, res) => {
  try {
    const { identifier, type = 'login' } = req.body;
    if (!identifier) return error(res, 'identifier required');

    const validTypes = ['login', 'register', 'withdrawal', 'bind_phone', 'reset_password'];
    if (!validTypes.includes(type)) return error(res, 'Invalid OTP type');

    const result = await otpService.sendOTP(identifier, type);

    if (!result.ok) return error(res, result.error || 'Failed to send OTP');

    return success(res, {
      sent: true,
      test_mode: result.test_mode || false,
    }, result.test_mode ? 'Test OTP (check console)' : 'OTP sent successfully');

  } catch (err) {
    return error(res, 'Failed to send OTP', 500);
  }
};

// ── Verify OTP ────────────────────────────────────
const verifyOTPHandler = async (req, res) => {
  try {
    const { identifier, code, type = 'login' } = req.body;
    if (!identifier || !code) return error(res, 'identifier and code required');

    const result = await otpService.verifyOTP(identifier, code, type);

    if (!result.ok) return error(res, result.error || 'Invalid OTP');

    return success(res, { verified: true }, 'OTP verified');

  } catch (err) {
    return error(res, 'Failed to verify OTP', 500);
  }
};

module.exports = { checkIdentifier, sendOTPHandler, verifyOTPHandler };
