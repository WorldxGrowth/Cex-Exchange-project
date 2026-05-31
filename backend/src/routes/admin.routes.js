const express = require('express');
const router  = express.Router();
const { adminAuth } = require('../middleware/admin.middleware');
const {
  adminLogin, getDashboard,
  getUsers, updateUserStatus, updateUserVip, approveKYC,
  getUserDetail, getUserBalances, getUserDeposits,
  getUserWithdrawals, getUserLedger, adjustBalance,
  getCoinsAdmin, addCoin, updateCoin,
  getTradingPairs, addTradingPair, updateTradingPair,
  getFeeRules, addFeeRule, updateFeeRule, deleteFeeRule,
  getVipLevels, updateVipLevel,
  getTreasuryReport, getVolumeReport,
  getBinanceCredentials, updateBinanceCredential,
  getPendingWithdrawals, processWithdrawal,
  getListings, processListing,
  getSettings, updateSetting, addSetting,
  addBanner, addPopup, addAnnouncement,
  getDeposits, getWithdrawals, getScannerState, getKYCList,
  getBannersAdmin,
} = require('../controllers/admin.controller');

// Public
router.post('/login', adminLogin);

// All below require admin auth
router.use(adminAuth);

// ── Dashboard ─────────────────────────────────
router.get('/dashboard', getDashboard);

// ── Users ─────────────────────────────────────
router.get('/users',                    getUsers);
router.get('/users/:id',               getUserDetail);
router.put('/users/:id/status',        updateUserStatus);
router.put('/users/:id/vip',           updateUserVip);
router.get('/users/:id/balances',      getUserBalances);
router.get('/users/:id/deposits',      getUserDeposits);
router.get('/users/:id/withdrawals',   getUserWithdrawals);
router.get('/users/:id/ledger',        getUserLedger);
router.post('/users/:id/balance',      adjustBalance);

// ── KYC ──────────────────────────────────────
router.get('/kyc',           getKYCList);
router.put('/kyc/:kyc_id',   approveKYC);

// ── Deposits ─────────────────────────────────
router.get('/deposits',      getDeposits);

// ── Withdrawals ──────────────────────────────
router.get('/withdrawals',           getWithdrawals);
router.get('/withdrawals/pending',   getPendingWithdrawals);
router.put('/withdrawals/:id',       processWithdrawal);

// ── Coins ────────────────────────────────────
router.get('/coins',         getCoinsAdmin);
router.post('/coins',        addCoin);
router.put('/coins/:id',     updateCoin);

// ── Trading Pairs ────────────────────────────
router.get('/pairs',         getTradingPairs);
router.post('/pairs',        addTradingPair);
router.put('/pairs/:id',     updateTradingPair);

// ── Fee Rules ────────────────────────────────
router.get('/fee-rules',         getFeeRules);
router.post('/fee-rules',        addFeeRule);
router.put('/fee-rules/:id',     updateFeeRule);
router.delete('/fee-rules/:id',  deleteFeeRule);

// ── VIP Levels ───────────────────────────────
router.get('/vip-levels',           getVipLevels);
router.put('/vip-levels/:level',    updateVipLevel);

// ── Reports ──────────────────────────────────
router.get('/reports/treasury',  getTreasuryReport);
router.get('/reports/volume',    getVolumeReport);

// ── Binance Credentials ──────────────────────
router.get('/binance-credentials',        getBinanceCredentials);
router.put('/binance-credentials/:id',    updateBinanceCredential);

// ── Listings ─────────────────────────────────
router.get('/listings',        getListings);
router.put('/listings/:id',    processListing);

// ── Scanner ──────────────────────────────────
router.get('/scanner/state',   getScannerState);

// ── Content ──────────────────────────────────
router.get('/banners',         getBannersAdmin);
router.post('/banners',        addBanner);
router.post('/announcements',  addAnnouncement);
router.post('/popups',         addPopup);

// ── Settings ─────────────────────────────────
router.get('/settings',        getSettings);
router.put('/settings/:key',   updateSetting);
router.post('/settings',       addSetting);

// ── Bot Management ───────────────────────────
router.use('/bots', require('./bot.routes'));

module.exports = router;
