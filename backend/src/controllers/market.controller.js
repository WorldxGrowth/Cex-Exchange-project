const db = require('../config/database');
const { cache } = require('../config/redis');
const axios = require('axios');
const { success, error } = require('../utils/response');

// GET all coins
const getCoins = async (req, res) => {
  try {
    const coins = await db.query(`
      SELECT c.id, c.symbol, c.name, c.logo_url, c.coin_type,
             c.decimals, c.is_deposit, c.is_withdraw,
             c.min_deposit, c.min_withdraw, c.withdraw_fee,
             c.confirmations, c.price_source,
             n.name as network_name, n.short_name as network,
             n.chain_id, n.explorer_url,
             p.price_usdt, p.change_24h, p.volume_24h,
             p.high_24h, p.low_24h
      FROM coins c
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN price_feeds p ON p.coin_id = c.id
      WHERE c.is_active = true
      ORDER BY c.sort_order ASC
    `);
    return success(res, coins.rows);
  } catch (err) {
    return error(res, 'Failed to get coins', 500);
  }
};

// GET all trading pairs
const getPairs = async (req, res) => {
  try {
    const pairs = await db.query(`
      SELECT tp.id, tp.symbol, tp.is_active, tp.listing_date,
             tp.price_precision, tp.qty_precision,
             tp.min_order_qty, tp.min_order_value,
             tp.maker_fee, tp.taker_fee, tp.sort_order,
             bc.symbol as base_symbol, bc.name as base_name, bc.logo_url as base_logo,
             qc.symbol as quote_symbol,
             p.price_usdt as price, p.change_24h,
             p.volume_24h, p.high_24h, p.low_24h
      FROM trading_pairs tp
      JOIN coins bc ON bc.id = tp.base_coin_id
      JOIN coins qc ON qc.id = tp.quote_coin_id
      LEFT JOIN price_feeds p ON p.coin_id = tp.base_coin_id
      WHERE tp.is_active = true
      ORDER BY tp.sort_order ASC
    `);
    return success(res, pairs.rows);
  } catch (err) {
    return error(res, 'Failed to get pairs', 500);
  }
};

// GET ticker for one pair
const getTicker = async (req, res) => {
  try {
    const { symbol } = req.params;

    // Check Redis cache first
    const cached = await cache.get(`ticker:${symbol}`);
    if (cached) return success(res, cached);

    const pair = await db.query(`
      SELECT tp.*, bc.symbol as base_symbol, qc.symbol as quote_symbol,
             p.price_usdt as price, p.change_1h, p.change_24h, p.change_7d,
             p.volume_24h, p.high_24h, p.low_24h, p.market_cap
      FROM trading_pairs tp
      JOIN coins bc ON bc.id = tp.base_coin_id
      JOIN coins qc ON qc.id = tp.quote_coin_id
      LEFT JOIN price_feeds p ON p.coin_id = tp.base_coin_id
      WHERE tp.symbol = $1
    `, [symbol.toUpperCase()]);

    if (!pair.rows[0]) return error(res, 'Pair not found', 404);

    await cache.set(`ticker:${symbol}`, pair.rows[0], 10);
    return success(res, pair.rows[0]);
  } catch (err) {
    return error(res, 'Failed to get ticker', 500);
  }
};

// GET order book (from Redis)
const getOrderBook = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 20 } = req.query;

    const pair = await db.query(
      'SELECT id FROM trading_pairs WHERE symbol = $1',
      [symbol.toUpperCase()]
    );
    if (!pair.rows[0]) return error(res, 'Pair not found', 404);

    const pairId = pair.rows[0].id;
    const { redis } = require('../config/redis');

    // Get bids (buy orders) - highest first
    const bids = await redis.zrevrange(
      `orderbook:${pairId}:bids`, 0, limit - 1, 'WITHSCORES'
    );

    // Get asks (sell orders) - lowest first
    const asks = await redis.zrange(
      `orderbook:${pairId}:asks`, 0, limit - 1, 'WITHSCORES'
    );

    // Format
    const formatOrders = (arr) => {
      const result = [];
      for (let i = 0; i < arr.length; i += 2) {
        result.push({ qty: arr[i], price: arr[i + 1] });
      }
      return result;
    };

    // If Redis empty, get from DB
    if (bids.length === 0 && asks.length === 0) {
      const dbOrders = await db.query(`
        SELECT side, price, SUM(remaining_qty) as total_qty
        FROM orders
        WHERE pair_id = $1 AND status = 'open'
        GROUP BY side, price
        ORDER BY
          CASE WHEN side = 'buy' THEN price END DESC,
          CASE WHEN side = 'sell' THEN price END ASC
        LIMIT $2
      `, [pairId, limit * 2]);

      const dbBids = dbOrders.rows.filter(o => o.side === 'buy')
        .map(o => ({ price: o.price, qty: o.total_qty }));
      const dbAsks = dbOrders.rows.filter(o => o.side === 'sell')
        .map(o => ({ price: o.price, qty: o.total_qty }));

      return success(res, { bids: dbBids, asks: dbAsks, symbol });
    }

    return success(res, {
      bids: formatOrders(bids),
      asks: formatOrders(asks),
      symbol
    });
  } catch (err) {
    return error(res, 'Failed to get order book', 500);
  }
};

