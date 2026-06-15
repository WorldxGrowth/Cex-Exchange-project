const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  register, login, logout, getMe,
  googleAuth, googleCallback,
  forgotPassword, resetPassword
} = require('../controllers/auth.controller');
const {
  sendOTPHandler, verifyOTPHandler, checkIdentifier
} = require('../controllers/otp.controller');
const {
  loginLimiter, registerLimiter,
  otpSendLimiter, forgotPasswordLimiter
} = require('../middleware/rateLimiter');

router.post('/register',        registerLimiter,       register);
router.post('/login',           loginLimiter,          login);
router.post('/logout',          authenticate,          logout);
router.get('/me',               authenticate,          getMe);
router.get('/test',             (req, res) => res.json({ status: '1', message: 'Auth API working ✅' }));
router.get('/google',           googleAuth);
router.get('/google/callback',  googleCallback);
router.post('/otp/send',        otpSendLimiter,        sendOTPHandler);
router.post('/otp/verify',      verifyOTPHandler);
router.post('/check',           checkIdentifier);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password',  resetPassword);

module.exports = router;
