const axios = require('axios');
const crypto = require('crypto');
const db = require('../../config/database');

class BinanceAdapter {

  // ── Credentials DB se load ─────────────────────
  async getCredentials() {
    const res = await db.query(
      'SELECT * FROM binance_credentials WHERE is_active=true ORDER BY id LIMIT 1'
    );
    if (!res.rows[0]) throw new Error('Binance credentials not configured');
    return res.rows[0];
  }

  // ── HMAC Signature ─────────────────────────────
  sign(queryString, secret) {
    return crypto.createHmac('sha256', secret)
      .update(queryString).digest('hex');
  }

  // ── REST API Call ──────────────────────────────
  async request(method, path, params = {}, signed = true) {
    const creds = await this.getCredentials();
    const baseUrl = 'https://api.binance.com';

    let queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    if (signed) {
      queryString += `&timestamp=${Date.now()}`;
      const sig = this.sign(queryString, creds.api_secret);
      queryString += `&signature=${sig}`;
    }

    const url = `${baseUrl}${path}${queryString ? '?' + queryString : ''}`;

    const response = await axios({
      method,
      url,
      headers: { 'X-MBX-APIKEY': creds.api_key },
      timeout: 10000
    });

    return response.data;
  }

  // ── Health Check ───────────────────────────────
  async ping() {
    try {
      await axios.get('https://api.binance.com/api/v3/ping', { timeout: 5000 });
      return true;
    } catch { return false; }
  }

  // ── Get Binance Balance ────────────────────────
  async getBalance(asset) {
    try {
      const data = await this.request('GET', '/api/v3/account', {});
      const bal = data.balances?.find(b => b.asset === asset);
      return parseFloat(bal?.free || 0);
    } catch (e) {
      console.error('[Binance] getBalance error:', e.message);
      return 0;
    }
  }

  // ── Place Order ────────────────────────────────
  async placeOrder({ symbol, side, orderType, quantity, price, clientOrderId }) {
    const params = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: orderType.toUpperCase(),
      quantity,
      newClientOrderId: clientOrderId,
      newOrderRespType: 'FULL'
    };

    // Limit order ke liye price chahiye
    if (orderType.toLowerCase() === 'limit') {
      params.timeInForce = 'GTC';
      params.price = parseFloat(price).toFixed(2);
    }

    // Market order ke liye price protection
    if (orderType.toLowerCase() === 'market') {
      // MARKET order → use LIMIT with slippage protection
      const ticker = await this.getPrice(symbol);
      const slippage = side.toLowerCase() === 'buy' ? 1.005 : 0.995;
      params.type = 'LIMIT';
      params.timeInForce = 'IOC'; // Fill or kill
      params.price = (ticker * slippage).toFixed(2);
    }

    console.log(`[Binance] Placing ${params.side} ${params.type} ${quantity} ${symbol} @ ${params.price || 'market'}`);

    const result = await this.request('POST', '/api/v3/order', params);
    return result;
  }

  // ── Cancel Order ───────────────────────────────
  async cancelOrder(symbol, binanceOrderId) {
    try {
      const result = await this.request('DELETE', '/api/v3/order', {
        symbol: symbol.toUpperCase(),
        orderId: binanceOrderId
      });
      return result;
    } catch (e) {
      // -2011 = order already filled/cancelled
      if (e.response?.data?.code === -2011) {
        return { status: 'ALREADY_FILLED_OR_CANCELLED' };
      }
      throw e;
    }
  }

  // ── Get Order Status ───────────────────────────
  async getOrderStatus(symbol, clientOrderId) {
    try {
      const result = await this.request('GET', '/api/v3/order', {
        symbol: symbol.toUpperCase(),
        origClientOrderId: clientOrderId
      });
      return result;
    } catch (e) {
      console.error('[Binance] getOrderStatus error:', e.message);
      return null;
    }
  }

  // ── Get Current Price ──────────────────────────
  async getPrice(symbol) {
    try {
      const res = await axios.get(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`,
        { timeout: 5000 }
      );
      return parseFloat(res.data.price);
    } catch (e) {
      console.error('[Binance] getPrice error:', e.message);
      return 0;
    }
  }
}

const binanceAdapter = new BinanceAdapter();
module.exports = binanceAdapter;
