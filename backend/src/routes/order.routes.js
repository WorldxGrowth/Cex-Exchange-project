const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  placeOrder, cancelOrder,
  getOpenOrders, getOrderHistory, getTradeHistory
} = require('../controllers/order.controller');
const {
  orderPlaceLimiter
} = require('../middleware/rateLimiter');

router.use(authenticate);

router.post('/place',       orderPlaceLimiter, placeOrder);
router.delete('/:order_id',                    cancelOrder);
router.get('/open',                            getOpenOrders);
router.get('/history',                         getOrderHistory);
router.get('/trades',                          getTradeHistory);

module.exports = router;
