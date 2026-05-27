const axios = require('axios');
const db = require('../config/database');

const SYMBOLS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','TRXUSDT'];
const INTERVALS = ['1m','15m','1h','4h','1d'];

const fetchAndSaveKlines = async (symbol, interval) => {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;
    const res = await axios.get(url, { timeout: 10000 });
    const klines = res.data;

    for (const k of klines) {
      await db.query(`
        INSERT INTO klines (pair_symbol, interval, open_time, open, high, low, close, volume, close_time)
        VALUES ($1,$2,to_timestamp($3/1000.0),$4,$5,$6,$7,$8,to_timestamp($9/1000.0))
        ON CONFLICT (pair_symbol, interval, open_time) DO UPDATE SET
          open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
          close=EXCLUDED.close, volume=EXCLUDED.volume
      `, [symbol, interval, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]);
    }
  } catch (err) {
    // Silently fail - Binance may rate limit
  }
};

const startKlinesFetcher = async () => {
  console.log('📊 Klines fetcher started');
  // Initial fetch
  for (const sym of SYMBOLS) {
    for (const iv of INTERVALS) {
      await fetchAndSaveKlines(sym, iv);
      await new Promise(r => setTimeout(r, 200)); // Rate limit
    }
  }

  // Every 1 min - fetch 1m klines
  setInterval(async () => {
    for (const sym of SYMBOLS) {
      await fetchAndSaveKlines(sym, '1m');
      await new Promise(r => setTimeout(r, 100));
    }
  }, 60000);

  // Every 15 min - fetch other intervals
  setInterval(async () => {
    for (const sym of SYMBOLS) {
      for (const iv of ['15m','1h','4h','1d']) {
        await fetchAndSaveKlines(sym, iv);
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }, 900000);
};

module.exports = { startKlinesFetcher };
