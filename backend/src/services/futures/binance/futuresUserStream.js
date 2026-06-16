/**
 * Binance Futures UserDataStream
 * Listens to: ORDER_TRADE_UPDATE, ACCOUNT_UPDATE
 * Reconnects automatically
 */
const WebSocket = require('ws');
const db        = require('../../../config/database');
const { getFuturesBinanceAdapter } = require('./futuresBinanceAdapter');
const { processFill } = require('./futuresBinanceHedge');

let ws          = null;
let listenKey   = null;
let keepaliveT  = null;
let reconnectT  = null;
let isRunning   = false;

async function start() {
  if (isRunning) return;
  isRunning = true;
  console.log('[FuturesUserStream] Starting...');
  await connect();
}

async function connect() {
  try {
    const adapter = await getFuturesBinanceAdapter();
    listenKey     = await adapter.createListenKey();
    console.log('[FuturesUserStream] ListenKey created:', listenKey.slice(0,20) + '...');

    ws = new WebSocket(`wss://fstream.binance.com/ws/${listenKey}`);

    ws.on('open', () => {
      console.log('[FuturesUserStream] Connected!');
      // Keepalive every 30 min
      keepaliveT = setInterval(async () => {
        try { await adapter.keepaliveListenKey(listenKey); }
        catch (e) { console.error('[FuturesUserStream] Keepalive error:', e.message); }
      }, 30 * 60 * 1000);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleEvent(msg);
      } catch (e) {
        console.error('[FuturesUserStream] Message parse error:', e.message);
      }
    });

    ws.on('close', () => {
      console.log('[FuturesUserStream] Disconnected. Reconnecting in 5s...');
      clearInterval(keepaliveT);
      if (isRunning) reconnectT = setTimeout(connect, 5000);
    });

    ws.on('error', (err) => {
      console.error('[FuturesUserStream] WS error:', err.message);
    });

  } catch (err) {
    console.error('[FuturesUserStream] connect error:', err.message);
    if (isRunning) reconnectT = setTimeout(connect, 10000);
  }
}

async function handleEvent(msg) {
  const event = msg.e;

  // ── ORDER_TRADE_UPDATE ──────────────────────────────────
  if (event === 'ORDER_TRADE_UPDATE') {
    const o = msg.o;
    const status        = o.X;  // NEW/FILLED/PARTIALLY_FILLED/CANCELED/EXPIRED
    const clientOrderId = o.c;  // our VDX- prefix id
    const binanceOrderId = o.i?.toString();
    const filledQty     = parseFloat(o.z || 0); // cumulative filled
    const avgPrice      = parseFloat(o.ap || o.p || 0);
    const symbol        = o.s;
    const side          = o.S?.toLowerCase(); // buy/sell

    console.log(`[FuturesUserStream] ORDER_UPDATE: ${symbol} ${side} ${status} filled=${filledQty}`);

    // Find our order in DB
    const { rows: [order] } = await db.query(
      `SELECT fo.*, fp.maintenance_margin, fp.taker_fee, fp.step_size,
              fp.price_precision, fp.is_custom
       FROM futures_orders fo
       JOIN futures_pairs fp ON fp.id = fo.pair_id
       WHERE fo.client_order_id = $1 OR fo.binance_order_id = $2
       LIMIT 1`,
      [clientOrderId, binanceOrderId]
    );

    if (!order) {
      console.warn('[FuturesUserStream] Order not found:', clientOrderId);
      return;
    }

    if (status === 'FILLED' && filledQty > 0 && order.status !== 'filled') {
      // Process the fill
      await processFill({
        orderId:    order.id,
        userId:     order.user_id,
        pairId:     order.pair_id,
        symbol:     order.symbol,
        side:       order.side,
        filledQty,
        avgPrice,
        leverage:   order.leverage,
        marginType: order.margin_type,
        marginUsed: order.margin_used,
        takeProfit: order.take_profit,
        stopLoss:   order.stop_loss,
        isCustom:   false,
        pair: {
          taker_fee:          order.taker_fee,
          maintenance_margin: order.maintenance_margin,
          step_size:          order.step_size,
          price_precision:    order.price_precision,
        }
      });

      // Emit to frontend via Socket.io
      emitOrderUpdate(order.user_id, {
        type:       'futures_order_filled',
        orderId:    order.id,
        symbol,
        side,
        filledQty,
        avgPrice,
        status:     'filled',
      });

    } else if (status === 'CANCELED' || status === 'EXPIRED') {
      await db.query(
        `UPDATE futures_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
        [order.id]
      );

      // Unlock margin
      await unlockMargin(order.user_id, order.margin_used);

      emitOrderUpdate(order.user_id, {
        type:    'futures_order_cancelled',
        orderId: order.id,
        symbol,
        status:  'cancelled',
      });

    } else if (status === 'PARTIALLY_FILLED') {
      await db.query(
        `UPDATE futures_orders 
         SET filled_qty=$1, avg_fill_price=$2, status='partially_filled', updated_at=NOW()
         WHERE id=$3`,
        [filledQty, avgPrice, order.id]
      );
    }
  }

  // ── ACCOUNT_UPDATE ───────────────────────────────────────
  if (event === 'ACCOUNT_UPDATE') {
    const reason = msg.a?.m; // DEPOSIT/WITHDRAW/ORDER/FUNDING_FEE/etc
    console.log(`[FuturesUserStream] ACCOUNT_UPDATE reason=${reason}`);

    // Funding fee deduction
    if (reason === 'FUNDING_FEE') {
      const balances = msg.a?.B || [];
      for (const b of balances) {
        if (b.a === 'USDT') {
          console.log(`[FuturesUserStream] Funding fee: USDT wallet=${b.wb}`);
        }
      }
    }
  }
}

async function unlockMargin(userId, marginUsed) {
  try {
    if (!marginUsed || parseFloat(marginUsed) <= 0) return;
    const { rows: [usdt] } = await db.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    if (!usdt) return;
    await db.query(
      `UPDATE balances SET
         available = available + $1,
         locked    = locked - $1,
         updated_at = NOW()
       WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
      [marginUsed, userId, usdt.id]
    );
  } catch (e) {
    console.error('[FuturesUserStream] unlockMargin error:', e.message);
  }
}

// Emit to Socket.io
function emitOrderUpdate(userId, data) {
  try {
    const io = require('../../../websocket/socket').getIO?.();
    if (io) io.to(`user:${userId}`).emit('futures_update', data);
  } catch (e) {}
}

function stop() {
  isRunning = false;
  clearInterval(keepaliveT);
  clearTimeout(reconnectT);
  if (ws) ws.close();
  ws = null;
}

module.exports = { start, stop };
