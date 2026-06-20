require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const http    = require('http');

const app    = express();
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
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
require('./src/config/passport');

// ── Webhook raw body FIRST ─────────────────────────
app.use('/api/v1/webhook/alchemy', express.raw({ type: 'application/json' }));
app.use('/api/v1/webhook/vdchain', express.raw({ type: 'application/json' }));

// ── JSON middleware ────────────────────────────────
app.use(express.json({ limit: '50mb' }));

// ── Health check ───────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: process.env.APP_NAME,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// ══════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════
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
app.use('/api/v1/transfer',      require('./src/routes/transfer.routes'));
app.use('/api/v1/market',        require('./src/routes/market.routes'));
app.use('/api/v1/webhook',       require('./src/routes/webhook.routes'));
app.use('/api/v1/futures',       require('./src/routes/futures.routes'));

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
  console.log(`VDExchange API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

// ── WebSocket ──────────────────────────────────────
const { initWebSocket } = require('./src/websocket/socket');
initWebSocket(server);

// ── Price Updater ──────────────────────────────────
const { startPriceUpdater } = require('./src/jobs/priceUpdater');
startPriceUpdater();

// ── Deposit Detector ───────────────────────────────
const depositDetector = require('./src/services/wallet/deposits/evmDepositScanner');
depositDetector.init().then(() => depositDetector.start()).catch(console.error);

// ── Spot Order Matching Engine (VDC internal) ──────
const orderMatcher = require('./src/services/orderMatcher');
try {
  orderMatcher.start();
  console.log('OrderMatcher loaded');
} catch(e) {
  console.error('OrderMatcher FAILED:', e.message);
}

// ── Market Making Bot ──────────────────────────────
const marketMaker = require('./src/services/marketMaker');
marketMaker.init().then(() => marketMaker.start()).catch(console.error);

// ── TRON Deposit Scanner (polling, no reliable push-webhook for TRON) ──
const tronDepositScanner = require('./src/services/wallet/deposits/tronDepositScanner');
try {
  tronDepositScanner.start();
  console.log('TronDepositScanner loaded');
} catch(e) {
  console.error('TronDepositScanner FAILED:', e.message);
}

// ── Sweep Service (EVM) ─────────────────────────────
const sweepService = require('./src/services/wallet/sweep/evmSweep');
sweepService.start();
console.log('SweepService loaded');

// ── Sweep Service (TRON) ────────────────────────────
const tronSweep = require('./src/services/wallet/sweep/tronSweep');
try {
  tronSweep.start();
  console.log('TronSweepService loaded');
} catch(e) {
  console.error('TronSweepService FAILED:', e.message);
}

// ── Sweep Service (Solana) ──────────────────────────
const solanaSweep = require('./src/services/wallet/sweep/solanaSweep');
try {
  solanaSweep.start();
  console.log('SolanaSweepService loaded');
} catch(e) {
  console.error('SolanaSweepService FAILED:', e.message);
}

// ── Sweep Service (Bitcoin) ─────────────────────────
const bitcoinSweep = require('./src/services/wallet/sweep/bitcoinSweep');
try {
  bitcoinSweep.start();
  console.log('BitcoinSweepService loaded');
} catch(e) {
  console.error('BitcoinSweepService FAILED:', e.message);
}

// ── Spot Reconcile Job (every 1 min) ───────────────
const reconcileService = require('./src/services/trading/reconcile');
setInterval(() => {
  reconcileService.run().catch(console.error);
}, 1 * 60 * 1000);
console.log('ReconcileService loaded (1 min interval)');

// ── Spot Binance User Data Stream ──────────────────
const binanceUserStream = require('./src/services/trading/binanceUserStream');
binanceUserStream.connect().catch(() => {});
console.log('Spot Binance UserDataStream starting...');

// ══════════════════════════════════════════════════
// FUTURES SERVICES
// ══════════════════════════════════════════════════

// ── Futures Liquidation Engine ─────────────────────
try {
  const futuresLiquidator = require('./src/services/futures/internal/futuresLiquidator');
  futuresLiquidator.start();
  console.log('Futures Liquidator started (5s interval)');
} catch(e) {
  console.error('Futures Liquidator FAILED:', e.message);
}

// ── Futures Funding Rate Cron ──────────────────────
try {
  const futuresFundingCron = require('./src/services/futures/internal/futuresFundingCron');
  futuresFundingCron.start();
  console.log('Futures Funding Cron started (8hr interval)');
} catch(e) {
  console.error('Futures Funding Cron FAILED:', e.message);
}

// ── Futures Binance UserDataStream ─────────────────
// ORDER_TRADE_UPDATE for instant limit order fills
try {
  const futuresUserStream = require('./src/services/futures/binance/futuresUserStream');
  futuresUserStream.start().catch(e => {
    console.warn('Futures UserStream start warning:', e.message);
  });
  console.log('Futures Binance UserDataStream starting...');
} catch(e) {
  console.error('Futures UserStream FAILED:', e.message);
}

// ── Futures Mark Price WebSocket (Binance fstream) ──
// Real futures mark price for accurate PnL calculation
// Updates every 1s via wss://fstream.binance.com/ws/!markPrice@arr@1s
try {
  const futuresMarkPrice = require('./src/services/futures/shared/futuresMarkPrice');
  futuresMarkPrice.start();
  console.log('Futures Mark Price WebSocket started (Binance fstream 1s)');
} catch(e) {
  console.error('Futures Mark Price FAILED:', e.message);
  // Fallback: use spot price_feeds every 2s
  const { updatePositionsPnl } = require('./src/services/futures/shared/pnlCalculator');
  setInterval(async () => {
    try {
      const db = require('./src/config/database');
      const { rows: pairs } = await db.query(
        `SELECT DISTINCT fp.symbol, fp.base_coin_id
         FROM futures_positions p
         JOIN futures_pairs fp ON fp.id = p.pair_id
         WHERE p.status = 'open'`
      );
      for (const pair of pairs) {
        const { rows: [feed] } = await db.query(
          `SELECT price_usdt FROM price_feeds WHERE coin_id = $1 LIMIT 1`,
          [pair.base_coin_id]
        );
        if (feed?.price_usdt) await updatePositionsPnl(pair.symbol, feed.price_usdt);
      }
    } catch(e) {}
  }, 2000);
  console.log('Futures PnL fallback updater started (2s spot price)');
}

// Futures Reconcile (fallback for limit orders - 1 min)
const futuresReconcile = require('./src/services/futures/binance/futuresReconcile');
setInterval(() => {
  futuresReconcile.run().catch(e => console.error('[FuturesReconcile]', e.message));
}, 60 * 1000);
console.log('Futures Reconciler started (1 min interval)');

// TP/SL check for internal pairs (5s)
setInterval(async () => {
  try {
    const { checkTpSl } = require('./src/services/futures/internal/futuresLiquidator');
    await checkTpSl();
  } catch(e) {}
}, 5000);
console.log('Futures TP/SL checker started (5s interval)');

module.exports = { app, server };
