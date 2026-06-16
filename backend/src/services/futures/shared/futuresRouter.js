/**
 * Futures Order Router
 * Same pattern as spot tradingRouter.js
 * is_custom=true  → internal engine
 * is_custom=false → Binance fapi passthrough
 */
const db = require('../../../config/database');

let binanceHedge  = null;
let internalEngine = null;

// Lazy load to avoid circular deps
function getBinanceHedge() {
  if (!binanceHedge) binanceHedge = require('../binance/futuresBinanceHedge');
  return binanceHedge;
}

function getInternalEngine() {
  if (!internalEngine) internalEngine = require('../internal/futuresEngine');
  return internalEngine;
}

/**
 * Route a futures order to correct engine
 * @param {Object} order - futures_orders row
 * @param {Object} pair  - futures_pairs row
 */
async function routeFuturesOrder(order, pair) {
  if (pair.is_custom) {
    // Internal matching engine (VDC futures, custom listed tokens)
    console.log(`[FuturesRouter] INTERNAL → ${order.symbol} ${order.side} ${order.quantity}`);
    return await getInternalEngine().processOrder(order, pair);
  } else {
    // Binance fapi passthrough
    console.log(`[FuturesRouter] BINANCE  → ${order.symbol} ${order.side} ${order.quantity}`);
    return await getBinanceHedge().placeOrder(order, pair);
  }
}

/**
 * Route a cancel order
 */
async function routeCancelOrder(order, pair) {
  if (pair.is_custom) {
    return await getInternalEngine().cancelOrder(order, pair);
  } else {
    return await getBinanceHedge().cancelOrder(order, pair);
  }
}

/**
 * Get futures pair with all config
 */
async function getFuturesPair(symbol) {
  const { rows } = await db.query(
    `SELECT fp.*, c.symbol as base_symbol, c.name as base_name
     FROM futures_pairs fp
     JOIN coins c ON c.id = fp.base_coin_id
     WHERE fp.symbol = $1 AND fp.is_active = true`,
    [symbol.toUpperCase()]
  );
  return rows[0] || null;
}

/**
 * Get Binance credentials
 */
async function getBinanceCreds() {
  const { rows } = await db.query(
    `SELECT api_key, api_secret FROM binance_credentials 
     WHERE is_active = true LIMIT 1`
  );
  return rows[0] || null;
}

module.exports = { routeFuturesOrder, routeCancelOrder, getFuturesPair, getBinanceCreds };
