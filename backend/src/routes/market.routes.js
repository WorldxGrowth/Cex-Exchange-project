const express = require('express');
const router = express.Router();
const {
  getCoins, getPairs, getTicker,
  getOrderBook, getRecentTrades, getKlines
} = require('../controllers/market.controller');

// All public - no auth needed
router.get('/coins', getCoins);
router.get('/pairs', getPairs);
router.get('/ticker/:symbol', getTicker);
router.get('/orderbook/:symbol', getOrderBook);
router.get('/trades/:symbol', getRecentTrades);
router.get('/klines/:symbol', getKlines);

module.exports = router;

// CMS Public (no auth)
const { getCmsPagePublic, getCmsFooterPages } = require('../controllers/market.controller');
router.get('/pages/footer', getCmsFooterPages);      // footer menu
router.get('/pages/:slug',  getCmsPagePublic);        // page content
