require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');

const app = express();
const server = http.createServer(app);

// ── Middleware ─────────────────────────────────────
app.set("trust proxy", true);
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://exchange.vdscan.io',
        'https://exchange.vdscan.com',
        'https://admin.vdscan.io',
        'http://84.247.139.193:4006',
        'http://84.247.139.193:4007'
      ]
    : ['http://localhost:3000', 'http://localhost:3001',
       'http://localhost:5173', 'http://localhost:4006',
       'http://localhost:4007'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(require('compression')());
app.use(express.urlencoded({ extended: true }));
require('./src/config/passport');

// ── IMPORTANT: Webhook raw body FIRST (before express.json)
// Alchemy signature verification ke liye raw body chahiye
app.use('/api/v1/webhook/alchemy', express.raw({ type: 'application/json' }));
app.use('/api/v1/webhook/vdchain', express.raw({ type: 'application/json' }));

// ── JSON middleware (all other routes)
app.use(express.json());

// ── Health check ───────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: process.env.APP_NAME,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// ════════════════════════════════════════════════════
// API ROUTES
// ════════════════════════════════════════════════════
app.use('/api/v1/auth',          require('./src/routes/auth.routes'));
app.use('/api/v1/user',          require('./src/routes/user.routes'));
app.use('/api/v1/2fa',           require('./src/routes/twofa.routes'));
app.use('/api/v1/admin',         require('./src/routes/admin.routes'));
app.use('/api/v1/listing',       require('./src/routes/listing.routes'));
app.use('/api/v1/referral',      require('./src/routes/referral.routes'));
app.use('/api/v1/notifications', require('./src/routes/notification.routes'));
app.use('/api/v1/withdrawal',    require('./src/routes/withdrawal.routes'));
app.use('/api/v1/deposit',       require('./src/routes/deposit.routes'));
app.use('/api/v1/orders',        require('./src/routes/order.routes'));
app.use('/api/v1/wallet',        require('./src/routes/wallet.routes'));
app.use('/api/v1/market',        require('./src/routes/market.routes'));
app.use('/api/v1/webhook',       require('./src/routes/webhook.routes'));

// ── 404 Handler ────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: '0', message: 'Route not found' });
});

// ── Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: '0', message: 'Internal server error' });
});

// ── Start Server ───────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 VDExchange API running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});

// ── WebSocket ──────────────────────────────────────
const { initWebSocket } = require('./src/websocket/socket');
initWebSocket(server);

// ── Price Updater ──────────────────────────────────
const { startPriceUpdater } = require('./src/jobs/priceUpdater');
startPriceUpdater();

// ── Deposit Detector ───────────────────────────────
const depositDetector = require('./src/services/wallet/depositDetector');
depositDetector.init().then(() => depositDetector.start()).catch(console.error);

// ── Order Matching Engine ──────────────────────────
const orderMatcher = require('./src/services/orderMatcher');
try {
  orderMatcher.start();
  console.log('⚡ OrderMatcher loaded');
} catch(e) {
  console.error('OrderMatcher FAILED:', e.message);
}

// ── Market Making Bot ──────────────────────────────
const marketMaker = require('./src/services/marketMaker');
marketMaker.init().then(() => marketMaker.start()).catch(console.error);

// ── Sweep Service ──────────────────────────────────
const sweepService = require('./src/services/wallet/sweepService');
sweepService.start();
console.log('🧹 SweepService loaded');

module.exports = { app, server };

// ── Reconcile Job (every 5 min) ────────────────────
const reconcileService = require('./src/services/trading/reconcile');
setInterval(() => {
  reconcileService.run().catch(console.error);
}, 5 * 60 * 1000);
console.log('🔄 ReconcileService loaded');
