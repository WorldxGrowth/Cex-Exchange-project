const bcrypt   = require('bcryptjs');
const db       = require('../config/database');
const UAParser = require('ua-parser-js');
const geoip    = require('geoip-lite');
const { generateTokens }             = require('../utils/jwt');
const { generateUID, generateReferralCode } = require('../utils/helpers');
const { success, error }             = require('../utils/response');

// Email helper - always safe
const sendEmail = async (fn, ...args) => {
  try {
    const emailService = require('../services/email/emailService');
    await emailService[fn](...args);
  } catch (e) {
    console.error(`Email ${fn} failed:`, e.message);
  }
};

// ── Get real IP + Device + Location ──────────────
const getRequestInfo = (req) => {
  try {
    const ip =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-real-ip'] ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      '0.0.0.0';

    const cleanIp = ip.replace('::ffff:', '');
    // IPv6 to IPv4 convert if possible
    const lookupIp = cleanIp.includes(':') && !cleanIp.startsWith('::ffff:')
      ? cleanIp  // real IPv6
      : cleanIp.replace('::ffff:', '');

    const parser = new UAParser(req.headers['user-agent']);
    const ua     = parser.getResult();

    const deviceType = ua.device.type || 'desktop';
    const browser    = ua.browser.name || 'Unknown';
    const os         = ua.os.name || 'Unknown';
    const model      = ua.device.model || '';

    // Try IPv6 first, fallback to IPv4
    let geo = geoip.lookup(cleanIp) || {};
    if (!geo.country && cleanIp.includes(':')) {
      // Try with ipv6 lookup
      geo = geoip.lookup(cleanIp) || {};
    }

    const time = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    return {
      ip:      cleanIp,
      device:  deviceType.charAt(0).toUpperCase() + deviceType.slice(1),
      browser,
      os,
      model,
      country: geo.country || '',
      city:    geo.city    || '',
      time,
    };
  } catch (e) {
    return {
      ip: (req.ip || '0.0.0.0').replace('::ffff:', ''),
      device: 'Unknown', browser: 'Unknown', os: 'Unknown',
      country: '', city: '', time: new Date().toLocaleString()
    };
  }
};

