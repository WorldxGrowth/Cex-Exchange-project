const axios  = require('axios');
const crypto = require('crypto');
const db     = require('../../config/database');

class BinanceAdapter {

  async getCredentials() {
    const res = await db.query(
      'SELECT * FROM binance_credentials WHERE is_active=true ORDER BY id LIMIT 1'
    );
    if (!res.rows[0]) throw new Error('Binance credentials not configured');
    return res.rows[0];
  }

  sign(queryString, secret) {
    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
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
      method, url,
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

  // ── Get symbol filters from DB ────────────────
  async getSymbolFilters(symbol) {
    try {
      const res = await db.query(`
        SELECT step_size, tick_size, min_notional, min_qty, max_qty
        FROM trading_pairs WHERE binance_symbol=$1
      `, [symbol.toUpperCase()]);
      if (res.rows[0]) return res.rows[0];
    } catch (e) {}
    // fallback defaults
    return { step_size: 0.00001, tick_size: 0.01, min_notional: 5, min_qty: 0.00001, max_qty: 9000000 };
  }

  // ── Round quantity to stepSize ────────────────
  roundQty(qty, stepSize) {
    if (!stepSize || stepSize <= 0) return qty;
    const precision = Math.round(-Math.log10(stepSize));
    const factor    = Math.pow(10, precision);
    return Math.floor(qty * factor) / factor;
  }

  // ── Round price to tickSize ───────────────────
  roundPrice(price, tickSize) {
    if (!tickSize || tickSize <= 0) return price;
    const precision = Math.round(-Math.log10(tickSize));
    const factor    = Math.pow(10, precision);
    return Math.round(price * factor) / factor;
  }

  // ── Validate order against Binance filters ────
  validateOrder(qty, price, filters) {
    const { step_size, tick_size, min_notional, min_qty, max_qty } = filters;
    const roundedQty   = this.roundQty(qty, parseFloat(step_size));
    const roundedPrice = this.roundPrice(price, parseFloat(tick_size));
    const notional     = roundedQty * roundedPrice;

    if (roundedQty < parseFloat(min_qty)) {
      return {
        ok: false,
        reason: 'qty_too_small',
        message: `Minimum order quantity is ${min_qty}`
      };
    }
    if (roundedQty > parseFloat(max_qty)) {
      return {
        ok: false,
        reason: 'qty_too_large',
        message: `Maximum order quantity is ${max_qty}`
      };
    }
    if (notional < parseFloat(min_notional)) {
      return {
        ok: false,
        reason: 'notional_too_small',
        message: `Minimum order value is $${min_notional} (current: $${notional.toFixed(2)})`
      };
    }
    return { ok: true, roundedQty, roundedPrice };
  }

  // ── Place Order ────────────────────────────────
  async placeOrder({ symbol, side, orderType, quantity, price, clientOrderId }) {
    // Get symbol filters
    const filters    = await this.getSymbolFilters(symbol);
    const stepSize   = parseFloat(filters.step_size  || 0.00001);
    const tickSize   = parseFloat(filters.tick_size  || 0.01);
    const minNotional = parseFloat(filters.min_notional || 5);
    const minQty     = parseFloat(filters.min_qty    || 0.00001);

    // Auto-round quantity to stepSize
    const roundedQty = this.roundQty(parseFloat(quantity), stepSize);

    if (roundedQty < minQty) {
      throw new Error(`Quantity too small. Min: ${minQty} ${symbol.replace('USDT','')}`);
    }

    const params = {
      symbol:           symbol.toUpperCase(),
      side:             side.toUpperCase(),
      newClientOrderId: clientOrderId,
      newOrderRespType: 'FULL'
    };

    if (orderType.toLowerCase() === 'limit') {
      const roundedPrice = this.roundPrice(parseFloat(price), tickSize);
      const notional     = roundedQty * roundedPrice;

      if (notional < minNotional) {
        throw new Error(`Order value too small. Min: $${minNotional} (current: $${notional.toFixed(2)})`);
      }

      params.type        = 'LIMIT';
      params.timeInForce = 'GTC';
      params.quantity    = roundedQty;
      params.price       = roundedPrice.toFixed(Math.round(-Math.log10(tickSize)));

    } else if (orderType.toLowerCase() === 'market') {
      params.type     = 'MARKET';
      params.quantity = roundedQty;
      // Market notional is estimated, Binance validates it
    }

    console.log(`[Binance] Placing ${params.side} ${params.type} ${roundedQty} ${symbol} @ ${params.price || 'MARKET'}`);

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
        symbol:            symbol.toUpperCase(),
        origClientOrderId: clientOrderId
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

  // ── Fetch & save exchangeInfo for symbols ─────
  async syncExchangeInfo(symbols) {
    try {
      const res = await axios.get(
        'https://api.binance.com/api/v3/exchangeInfo?symbols=' + JSON.stringify(symbols)
      );
      for (const sym of res.data.symbols) {
        const filters = {};
        sym.filters.forEach(f => { filters[f.filterType] = f; });

        const stepSize    = parseFloat(filters.LOT_SIZE?.stepSize    || 0.00001);
        const minQty      = parseFloat(filters.LOT_SIZE?.minQty      || 0.00001);
        const maxQty      = parseFloat(filters.LOT_SIZE?.maxQty      || 9000000);
        const tickSize    = parseFloat(filters.PRICE_FILTER?.tickSize || 0.01);
        const minNotional = parseFloat(filters.NOTIONAL?.minNotional  || 5);

        await db.query(`
          UPDATE trading_pairs SET
            step_size=$1, min_qty=$2, max_qty=$3,
            tick_size=$4, min_notional=$5
          WHERE binance_symbol=$6
        `, [stepSize, minQty, maxQty, tickSize, minNotional, sym.symbol]);
      }
      console.log(`[Binance] ExchangeInfo synced for ${symbols.length} symbols`);
    } catch (e) {
      console.error('[Binance] syncExchangeInfo error:', e.message);
    }
  }
}

const binanceAdapter = new BinanceAdapter();
module.exports = binanceAdapter;
