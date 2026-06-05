/**
 * Binance User Data Stream
 * Limit order fill hote hi instantly notify karta hai
 * 410 error = API key permission nahi → reconcile fallback use hoga
 */
const WebSocket   = require('ws');
const db          = require('../../config/database');
const hedgeEngine = require('./hedgeEngine');

class BinanceUserStream {
  constructor() {
    this.ws             = null;
    this.listenKey      = null;
    this.pingTimer      = null;
    this.reconnectTimer = null;
    this.supported      = true; // false if API key doesn't support
  }

  async getListenKey() {
    const creds = await db.query(
      'SELECT api_key FROM binance_credentials WHERE is_active=true LIMIT 1'
    );
    if (!creds.rows[0]) throw new Error('No Binance credentials');

    const axios = require('axios');
    const res = await axios.post(
      'https://api.binance.com/api/v3/userDataStream',
      {},
      { headers: { 'X-MBX-APIKEY': creds.rows[0].api_key }, timeout: 5000 }
    );
    return res.data.listenKey;
  }

  async keepAlive() {
    if (!this.listenKey) return;
    try {
      const creds = await db.query(
        'SELECT api_key FROM binance_credentials WHERE is_active=true LIMIT 1'
      );
      const axios = require('axios');
      await axios.put(
        'https://api.binance.com/api/v3/userDataStream',
        {},
        {
          params:  { listenKey: this.listenKey },
          headers: { 'X-MBX-APIKEY': creds.rows[0].api_key },
          timeout: 5000
        }
      );
    } catch (e) {
      console.error('[UserStream] keepAlive error:', e.message);
    }
  }

  async connect() {
    // Already determined not supported
    if (!this.supported) return;

    try {
      this.listenKey = await this.getListenKey();
      console.log('✅ Binance User Data Stream: listenKey obtained');

      this.ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${this.listenKey}`
      );

      this.ws.on('open', () => {
        console.log('✅ Binance User Data Stream connected - limit orders will fill instantly!');
        this.pingTimer = setInterval(() => this.keepAlive(), 30 * 60 * 1000);
      });

      this.ws.on('message', async (data) => {
        try {
          const event = JSON.parse(data);
          await this.handleEvent(event);
        } catch (e) {
          console.error('[UserStream] message error:', e.message);
        }
      });

      this.ws.on('close', () => {
        console.log('⚠️ User Data Stream disconnected - reconnecting in 10s');
        clearInterval(this.pingTimer);
        if (this.supported) {
          this.reconnectTimer = setTimeout(() => this.connect(), 10000);
        }
      });

      this.ws.on('error', () => {});

    } catch (e) {
      const status = e.response?.status;

      // 410 = endpoint deprecated or API key no permission
      // 401/403 = unauthorized
      if (status === 410 || status === 401 || status === 403) {
        this.supported = false;
        console.log('[UserStream] ⚠️ API key does not support User Data Stream (HTTP ' + status + ')');
        console.log('[UserStream] → Using reconcile.js as fallback (runs every 5 min)');
        console.log('[UserStream] → To enable instant limit fills: add READ permission to Binance API key');
        return; // No retry
      }

      console.error('[UserStream] connect error:', e.message);
      // Retry after 30s for other errors
      this.reconnectTimer = setTimeout(() => this.connect(), 30000);
    }
  }

  async handleEvent(event) {
    if (event.e !== 'executionReport') return;

    const clientOrderId = event.c;
    const execType      = event.x;
    const orderStatus   = event.X;
    const executedQty   = parseFloat(event.z || 0);
    const lastQty       = parseFloat(event.l || 0);
    const lastPrice     = parseFloat(event.L || 0);
    const symbol        = event.s;

    // Only process fills
    if (execType !== 'TRADE') return;
    if (!['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) return;
    if (!clientOrderId.startsWith('VDX_')) return;

    const ourOrderId = clientOrderId.replace('VDX_', '');

    try {
      const bo = await db.query(
        'SELECT filled_qty FROM binance_orders WHERE our_order_id=$1',
        [ourOrderId]
      );
      if (!bo.rows[0]) return;

      const alreadyFilled = parseFloat(bo.rows[0].filled_qty || 0);
      if (executedQty <= alreadyFilled) return;

      await hedgeEngine.processFill(ourOrderId, {
        orderId:             event.i,
        symbol,
        executedQty:         executedQty.toString(),
        cummulativeQuoteQty: (parseFloat(event.Z || 0)).toString(),
        status:              orderStatus,
        fills: [{ price: lastPrice.toString(), qty: lastQty.toString() }]
      });

      console.log(`[UserStream] ✅ Instant fill: ${ourOrderId} ${executedQty} ${symbol}`);
    } catch (e) {
      console.error('[UserStream] processFill error:', e.message);
    }
  }

  stop() {
    this.supported = false;
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.terminate();
  }
}

const binanceUserStream = new BinanceUserStream();
module.exports = binanceUserStream;
