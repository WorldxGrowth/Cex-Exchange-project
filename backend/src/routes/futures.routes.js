const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/futures.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Rate limiters
const orderLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { status: '0', message: 'Too many orders. Max 60/min.' }
});

const cancelLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { status: '0', message: 'Too many cancel requests.' }
});

// ── Public routes (no auth) ───────────────────────────────────
router.get('/pairs',             ctrl.getFuturesPairs);
router.get('/pairs/:symbol',     ctrl.getFuturesPairInfo);
router.get('/funding-rates',     ctrl.getFundingRateHistory);
router.get('/calculate-cost',    ctrl.calculateOrderCost);

// ── Auth required ─────────────────────────────────────────────
router.use(authenticate);

// Balance
router.get('/balance',           ctrl.getFuturesBalance);

// Orders
router.post('/orders/place',     orderLimit, ctrl.placeOrder);
router.delete('/orders/:order_id/cancel', cancelLimit, ctrl.cancelOrder);
router.get('/orders/open',       ctrl.getOpenOrders);
router.get('/orders/history',    ctrl.getOrderHistory);

// Positions
router.get('/positions',         ctrl.getPositions);
router.post('/positions/:position_id/close', ctrl.closePositionEndpoint);

// Trade history
router.get('/trades',            ctrl.getTradeHistory);

// Liquidations
router.get('/liquidations',      ctrl.getLiquidationLogs);

// Settings
router.post('/leverage',         ctrl.changeLeverage);
router.post('/margin-type',      ctrl.changeMarginType);

module.exports = router;