// ── Alchemy address register helper (non-blocking) ─
const registerAddressToAlchemy = async (userId) => {
  try {
    if (process.env.ALCHEMY_NOTIFY_ENABLED !== 'true') return;
    const alchemyService = require('../services/alchemyService');
    const addresses = await db.query(
      'SELECT network, address FROM user_deposit_addresses WHERE user_id = $1',
      [userId]
    );
    for (const row of addresses.rows) {
      if (row.network === 'VDCHAIN') continue;
      await alchemyService.registerNewUserAddress(userId, row.network, row.address);
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.error('[Auth] Alchemy register error (non-blocking):', e.message);
  }
};

// ================================
// REGISTER
// ================================
const register = async (req, res) => {
  try {
    const { email, phone, password, referral_code } = req.body;

    if (!password || password.length < 8)
      return error(res, 'Password must be at least 8 characters');
    if (!email && !phone)
      return error(res, 'Email or phone required');

    if (email) {
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1', [email.toLowerCase()]
      );
      if (existing.rows.length > 0) return error(res, 'Email already registered');
    }
    if (phone) {
      const existing = await db.query(
        'SELECT id FROM users WHERE phone = $1', [phone]
      );
      if (existing.rows.length > 0) return error(res, 'Phone already registered');
    }

    let referredBy = null;
    if (referral_code) {
      const referrer = await db.query(
        'SELECT id FROM users WHERE referral_code = $1', [referral_code]
      );
      if (referrer.rows.length > 0) referredBy = referrer.rows[0].id;
    }

    const passwordHash   = await bcrypt.hash(password, 12);
    const uid            = generateUID();
    const myReferralCode = generateReferralCode();

    const newUser = await db.query(`
      INSERT INTO users (uid, email, phone, password_hash, referral_code, referred_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, uid, email, phone, status, kyc_level, vip_level, referral_code, created_at
    `, [uid,
        email ? email.toLowerCase() : null,
        phone || null,
        passwordHash, myReferralCode, referredBy]);

    const user = newUser.rows[0];

    await db.query('INSERT INTO two_factor_auth (user_id) VALUES ($1)', [user.id]);

    const { accessToken, refreshToken } = generateTokens(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const reqInfo = getRequestInfo(req);

    await db.query(`
      INSERT INTO user_sessions
        (user_id, token, device_type, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [user.id, accessToken,
        reqInfo.device.toLowerCase() || 'web',
        reqInfo.ip, req.headers['user-agent'], expiresAt]);

    await db.query(`
      INSERT INTO security_logs (user_id, action, ip_address, status)
      VALUES ($1, 'register', $2, 'success')
    `, [user.id, reqInfo.ip]);

    // Welcome email - async safe
    sendEmail('sendWelcomeEmail', user);

    // Alchemy - async non-blocking
    setTimeout(() => registerAddressToAlchemy(user.id), 3000);

    return success(res, {
      user: {
        uid:           user.uid,
        email:         user.email,
        phone:         user.phone,
        kyc_level:     user.kyc_level,
        vip_level:     user.vip_level,
        referral_code: user.referral_code,
        created_at:    user.created_at
      },
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_in:    '7d'
    }, 'Registration successful', 201);

  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Registration failed', 500);
  }
};

// ================================
// LOGIN
// ================================
const login = async (req, res) => {
  try {
    const { email, phone, password, device_type, device_name } = req.body;

    if (!password)         return error(res, 'Password required');
    if (!email && !phone)  return error(res, 'Email or phone required');

    let userResult;
    if (email) {
      userResult = await db.query(
        'SELECT * FROM users WHERE email = $1', [email.toLowerCase()]
      );
    } else {
      userResult = await db.query(
        'SELECT * FROM users WHERE phone = $1', [phone]
      );
    }

    if (userResult.rows.length === 0) return error(res, 'Invalid credentials');

    const user = userResult.rows[0];

    if (user.status === 'banned')    return error(res, 'Account banned');
    if (user.status === 'suspended') return error(res, 'Account suspended');

    const isValid = await bcrypt.compare(password, user.password_hash);

    // Get request info for logging
    const reqInfo = getRequestInfo(req);

    if (!isValid) {
      await db.query(`
        INSERT INTO login_history
          (user_id, ip_address, device_type, user_agent, status)
        VALUES ($1, $2, $3, $4, 'failed')
      `, [user.id, reqInfo.ip,
          reqInfo.device.toLowerCase() || 'web',
          req.headers['user-agent']]);
      return error(res, 'Invalid credentials');
    }

    // Check 2FA
    const twoFA       = await db.query(
      'SELECT * FROM two_factor_auth WHERE user_id = $1', [user.id]
    );
    const twoFAEnabled = twoFA.rows[0]?.is_enabled || false;

    if (twoFAEnabled) {
      const tempToken    = require('crypto').randomBytes(32).toString('hex');
      const { cache }    = require('../config/redis');
      await cache.set(`2fa_temp:${tempToken}`, { userId: user.id }, 300);
      return success(res,
        { requires_2fa: true, temp_token: tempToken },
        '2FA verification required'
      );
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(`
      INSERT INTO user_sessions
        (user_id, token, device_type, device_name, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [user.id, accessToken,
        reqInfo.device.toLowerCase() || 'web',
        device_name || (reqInfo.browser + ' on ' + reqInfo.os),
        reqInfo.ip, req.headers['user-agent'], expiresAt]);

    await db.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [reqInfo.ip, user.id]
    );

    await db.query(`
      INSERT INTO login_history
        (user_id, ip_address, device_type, user_agent, status)
      VALUES ($1, $2, $3, $4, 'success')
    `, [user.id, reqInfo.ip,
        reqInfo.device.toLowerCase() || 'web',
        req.headers['user-agent']]);

    // Login alert email with full device info - async safe
    sendEmail('sendLoginAlertEmail', user, {
      ip:      reqInfo.ip,
      device:  reqInfo.device,
      browser: reqInfo.browser,
      os:      reqInfo.os,
      country: reqInfo.country,
      city:    reqInfo.city,
      time:    reqInfo.time,
    });

    return success(res, {
      user: {
        uid:       user.uid,
        email:     user.email,
        phone:     user.phone,
        kyc_level: user.kyc_level,
        vip_level: user.vip_level,
        theme:     user.theme,
        language:  user.language
      },
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_in:    '7d'
    }, 'Login successful');

  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Login failed', 500);
  }
};

// ================================
// LOGOUT
// ================================
const logout = async (req, res) => {
  try {
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE token = $1',
      [req.token]
    );
    return success(res, {}, 'Logged out successfully');
  } catch (err) {
    return error(res, 'Logout failed', 500);
  }
};

// ================================
// GET ME
// ================================
const getMe = async (req, res) => {
  try {
    const user = await db.query(`
      SELECT id, uid, email, phone, alias, kyc_level, vip_level,
             referral_code, theme, language, currency, haptic_feedback,
             push_notif, email_verified, phone_verified, anti_phish_code,
             last_login_at, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    const twoFA = await db.query(
      'SELECT is_enabled, method FROM two_factor_auth WHERE user_id = $1',
      [req.user.id]
    );

    return success(res, {
      ...user.rows[0],
      two_fa_enabled: twoFA.rows[0]?.is_enabled || false,
      two_fa_method:  twoFA.rows[0]?.method     || null
    });
  } catch (err) {
    return error(res, 'Failed to get profile', 500);
  }
};

// ================================
// GOOGLE OAUTH
// ================================
const googleAuth = (req, res, next) => {
  const passport = require('../config/passport');
  passport.authenticate('google', {
    scope: ['profile', 'email'], session: false
  })(req, res, next);
};

const googleCallback = (req, res, next) => {
  const passport = require('../config/passport');
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`
  }, (err, data) => {
    if (err || !data)
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
    setTimeout(() => registerAddressToAlchemy(data.user.id), 3000);
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/google/success?token=${data.token}&uid=${data.user.uid}&email=${data.user.email}`
    );
  })(req, res, next);
};

module.exports = {
  register, login, logout, getMe, googleAuth, googleCallback
};
