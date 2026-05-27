const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/admin.middleware');
const {
  adminLogin, getDashboard,
  getUsers, updateUserStatus, approveKYC,
  getCoinsAdmin, addCoin, updateCoin,
  addTradingPair,
  getPendingWithdrawals, processWithdrawal,
  getListings, processListing,
  getSettings, updateSetting,
  addBanner, addPopup, addAnnouncement
} = require('../controllers/admin.controller');

// Public admin route
router.post('/login', adminLogin);

// All below require admin auth
router.use(adminAuth);

// Dashboard
router.get('/dashboard', getDashboard);

// Users
router.get('/users',                  getUsers);
router.put('/users/:id/status',       updateUserStatus);
router.put('/kyc/:kyc_id',            approveKYC);

// Coins & Pairs
router.get('/coins',                  getCoinsAdmin);
router.post('/coins',                 addCoin);
router.put('/coins/:id',              updateCoin);
router.post('/pairs',                 addTradingPair);

// Withdrawals
router.get('/withdrawals/pending',    getPendingWithdrawals);
router.put('/withdrawals/:id',        processWithdrawal);

// Token Listings
router.get('/listings',               getListings);
router.put('/listings/:id',           processListing);

// Settings
router.get('/settings',               getSettings);
router.put('/settings/:key',          updateSetting);

// Content
router.post('/banners',               addBanner);
router.post('/popups',                addPopup);
router.post('/announcements',         addAnnouncement);

module.exports = router;
