const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getReferralInfo, getReferralList, getCommissionHistory } = require('../controllers/referral.controller');

router.use(authenticate);
router.get('/info',        getReferralInfo);
router.get('/list',        getReferralList);
router.get('/commissions', getCommissionHistory);

module.exports = router;
