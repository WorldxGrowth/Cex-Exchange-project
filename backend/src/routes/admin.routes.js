const express = require('express');
const router  = express.Router();
const { adminAuth } = require('../middleware/admin.middleware');
const { audit }     = require('../middleware/audit.middleware');
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
const { adminLoginLimiter } = require('../middleware/rateLimiter');

// ── Public Routes (No Auth) ───────────────────
router.post('/verify-pin',  adminLoginLimiter, verifyAdminPin);
router.post('/login',       adminLoginLimiter, adminLoginStep2);
router.post('/verify-otp',  adminLoginLimiter, verifyAdminOTP);
router.post('/verify-2fa',  adminLoginLimiter, verifyAdmin2FA);

// ── All below require admin auth ──────────────
router.use(adminAuth);

// ── Dashboard ─────────────────────────────────
router.get('/dashboard', getDashboard);

// ── Users ─────────────────────────────────────
router.get('/users',                   getUsers);
router.get('/users/:id',               getUserDetail);
router.put('/users/:id/status',        audit('user_status_change','users'),      updateUserStatus);
router.put('/users/:id/vip',           audit('user_vip_change','users'),         updateUserVip);
router.get('/users/:id/balances',      getUserBalances);
router.get('/users/:id/deposits',      getUserDeposits);
router.get('/users/:id/withdrawals',   getUserWithdrawals);
router.get('/users/:id/ledger',        getUserLedger);
router.post('/users/:id/balance',      audit('balance_adjust','users'),          adjustBalance);

// ── KYC ──────────────────────────────────────
router.get('/kyc',           getKYCList);
router.put('/kyc/:kyc_id',   audit('kyc_review','kyc'),                          approveKYC);

// ── Deposits ─────────────────────────────────
router.get('/deposits',      getDeposits);

// ── Withdrawals ──────────────────────────────
router.get('/withdrawals',           getWithdrawals);
router.get('/withdrawals/pending',   getPendingWithdrawals);
router.put('/withdrawals/:id',       audit('withdrawal_process','withdrawals'),   processWithdrawal);

// ── Coins ────────────────────────────────────
router.get('/coins',         getCoinsAdmin);
router.post('/coins',        audit('coin_add','coins'),                           addCoin);
router.put('/coins/:id',     audit('coin_update','coins'),                        updateCoin);

// ── Trading Pairs ────────────────────────────
router.get('/pairs',         getTradingPairs);
router.post('/pairs',        audit('pair_add','pairs'),                           addTradingPair);
router.put('/pairs/:id',     audit('pair_update','pairs'),                        updateTradingPair);

// ── OrderBook CRUD ───────────────────────────
router.get('/orderbook',             getAdminOrders);
router.post('/orderbook',            audit('orderbook_create','orders'),          createAdminOrders);
router.put('/orderbook/:id',         audit('orderbook_update','orders'),          updateAdminOrder);
router.delete('/orderbook/:id',      audit('orderbook_delete','orders'),          deleteAdminOrder);
router.post('/orderbook/cancel-all', audit('orderbook_cancel_all','orders'),      deleteAllAdminOrders);

// ── Fee Rules ────────────────────────────────
router.get('/fee-rules',         getFeeRules);
router.post('/fee-rules',        audit('fee_rule_add','fee_rules'),               addFeeRule);
router.put('/fee-rules/:id',     audit('fee_rule_update','fee_rules'),            updateFeeRule);
router.delete('/fee-rules/:id',  audit('fee_rule_delete','fee_rules'),            deleteFeeRule);

// ── VIP Levels ───────────────────────────────
router.get('/vip-levels',        getVipLevels);
router.put('/vip-levels/:level', audit('vip_level_update','vip_levels'),          updateVipLevel);

// ── Reports ──────────────────────────────────
router.get('/reports/treasury', getTreasuryReport);
router.get('/reports/holdings', getCoinHoldingsReport);
router.get('/reports/volume',   getVolumeReport);

// ── Binance Credentials ──────────────────────
router.get('/binance-credentials',     getBinanceCredentials);
router.put('/binance-credentials/:id', audit('binance_cred_update','binance'),    updateBinanceCredential);

// ── Withdrawal Settings ───────────────────────
router.get('/withdrawal-settings',     getWithdrawalSettings);
router.put('/withdrawal-settings/:id', audit('wd_settings_update','wd_settings'), updateWithdrawalSetting);

// ── Networks ─────────────────────────────────
router.get('/networks',      getNetworks);
router.put('/networks/:id',  audit('network_update','networks'),                  updateNetwork);

// ── Listings ─────────────────────────────────
router.get('/listings',      getListings);
router.put('/listings/:id',  audit('listing_process','listings'),                 processListing);

// ── Scanner ──────────────────────────────────
router.get('/scanner/state', getScannerState);

// ── Content ──────────────────────────────────
router.get('/banners',              getBannersAdmin);
router.post('/banners',             audit('banner_add','banners'),                addBanner);
router.post('/announcements',       audit('announcement_add','announcements'),    addAnnouncement);
router.put('/announcements/:id',    audit('announcement_update','announcements'), updateAnnouncement);
router.delete('/announcements/:id', audit('announcement_delete','announcements'), deleteAnnouncement);
router.get('/announcements',        getAnnouncements);
router.post('/popups',              audit('popup_add','popups'),                  addPopup);

// ── CMS Pages ────────────────────────────────
router.get('/cms',         getCmsPages);
router.get('/cms/:id',     getCmsPage);
router.post('/cms',        audit('cms_add','cms'),                                addCmsPage);
router.put('/cms/:id',     audit('cms_update','cms'),                             updateCmsPage);
router.delete('/cms/:id',  audit('cms_delete','cms'),                             deleteCmsPage);

// ── Settings ─────────────────────────────────
router.get('/settings',      getSettings);
router.put('/settings/:key', audit('setting_update','settings'),                  updateSetting);
router.post('/settings',     audit('setting_add','settings'),                     addSetting);

// ── Admin Security ────────────────────────────
router.get('/security/2fa-status',        adminGet2FAStatus);
router.post('/security/2fa-setup',        adminSetup2FA);
router.post('/security/2fa-enable',       audit('admin_2fa_enable','security'),   adminEnable2FA);
router.post('/security/2fa-disable',      audit('admin_2fa_disable','security'),  adminDisable2FA);
router.post('/security/toggle-otp',       audit('admin_otp_toggle','security'),   adminToggleOTP);
router.post('/security/change-pin/step1', adminChangePinStep1);
router.post('/security/change-pin/step2', audit('admin_pin_change','security'),   adminChangePinStep2);

// ── Bot Management ───────────────────────────
router.use('/bots', require('./bot.routes'));

module.exports = router;
