const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getProfile, updateProfile, changePassword,
  setAntiPhishCode, getLoginHistory, getSessions,
  revokeSession, submitKYC, getKYCStatus
} = require('../controllers/user.controller');

router.use(authenticate); // All routes protected

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/change-password', changePassword);
router.post('/anti-phish-code', setAntiPhishCode);
router.get('/login-history', getLoginHistory);
router.get('/sessions', getSessions);
router.delete('/sessions/:session_id', revokeSession);
router.post('/kyc/submit', submitKYC);
router.get('/kyc/status', getKYCStatus);

module.exports = router;
