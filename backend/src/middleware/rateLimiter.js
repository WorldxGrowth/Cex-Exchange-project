/**
 * VDExchange — Per Endpoint Rate Limiter
 * express-rate-limit v8.x
 * trust proxy = true (already set in server.js)
 */

const { rateLimit } = require('express-rate-limit');

// ── Helper: standard response format ──────────────
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    status: '0',
    message: 'Too many requests. Please try again later.',
  });
};

// ── 1. Login — 5 attempts per 1 min ──────────────
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});

// ── 2. Register — 3 per 10 min ───────────────────
const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});

// ── 3. OTP Send — 3 per 1 min ────────────────────
const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});

// ── 4. Forgot Password — 3 per hour ──────────────
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});

// ── 5. Withdrawal — 5 per hour per user ──────────
const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // IP + userId dono se limit (agar token available ho)
  keyGenerator: (req) => {
    const userId = req.user?.id || req.user?.userId;
    return userId ? `user_${userId}` : req.ip;
  },
});

// ── 6. Order Place — 60 per min per user ─────────
const orderPlaceLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    const userId = req.user?.id || req.user?.userId;
    return userId ? `user_${userId}` : req.ip;
  },
});

// ── 7. Admin Login steps — 10 per 5 min per IP ───
const adminLoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});

// ── 8. General API — 300 per min (global safety) ─
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  otpSendLimiter,
  forgotPasswordLimiter,
  withdrawalLimiter,
  orderPlaceLimiter,
  adminLoginLimiter,
  generalLimiter,
};
