const express = require('express');
const router  = express.Router();
const { adminAuth } = require('../middleware/admin.middleware');
const {
  adminLogin, getDashboard,
  verifyAdminPin, adminLoginStep2, verifyAdminOTP, verifyAdmin2FA,
  getUsers, updateUserStatus, updateUserVip, approveKYC,
  getUserDetail, getUserBalances, getUserDeposits,
  getUserWithdrawals, getUserLedger, adjustBalance,
  getCoinsAdmin, addCoin, updateCoin,
  getTradingPairs, addTradingPair, updateTradingPair,
  getAdminOrders, createAdminOrders, updateAdminOrder,
  deleteAdminOrder, deleteAllAdminOrders,
  getCoinHoldingsReport,
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
  getWithdrawalSettings, updateWithdrawalSetting,
  getNetworks, updateNetwork,
  getAnnouncements, updateAnnouncement, deleteAnnouncement,
  getCmsPages, getCmsPage, addCmsPage, updateCmsPage, deleteCmsPage,
  adminSetup2FA, adminEnable2FA, adminDisable2FA, adminGet2FAStatus,
  adminToggleOTP, adminChangePinStep1, adminChangePinStep2,
} = require('../controllers/admin.controller');

// ── Public Routes (No Auth) ───────────────────
router.post('/verify-pin',  verifyAdminPin);
router.post('/login',       adminLoginStep2);
router.post('/verify-otp',  verifyAdminOTP);
router.post('/verify-2fa',  verifyAdmin2FA);

// ── All below require admin auth ──────────────
router.use(adminAuth);

// ── Dashboard ─────────────────────────────────
router.get('/dashboard', getDashboard);

// ── Users ─────────────────────────────────────
router.get('/users',                   getUsers);
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

// ── OrderBook CRUD ───────────────────────────
router.get('/orderbook',             getAdminOrders);
router.post('/orderbook',            createAdminOrders);
router.put('/orderbook/:id',         updateAdminOrder);
router.delete('/orderbook/:id',      deleteAdminOrder);
router.post('/orderbook/cancel-all', deleteAllAdminOrders);

// ── Fee Rules ────────────────────────────────
router.get('/fee-rules',         getFeeRules);
router.post('/fee-rules',        addFeeRule);
router.put('/fee-rules/:id',     updateFeeRule);
router.delete('/fee-rules/:id',  deleteFeeRule);

// ── VIP Levels ───────────────────────────────
router.get('/vip-levels',        getVipLevels);
router.put('/vip-levels/:level', updateVipLevel);

// ── Reports ──────────────────────────────────
router.get('/reports/treasury', getTreasuryReport);
router.get('/reports/holdings', getCoinHoldingsReport);
router.get('/reports/volume',   getVolumeReport);

// ── Binance Credentials ──────────────────────
router.get('/binance-credentials',     getBinanceCredentials);
router.put('/binance-credentials/:id', updateBinanceCredential);

// ── Withdrawal Settings ───────────────────────
router.get('/withdrawal-settings',     getWithdrawalSettings);
router.put('/withdrawal-settings/:id', updateWithdrawalSetting);

// ── Networks ─────────────────────────────────
router.get('/networks',      getNetworks);
router.put('/networks/:id',  updateNetwork);

// ── Listings ─────────────────────────────────
router.get('/listings',      getListings);
router.put('/listings/:id',  processListing);

// ── Scanner ──────────────────────────────────
router.get('/scanner/state', getScannerState);

// ── Content ──────────────────────────────────
router.get('/banners',              getBannersAdmin);
router.post('/banners',             addBanner);
router.post('/announcements',       addAnnouncement);
router.put('/announcements/:id',    updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);
router.get('/announcements',        getAnnouncements);
router.post('/popups',              addPopup);

// ── CMS Pages ────────────────────────────────
router.get('/cms',         getCmsPages);
router.get('/cms/:id',     getCmsPage);
router.post('/cms',        addCmsPage);
router.put('/cms/:id',     updateCmsPage);
router.delete('/cms/:id',  deleteCmsPage);

// ── Settings ─────────────────────────────────
router.get('/settings',      getSettings);
router.put('/settings/:key', updateSetting);
router.post('/settings',     addSetting);

// ── Admin Security ────────────────────────────
router.get('/security/2fa-status',          adminGet2FAStatus);
router.post('/security/2fa-setup',          adminSetup2FA);
router.post('/security/2fa-enable',         adminEnable2FA);
router.post('/security/2fa-disable',        adminDisable2FA);
router.post('/security/toggle-otp',         adminToggleOTP);
router.post('/security/change-pin/step1',   adminChangePinStep1);
router.post('/security/change-pin/step2',   adminChangePinStep2);

// ── Bot Management ───────────────────────────
router.use('/bots', require('./bot.routes'));

module.exports = router;
