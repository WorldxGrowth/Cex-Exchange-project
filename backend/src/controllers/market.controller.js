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
      SELECT tp.id, tp.symbol, tp.is_active, tp.is_custom,
             tp.binance_symbol, tp.listing_date,
             tp.price_precision, tp.qty_precision,
             tp.min_order_qty, tp.min_order_value,
             tp.maker_fee, tp.taker_fee, tp.sort_order,
             tp.pre_listing_mode, tp.show_countdown,
             tp.trading_enabled_at, tp.trading_notice,
             bc.symbol as base_symbol, bc.name as base_name, bc.logo_url as base_logo,
             qc.symbol as quote_symbol,
             p.price_usdt as price, p.change_24h,
             p.volume_24h, p.high_24h, p.low_24h
      FROM trading_pairs tp
      JOIN coins bc ON bc.id = tp.base_coin_id
      JOIN coins qc ON qc.id = tp.quote_coin_id
      LEFT JOIN price_feeds p ON p.coin_id = tp.base_coin_id
      WHERE (tp.is_active = true OR tp.pre_listing_mode = true)
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

// ─────────────────────────────────────────────────────
// GET ORDER BOOK
// is_custom = false → Binance orderbook (pass-through)
// is_custom = true  → Internal DB orderbook (VDC/custom)
// ─────────────────────────────────────────────────────
const getOrderBook = async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = Math.min(parseInt(req.query.limit || 20), 100);

    const pair = await db.query(
      `SELECT id, is_custom, binance_symbol
       FROM trading_pairs WHERE symbol = $1 AND is_active = true`,
      [symbol.toUpperCase()]
    );
    if (!pair.rows[0]) return error(res, 'Pair not found', 404);

    const { id: pairId, is_custom, binance_symbol } = pair.rows[0];

    // Binance pass-through
    if (!is_custom && binance_symbol) {
      try {
        const cacheKey = `binance_ob:${binance_symbol}:${limit}`;
        const cached = await cache.get(cacheKey);
        if (cached) return success(res, { ...cached, symbol, source: 'binance' });

        const response = await axios.get(
          'https://api.binance.com/api/v3/depth',
          { params: { symbol: binance_symbol, limit }, timeout: 3000 }
        );
        const data = {
          bids: response.data.bids.map(([price, qty]) => ({ price, qty })),
          asks: response.data.asks.map(([price, qty]) => ({ price, qty })),
          lastUpdateId: response.data.lastUpdateId
        };
        await cache.set(cacheKey, data, 2);
        return success(res, { ...data, symbol, source: 'binance' });
      } catch (e) {
        console.error('Binance orderbook fallback to internal:', e.message);
        // Fallback to internal on Binance failure
      }
    }

    // Internal orderbook (VDC/custom tokens + Binance fallback)
    const cacheKey = `internal_ob:${pairId}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) return success(res, { ...cached, symbol, source: 'internal' });

    const bids = await db.query(`
      SELECT CAST(price AS VARCHAR) as price,
             CAST(SUM(remaining_qty) AS VARCHAR) as qty,
             COUNT(*) as order_count
      FROM orders
      WHERE pair_id = $1
        AND side = 'buy'
        AND status IN ('open','partially_filled')
        AND price IS NOT NULL
      GROUP BY price
      ORDER BY price DESC
      LIMIT $2
    `, [pairId, limit]);

    const asks = await db.query(`
      SELECT CAST(price AS VARCHAR) as price,
             CAST(SUM(remaining_qty) AS VARCHAR) as qty,
             COUNT(*) as order_count
      FROM orders
      WHERE pair_id = $1
        AND side = 'sell'
        AND status IN ('open','partially_filled')
        AND price IS NOT NULL
      GROUP BY price
      ORDER BY price ASC
      LIMIT $2
    `, [pairId, limit]);

    const bestBid = bids.rows[0]?.price || null;
    const bestAsk = asks.rows[0]?.price || null;
    const spread = bestBid && bestAsk
      ? (parseFloat(bestAsk) - parseFloat(bestBid)).toFixed(6)
      : null;

    const data = { bids: bids.rows, asks: asks.rows, bestBid, bestAsk, spread };
    await cache.set(cacheKey, data, 1);
    return success(res, { ...data, symbol, source: 'internal' });

  } catch (err) {
    console.error('getOrderBook error:', err.message);
    return error(res, 'Failed to get order book', 500);
  }
};

// GET recent trades
const getRecentTrades = async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = Math.min(parseInt(req.query.limit || 50), 200);

    const pair = await db.query(
      'SELECT id, is_custom, binance_symbol FROM trading_pairs WHERE symbol = $1',
      [symbol.toUpperCase()]
    );
    if (!pair.rows[0]) return error(res, 'Pair not found', 404);

    const { id: pairId, is_custom, binance_symbol } = pair.rows[0];

    // Internal trades from our DB (trades table)
    const trades = await db.query(`
      SELECT price, quantity, total_value,
             CASE WHEN is_maker_buy THEN 'sell' ELSE 'buy' END as side,
             created_at
      FROM trades
      WHERE pair_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [pairId, limit]);

    // If no internal trades and Binance pair → fetch from Binance
    if (trades.rows.length === 0 && !is_custom && binance_symbol) {
      try {
        const response = await axios.get(
          'https://api.binance.com/api/v3/trades',
          { params: { symbol: binance_symbol, limit }, timeout: 3000 }
        );
        const binanceTrades = response.data.map(t => ({
          price: t.price,
          quantity: t.qty,
          side: t.isBuyerMaker ? 'sell' : 'buy',
          created_at: new Date(t.time)
        }));
        return success(res, binanceTrades);
      } catch (e) {
        return success(res, []);
      }
    }

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
      'SELECT id, is_custom, binance_symbol FROM trading_pairs WHERE symbol = $1',
      [symbol.toUpperCase()]
    );
    if (!pair.rows[0]) return error(res, 'Pair not found', 404);

    const { id: pairId, is_custom, binance_symbol } = pair.rows[0];

    // Internal klines first
    let query = `
      SELECT open_time, open, high, low, close, volume, close_time
      FROM klines
      WHERE pair_id = $1 AND interval = $2
    `;
    const params = [pairId, interval];
    if (startTime) { params.push(new Date(parseInt(startTime))); query += ` AND open_time >= $${params.length}`; }
    if (endTime)   { params.push(new Date(parseInt(endTime)));   query += ` AND open_time <= $${params.length}`; }
    params.push(limit);
    query += ` ORDER BY open_time DESC LIMIT $${params.length}`;

    const klines = await db.query(query, params);
    if (klines.rows.length > 0) {
      return success(res, klines.rows.reverse());
    }

    // Fallback: Binance klines for non-custom pairs
    if (!is_custom && binance_symbol) {
      try {
        const response = await axios.get(
          'https://api.binance.com/api/v3/klines',
          { params: { symbol: binance_symbol, interval, limit }, timeout: 5000 }
        );
        const data = response.data.map(k => ({
          open_time: k[0], open: k[1], high: k[2],
          low: k[3], close: k[4], volume: k[5], close_time: k[6]
        }));
        return success(res, data);
      } catch (e) {
        return success(res, []);
      }
    }

    // Custom token → trades se OHLCV generate karo
    if (is_custom) {
      try {
        const intervalSeconds = {
          '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
          '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800
        };
        const secs = intervalSeconds[interval] || 3600;

        const tradesData = await db.query(`
          SELECT
            to_timestamp(floor(extract(epoch from created_at) / $1) * $1) as open_time,
            (array_agg(price ORDER BY created_at ASC))[1] as open,
            MAX(price) as high,
            MIN(price) as low,
            (array_agg(price ORDER BY created_at DESC))[1] as close,
            SUM(quantity) as volume,
            to_timestamp(floor(extract(epoch from created_at) / $1) * $1 + $1 - 1) as close_time
          FROM trades
          WHERE pair_id = $2
          GROUP BY floor(extract(epoch from created_at) / $1)
          ORDER BY open_time ASC
          LIMIT $3
        `, [secs, pairId, limit]);

        if (tradesData.rows.length > 0) {
          return success(res, tradesData.rows);
        }
      } catch (e) {
        console.error('Custom klines error:', e.message);
      }
    }

    return success(res, []);
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
        INSERT INTO price_feeds
          (coin_id, price_usdt, change_24h, volume_24h, high_24h, low_24h, source, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'binance', NOW())
        ON CONFLICT (coin_id) DO UPDATE SET
          price_usdt = $2, change_24h = $3, volume_24h = $4,
          high_24h = $5, low_24h = $6, source = 'binance', updated_at = NOW()
      `, [coin.id,
          parseFloat(ticker.lastPrice), parseFloat(ticker.priceChangePercent),
          parseFloat(ticker.quoteVolume), parseFloat(ticker.highPrice),
          parseFloat(ticker.lowPrice)]);

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

// UPDATE prices from CoinGecko (VDC jaise custom coins)
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
        INSERT INTO price_feeds
          (coin_id, price_usdt, change_24h, volume_24h, source, updated_at)
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

// UPDATE custom token stats (VDC etc) from trades table
// ALL custom tokens ke liye auto-work karta hai
const updateCustomTokenStats = async () => {
  try {
    // Get all custom trading pairs
    const pairs = await db.query(`
      SELECT tp.id, tp.symbol, tp.base_coin_id,
             bc.symbol as base_symbol
      FROM trading_pairs tp
      JOIN coins bc ON bc.id = tp.base_coin_id
      WHERE tp.is_custom = true AND tp.is_active = true
    `);

    if (pairs.rows.length === 0) return;

    for (const pair of pairs.rows) {
      try {
        // 24h stats from trades
        const stats = await db.query(`
          SELECT
            COUNT(*) as trade_count,
            COALESCE(MAX(price), 0) as high_24h,
            COALESCE(MIN(price), 0) as low_24h,
            COALESCE(SUM(total_value), 0) as volume_24h,
            (array_agg(price ORDER BY created_at DESC))[1] as last_price,
            (array_agg(price ORDER BY created_at ASC))[1] as open_price
          FROM trades
          WHERE pair_id = $1
            AND created_at > NOW() - INTERVAL '24 hours'
        `, [pair.id]);

        const s = stats.rows[0];
        if (!s || parseFloat(s.trade_count) === 0) continue;

        const lastPrice  = parseFloat(s.last_price  || 0);
        const openPrice  = parseFloat(s.open_price  || lastPrice);
        const high24h    = parseFloat(s.high_24h    || 0);
        const low24h     = parseFloat(s.low_24h     || 0);
        const volume24h  = parseFloat(s.volume_24h  || 0);
        const change24h  = openPrice > 0
          ? ((lastPrice - openPrice) / openPrice * 100)
          : 0;

        // Update price_feeds
        await db.query(`
          INSERT INTO price_feeds
            (coin_id, price_usdt, change_24h, volume_24h, high_24h, low_24h, source, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'internal', NOW())
          ON CONFLICT (coin_id) DO UPDATE SET
            high_24h   = CASE WHEN $5 > 0 THEN $5 ELSE price_feeds.high_24h END,
            low_24h    = CASE WHEN $6 > 0 THEN $6 ELSE price_feeds.low_24h END,
            volume_24h = $4,
            change_24h = $3,
            updated_at = NOW()
        `, [pair.base_coin_id, lastPrice, change24h, volume24h, high24h, low24h]);

        // Update redis cache
        await cache.set(`price:${pair.base_symbol}`, {
          price: lastPrice.toString(),
          change_24h: change24h.toFixed(4),
          volume_24h: volume24h.toString(),
          high_24h: high24h.toString(),
          low_24h: low24h.toString()
        }, 60);

        console.log(`✅ Custom stats: ${pair.symbol} price=${lastPrice} vol=${volume24h} h=${high24h} l=${low24h}`);
      } catch (e) {
        console.error(`Custom stats error ${pair.symbol}:`, e.message);
      }
    }
  } catch (err) {
    console.error('updateCustomTokenStats error:', err.message);
  }
};

module.exports = {
  getCoins, getPairs, getTicker, getOrderBook,
  getRecentTrades, getKlines,
  updatePricesFromBinance, updatePricesFromCoingecko,
  updateCustomTokenStats
};

// ================================
// CMS PUBLIC APIs (no auth)
// ================================
const getCmsPagePublic = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await db.query(`
      SELECT id, slug, title, subtitle, icon, content, content_type,
             featured_image, meta_title, meta_desc, meta_keywords,
             og_image, page_type, view_count, updated_at
      FROM cms_pages
      WHERE slug=$1 AND is_published=true
    `, [slug]);

    if (!page.rows[0]) return error(res, 'Page not found', 404);

    // View count increment
    db.query('UPDATE cms_pages SET view_count=view_count+1 WHERE slug=$1', [slug]).catch(()=>{});

    return success(res, page.rows[0]);
  } catch (err) { return error(res, 'Failed', 500); }
};

const getCmsFooterPages = async (req, res) => {
  try {
    const pages = await db.query(`
      SELECT id, slug, title, icon, page_type, sort_order
      FROM cms_pages
      WHERE is_published=true AND show_in_footer=true
      ORDER BY sort_order
    `);
    return success(res, pages.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

module.exports = Object.assign(module.exports, {
  getCmsPagePublic, getCmsFooterPages
});

// ================================
// PUBLIC SITE SETTINGS (NEW — safe subset for branding/header use)
// ================================
// Only whitelisted keys are exposed here - NEVER include sensitive
// settings (SMS provider keys, treasury IDs, fee rates an attacker
// could use to game things, etc). This is the public-facing branding
// config consumed by the Landing page header, popups, etc.
const PUBLIC_SETTINGS_WHITELIST = [
  'site_name', 'site_logo', 'site_logo_circle', 'site_logo_rectangle',
  'site_favicon', 'meta_title', 'meta_description', 'meta_keywords',
  'og_image', 'telegram_link', 'twitter_link', 'support_email',
  'maintenance_mode', 'registration_open',
];

const getPublicSettings = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT key, value FROM system_settings WHERE key = ANY($1)`,
      [PUBLIC_SETTINGS_WHITELIST]
    );
    const settingsMap = {};
    result.rows.forEach(row => { settingsMap[row.key] = row.value; });
    return success(res, settingsMap);
  } catch (err) {
    console.error('getPublicSettings:', err.message);
    return error(res, 'Failed', 500);
  }
};

module.exports = Object.assign(module.exports, { getPublicSettings });
