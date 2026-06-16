/**
 * Futures Controller
 * All futures trading endpoints
 */
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../utils/response');
const { routeFuturesOrder, routeCancelOrder, getFuturesPair } = require('../services/futures/shared/futuresRouter');
const { calcInitialMargin, calcLiquidationPrice, calcOrderCost, calcMaxOrderQty } = require('../services/futures/shared/marginCalculator');
const { getUserPositionsPnl } = require('../services/futures/shared/pnlCalculator');
const { closePosition } = require('../services/futures/internal/futuresEngine');

// ── Get Futures Pairs ────────────────────────────────────────
async function getFuturesPairs(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT fp.*, c.symbol as base_symbol, c.name as base_name, c.logo_url,
              pf.price_usdt as mark_price, pf.change_24h, pf.volume_24h,
              fr.rate as funding_rate, fr.next_funding
       FROM futures_pairs fp
       JOIN coins c ON c.id = fp.base_coin_id
       LEFT JOIN price_feeds pf ON pf.coin_id = fp.base_coin_id
       LEFT JOIN funding_rates fr ON fr.pair_id = fp.id
         AND fr.id = (SELECT MAX(id) FROM funding_rates WHERE pair_id = fp.id)
       WHERE fp.is_active = true AND fp.futures_enabled = true
       ORDER BY fp.sort_order ASC, fp.id ASC`
    );
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get Single Pair Info ─────────────────────────────────────
async function getFuturesPairInfo(req, res) {
  try {
    const { symbol } = req.params;
    const pair = await getFuturesPair(symbol);
    if (!pair) return error(res, 'Futures pair not found', 404);
    return success(res, pair);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get Futures Balance ──────────────────────────────────────
async function getFuturesBalance(req, res) {
  try {
    const userId = req.user.id;
    const { rows } = await db.query(
      `SELECT b.available, b.locked, c.symbol, c.name, c.logo_url
       FROM balances b
       JOIN coins c ON c.id = b.coin_id
       WHERE b.user_id = $1 AND b.account_type = 'futures'
       ORDER BY c.symbol`,
      [userId]
    );
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Place Futures Order ──────────────────────────────────────
async function placeOrder(req, res) {
  const userId = req.user.id;
  const {
    symbol, side, order_type = 'market',
    quantity, price, stop_price,
    leverage = 5, margin_type = 'isolated',
    take_profit, stop_loss,
    reduce_only = false,
    price_rate,       // trailing stop callback rate
    time_in_force = 'GTC'
  } = req.body;

  // Validate
  if (!symbol || !side || !quantity) {
    return error(res, 'symbol, side, quantity are required', 400);
  }
  if (!['buy','sell'].includes(side.toLowerCase())) {
    return error(res, 'side must be buy or sell', 400);
  }
  if (parseFloat(quantity) <= 0) {
    return error(res, 'quantity must be positive', 400);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get pair config
    const pair = await getFuturesPair(symbol);
    if (!pair) return error(res, 'Futures pair not found or disabled', 404);

    // Get mark price
    const { rows: [feed] } = await client.query(
      `SELECT price_usdt FROM price_feeds
       WHERE coin_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [pair.base_coin_id]
    );
    const markPrice = parseFloat(feed?.price_usdt || price || 0);
    if (!markPrice) return error(res, 'Cannot determine mark price', 400);

    // Use limit price or mark price for cost calculation
    const orderPrice = order_type === 'limit' ? parseFloat(price) : markPrice;

    // Calculate margin needed
    const margin = calcInitialMargin(quantity, orderPrice, leverage, margin_type);
    const cost   = calcOrderCost(quantity, orderPrice, leverage);

    // USDT coin id
    const { rows: [usdtCoin] } = await client.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    if (!usdtCoin) throw new Error('USDT coin not found');

    // Check futures balance
    const { rows: [bal] } = await client.query(
      `SELECT available, locked FROM balances
       WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'
       FOR UPDATE`,
      [userId, usdtCoin.id]
    );

    if (!bal || parseFloat(bal.available) < cost) {
      await client.query('ROLLBACK');
      return error(res, `Insufficient futures balance. Need $${cost.toFixed(4)} USDT`, 400);
    }

    // Check min notional
    const notional = parseFloat(quantity) * orderPrice;
    const minNotional = parseFloat(pair.min_notional || 5);
    if (notional < minNotional) {
      await client.query('ROLLBACK');
      return error(res, `Order too small. Min notional: $${minNotional}`, 400);
    }

    // Check leverage
    const maxLev = parseInt(pair.max_leverage || 125);
    if (parseInt(leverage) > maxLev) {
      await client.query('ROLLBACK');
      return error(res, `Max leverage for ${symbol} is ${maxLev}x`, 400);
    }

    // Lock margin in balance
    await client.query(
      `UPDATE balances SET
         available = available - $1,
         locked    = locked + $1,
         updated_at = NOW()
       WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
      [margin, userId, usdtCoin.id]
    );

    // Generate client order ID (VDX prefix for Binance compatibility)
    const clientOrderId = `VDX-F-${Date.now()}-${uuidv4().slice(0,8).toUpperCase()}`;

    // Insert order to DB
    const { rows: [order] } = await client.query(
      `INSERT INTO futures_orders
         (user_id, pair_id, client_order_id, symbol, side, order_type,
          margin_type, leverage, price, stop_price, quantity,
          margin_used, take_profit, stop_loss, reduce_only,
          price_rate, time_in_force, is_custom, status, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'open',$19)
       RETURNING *`,
      [
        userId, pair.id, clientOrderId, symbol.toUpperCase(),
        side.toLowerCase(), order_type.toLowerCase(),
        margin_type, parseInt(leverage),
        price ? parseFloat(price) : null,
        stop_price ? parseFloat(stop_price) : null,
        parseFloat(quantity),
        margin,
        take_profit ? parseFloat(take_profit) : null,
        stop_loss   ? parseFloat(stop_loss)   : null,
        reduce_only, price_rate || null,
        time_in_force, pair.is_custom,
        req.headers['x-platform'] || 'web'
      ]
    );

    await client.query('COMMIT');

    // Route order (async — don't wait for market orders on limit)
    const fullOrder = { ...pair, ...order }; // order fields take priority over pair fields
    if (order_type.toLowerCase() === 'market') {
      // Market: await fill
      try {
        const result = await routeFuturesOrder(fullOrder, pair);
        return success(res, {
          order_id:  order.id,
          client_order_id: clientOrderId,
          status:    result.status || 'filled',
          symbol, side, quantity, leverage,
          margin_used: margin,
          message: `Futures ${side} order ${result.status || 'filled'}`
        });
      } catch (routeErr) {
        // Refund margin if routing fails
        await db.query(
          `UPDATE balances SET available=available+$1, locked=GREATEST(locked-$1,0), updated_at=NOW()
           WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
          [margin, userId, usdtCoin.id]
        );
        await db.query(
          `UPDATE futures_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
          [order.id]
        );
        return error(res, `Order failed: ${routeErr.message}`, 500);
      }
    } else {
      // Limit: async
      setImmediate(() => routeFuturesOrder(fullOrder, pair).catch(e =>
        console.error('[FuturesCtrl] limit order route error:', e.message)
      ));
      return success(res, {
        order_id:  order.id,
        client_order_id: clientOrderId,
        status:    'open',
        symbol, side, quantity, price, leverage,
        margin_used: margin,
        message: 'Limit order placed'
      });
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[FuturesCtrl] placeOrder error:', err.message);
    return error(res, err.message, 500);
  } finally {
    client.release();
  }
}

// ── Cancel Order ─────────────────────────────────────────────
async function cancelOrder(req, res) {
  const userId  = req.user.id;
  const orderId = parseInt(req.params.order_id);

  try {
    const { rows: [order] } = await db.query(
      `SELECT fo.*, fp.is_custom
       FROM futures_orders fo
       JOIN futures_pairs fp ON fp.id = fo.pair_id
       WHERE fo.id=$1 AND fo.user_id=$2`,
      [orderId, userId]
    );

    if (!order)               return error(res, 'Order not found', 404);
    if (order.status !== 'open') return error(res, 'Order is not open', 400);

    const pair = await getFuturesPair(order.symbol);
    await routeCancelOrder(order, pair);

    return success(res, { order_id: orderId, status: 'cancelled' });
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get Open Orders ──────────────────────────────────────────
async function getOpenOrders(req, res) {
  try {
    const userId = req.user.id;
    const { symbol } = req.query;

    let query = `
      SELECT fo.*, fp.tick_size, fp.step_size, fp.price_precision
      FROM futures_orders fo
      JOIN futures_pairs fp ON fp.id = fo.pair_id
      WHERE fo.user_id=$1 AND fo.status IN ('open','partially_filled')`;
    const params = [userId];

    if (symbol) {
      query += ` AND fo.symbol=$2`;
      params.push(symbol.toUpperCase());
    }
    query += ` ORDER BY fo.created_at DESC`;

    const { rows } = await db.query(query, params);
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get Order History ────────────────────────────────────────
async function getOrderHistory(req, res) {
  try {
    const userId = req.user.id;
    const { symbol, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT fo.* FROM futures_orders fo
      WHERE fo.user_id=$1`;
    const params = [userId];
    let pIdx = 2;

    if (symbol) { query += ` AND fo.symbol=$${pIdx++}`; params.push(symbol.toUpperCase()); }
    query += ` ORDER BY fo.created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await db.query(query, params);
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get Positions ────────────────────────────────────────────
async function getPositions(req, res) {
  try {
    const userId = req.user.id;
    const positions = await getUserPositionsPnl(userId);
    return success(res, positions);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Close Position ───────────────────────────────────────────
async function closePositionEndpoint(req, res) {
  try {
    const userId     = req.user.id;
    const positionId = parseInt(req.params.position_id);
    const { close_qty } = req.body;

    // Get current mark price
    const { rows: [pos] } = await db.query(
      `SELECT p.*, pf.price_usdt as mark_price
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       LEFT JOIN price_feeds pf ON pf.coin_id = fp.base_coin_id
       WHERE p.id=$1 AND p.user_id=$2 AND p.status='open'`,
      [positionId, userId]
    );

    if (!pos) return error(res, 'Position not found', 404);

    const markPrice = parseFloat(pos.mark_price || pos.mark_price);
    if (!markPrice) return error(res, 'Cannot get mark price', 400);

    const result = await closePosition(
      positionId, userId, close_qty || pos.quantity, markPrice, pos.is_custom
    );

    return success(res, {
      position_id:  positionId,
      closed_qty:   result.closedQty,
      realized_pnl: result.realizedPnl.toFixed(6),
      fee:          result.fee.toFixed(6),
      is_full_close: result.isFullClose,
    });
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get Trade History ────────────────────────────────────────
async function getTradeHistory(req, res) {
  try {
    const userId = req.user.id;
    const { symbol, limit = 50, offset = 0 } = req.query;

    let query = `SELECT * FROM futures_trades WHERE user_id=$1`;
    const params = [userId];
    let pIdx = 2;

    if (symbol) { query += ` AND symbol=$${pIdx++}`; params.push(symbol.toUpperCase()); }
    query += ` ORDER BY created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await db.query(query, params);
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get Funding Rate History ─────────────────────────────────
async function getFundingRateHistory(req, res) {
  try {
    const { symbol, limit = 20 } = req.query;
    const { rows } = await db.query(
      `SELECT fr.*, fp.symbol as pair_symbol
       FROM funding_rates fr
       JOIN futures_pairs fp ON fp.id = fr.pair_id
       WHERE ($1::text IS NULL OR fr.symbol = $1)
       ORDER BY fr.created_at DESC LIMIT $2`,
      [symbol?.toUpperCase() || null, parseInt(limit)]
    );
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Change Leverage ──────────────────────────────────────────
async function changeLeverage(req, res) {
  try {
    const { symbol, leverage } = req.body;
    const lev = parseInt(leverage);

    const pair = await getFuturesPair(symbol);
    if (!pair) return error(res, 'Pair not found', 404);

    const maxLev = parseInt(pair.max_leverage || 125);
    if (lev < 1 || lev > maxLev) {
      return error(res, `Leverage must be 1-${maxLev}`, 400);
    }

    // For Binance pairs, also change on Binance
    if (!pair.is_custom) {
      try {
        const { getFuturesBinanceAdapter } = require('../services/futures/binance/futuresBinanceAdapter');
        const adapter = await getFuturesBinanceAdapter();
        await adapter.changeLeverage(symbol.toUpperCase(), lev);
      } catch (e) {
        console.warn('[FuturesCtrl] Binance changeLeverage warning:', e.message);
      }
    }

    return success(res, { symbol, leverage: lev, max_leverage: maxLev });
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Change Margin Type ───────────────────────────────────────
async function changeMarginType(req, res) {
  try {
    const { symbol, margin_type } = req.body;
    if (!['isolated','cross'].includes(margin_type)) {
      return error(res, 'margin_type must be isolated or cross', 400);
    }

    const pair = await getFuturesPair(symbol);
    if (!pair) return error(res, 'Pair not found', 404);

    if (!pair.is_custom) {
      try {
        const { getFuturesBinanceAdapter } = require('../services/futures/binance/futuresBinanceAdapter');
        const adapter = await getFuturesBinanceAdapter();
        await adapter.changeMarginType(symbol.toUpperCase(),
          margin_type === 'isolated' ? 'ISOLATED' : 'CROSSED');
      } catch (e) {
        // Ignore if already set
        console.warn('[FuturesCtrl] Binance changeMarginType:', e.message);
      }
    }

    return success(res, { symbol, margin_type });
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Calculate Order Cost (for frontend preview) ───────────────
async function calculateOrderCost(req, res) {
  try {
    const { symbol, side, quantity, price, leverage = 5, order_type = 'market' } = req.query;

    const pair = await getFuturesPair(symbol);
    if (!pair) return error(res, 'Pair not found', 404);

    const { rows: [feed] } = await db.query(
      `SELECT price_usdt FROM price_feeds WHERE coin_id=$1 ORDER BY updated_at DESC LIMIT 1`,
      [pair.base_coin_id]
    );

    const markPrice  = parseFloat(feed?.price_usdt || 0);
    const orderPrice = order_type === 'limit' ? parseFloat(price) : markPrice;
    const qty        = parseFloat(quantity);
    const lev        = parseInt(leverage);
    const feeRate    = parseFloat(pair.taker_fee || 0.0004);

    const margin      = calcInitialMargin(qty, orderPrice, lev);
    const cost        = calcOrderCost(qty, orderPrice, lev, feeRate);
    const maxQty      = calcMaxOrderQty(0, lev, markPrice, feeRate); // without balance check
    const liqPrice    = calcLiquidationPrice(
      side === 'buy' ? 'long' : 'short', orderPrice, lev
    );

    return success(res, {
      mark_price:       markPrice,
      order_price:      orderPrice,
      notional:         (qty * orderPrice).toFixed(4),
      margin_required:  margin.toFixed(4),
      total_cost:       cost.toFixed(4),
      estimated_fee:    (qty * orderPrice * feeRate).toFixed(6),
      liquidation_price: liqPrice.toFixed(4),
      leverage:         lev,
    });
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Liquidation Logs ─────────────────────────────────────────
async function getLiquidationLogs(req, res) {
  try {
    const userId = req.user.id;
    const { rows } = await db.query(
      `SELECT * FROM futures_liquidation_logs
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = {
  getFuturesPairs,
  getFuturesPairInfo,
  getFuturesBalance,
  placeOrder,
  cancelOrder,
  getOpenOrders,
  getOrderHistory,
  getPositions,
  closePositionEndpoint,
  getTradeHistory,
  getFundingRateHistory,
  changeLeverage,
  changeMarginType,
  calculateOrderCost,
  getLiquidationLogs,
};
