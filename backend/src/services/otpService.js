/**
 * VDExchange - Centralized OTP Service
 * =====================================
 * Supports: Email OTP + SMS (apitxt.com) + WhatsApp + Voice
 * Test bypass: otp_test_number + otp_test_code from system_settings
 * Fallback: provider1 → provider2 → email fallback
 */

const db     = require('../config/database');
const { cache } = require('../config/redis');
const crypto = require('crypto');
const axios  = require('axios');

// ── Generate 6-digit OTP ──────────────────────────
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ── Get SMS settings from DB ──────────────────────
const getSmsSettings = async () => {
  const res = await db.query(
    "SELECT key, value FROM system_settings WHERE category='sms'"
  );
  const s = {};
  res.rows.forEach(r => { s[r.key] = r.value; });
  return {
    provider:       s['sms_provider'] || 'none',
    p1_name:        s['sms_provider1_name'] || 'apitxt',
    p1_key:         s['sms_provider1_key'] || '',
    p1_url:         s['sms_provider1_url'] || 'https://apitxt.com/api/sendOTP',
    p2_name:        s['sms_provider2_name'] || '',
    p2_key:         s['sms_provider2_key'] || '',
    expire_sec:     parseInt(s['otp_expire_seconds'] || 300),
    max_attempts:   parseInt(s['otp_max_attempts'] || 5),
    test_number:    s['otp_test_number'] || '',
    test_code:      s['otp_test_code'] || '',
  };
};

// ── Send SMS via apitxt.com ───────────────────────
const sendSmsApitxt = async (mobile, otp, apiKey, channel = 'sms') => {
  const url = `https://apitxt.com/api/sendOTP?authkey=${apiKey}&mobile=${mobile}&otp=${otp}&channel=${channel}`;
  const res = await axios.get(url, { timeout: 10000 });
  if (res.data?.status === 'success') {
    return { ok: true, request_id: res.data.data?.request_id };
  }
  throw new Error(res.data?.message || 'SMS send failed');
};

// ── Send Email OTP ────────────────────────────────
const sendEmailOTP = async (email, otp, type = 'login') => {
  try {
    const emailService = require('./email/emailService');
    await emailService.sendOTPEmail({ email }, otp, type);
    return { ok: true };
  } catch (e) {
    console.error('[OTP] Email send error:', e.message);
    return { ok: false, error: e.message };
  }
};

