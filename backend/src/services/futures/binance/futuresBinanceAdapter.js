/**
 * Binance USDT-M Futures REST API Adapter
 * Base URL: https://fapi.binance.com
 * Docs: https://developers.binance.com/docs/derivatives/usds-margined-futures
 */
const crypto  = require('crypto');
const axios   = require('axios');

const FAPI_BASE = 'https://fapi.binance.com';

class FuturesBinanceAdapter {
  constructor(apiKey, apiSecret) {
    this.apiKey    = apiKey;
    this.apiSecret = apiSecret;
    this.client    = axios.create({
      baseURL: FAPI_BASE,
      timeout: 10000,
      headers: { 'X-MBX-APIKEY': apiKey }
    });
  }

  // ── HMAC Signature ──────────────────────────────────────
  sign(params) {
    const qs  = new URLSearchParams({ ...params, timestamp: Date.now() }).toString();
    const sig = crypto.createHmac('sha256', this.apiSecret).update(qs).digest('hex');
    return qs + '&signature=' + sig;
  }

  async get(path, params = {}, auth = false) {
    try {
      const query = auth ? this.sign(params) : new URLSearchParams(params).toString();
      const res   = await this.client.get(`${path}?${query}`);
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.msg || err.message);
    }
  }

  async post(path, params = {}) {
    try {
      const body = this.sign(params);
      const res  = await this.client.post(path, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.msg || err.message);
    }
  }

  async delete(path, params = {}) {
    try {
      const query = this.sign(params);
      const res   = await this.client.delete(`${path}?${query}`);
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.msg || err.message);
    }
  }

  // ── Market Data (No Auth) ────────────────────────────────

  async getMarkPrice(symbol) {
    return await this.get('/fapi/v1/premiumIndex', { symbol });
  }

  async getOrderBook(symbol, limit = 20) {
    return await this.get('/fapi/v1/depth', { symbol, limit });
  }

  async getTicker24h(symbol) {
    return await this.get('/fapi/v1/ticker/24hr', { symbol });
  }

  async getKlines(symbol, interval = '1h', limit = 200) {
    return await this.get('/fapi/v1/klines', { symbol, interval, limit });
  }

  async getFundingRate(symbol) {
    return await this.get('/fapi/v1/fundingRate', { symbol, limit: 1 });
  }

  async getExchangeInfo(symbol) {
    const data = await this.get('/fapi/v1/exchangeInfo');
    if (symbol) {
      return data.symbols?.find(s => s.symbol === symbol) || null;
    }
    return data;
  }

  // ── Account (Auth Required) ──────────────────────────────

  async getBalance() {
    return await this.get('/fapi/v2/balance', {}, true);
  }

  async getAccount() {
    return await this.get('/fapi/v2/account', {}, true);
  }

  async getPositions(symbol = null) {
    const params = symbol ? { symbol } : {};
    return await this.get('/fapi/v2/positionRisk', params, true);
  }

  async changeLeverage(symbol, leverage) {
    return await this.post('/fapi/v1/leverage', { symbol, leverage });
  }

  async changeMarginType(symbol, marginType) {
    // marginType: ISOLATED or CROSSED
    return await this.post('/fapi/v1/marginType', { symbol, marginType });
  }

  async changePositionMode(dualSidePosition) {
    // dualSidePosition: true=Hedge, false=One-way
    return await this.post('/fapi/v1/positionSide/dual', { dualSidePosition });
  }

  // ── Orders ───────────────────────────────────────────────

  async placeOrder(params) {
    const payload = {
      symbol:          params.symbol,
      side:            params.side.toUpperCase(),
      positionSide:    params.positionSide || 'BOTH',
      type:            params.type.toUpperCase(),
      quantity:        params.quantity,
      reduceOnly:      params.reduceOnly || false,
      newOrderRespType: 'RESULT',
    };

    if (params.newClientOrderId) payload.newClientOrderId = params.newClientOrderId;

    // LIMIT order
    if (params.type.toUpperCase() === 'LIMIT') {
      payload.price       = params.price;
      payload.timeInForce = params.timeInForce || 'GTC';
    }

    // STOP_MARKET / TAKE_PROFIT_MARKET
    if (['STOP_MARKET','TAKE_PROFIT_MARKET'].includes(params.type.toUpperCase())) {
      payload.stopPrice = params.stopPrice;
    }

    // TRAILING_STOP_MARKET
    if (params.type.toUpperCase() === 'TRAILING_STOP_MARKET') {
      payload.callbackRate  = params.callbackRate || 1;
      if (params.activatePrice) payload.activationPrice = params.activatePrice;
    }

    return await this.post('/fapi/v1/order', payload);
  }

  // Modify limit order (price/qty change)
  async modifyOrder(symbol, orderId, clientOrderId, side, quantity, price) {
    const params = { symbol, side: side.toUpperCase(), quantity, price };
    if (orderId)       params.orderId = orderId;
    if (clientOrderId) params.origClientOrderId = clientOrderId;
    return await this.put('/fapi/v1/order', params);
  }

  async put(path, params = {}) {
    try {
      const body = this.sign(params);
      const res  = await this.client.put(path, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return res.data;
    } catch(err) {
      throw new Error(err.response?.data?.msg || err.message);
    }
  }

  async cancelOrder(symbol, orderId = null, clientOrderId = null) {
    const params = { symbol };
    if (orderId)       params.orderId = orderId;
    if (clientOrderId) params.origClientOrderId = clientOrderId;
    return await this.delete('/fapi/v1/order', params);
  }

  async cancelAllOrders(symbol) {
    return await this.delete('/fapi/v1/allOpenOrders', { symbol });
  }

  async queryOrder(symbol, orderId = null, clientOrderId = null) {
    const params = { symbol };
    if (orderId)       params.orderId = orderId;
    if (clientOrderId) params.origClientOrderId = clientOrderId;
    return await this.get('/fapi/v1/order', params, true);
  }

  async getOpenOrders(symbol = null) {
    const params = symbol ? { symbol } : {};
    return await this.get('/fapi/v1/openOrders', params, true);
  }

  async modifyPositionMargin(symbol, amount, type, positionSide = 'BOTH') {
    return await this.post('/fapi/v1/positionMargin', {
      symbol, amount, type, positionSide
    });
  }

  // ── UserDataStream ───────────────────────────────────────

  async createListenKey() {
    const res = await this.client.post('/fapi/v1/listenKey', '', {
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });
    return res.data.listenKey;
  }

  async keepaliveListenKey(listenKey) {
    await this.client.put(`/fapi/v1/listenKey?listenKey=${listenKey}`, '', {
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });
  }

  // ── Lot Size helper ─────────────────────────────────────

  async getLotSize(symbol) {
    const info = await this.getExchangeInfo(symbol);
    if (!info) return null;
    const filter = info.filters?.find(f => f.filterType === 'LOT_SIZE');
    return filter ? {
      stepSize: parseFloat(filter.stepSize),
      minQty:   parseFloat(filter.minQty),
      maxQty:   parseFloat(filter.maxQty),
    } : null;
  }

  roundQty(qty, stepSize) {
    const step = parseFloat(stepSize);
    const q    = parseFloat(qty);
    if (!step) return q;
    const precision = (step.toString().split('.')[1] || '').length;
    return parseFloat((Math.floor(q / step) * step).toFixed(precision));
  }

  // ── Algo Orders (TP/SL) ─────────────────────────────────
  // POST /fapi/v1/algoOrder - For STOP_MARKET, TAKE_PROFIT_MARKET, TRAILING_STOP_MARKET
  async placeAlgoOrder(params) {
    // algoType is always CONDITIONAL for TP/SL/Trailing
    const payload = {
      symbol:       params.symbol,
      side:         params.side.toUpperCase(),
      positionSide: params.positionSide || 'BOTH',
      algoType:     'CONDITIONAL',
      type:         params.type?.toUpperCase(),
      quantity:     params.quantity,
      workingType:  params.workingType || 'MARK_PRICE',
    };
    if (params.triggerPrice) payload.triggerPrice = params.triggerPrice;
    if (params.stopPrice)    payload.triggerPrice = params.stopPrice; // alias
    if (params.reduceOnly)   payload.reduceOnly   = String(params.reduceOnly);
    if (params.clientAlgoId) payload.clientAlgoId = params.clientAlgoId;
    if (params.callbackRate) payload.callbackRate  = params.callbackRate;
    if (params.activationPrice) payload.activatePrice = params.activationPrice;
    if (params.closePosition)   payload.closePosition = String(params.closePosition);
    return await this.post('/fapi/v1/algoOrder', payload);
  }

  async cancelAlgoOrder(algoId) {
    return await this.delete('/fapi/v1/algoOrder', { algoId });
  }

  async getOpenAlgoOrders(symbol) {
    return await this.get('/fapi/v1/openAlgoOrders', { symbol }, true);
  }
} // <--- Class ends here now (Correct placement)

// Singleton factory
let _instance = null;

async function getFuturesBinanceAdapter() {
  if (_instance) return _instance;
  const db   = require('../../../config/database');
  const { rows } = await db.query(
    'SELECT api_key, api_secret FROM binance_credentials WHERE is_active=true LIMIT 1'
  );
  if (!rows[0]) throw new Error('No Binance credentials found');
  _instance = new FuturesBinanceAdapter(rows[0].api_key, rows[0].api_secret);
  return _instance;
}

// Reset singleton (when creds change)
function resetAdapter() { _instance = null; }

module.exports = { FuturesBinanceAdapter, getFuturesBinanceAdapter, resetAdapter };
