/**
 * Futures Mark Price Updater
 * Polls Binance fapi REST every 1s for accurate futures mark prices
 * (fstream.binance.com WebSocket is blocked on this server)
 */
const https = require('https');
const { updatePositionsPnl } = require('./pnlCalculator');

const markPrices = {};
let pollTimer    = null;
let isRunning    = false;

function getMarkPrice(symbol) {
  return markPrices[symbol] || null;
}

function getAllMarkPrices() {
  return { ...markPrices };
}

async function fetchMarkPrices() {
  return new Promise((resolve) => {
    const req = https.get(
      'https://fapi.binance.com/fapi/v1/premiumIndex',
      { timeout: 3000 },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const arr = JSON.parse(data);
            if (Array.isArray(arr)) {
              for (const item of arr) {
                if (item.symbol && item.markPrice) {
                  markPrices[item.symbol] = parseFloat(item.markPrice);
                }
              }
            } else if (arr.symbol) {
              markPrices[arr.symbol] = parseFloat(arr.markPrice);
            }
            resolve(markPrices);
          } catch(e) { resolve({}); }
        });
      }
    );
    req.on('error', () => resolve({}));
    req.on('timeout', () => { req.destroy(); resolve({}); });
  });
}

async function pollLoop() {
  if (!isRunning) return;
  try {
    await fetchMarkPrices();
    // Update PnL for all symbols that have open positions
    const db = require('../../../config/database');
    const { rows: activePairs } = await db.query(
      `SELECT DISTINCT fp.symbol
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       WHERE p.status = 'open' AND fp.is_custom = false`
    );
    for (const pair of activePairs) {
      const mp = markPrices[pair.symbol];
      if (mp) {
        await updatePositionsPnl(pair.symbol, mp).catch(() => {});
      }
    }
  } catch(e) {}
  // Poll every 1s
  pollTimer = setTimeout(pollLoop, 1000);
}

function start() {
  if (isRunning) return;
  isRunning = true;
  console.log('[FuturesMarkPrice] Starting REST poll (1s interval)...');
  pollLoop();
}

function stop() {
  isRunning = false;
  clearTimeout(pollTimer);
}

module.exports = { start, getMarkPrice, getAllMarkPrices, fetchMarkPrices };
