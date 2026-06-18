const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/futures.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const orderLimit = rateLimit({
  windowMs: 60 * 1000, max: 60,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { status: '0', message: 'Too many orders. Max 60/min.' }
});
const cancelLimit = rateLimit({
  windowMs: 60 * 1000, max: 100,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { status: '0', message: 'Too many cancel requests.' }
});

// ── Public ───────────────────────────────────────────────────
router.get('/orderbook/:symbol', async (req, res) => {
  try {
    const axios = require('axios');
    const db    = require('../config/database');
    const sym   = req.params.symbol.toUpperCase();
    const limit = parseInt(req.query.limit || 20);

    // Check if custom pair (VDC etc)
    const { rows: [pair] } = await db.query(
      `SELECT id, is_custom FROM futures_pairs WHERE symbol=$1 AND is_active=true LIMIT 1`,
      [sym]
    );

    // Custom pair → use spot orderbook from DB
    if (pair?.is_custom) {
      const { rows: [spotPair] } = await db.query(
        `SELECT id FROM trading_pairs WHERE symbol=$1 AND is_active=true LIMIT 1`,
        [sym]
      );
      if (spotPair) {
        const bidsQ = await db.query(`
          SELECT CAST(price AS VARCHAR) as price, CAST(SUM(remaining_qty) AS VARCHAR) as qty
          FROM orders WHERE pair_id=$1 AND side='buy' AND status IN ('open','partially_filled') AND price IS NOT NULL
          GROUP BY price ORDER BY price DESC LIMIT $2`, [spotPair.id, limit]);
        const asksQ = await db.query(`
          SELECT CAST(price AS VARCHAR) as price, CAST(SUM(remaining_qty) AS VARCHAR) as qty
          FROM orders WHERE pair_id=$1 AND side='sell' AND status IN ('open','partially_filled') AND price IS NOT NULL
          GROUP BY price ORDER BY price ASC LIMIT $2`, [spotPair.id, limit]);
        return res.json({ status: '1', message: 'Success',
          data: { bids: bidsQ.rows, asks: asksQ.rows, source: 'internal' } });
      }
      return res.json({ status: '1', message: 'Success', data: { bids: [], asks: [], source: 'internal' } });
    }

    // Binance futures pair → fapi proxy
    const r = await axios.get(
      `https://fapi.binance.com/fapi/v1/depth?symbol=${sym}&limit=${limit}`,
      { timeout: 5000 }
    );
    const d = r.data;
    const bids = (d.bids||[]).map((b) => ({ price: String(b[0]), qty: String(b[1]) }));
    const asks = (d.asks||[]).map((a) => ({ price: String(a[0]), qty: String(a[1]) }));
    console.log('[FuturesOB] bids:', bids.length, 'asks:', asks.length);
    res.json({ status: '1', message: 'Success', data: { bids, asks, source: 'binance' } });
  } catch(e) {
    res.json({ status: '0', message: e.message, data: { bids: [], asks: [] } });
  }
});
router.get('/pairs',              ctrl.getFuturesPairs);
router.get('/pairs/:symbol',      ctrl.getFuturesPairInfo);
router.get('/funding-rates',      ctrl.getFundingRateHistory);
router.get('/calculate-cost',     ctrl.calculateOrderCost);

// ── Auth required ─────────────────────────────────────────────
router.use(authenticate);

// Balance + Settings
router.get('/balance',            ctrl.getFuturesBalance);
router.get('/settings',           ctrl.getUserSettings);

// Orders
router.post('/orders/place',      orderLimit, ctrl.placeOrder);
router.put('/orders/:order_id/modify', orderLimit, ctrl.modifyOrder);
router.delete('/orders/:order_id/cancel', cancelLimit, ctrl.cancelOrder);
router.get('/orders/open',        ctrl.getOpenOrders);
router.get('/orders/history',     ctrl.getOrderHistory);

// Positions
router.get('/positions',          ctrl.getPositions);
router.post('/positions/:position_id/close', ctrl.closePositionEndpoint);
router.put('/positions/:position_id/tpsl',  ctrl.updatePositionTpSl);

// Trade history + Liquidations
router.get('/trades',             ctrl.getTradeHistory);
router.get('/liquidations',       ctrl.getLiquidationLogs);

// Settings
router.post('/leverage',          ctrl.changeLeverage);
router.post('/margin-type',       ctrl.changeMarginType);

module.exports = router;
