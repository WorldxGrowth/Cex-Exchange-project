const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getDepositAddress, getDepositHistory } = require('../controllers/deposit.controller');

router.use(authenticate);
router.get('/address', getDepositAddress);
router.get('/history', getDepositHistory);

module.exports = router;
