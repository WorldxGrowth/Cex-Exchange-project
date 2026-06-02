const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  transferBetweenAccounts,
  internalTransfer,
  lookupUser,
  getTransferHistory
} = require('../controllers/transfer.controller');

router.use(authenticate);
router.get('/lookup',    lookupUser);
router.post('/accounts', transferBetweenAccounts);
router.post('/internal', internalTransfer);
router.get('/history',   getTransferHistory);

module.exports = router;
