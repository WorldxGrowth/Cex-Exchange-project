const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getDepositAddress, getDepositHistory, getCoinNetworks } = require('../controllers/deposit.controller');

router.use(authenticate);
router.get('/address', getDepositAddress);
router.get('/history', getDepositHistory);
router.get('/coin-networks', getCoinNetworks);

module.exports = router;