// ── Main: Send OTP ────────────────────────────────
// identifier = email or phone (with country code: 919876543210)
// type = login | register | withdrawal | bind_phone
const sendOTP = async (identifier, type = 'login') => {
  try {
    const settings = await getSmsSettings();
    const isPhone  = /^\d{10,15}$/.test(identifier.replace(/\D/g, ''));
    const isEmail  = identifier.includes('@');

    // ── Test number bypass ─────────────────────────
    const cleanPhone = identifier.replace(/\D/g, '');
    const testNumber = settings.test_number.replace(/\D/g, '');
    if (isPhone && testNumber && cleanPhone.endsWith(testNumber)) {
      const testOtp = settings.test_code || '194750';

      // Save to DB
      await db.query(`
        DELETE FROM otp_codes
        WHERE identifier=$1 AND type=$2 AND is_used=false
      `, [identifier, type]);

      await db.query(`
        INSERT INTO otp_codes (identifier, type, code, expires_at)
        VALUES ($1,$2,$3,NOW() + INTERVAL '${settings.expire_sec} seconds')
      `, [identifier, type, testOtp]);

      console.log(`[OTP] Test bypass: ${identifier} → ${testOtp}`);
      return { ok: true, test_mode: true };
    }

    // ── Generate real OTP ──────────────────────────
    const otp = generateOTP();

    // Rate limit check (max 3 per 60s)
    const rateKey = `otp_rate:${identifier}`;
    const rateCount = await cache.get(rateKey) || 0;
    if (rateCount >= 3) {
      return { ok: false, error: 'Too many OTP requests. Wait 1 minute.' };
    }

    // Save to DB (invalidate old ones)
    await db.query(`
      UPDATE otp_codes SET is_used=true
      WHERE identifier=$1 AND type=$2 AND is_used=false
    `, [identifier, type]);

    await db.query(`
      INSERT INTO otp_codes (identifier, type, code, expires_at)
      VALUES ($1,$2,$3,NOW() + INTERVAL '${settings.expire_sec} seconds')
    `, [identifier, type, otp]);

    // Update rate limit
    await cache.set(rateKey, (parseInt(rateCount) + 1), 60);

    // ── Send via appropriate channel ───────────────
    if (isEmail) {
      return await sendEmailOTP(identifier, otp, type);
    }

    if (isPhone) {
      // Format mobile with country code
      let mobile = cleanPhone;
      if (mobile.length === 10) mobile = '91' + mobile; // India default

      // Try provider 1
      try {
        if (settings.p1_key) {
          const result = await sendSmsApitxt(mobile, otp, settings.p1_key);
          console.log(`[OTP] SMS sent via ${settings.p1_name}: ${mobile}`);
          return { ok: true, request_id: result.request_id };
        }
      } catch (e) {
        console.error(`[OTP] Provider1 failed: ${e.message}`);

        // Try provider 2 fallback
        if (settings.p2_key) {
          try {
            const result = await sendSmsApitxt(mobile, otp, settings.p2_key);
            console.log(`[OTP] SMS sent via provider2: ${mobile}`);
            return { ok: true, request_id: result.request_id };
          } catch (e2) {
            console.error(`[OTP] Provider2 failed: ${e2.message}`);
          }
        }

        return { ok: false, error: 'SMS delivery failed. Try email.' };
      }
    }

    return { ok: false, error: 'Invalid identifier' };

  } catch (err) {
    console.error('[OTP] sendOTP error:', err.message);
    return { ok: false, error: err.message };
  }
};

// ── Verify OTP ────────────────────────────────────
const verifyOTP = async (identifier, code, type = 'login') => {
  try {
    const settings = await getSmsSettings();

    // Get latest unused OTP
    const res = await db.query(`
      SELECT * FROM otp_codes
      WHERE identifier=$1 AND type=$2 AND is_used=false
      ORDER BY created_at DESC LIMIT 1
    `, [identifier, type]);

    if (!res.rows[0]) {
      return { ok: false, error: 'OTP not found or expired' };
    }

    const otpRecord = res.rows[0];

    // Expiry check
    if (new Date() > new Date(otpRecord.expires_at)) {
      await db.query('UPDATE otp_codes SET is_used=true WHERE id=$1', [otpRecord.id]);
      return { ok: false, error: 'OTP expired. Request new one.' };
    }

    // Max attempts check
    if (otpRecord.attempts >= settings.max_attempts) {
      await db.query('UPDATE otp_codes SET is_used=true WHERE id=$1', [otpRecord.id]);
      return { ok: false, error: 'Too many wrong attempts. Request new OTP.' };
    }

    // Wrong code
    if (otpRecord.code !== code.toString().trim()) {
      await db.query(
        'UPDATE otp_codes SET attempts=attempts+1 WHERE id=$1',
        [otpRecord.id]
      );
      const remaining = settings.max_attempts - otpRecord.attempts - 1;
      return { ok: false, error: `Wrong OTP. ${remaining} attempts remaining.` };
    }

    // ✅ Correct!
    await db.query(
      'UPDATE otp_codes SET is_used=true WHERE id=$1',
      [otpRecord.id]
    );

    return { ok: true };

  } catch (err) {
    console.error('[OTP] verifyOTP error:', err.message);
    return { ok: false, error: err.message };
  }
};

module.exports = { sendOTP, verifyOTP, generateOTP };