// GET recent trades
const getRecentTrades = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 50 } = req.query;

    const pair = await db.query(
      'SELECT id FROM trading_pairs WHERE symbol = $1',
      [symbol.toUpperCase()]
    );
    if (!pair.rows[0]) return error(res, 'Pair not found', 404);

    const trades = await db.query(`
      SELECT price, quantity, total_value,
             CASE WHEN is_maker_buy THEN 'sell' ELSE 'buy' END as side,
             created_at
      FROM trades
      WHERE pair_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [pair.rows[0].id, limit]);

    return success(res, trades.rows);
  } catch (err) {
    return error(res, 'Failed to get trades', 500);
  }
};

// GET klines/candles
const getKlines = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 200, startTime, endTime } = req.query;

    const validIntervals = ['1m','5m','15m','30m','1h','4h','1d','1w'];
    if (!validIntervals.includes(interval)) {
      return error(res, 'Invalid interval');
    }

    const pair = await db.query(
      'SELECT id FROM trading_pairs WHERE symbol = $1',
      [symbol.toUpperCase()]
    );
    if (!pair.rows[0]) return error(res, 'Pair not found', 404);

    let query = `
      SELECT open_time, open, high, low, close, volume, close_time
      FROM klines
      WHERE pair_id = $1 AND interval = $2
    `;
    const params = [pair.rows[0].id, interval];

    if (startTime) { params.push(new Date(parseInt(startTime))); query += ` AND open_time >= $${params.length}`; }
    if (endTime)   { params.push(new Date(parseInt(endTime)));   query += ` AND open_time <= $${params.length}`; }

    params.push(limit);
    query += ` ORDER BY open_time DESC LIMIT $${params.length}`;

    const klines = await db.query(query, params);
    return success(res, klines.rows.reverse());
  } catch (err) {
    return error(res, 'Failed to get klines', 500);
  }
};

// UPDATE prices from Binance (called by cron job)
const updatePricesFromBinance = async () => {
  try {
    const coins = await db.query(
      "SELECT id, symbol, price_symbol FROM coins WHERE price_source = 'binance' AND is_active = true"
    );

    if (coins.rows.length === 0) return;

    const symbols = coins.rows
      .filter(c => c.price_symbol && c.price_symbol !== 'USDTUSDT')
      .map(c => `"${c.price_symbol}"`)
      .join(',');

    if (!symbols) return;

    const response = await axios.get(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`,
      { timeout: 10000 }
    );

    for (const ticker of response.data) {
      const coin = coins.rows.find(c => c.price_symbol === ticker.symbol);
      if (!coin) continue;

      await db.query(`
        INSERT INTO price_feeds (coin_id, price_usdt, change_24h, volume_24h, high_24h, low_24h, source, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'binance', NOW())
        ON CONFLICT (coin_id) DO UPDATE SET
          price_usdt = $2, change_24h = $3, volume_24h = $4,
          high_24h = $5, low_24h = $6, source = 'binance', updated_at = NOW()
      `, [
        coin.id,
        parseFloat(ticker.lastPrice),
        parseFloat(ticker.priceChangePercent),
        parseFloat(ticker.quoteVolume),
        parseFloat(ticker.highPrice),
        parseFloat(ticker.lowPrice)
      ]);

      // Cache mein bhi save karo
      await cache.set(`price:${coin.symbol}`, {
        price: ticker.lastPrice,
        change_24h: ticker.priceChangePercent,
        volume_24h: ticker.quoteVolume
      }, 30);
    }

    // USDT = always 1
    const usdtCoin = coins.rows.find(c => c.symbol === 'USDT');
    if (usdtCoin) {
      await db.query(`
        INSERT INTO price_feeds (coin_id, price_usdt, change_24h, source, updated_at)
        VALUES ($1, 1.00, 0, 'fixed', NOW())
        ON CONFLICT (coin_id) DO UPDATE SET price_usdt = 1.00, updated_at = NOW()
      `, [usdtCoin.id]);
    }

    console.log(`✅ Prices updated: ${response.data.length} coins`);
  } catch (err) {
    console.error('Price update error:', err.message);
  }
};

module.exports = { getCoins, getPairs, getTicker, getOrderBook, getRecentTrades, getKlines, updatePricesFromBinance };

// updatePricesFromCoingecko →
// CoinGecko FREE API se VDC jaise custom
// coins ka price fetch karta hai jo
// Binance pe listed nahi hain
const updatePricesFromCoingecko = async () => {
  try {
    const coins = await db.query(
      "SELECT id, symbol, price_symbol FROM coins WHERE price_source = 'coingecko' AND is_active = true"
    );
    if (coins.rows.length === 0) return;

    const ids = coins.rows.map(c => c.price_symbol).join(',');
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { timeout: 10000 }
    );

    for (const coin of coins.rows) {
      const data = response.data[coin.price_symbol];
      if (!data) continue;

      await db.query(`
        INSERT INTO price_feeds (coin_id, price_usdt, change_24h, volume_24h, source, updated_at)
        VALUES ($1, $2, $3, $4, 'coingecko', NOW())
        ON CONFLICT (coin_id) DO UPDATE SET
          price_usdt = $2, change_24h = $3, volume_24h = $4,
          source = 'coingecko', updated_at = NOW()
      `, [coin.id, data.usd, data.usd_24h_change, data.usd_24h_vol]);
    }
    console.log(`✅ CoinGecko prices updated`);
  } catch (err) {
    console.error('CoinGecko error:', err.message);
  }
};

module.exports.updatePricesFromCoingecko = updatePricesFromCoingecko;
