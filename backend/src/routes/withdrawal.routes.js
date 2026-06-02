const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getWithdrawInfo, sendWithdrawalOTP,
  requestWithdrawal, getWithdrawalHistory
} = require('../controllers/withdrawal.controller');

router.use(authenticate);
router.get('/info',          getWithdrawInfo);
router.post('/send-otp',     sendWithdrawalOTP);
router.post('/request',      requestWithdrawal);
router.get('/history',       getWithdrawalHistory);

module.exports = router;
