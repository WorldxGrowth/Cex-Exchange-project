const { Server } = require('socket.io');
const { redis } = require('../config/redis');
const db = require('../config/database');
const { verifyToken } = require('../utils/jwt');

let io;

const initWebSocket = (server) => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling']
  });

  io.on('connection', async (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = verifyToken(token);
        socket.userId = decoded.userId;
        socket.join(`user:${decoded.userId}`);
        console.log(`👤 Authenticated user: ${decoded.userId}`);
      } catch (e) {
        console.log('Invalid token - public access only');
      }
    }

    // SUBSCRIBE TO TICKER
    socket.on('subscribe_ticker', async (symbol) => {
      const room = `ticker:${symbol.toUpperCase()}`;
      socket.join(room);
      const cached = await redis.get(`price:${symbol.replace('USDT','')}`);
      if (cached) {
        socket.emit('ticker', { symbol: symbol.toUpperCase(), ...JSON.parse(cached) });
      }
    });

    socket.on('unsubscribe_ticker', (symbol) => {
      socket.leave(`ticker:${symbol.toUpperCase()}`);
    });

    // SUBSCRIBE TO ORDER BOOK
    socket.on('subscribe_orderbook', async (symbol) => {
      const room = `orderbook:${symbol.toUpperCase()}`;
      socket.join(room);

      // Send immediately on subscribe
      const pair = await db.query(
        'SELECT id, is_custom FROM trading_pairs WHERE symbol = $1',
        [symbol.toUpperCase()]
      );
      if (!pair.rows[0]) return;

      const { id: pairId, is_custom } = pair.rows[0];

      if (is_custom) {
        // Internal orderbook
        const bids = await db.query(`
          SELECT CAST(price AS VARCHAR) as price,
                 CAST(SUM(remaining_qty) AS VARCHAR) as qty
          FROM orders WHERE pair_id = $1 AND side = 'buy'
            AND status IN ('open','partially_filled') AND price IS NOT NULL
          GROUP BY price ORDER BY price DESC LIMIT 15
        `, [pairId]);
        const asks = await db.query(`
          SELECT CAST(price AS VARCHAR) as price,
                 CAST(SUM(remaining_qty) AS VARCHAR) as qty
          FROM orders WHERE pair_id = $1 AND side = 'sell'
            AND status IN ('open','partially_filled') AND price IS NOT NULL
          GROUP BY price ORDER BY price ASC LIMIT 15
        `, [pairId]);
        socket.emit('orderbook', {
          symbol: symbol.toUpperCase(),
          bids: bids.rows, asks: asks.rows, source: 'internal'
        });
      } else {
        // Redis orderbook (Binance)
        const bids = await redis.zrevrange(`orderbook:${pairId}:bids`, 0, 19, 'WITHSCORES');
        const asks = await redis.zrange(`orderbook:${pairId}:asks`, 0, 19, 'WITHSCORES');
        socket.emit('orderbook', {
          symbol: symbol.toUpperCase(),
          bids: formatOrderBook(bids),
          asks: formatOrderBook(asks)
        });
      }
    });

    socket.on('unsubscribe_orderbook', (symbol) => {
      socket.leave(`orderbook:${symbol.toUpperCase()}`);
    });

    socket.on('subscribe_orders', () => {
      if (socket.userId) socket.join(`orders:${socket.userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });

    socket.on('ping', () => socket.emit('pong'));
  });

  startPriceBroadcast();
  startBinanceWebSocket();
  startInternalOrderBookBroadcast();

  console.log('✅ WebSocket server initialized');
  return io;
};

// ── PRICE BROADCAST (every 1s) ──────────────────────
const startPriceBroadcast = () => {
  setInterval(async () => {
    if (!io) return;
    try {
      const pairs = await db.query(`
        SELECT tp.symbol, p.price_usdt as price, p.change_24h,
               p.volume_24h, p.high_24h, p.low_24h
        FROM trading_pairs tp
        JOIN coins bc ON bc.id = tp.base_coin_id
        JOIN price_feeds p ON p.coin_id = bc.id
        WHERE tp.is_active = true
      `);
      for (const pair of pairs.rows) {
        const room = `ticker:${pair.symbol}`;
        const sockets = await io.in(room).fetchSockets();
        if (sockets.length > 0) {
          io.to(room).emit('ticker', {
            symbol: pair.symbol, price: pair.price,
            change_24h: pair.change_24h, volume_24h: pair.volume_24h,
            high_24h: pair.high_24h, low_24h: pair.low_24h,
            timestamp: Date.now()
          });
        }
      }
    } catch (err) {
      console.error('Broadcast error:', err.message);
    }
  }, 1000);
};

// ── INTERNAL ORDERBOOK BROADCAST (VDC/Custom, every 1s) ──
const startInternalOrderBookBroadcast = () => {
  setInterval(async () => {
    if (!io) return;
    try {
      const pairs = await db.query(`
        SELECT id, symbol FROM trading_pairs
        WHERE is_custom = true AND is_active = true
      `);
      for (const pair of pairs.rows) {
        const room = `orderbook:${pair.symbol}`;
        const sockets = await io.in(room).fetchSockets();
        if (sockets.length === 0) continue;

        const bids = await db.query(`
          SELECT CAST(price AS VARCHAR) as price,
                 CAST(SUM(remaining_qty) AS VARCHAR) as qty
          FROM orders WHERE pair_id = $1 AND side = 'buy'
            AND status IN ('open','partially_filled') AND price IS NOT NULL
          GROUP BY price ORDER BY price DESC LIMIT 15
        `, [pair.id]);

        const asks = await db.query(`
          SELECT CAST(price AS VARCHAR) as price,
                 CAST(SUM(remaining_qty) AS VARCHAR) as qty
          FROM orders WHERE pair_id = $1 AND side = 'sell'
            AND status IN ('open','partially_filled') AND price IS NOT NULL
          GROUP BY price ORDER BY price ASC LIMIT 15
        `, [pair.id]);

        io.to(room).emit('orderbook', {
          symbol: pair.symbol,
          bids: bids.rows, asks: asks.rows,
          source: 'internal'
        });
      }
    } catch (e) {}
  }, 1000);
};

// ── BINANCE WEBSOCKET RELAY ───────────────────────────
const startBinanceWebSocket = () => {
  const WebSocket = require('ws');

  // Ticker stream
  const tickerStreams = [
    'btcusdt@ticker','ethusdt@ticker','bnbusdt@ticker',
    'solusdt@ticker','xrpusdt@ticker','dogeusdt@ticker','trxusdt@ticker'
  ].join('/');

  const connectTicker = () => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${tickerStreams}`);
    ws.on('open', () => console.log('✅ Binance Ticker WS connected'));
    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data);
        const ticker = parsed.data;
        if (!ticker || !ticker.s) return;
        const symbol = ticker.s;
        const coinSymbol = symbol.replace('USDT','');
        await redis.setex(`price:${coinSymbol}`, 60, JSON.stringify({
          price: ticker.c, change_24h: ticker.P,
          volume_24h: ticker.q, high_24h: ticker.h, low_24h: ticker.l
        }));
        if (io) {
          io.to(`ticker:${symbol}`).emit('ticker', {
            symbol, price: ticker.c, change_24h: ticker.P,
            volume_24h: ticker.q, high_24h: ticker.h,
            low_24h: ticker.l, timestamp: Date.now()
          });
        }
      } catch (e) {}
    });
    ws.on('close', () => setTimeout(connectTicker, 5000));
    ws.on('error', () => {});
  };

  // Orderbook stream
  const obStreams = [
    'btcusdt@depth20@100ms','ethusdt@depth20@100ms','bnbusdt@depth20@100ms',
    'solusdt@depth20@100ms','xrpusdt@depth20@100ms','dogeusdt@depth20@100ms','trxusdt@depth20@100ms'
  ].join('/');

  const connectOrderBook = () => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${obStreams}`);
    ws.on('open', () => console.log('✅ Binance OrderBook WS connected'));
    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data);
        const ob = parsed.data;
        if (!ob || !ob.bids) return;
        const symbol = parsed.stream.split('@')[0].toUpperCase() + 'USDT';
        const payload = {
          symbol,
          bids: (ob.bids||[]).slice(0,15).map(([price,qty]) => ({price,qty})),
          asks: (ob.asks||[]).slice(0,15).map(([price,qty]) => ({price,qty})),
          source: 'binance'
        };
        if (io) io.to(`orderbook:${symbol}`).emit('orderbook', payload);
      } catch (e) {}
    });
    ws.on('close', () => {
      console.log('⚠️ Binance OB WS disconnected - reconnecting...');
      setTimeout(connectOrderBook, 5000);
    });
    ws.on('error', () => {});
  };

  connectTicker();
  connectOrderBook();
};

// ── HELPERS ───────────────────────────────────────────
const formatOrderBook = (arr) => {
  const result = [];
  for (let i = 0; i < arr.length; i += 2) {
    result.push({ qty: arr[i], price: arr[i + 1] });
  }
  return result;
};

const pushOrderUpdate = (userId, orderData) => {
  if (io) {
    io.to(`user:${userId}`).emit('order_update', orderData);
    io.to(`orders:${userId}`).emit('order_update', orderData);
  }
};

const pushTradeNotification = (userId, tradeData) => {
  if (io) io.to(`user:${userId}`).emit('trade_executed', tradeData);
};

module.exports = { initWebSocket, pushOrderUpdate, pushTradeNotification, getIO: () => io };
