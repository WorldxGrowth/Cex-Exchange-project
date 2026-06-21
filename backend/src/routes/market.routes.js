const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const {
  getCoins, getPairs, getTicker,
  getOrderBook, getRecentTrades, getKlines
} = require('../controllers/market.controller');

// All public - no auth needed
router.get('/coins',             getCoins);
router.get('/pairs',             getPairs);
router.get('/ticker/:symbol',    getTicker);
router.get('/orderbook/:symbol', getOrderBook);
router.get('/trades/:symbol',    getRecentTrades);
router.get('/klines/:symbol',    getKlines);

// ── Binance klines proxy (chart ke liye - CORS avoid) ──
router.get('/binance-klines/:symbol', async (req, res) => {
  try {
    const { symbol }              = req.params;
    const { interval = '1h', limit = '50' } = req.query;
    const response = await axios.get(
      'https://api.binance.com/api/v3/klines',
      {
        params: {
          symbol:   symbol.toUpperCase(),
          interval,
          limit:    parseInt(limit)
        },
        timeout: 8000
      }
    );
    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CMS Public (no auth)
const { getCmsPagePublic, getCmsFooterPages, getPublicSettings } = require('../controllers/market.controller');
router.get('/settings/public', getPublicSettings);
router.get('/pages/footer', getCmsFooterPages);
router.get('/pages/:slug',  getCmsPagePublic);

// Public Announcements (no auth)
router.get('/announcements', async (req, res) => {
  try {
    const db      = require('../config/database');
    const { success } = require('../utils/response');
    const anns    = await db.query(`
      SELECT id, title, content, type, image_url, created_at
      FROM announcements
      WHERE is_published = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 5
    `);
    return success(res, anns.rows);
  } catch (e) {
    res.json({ status: '0', data: [] });
  }
});

module.exports = router;
