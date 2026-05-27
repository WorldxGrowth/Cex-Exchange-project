const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { setup2FA, verify2FA, disable2FA, verifyLogin2FA, get2FAStatus } = require('../controllers/twofa.controller');

router.post('/login-verify', verifyLogin2FA); // Public - login 2FA

router.use(authenticate);
router.get('/status',  get2FAStatus);
router.post('/setup',  setup2FA);
router.post('/verify', verify2FA);
router.post('/disable', disable2FA);

module.exports = router;
