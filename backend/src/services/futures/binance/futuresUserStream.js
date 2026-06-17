/**
 * Binance Futures UserDataStream
 * Events: ORDER_TRADE_UPDATE, ACCOUNT_UPDATE, ALGO_UPDATE
 * URL: wss://fstream.binance.com/private/ws/<listenKey>
 * Auto-reconnect, 24hr renewal, keepalive every 30min
 */
const WebSocket = require('ws');
const db        = require('../../../config/database');
const { getFuturesBinanceAdapter } = require('./futuresBinanceAdapter');
const { processFill }              = require('./futuresBinanceHedge');
const { closePosition }            = require('../internal/futuresEngine');

let ws          = null;
let listenKey   = null;
let keepaliveT  = null;
let renewT      = null;
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
    console.log('[FuturesUserStream] ListenKey:', listenKey.slice(0,20) + '...');

    // wss://fstream.binance.com/private/ws/<listenKey>
    ws = new WebSocket(`wss://fstream.binance.com/private/ws/${listenKey}`);

    ws.on('open', () => {
      console.log('[FuturesUserStream] Connected!');

      // Keepalive every 30 min
      keepaliveT = setInterval(async () => {
        try {
          await adapter.keepaliveListenKey(listenKey);
          console.log('[FuturesUserStream] Keepalive sent');
        } catch(e) {
          console.error('[FuturesUserStream] Keepalive error:', e.message);
        }
      }, 30 * 60 * 1000);

      // Renew every 23 hours (stream expires at 24hr)
      renewT = setTimeout(async () => {
        console.log('[FuturesUserStream] 23hr renewal - reconnecting...');
        ws.close();
      }, 23 * 60 * 60 * 1000);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleEvent(msg);
      } catch(e) {
        console.error('[FuturesUserStream] Parse error:', e.message);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[FuturesUserStream] Disconnected (${code}). Reconnecting in 5s...`);
      clearInterval(keepaliveT);
      clearTimeout(renewT);
      if (isRunning) reconnectT = setTimeout(connect, 5000);
    });

    ws.on('error', (err) => {
      console.error('[FuturesUserStream] WS error:', err.message);
    });

  } catch(err) {
    console.error('[FuturesUserStream] Connect error:', err.message);
    if (isRunning) reconnectT = setTimeout(connect, 10000);
  }
}

async function handleEvent(msg) {
  const event = msg.e;
  if (!event) return;

  // ── ORDER_TRADE_UPDATE (market/limit orders) ─────────────
  if (event === 'ORDER_TRADE_UPDATE') {
    const o             = msg.o;
    const status        = o.X;
    const clientOrderId = o.c;
    const binanceOrderId = o.i?.toString();
    const filledQty     = parseFloat(o.z || 0);
    const avgPrice      = parseFloat(o.ap || o.p || 0);
    const symbol        = o.s;
    const side          = o.S?.toLowerCase();

    console.log(`[FuturesUserStream] ORDER_UPDATE: ${symbol} ${side} ${status} qty=${filledQty} price=${avgPrice}`);

    // Find order in DB
    const { rows: [order] } = await db.query(
      `SELECT fo.*, fp.maintenance_margin, fp.taker_fee, fp.step_size,
              fp.price_precision, fp.is_custom
       FROM futures_orders fo
       JOIN futures_pairs fp ON fp.id = fo.pair_id
       WHERE fo.client_order_id=$1 OR fo.binance_order_id=$2
       LIMIT 1`,
      [clientOrderId, binanceOrderId]
    );

    if (!order) {
      console.warn('[FuturesUserStream] Order not found:', clientOrderId, binanceOrderId);
      return;
    }

    // Skip if already processed by controller (market orders filled instantly)
    if (status === 'FILLED' && filledQty > 0 && order.status !== 'filled' && order.order_type !== 'market') {
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
        marginUsed: parseFloat(order.margin_used),
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

      emitToUser(order.user_id, {
        type:     'futures_order_filled',
        orderId:  order.id,
        symbol, side, filledQty, avgPrice,
        status:   'filled',
      });

    } else if (['CANCELED','EXPIRED'].includes(status)) {
      await db.query(
        `UPDATE futures_orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
        [order.id]
      );
      await unlockMargin(order.user_id, parseFloat(order.margin_used));
      emitToUser(order.user_id, {
        type: 'futures_order_cancelled', orderId: order.id, symbol,
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

  // ── ALGO_UPDATE (TP/SL/Trailing hit) ────────────────────
  if (event === 'ALGO_UPDATE') {
    // Binance ALGO_UPDATE fields (from docs):
    // msg.ao = algo order object
    // ao.ai = algoId, ao.ca = clientAlgoId
    // ao.s  = symbol, ao.S = side
    // ao.T  = orderType (TAKE_PROFIT_MARKET/STOP_MARKET)
    // ao.as = algoStatus (NEW/FILLED/CANCELED/EXPIRED)
    // ao.sp = triggerPrice, ao.ap = avgPrice
    // ao.z  = executedQty
    const ao      = msg.ao || {};
    const algoId  = (ao.ai || ao.j || '').toString();
    const type    = ao.T || ao.ot || '';   // orderType
    const status  = ao.as || ao.X || '';  // algoStatus
    const symbol  = ao.s || '';
    const side    = ao.S || '';
    const trigPx  = parseFloat(ao.sp || ao.SP || 0);
    const fillPx  = parseFloat(ao.ap || trigPx);
    const fillQty = parseFloat(ao.z || ao.q || 0);

    console.log(`[FuturesUserStream] ALGO_UPDATE: ${symbol} ${type} status=${status} algoId=${algoId} fillQty=${fillQty} fillPx=${fillPx}`);
    console.log('[FuturesUserStream] ALGO_UPDATE RAW ao:', JSON.stringify(ao));

    if (status === 'FILLED' && fillQty > 0 && fillPx > 0) {
      // Find the open position for this symbol
      // TP hits → close LONG; SL hits → close LONG
      // For SELL algo orders → it was a LONG position close
      const side   = ao.S || ao.side; // SELL=was long, BUY=was short
      const posSide = side?.toUpperCase() === 'SELL' ? 'long' : 'short';

      // Find all open positions for this symbol with this side
      const { rows: positions } = await db.query(
        `SELECT p.*, u.id as uid
         FROM futures_positions p
         JOIN users u ON u.id = p.user_id
         WHERE p.symbol=$1 AND p.side=$2 AND p.status='open' AND p.is_custom=false
         ORDER BY p.opened_at ASC`,
        [symbol, posSide]
      );

      let remainQty = fillQty;
      for (const pos of positions) {
        if (remainQty <= 0) break;
        const posQty   = parseFloat(pos.quantity);
        const closeQty = Math.min(posQty, remainQty);
        remainQty -= closeQty;

        try {
          const result = await closePosition(
            pos.id, pos.user_id, closeQty, fillPx, false
          );
          console.log(`[FuturesUserStream] ALGO close pos=${pos.id} qty=${closeQty} pnl=${result.realizedPnl.toFixed(4)}`);

          emitToUser(pos.user_id, {
            type:        type === 'TAKE_PROFIT_MARKET' ? 'take_profit_hit' : 'stop_loss_hit',
            positionId:  pos.id,
            symbol,
            side:        posSide,
            closePrice:  fillPx,
            closedQty:   closeQty,
            realizedPnl: result.realizedPnl,
            message:     `${type === 'TAKE_PROFIT_MARKET' ? 'Take Profit' : 'Stop Loss'} triggered for ${symbol} @ ${fillPx}`
          });
        } catch(e) {
          console.error('[FuturesUserStream] ALGO close error:', e.message);
        }
      }
    }

    if (['CANCELED','EXPIRED'].includes(status)) {
      console.log(`[FuturesUserStream] Algo order ${algoId} ${status}`);
    }
  }

  // ── ACCOUNT_UPDATE ───────────────────────────────────────
  if (event === 'ACCOUNT_UPDATE') {
    const reason = msg.a?.m;
    console.log(`[FuturesUserStream] ACCOUNT_UPDATE reason=${reason}`);

    // Funding fee
    if (reason === 'FUNDING_FEE') {
      const positions = msg.a?.P || [];
      for (const p of positions) {
        const symbol   = p.s;
        const walletBal = parseFloat(p.iw || 0);

        // Find matching open position in DB
        const { rows: [dbPos] } = await db.query(
          `SELECT p.id, p.user_id FROM futures_positions p
           JOIN futures_pairs fp ON fp.id = p.pair_id
           WHERE fp.binance_symbol=$1 AND p.status='open' AND p.is_custom=false
           LIMIT 1`,
          [symbol]
        );

        if (dbPos) {
          console.log(`[FuturesUserStream] Funding fee for ${symbol} pos=${dbPos.id}`);
          emitToUser(dbPos.user_id, {
            type: 'funding_fee', symbol, isolatedWallet: walletBal
          });
        }
      }
    }
  }

  // ── listenKey expired ────────────────────────────────────
  if (event === 'listenKeyExpired') {
    console.warn('[FuturesUserStream] ListenKey expired! Reconnecting...');
    clearInterval(keepaliveT);
    clearTimeout(renewT);
    if (isRunning) reconnectT = setTimeout(connect, 1000);
  }
}

async function unlockMargin(userId, marginUsed) {
  try {
    if (!marginUsed || marginUsed <= 0) return;
    const { rows: [usdt] } = await db.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    if (!usdt) return;
    await db.query(
      `UPDATE balances SET
         available = available + $1,
         locked    = GREATEST(locked - $1, 0),
         updated_at = NOW()
       WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
      [marginUsed, userId, parseInt(usdt.id)]
    );
  } catch(e) {
    console.error('[FuturesUserStream] unlockMargin error:', e.message);
  }
}

function emitToUser(userId, data) {
  try {
    const io = require('../../../websocket/socket').getIO?.();
    if (io) io.to(`user:${userId}`).emit('futures_update', data);
  } catch(e) {}
}

function stop() {
  isRunning = false;
  clearInterval(keepaliveT);
  clearTimeout(renewT);
  clearTimeout(reconnectT);
  if (ws) { ws.close(); ws = null; }
}

module.exports = { start, stop };
