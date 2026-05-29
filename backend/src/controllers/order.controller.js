const db = require('../config/database');
const { success, error } = require('../utils/response');

const generateOrderId = () =>
  'ORD' + Date.now() + Math.random().toString(36).substr(2,6).toUpperCase();

// ─────────────────────────────────────────────────────
// PLACE ORDER
// ─────────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { symbol, side, order_type, price, quantity, time_in_force = 'GTC' } = req.body;

    if (!symbol || !side || !order_type || !quantity)
      return error(res, 'symbol, side, order_type, quantity required');
    if (!['buy','sell'].includes(side))
      return error(res, 'side must be buy or sell');
    if (!['limit','market'].includes(order_type))
      return error(res, 'order_type must be limit or market');

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return error(res, 'Invalid quantity');

    const limitPrice = order_type === 'limit' ? parseFloat(price) : null;
    if (order_type === 'limit' && (!limitPrice || isNaN(limitPrice) || limitPrice <= 0))
      return error(res, 'Valid price required for limit order');

    // Get pair info
    const pairInfo = await client.query(`
      SELECT tp.id, tp.symbol, tp.base_coin_id, tp.quote_coin_id,
             cb.symbol as base_symbol, cq.symbol as quote_symbol,
             tp.min_order_qty, tp.max_order_qty,
             tp.price_precision, tp.qty_precision
      FROM trading_pairs tp
      JOIN coins cb ON cb.id = tp.base_coin_id
      JOIN coins cq ON cq.id = tp.quote_coin_id
      WHERE tp.symbol = $1 AND tp.is_active = true
    `, [symbol.toUpperCase()]);

    if (!pairInfo.rows[0]) return error(res, 'Trading pair not found or inactive');
    const pair = pairInfo.rows[0];

    // Get current market price
    const priceData = await client.query(
      'SELECT price_usdt FROM price_feeds WHERE coin_id = $1',
      [pair.base_coin_id]
    );
    const marketPrice = parseFloat(priceData.rows[0]?.price_usdt || 0);
    if (marketPrice <= 0) return error(res, 'Market price not available');

    // execPrice:
    //   limit  → use limitPrice
    //   market → use current marketPrice (stored in DB for matcher)
    const execPrice = order_type === 'market' ? marketPrice : limitPrice;

    // Calculate required balance
    let requiredCoinId, requiredAmount;
    if (side === 'buy') {
      requiredCoinId = pair.quote_coin_id; // USDT
      requiredAmount = qty * execPrice * 1.001; // 0.1% buffer
    } else {
      requiredCoinId = pair.base_coin_id; // Base coin
      requiredAmount = qty;
    }

    if (isNaN(requiredAmount) || requiredAmount <= 0)
      return error(res, 'Invalid order amount');

    // Check + lock balance
    const balance = await client.query(`
      SELECT available, locked FROM balances
      WHERE user_id = $1 AND coin_id = $2 AND account_type = 'spot'
      FOR UPDATE
    `, [req.user.id, requiredCoinId]);

    if (!balance.rows[0]) return error(res, 'Insufficient balance');

    const available = parseFloat(balance.rows[0].available || 0);
    if (available < requiredAmount)
      return error(res,
        `Insufficient balance. Need: ${requiredAmount.toFixed(6)}, Have: ${available.toFixed(6)}`
      );

    await client.query(`
      UPDATE balances
      SET available = available - $1,
          locked    = locked    + $1,
          updated_at = NOW()
      WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
    `, [requiredAmount, req.user.id, requiredCoinId]);

    // Create order record
    // NOTE: market order stores execPrice (current market price) so matcher can work
    const orderId    = generateOrderId();
    const totalValue = qty * execPrice;

    const newOrder = await client.query(`
      INSERT INTO orders
        (order_id, user_id, pair_id, side, order_type,
         price, quantity, remaining_qty, total_value,
         status, time_in_force, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,'open',$9,'web')
      RETURNING *
    `, [orderId, req.user.id, pair.id, side, order_type,
        execPrice,   // market order: stores current price ← KEY FIX
        qty, totalValue, time_in_force]);

    // Ledger entry
    await client.query(`
      INSERT INTO ledger
        (user_id, coin_id, type, amount, balance_before, balance_after,
         reference_id, description)
      VALUES ($1,$2,'order_lock',$3,$4,$5,$6,$7)
    `, [req.user.id, requiredCoinId, requiredAmount,
        available, available - requiredAmount,
        orderId,
        `${side.toUpperCase()} ${qty} ${pair.base_symbol} @ ${execPrice}`
    ]).catch(() => {});

    await client.query('COMMIT');

    // Instant match for market orders
    if (order_type === 'market') {
      setImmediate(() => {
        try {
          const matcher = require('../services/orderMatcher');
          matcher.matchPairNow(pair.id).catch(() => {});
        } catch (e) {}
      });
    }

    return success(res, newOrder.rows[0], 'Order placed successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('placeOrder error:', err.message);
    return error(res, err.message || 'Order failed', 500);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────
// CANCEL ORDER
// ─────────────────────────────────────────────────────
const cancelOrder = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { order_id } = req.params;

    const order = await client.query(`
      SELECT o.*, tp.base_coin_id, tp.quote_coin_id,
             cb.symbol as base_symbol
      FROM orders o
      JOIN trading_pairs tp ON tp.id = o.pair_id
      JOIN coins cb ON cb.id = tp.base_coin_id
      WHERE o.order_id = $1 AND o.user_id = $2
      FOR UPDATE
    `, [order_id, req.user.id]);

    if (!order.rows[0]) return error(res, 'Order not found');

    const o = order.rows[0];
    if (!['open','partially_filled'].includes(o.status))
      return error(res, 'Order cannot be cancelled');

    const remainingQty = parseFloat(o.remaining_qty || 0);
    const orderPrice   = parseFloat(o.price || 0);

    let refundCoinId, refundAmount;
    if (o.side === 'buy') {
      refundCoinId  = o.quote_coin_id;
      refundAmount  = remainingQty * orderPrice * 1.001;
    } else {
      refundCoinId  = o.base_coin_id;
      refundAmount  = remainingQty;
    }

    if (refundAmount > 0) {
      await client.query(`
        UPDATE balances
        SET available  = available + $1,
            locked     = GREATEST(0, locked - $1),
            updated_at = NOW()
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [refundAmount, req.user.id, refundCoinId]);
    }

    await client.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW()
       WHERE order_id = $1`, [order_id]
    );

    await client.query('COMMIT');

    return success(res, {
      order_id, refunded: refundAmount, status: 'cancelled'
    }, 'Order cancelled');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('cancelOrder error:', err.message);
    return error(res, 'Cancel failed', 500);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────
// GET OPEN ORDERS
// ─────────────────────────────────────────────────────
const getOpenOrders = async (req, res) => {
  try {
    const { symbol } = req.query;
    const orders = await db.query(`
      SELECT o.order_id, o.side, o.order_type, o.price, o.quantity,
             o.filled_qty, o.remaining_qty, o.total_value,
             o.status, o.avg_fill_price, o.created_at,
             tp.symbol as pair_symbol,
             cb.symbol as base_symbol, cq.symbol as quote_symbol
      FROM orders o
      JOIN trading_pairs tp ON tp.id = o.pair_id
      JOIN coins cb ON cb.id = tp.base_coin_id
      JOIN coins cq ON cq.id = tp.quote_coin_id
      WHERE o.user_id = $1
        AND o.status IN ('open','partially_filled')
        ${symbol ? `AND tp.symbol = '${symbol.toUpperCase()}'` : ''}
      ORDER BY o.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    return success(res, orders.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

// ─────────────────────────────────────────────────────
// GET ORDER HISTORY
// ─────────────────────────────────────────────────────
const getOrderHistory = async (req, res) => {
  try {
    const { symbol, limit = 50, offset = 0 } = req.query;
    const orders = await db.query(`
      SELECT o.order_id, o.side, o.order_type, o.price, o.quantity,
             o.filled_qty, o.remaining_qty, o.total_value,
             o.status, o.avg_fill_price, o.created_at,
             tp.symbol as pair_symbol
      FROM orders o
      JOIN trading_pairs tp ON tp.id = o.pair_id
      WHERE o.user_id = $1
        ${symbol ? `AND tp.symbol = '${symbol.toUpperCase()}'` : ''}
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);
    return success(res, orders.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

// ─────────────────────────────────────────────────────
// GET TRADE HISTORY
// ─────────────────────────────────────────────────────
const getTradeHistory = async (req, res) => {
  try {
    const trades = await db.query(`
      SELECT t.trade_id, t.price, t.quantity, t.total_value,
             t.buyer_fee, t.seller_fee, t.created_at,
             tp.symbol as pair_symbol,
             CASE WHEN t.buyer_id = $1 THEN 'buy' ELSE 'sell' END as side
      FROM trades t
      JOIN trading_pairs tp ON tp.id = t.pair_id
      WHERE t.buyer_id = $1 OR t.seller_id = $1
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    return success(res, trades.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

module.exports = {
  placeOrder, cancelOrder,
  getOpenOrders, getOrderHistory, getTradeHistory
};
