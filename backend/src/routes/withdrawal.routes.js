const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getWithdrawInfo, sendWithdrawalOTP,
  requestWithdrawal, getWithdrawalHistory
} = require('../controllers/withdrawal.controller');
const {
  withdrawalLimiter, otpSendLimiter
} = require('../middleware/rateLimiter');

router.use(authenticate);

router.get('/info',      getWithdrawInfo);
router.post('/send-otp', otpSendLimiter,    sendWithdrawalOTP);
router.post('/request',  withdrawalLimiter, requestWithdrawal);
router.get('/history',   getWithdrawalHistory);

module.exports = router;
