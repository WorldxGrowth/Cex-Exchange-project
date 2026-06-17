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
    price_rate,
    time_in_force = 'GTC'
  } = req.body;

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

    const pair = await getFuturesPair(symbol);
    if (!pair) return error(res, 'Futures pair not found or disabled', 404);

    const { rows: [feed] } = await client.query(
      `SELECT price_usdt FROM price_feeds
       WHERE coin_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [pair.base_coin_id]
    );
    const markPrice = parseFloat(feed?.price_usdt || price || 0);
    if (!markPrice) return error(res, 'Cannot determine mark price', 400);

    const orderPrice = order_type === 'limit' ? parseFloat(price) : markPrice;
    const margin = calcInitialMargin(parseFloat(quantity), parseFloat(orderPrice), parseInt(leverage), margin_type);
    const cost   = calcOrderCost(parseFloat(quantity), parseFloat(orderPrice), parseInt(leverage));

    const { rows: [usdtCoin] } = await client.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    if (!usdtCoin) throw new Error('USDT coin not found');

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


    // Validate TP/SL direction
    if (take_profit || stop_loss) {
      const tp = take_profit ? parseFloat(take_profit) : null;
      const sl = stop_loss ? parseFloat(stop_loss) : null;
      if (side.toLowerCase() === 'buy') {
        if (tp && tp <= orderPrice) { await client.query('ROLLBACK'); return error(res, `TP (${tp}) must be above entry (${orderPrice.toFixed(2)}) for LONG`, 400); }
        if (sl && sl >= orderPrice) { await client.query('ROLLBACK'); return error(res, `SL (${sl}) must be below entry (${orderPrice.toFixed(2)}) for LONG`, 400); }
      } else {
        if (tp && tp >= orderPrice) { await client.query('ROLLBACK'); return error(res, `TP (${tp}) must be below entry (${orderPrice.toFixed(2)}) for SHORT`, 400); }
        if (sl && sl <= orderPrice) { await client.query('ROLLBACK'); return error(res, `SL (${sl}) must be above entry (${orderPrice.toFixed(2)}) for SHORT`, 400); }
      }
    }
    const notional = parseFloat(quantity) * orderPrice;
    const minNotional = parseFloat(pair.min_notional || 5);
    if (notional < minNotional) {
      await client.query('ROLLBACK');
      return error(res, `Order too small. Min notional: $${minNotional}`, 400);
    }

    const maxLev = parseInt(pair.max_leverage || 125);
    if (parseInt(leverage) > maxLev) {
      await client.query('ROLLBACK');
      return error(res, `Max leverage for ${symbol} is ${maxLev}x`, 400);
    }

    await client.query(
      `UPDATE balances SET
         available = available - $1,
         locked    = locked + $1,
         updated_at = NOW()
       WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
      [margin, userId, usdtCoin.id]
    );

    const clientOrderId = `VDX-F-${Date.now()}-${uuidv4().slice(0,8).toUpperCase()}`;

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

    const fullOrder = { ...pair, ...order };
    if (order_type.toLowerCase() === 'market') {
      try {
        const result = await routeFuturesOrder(fullOrder, pair);
        return success(res, {
          order_id:        order.id,
          client_order_id: clientOrderId,
          status:          result.status || 'filled',
          symbol, side, quantity, leverage,
          margin_used:     margin,
          message:         `Futures ${side} order ${result.status || 'filled'}`
        });
      } catch (routeErr) {
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
      setImmediate(() => routeFuturesOrder(fullOrder, pair).catch(e =>
        console.error('[FuturesCtrl] limit order route error:', e.message)
      ));
      return success(res, {
        order_id:        order.id,
        client_order_id: clientOrderId,
        status:          'open',
        symbol, side, quantity, price, leverage,
        margin_used:     margin,
        message:         'Limit order placed'
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
    if (!order)                  return error(res, 'Order not found', 404);
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
    if (symbol) { query += ` AND fo.symbol=$2`; params.push(symbol.toUpperCase()); }
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
    let query = `SELECT fo.* FROM futures_orders fo WHERE fo.user_id=$1`;
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

    // Get position with pair info
    const { rows: [pos] } = await db.query(
      `SELECT p.*, fp.is_custom, fp.step_size, fp.taker_fee,
              fp.maintenance_margin, fp.price_precision,
              pf.price_usdt as mark_price
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       LEFT JOIN price_feeds pf ON pf.coin_id = fp.base_coin_id
       WHERE p.id=$1 AND p.user_id=$2 AND p.status='open'`,
      [positionId, userId]
    );

    if (!pos) return error(res, 'Position not found', 404);

    const markPrice = parseFloat(pos.mark_price || 0);
    if (!markPrice) return error(res, 'Cannot get mark price', 400);

    const closeQty = parseFloat(close_qty || pos.quantity);

    // ── Binance pairs: place reduce-only order on Binance ──
    if (!pos.is_custom) {
      try {
        const { getFuturesBinanceAdapter } = require('../services/futures/binance/futuresBinanceAdapter');
        const adapter  = await getFuturesBinanceAdapter();

        const stepSize   = parseFloat(pos.step_size || 0.001);
        const precision  = (stepSize.toString().split('.')[1] || '').length;
        const roundedQty = parseFloat((Math.floor(closeQty / stepSize) * stepSize).toFixed(precision));

        if (roundedQty <= 0) return error(res, 'Close quantity too small', 400);

        const closeSide  = pos.side === 'long' ? 'SELL' : 'BUY';
        const binanceRes = await adapter.placeOrder({
          symbol:       pos.symbol,
          side:         closeSide,
          type:         'MARKET',
          quantity:     roundedQty,
          positionSide: 'BOTH',
          reduceOnly:   true,
        });

        console.log(`[FuturesCtrl] Binance close: ${binanceRes.status} avgPrice=${binanceRes.avgPrice}`);

        const closePrice = parseFloat(binanceRes.avgPrice || markPrice);

        // Update DB position
        const result = await closePosition(
          positionId, userId, roundedQty, closePrice, false
        );

        // Cancel remaining TP/SL algo orders on Binance (non-blocking)
        if (result.isFullClose) {
          setImmediate(async () => {
            try {
              const { getFuturesBinanceAdapter } = require('../services/futures/binance/futuresBinanceAdapter');
              const adp = await getFuturesBinanceAdapter();
              await adp.delete('/fapi/v1/algoOpenOrders', { symbol: pos.symbol });
              console.log(`[FuturesCtrl] Algo orders cancelled for ${pos.symbol}`);
            } catch(e) {
              console.warn('[FuturesCtrl] Cancel algo orders:', e.message);
            }
          });
        }

        return success(res, {
          position_id:  positionId,
          closed_qty:   result.closedQty,
          realized_pnl: result.realizedPnl.toFixed(6),
          fee:          result.fee.toFixed(6),
          is_full_close: result.isFullClose,
          close_price:  closePrice,
        });

      } catch (binanceErr) {
        console.error('[FuturesCtrl] Binance close error:', binanceErr.message);
        return error(res, `Close failed on Binance: ${binanceErr.message}`, 500);
      }
    }

    // ── Internal pairs: close directly ──
    const result = await closePosition(
      positionId, userId, closeQty, markPrice, true
    );

    return success(res, {
      position_id:  positionId,
      closed_qty:   result.closedQty,
      realized_pnl: result.realizedPnl.toFixed(6),
      fee:          result.fee.toFixed(6),
      is_full_close: result.isFullClose,
      close_price:  markPrice,
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
    if (!pair.is_custom) {
      try {
        const { getFuturesBinanceAdapter } = require('../services/futures/binance/futuresBinanceAdapter');
        const adapter = await getFuturesBinanceAdapter();
        await adapter.changeLeverage(symbol.toUpperCase(), lev);
      } catch (e) {
        console.warn('[FuturesCtrl] Binance changeLeverage warning:', e.message);
      }
    }
    // Save user preference
    await db.query(
      `INSERT INTO user_futures_settings (user_id, symbol, leverage)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET leverage=$3, updated_at=NOW()`,
      [req.user.id, symbol.toUpperCase(), lev]
    );
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
        console.warn('[FuturesCtrl] Binance changeMarginType:', e.message);
      }
    }
    // Save user preference
    await db.query(
      `INSERT INTO user_futures_settings (user_id, symbol, margin_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET margin_type=$3, updated_at=NOW()`,
      [req.user.id, symbol.toUpperCase(), margin_type]
    );
    return success(res, { symbol, margin_type });
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Get User Futures Settings ────────────────────────────────
async function getUserSettings(req, res) {
  try {
    const { symbol } = req.query;
    const { rows } = await db.query(
      `SELECT * FROM user_futures_settings
       WHERE user_id=$1 ${symbol ? 'AND symbol=$2' : ''}`,
      symbol ? [req.user.id, symbol.toUpperCase()] : [req.user.id]
    );
    return success(res, rows);
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Calculate Order Cost ─────────────────────────────────────
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
    const margin     = calcInitialMargin(qty, orderPrice, lev);
    const cost       = calcOrderCost(qty, orderPrice, lev, feeRate);
    const liqPrice   = calcLiquidationPrice(side === 'buy' ? 'long' : 'short', orderPrice, lev);
    return success(res, {
      mark_price:        markPrice,
      order_price:       orderPrice,
      notional:          (qty * orderPrice).toFixed(4),
      margin_required:   margin.toFixed(4),
      total_cost:        cost.toFixed(4),
      estimated_fee:     (qty * orderPrice * feeRate).toFixed(6),
      liquidation_price: liqPrice.toFixed(4),
      leverage:          lev,
    });
  } catch (err) {
    return error(res, err.message);
  }
}

// ── Modify Order ────────────────────────────────────────────
async function modifyOrder(req, res) {
  try {
    const userId  = req.user.id;
    const orderId = parseInt(req.params.order_id);
    const { price, quantity } = req.body;

    if (!price && !quantity) {
      return error(res, 'price or quantity required', 400);
    }

    const { rows: [order] } = await db.query(
      `SELECT fo.*, fp.is_custom, fp.step_size, fp.price_precision
       FROM futures_orders fo
       JOIN futures_pairs fp ON fp.id = fo.pair_id
       WHERE fo.id=$1 AND fo.user_id=$2`,
      [orderId, userId]
    );

    if (!order) return error(res, 'Order not found', 404);
    if (order.status !== 'open') return error(res, 'Only open orders can be modified', 400);
    if (order.order_type !== 'limit') return error(res, 'Only limit orders can be modified', 400);

    const newPrice = parseFloat(price || order.price);
    const newQty   = parseFloat(quantity || order.quantity);

    if (!order.is_custom) {
      // Binance modify
      const { getFuturesBinanceAdapter } = require('../services/futures/binance/futuresBinanceAdapter');
      const adapter = await getFuturesBinanceAdapter();
      await adapter.modifyOrder(
        order.symbol,
        order.binance_order_id,
        order.client_order_id,
        order.side,
        newQty,
        newPrice.toFixed(parseInt(order.price_precision || 2))
      );
    }

    // Update DB
    await db.query(
      `UPDATE futures_orders SET price=$1, quantity=$2, updated_at=NOW() WHERE id=$3`,
      [newPrice, newQty, orderId]
    );

    return success(res, {
      order_id: orderId,
      price:    newPrice,
      quantity: newQty,
      status:   'modified',
    });
  } catch(err) {
    return error(res, err.message);
  }
}

// ── Update TP/SL on open position ────────────────────────────
async function updatePositionTpSl(req, res) {
  try {
    const userId     = req.user.id;
    const positionId = parseInt(req.params.position_id);
    const { take_profit, stop_loss } = req.body;

    if (!take_profit && !stop_loss) {
      return error(res, 'take_profit or stop_loss required', 400);
    }

    const { rows: [pos] } = await db.query(
      `SELECT p.*, fp.is_custom, fp.step_size
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       WHERE p.id=$1 AND p.user_id=$2 AND p.status='open'`,
      [positionId, userId]
    );
    if (!pos) return error(res, 'Position not found', 404);

    const tp = take_profit ? parseFloat(take_profit) : null;
    const sl = stop_loss   ? parseFloat(stop_loss)   : null;
    const ep = parseFloat(pos.entry_price);

    if (pos.side === 'long') {
      if (tp && tp <= ep) return error(res, `TP must be above entry (${ep.toFixed(2)}) for LONG`, 400);
      if (sl && sl >= ep) return error(res, `SL must be below entry (${ep.toFixed(2)}) for LONG`, 400);
    } else {
      if (tp && tp >= ep) return error(res, `TP must be below entry (${ep.toFixed(2)}) for SHORT`, 400);
      if (sl && sl <= ep) return error(res, `SL must be above entry (${ep.toFixed(2)}) for SHORT`, 400);
    }

    await db.query(
      `UPDATE futures_positions SET take_profit=$1, stop_loss=$2, updated_at=NOW() WHERE id=$3`,
      [tp, sl, positionId]
    );

    if (!pos.is_custom) {
      setImmediate(async () => {
        try {
          const { getFuturesBinanceAdapter } = require('../services/futures/binance/futuresBinanceAdapter');
          const adapter   = await getFuturesBinanceAdapter();
          await adapter.delete('/fapi/v1/algoOpenOrders', { symbol: pos.symbol });
          const qty       = parseFloat(pos.quantity);
          const closeSide = pos.side === 'long' ? 'SELL' : 'BUY';
          if (tp) {
            await adapter.placeAlgoOrder({
              symbol: pos.symbol, side: closeSide,
              type: 'TAKE_PROFIT_MARKET', quantity: qty,
              triggerPrice: tp, workingType: 'MARK_PRICE', reduceOnly: true,
            });
            console.log(`[FuturesCtrl] TP set @ ${tp} pos=${positionId}`);
          }
          if (sl) {
            await adapter.placeAlgoOrder({
              symbol: pos.symbol, side: closeSide,
              type: 'STOP_MARKET', quantity: qty,
              triggerPrice: sl, workingType: 'MARK_PRICE', reduceOnly: true,
            });
            console.log(`[FuturesCtrl] SL set @ ${sl} pos=${positionId}`);
          }
        } catch(e) {
          console.warn('[FuturesCtrl] updateTpSl Binance error:', e.message);
        }
      });
    }

    return success(res, { position_id: positionId, take_profit: tp, stop_loss: sl, message: 'TP/SL updated' });
  } catch(err) {
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
  getUserSettings,
  calculateOrderCost,
  getLiquidationLogs,
  modifyOrder,
  updatePositionTpSl,
};
