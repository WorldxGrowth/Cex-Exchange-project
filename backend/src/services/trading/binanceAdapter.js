const axios = require('axios');
const crypto = require('crypto');
const db = require('../../config/database');

class BinanceAdapter {

  async getCredentials() {
    const res = await db.query(
      'SELECT * FROM binance_credentials WHERE is_active=true ORDER BY id LIMIT 1'
    );
    if (!res.rows[0]) throw new Error('Binance credentials not configured');
    return res.rows[0];
  }

  sign(queryString, secret) {
    return crypto.createHmac('sha256', secret)
      .update(queryString).digest('hex');
  }

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

  async ping() {
    try {
      await axios.get('https://api.binance.com/api/v3/ping', { timeout: 5000 });
      return true;
    } catch { return false; }
  }

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
      symbol:           symbol.toUpperCase(),
      side:             side.toUpperCase(),
      newClientOrderId: clientOrderId,
      newOrderRespType: 'FULL'
    };

    if (orderType.toLowerCase() === 'limit') {
      // ── LIMIT order ──────────────────────────
      params.type        = 'LIMIT';
      params.timeInForce = 'GTC';
      params.quantity    = quantity;
      params.price       = parseFloat(price).toFixed(2);

    } else if (orderType.toLowerCase() === 'market') {
      // ── MARKET order — real Binance MARKET type ──
      // No price needed, fills instantly at best available price
      params.type     = 'MARKET';
      params.quantity = quantity;
      // No timeInForce, no price for MARKET orders
    }

    console.log(`[Binance] Placing ${params.side} ${params.type} ${quantity} ${symbol} @ ${params.price || 'MARKET'}`);

    const result = await this.request('POST', '/api/v3/order', params);
    return result;
  }

  async cancelOrder(symbol, binanceOrderId) {
    try {
      const result = await this.request('DELETE', '/api/v3/order', {
        symbol:  symbol.toUpperCase(),
        orderId: binanceOrderId
      });
      return result;
    } catch (e) {
      if (e.response?.data?.code === -2011) {
        return { status: 'ALREADY_FILLED_OR_CANCELLED' };
      }
      throw e;
    }
  }

  async getOrderStatus(symbol, clientOrderId) {
    try {
      const result = await this.request('GET', '/api/v3/order', {
        symbol:              symbol.toUpperCase(),
        origClientOrderId:   clientOrderId
      });
      return result;
    } catch (e) {
      console.error('[Binance] getOrderStatus error:', e.message);
      return null;
    }
  }

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
