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
  addBanner, addPopup, addAnnouncement,
  getDeposits, getWithdrawals, getScannerState, getKYCList,
  getBannersAdmin, adjustBalance,
  getUserDetail, getUserBalances, getUserDeposits,
  getUserWithdrawals, getUserLedger
} = require('../controllers/admin.controller');

// Public
router.post('/login', adminLogin);

// All below require admin auth
router.use(adminAuth);

// Dashboard
router.get('/dashboard', getDashboard);

// Users
router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/status', updateUserStatus);
router.get('/users/:id/balances', getUserBalances);
router.get('/users/:id/deposits', getUserDeposits);
router.get('/users/:id/withdrawals', getUserWithdrawals);
router.get('/users/:id/ledger', getUserLedger);
router.post('/users/:id/balance', adjustBalance);

// KYC
router.get('/kyc', getKYCList);
router.put('/kyc/:kyc_id', approveKYC);

// Deposits
router.get('/deposits', getDeposits);

// Withdrawals
router.get('/withdrawals', getWithdrawals);
router.get('/withdrawals/pending', getPendingWithdrawals);
router.put('/withdrawals/:id', processWithdrawal);

// Coins & Pairs
router.get('/coins', getCoinsAdmin);
router.post('/coins', addCoin);
router.put('/coins/:id', updateCoin);
router.post('/pairs', addTradingPair);

// Listings
router.get('/listings', getListings);
router.put('/listings/:id', processListing);

// Scanner
router.get('/scanner/state', getScannerState);

// Banners
router.get('/banners', getBannersAdmin);
router.post('/banners', addBanner);

// Announcements
router.post('/announcements', addAnnouncement);
router.post('/popups', addPopup);

// Settings
router.get('/settings', getSettings);
router.put('/settings/:key', updateSetting);

// Bot Management
router.use('/bots', require('./bot.routes'));

module.exports = router;
