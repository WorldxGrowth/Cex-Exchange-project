const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getBalances, getDepositAddress, getDepositHistory,
  submitWithdrawal, getWithdrawalHistory,
  internalTransfer, getTransactionHistory
} = require('../controllers/wallet.controller');

router.use(authenticate);

router.get('/balances',           getBalances);
router.get('/deposit/:coin',      getDepositAddress);
router.get('/deposits',           getDepositHistory);
router.post('/withdraw',          submitWithdrawal);
router.get('/withdrawals',        getWithdrawalHistory);
router.post('/transfer',          internalTransfer);
router.get('/transactions',       getTransactionHistory);

module.exports = router;
