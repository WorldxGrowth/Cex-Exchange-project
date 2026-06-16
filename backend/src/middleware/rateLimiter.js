/**
 * VDExchange — Per Endpoint Rate Limiter
 * express-rate-limit v8.x
 * trust proxy = true (already set in server.js)
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const rateLimitHandler = (req, res) => {
  res.status(429).json({
    status: '0',
    message: 'Too many requests. Please try again later.',
  });
};

// ── 1. Login — 5/min ─────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => ipKeyGenerator(req),
});

// ── 2. Register — 3/10min ────────────────────────
const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 3,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => ipKeyGenerator(req),
});

// ── 3. OTP Send — 3/min ──────────────────────────
const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000, max: 3,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => ipKeyGenerator(req),
});

// ── 4. Forgot Password — 3/hour ──────────────────
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => ipKeyGenerator(req),
});

// ── 5. Withdrawal — 5/hour per user ──────────────
const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    const userId = req.user?.id || req.user?.userId;
    return userId ? `user_${userId}` : ipKeyGenerator(req);
  },
});

// ── 6. Order Place — 60/min per user ─────────────
const orderPlaceLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    const userId = req.user?.id || req.user?.userId;
    return userId ? `user_${userId}` : ipKeyGenerator(req);
  },
});

// ── 7. Admin Login — 10/5min ─────────────────────
const adminLoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => ipKeyGenerator(req),
});

// ── 8. General — 300/min ─────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => ipKeyGenerator(req),
});

module.exports = {
  loginLimiter, registerLimiter, otpSendLimiter,
  forgotPasswordLimiter, withdrawalLimiter,
  orderPlaceLimiter, adminLoginLimiter, generalLimiter,
};
