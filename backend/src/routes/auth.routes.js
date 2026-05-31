const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/test', (req, res) => res.json({ status: '1', message: 'Auth API working ✅' }));

module.exports = router;

// Google OAuth routes
const { googleAuth, googleCallback } = require('../controllers/auth.controller');
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

// ── OTP Routes ────────────────────────────────────
const { sendOTPHandler, verifyOTPHandler, checkIdentifier } = require('../controllers/otp.controller');
router.post('/otp/send',   sendOTPHandler);
router.post('/otp/verify', verifyOTPHandler);
router.post('/check',      checkIdentifier); // email/phone exists check
