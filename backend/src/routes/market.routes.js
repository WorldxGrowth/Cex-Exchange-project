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

// Public Announcements (no auth)
router.get('/announcements', async (req, res) => {
  try {
    const db = require('../config/database');
    const { success } = require('../utils/response');
    const anns = await db.query(`
      SELECT id, title, content, type, image_url, created_at
      FROM announcements
      WHERE is_published=true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 5
    `);
    return success(res, anns.rows);
  } catch (e) { res.json({ status: '0', data: [] }); }
});
