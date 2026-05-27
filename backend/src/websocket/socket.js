const { Server } = require('socket.io');
const { redis } = require('../config/redis');
const db = require('../config/database');
const { verifyToken } = require('../utils/jwt');
const axios = require('axios');

let io;

const initWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // ================================
  // CONNECTION HANDLER
  // socket.js →
  // WebSocket server hai - client connect
  // karta hai, price/orderbook subscribe
  // karta hai, real-time data push hota hai
  // ================================
  io.on('connection', async (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Optional auth (for private channels)
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

    // ================================
    // SUBSCRIBE TO TICKER
    // Client: socket.emit('subscribe_ticker', 'BTCUSDT')
    // Server: pushes price every 1 second
    // ================================
    socket.on('subscribe_ticker', async (symbol) => {
      const room = `ticker:${symbol.toUpperCase()}`;
      socket.join(room);
      console.log(`📊 ${socket.id} subscribed to ${room}`);

      // Send current price immediately
      const cached = await redis.get(`price:${symbol.replace('USDT','')}`);
      if (cached) {
        socket.emit('ticker', {
          symbol: symbol.toUpperCase(),
          ...JSON.parse(cached)
        });
      }
    });

    socket.on('unsubscribe_ticker', (symbol) => {
      socket.leave(`ticker:${symbol.toUpperCase()}`);
    });

    // ================================
    // SUBSCRIBE TO ORDER BOOK
    // ================================
    socket.on('subscribe_orderbook', async (symbol) => {
      const room = `orderbook:${symbol.toUpperCase()}`;
      socket.join(room);

      // Send current order book
      const pair = await db.query(
        'SELECT id FROM trading_pairs WHERE symbol = $1',
        [symbol.toUpperCase()]
      );
      if (pair.rows[0]) {
        const pairId = pair.rows[0].id;
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

    // ================================
    // SUBSCRIBE TO USER ORDERS (private)
    // ================================
    socket.on('subscribe_orders', () => {
      if (socket.userId) {
        socket.join(`orders:${socket.userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });

    // Ping/pong keep alive
    socket.on('ping', () => socket.emit('pong'));
  });

  // Start broadcasting prices
  startPriceBroadcast();
  startBinanceWebSocket();

  console.log('✅ WebSocket server initialized');
  return io;
};

// ================================
// BROADCAST PRICES TO ALL SUBSCRIBERS
// Har 1 second mein sab subscribed
// clients ko latest price bhejta hai
// ================================
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
        const roomSockets = await io.in(room).fetchSockets();
        if (roomSockets.length > 0) {
          io.to(room).emit('ticker', {
            symbol: pair.symbol,
            price: pair.price,
            change_24h: pair.change_24h,
            volume_24h: pair.volume_24h,
            high_24h: pair.high_24h,
            low_24h: pair.low_24h,
            timestamp: Date.now()
          });
        }
      }
    } catch (err) {
      console.error('Broadcast error:', err.message);
    }
  }, 1000); // Every 1 second
};

// ================================
// BINANCE WEBSOCKET - Direct stream
// Binance se real-time stream leta hai
// aur hamare users ko relay karta hai
// ================================
const startBinanceWebSocket = () => {
  const WebSocket = require('ws');
  const streams = [
    'btcusdt@ticker', 'ethusdt@ticker', 'bnbusdt@ticker',
    'solusdt@ticker', 'xrpusdt@ticker', 'dogeusdt@ticker'
  ].join('/');

  const connectBinance = () => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.on('open', () => console.log('✅ Binance WebSocket connected'));

    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data);
        const ticker = parsed.data;
        if (!ticker || !ticker.s) return;

        const symbol = ticker.s; // BTCUSDT
        const coinSymbol = symbol.replace('USDT', '');

        // Update Redis cache
        await redis.setex(`price:${coinSymbol}`, 60, JSON.stringify({
          price: ticker.c,
          change_24h: ticker.P,
          volume_24h: ticker.q,
          high_24h: ticker.h,
          low_24h: ticker.l
        }));

        // Broadcast to subscribers
        if (io) {
          io.to(`ticker:${symbol}`).emit('ticker', {
            symbol,
            price: ticker.c,
            change_24h: ticker.P,
            volume_24h: ticker.q,
            high_24h: ticker.h,
            low_24h: ticker.l,
            timestamp: Date.now()
          });
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      console.log('⚠️ Binance WS disconnected - reconnecting in 5s...');
      setTimeout(connectBinance, 5000);
    });

    ws.on('error', (err) => {
      console.error('Binance WS error:', err.message);
    });
  };

  connectBinance();
};

// Helper
const formatOrderBook = (arr) => {
  const result = [];
  for (let i = 0; i < arr.length; i += 2) {
    result.push({ qty: arr[i], price: arr[i + 1] });
  }
  return result;
};

// Push order update to user (called from order controller)
const pushOrderUpdate = (userId, orderData) => {
  if (io) {
    io.to(`user:${userId}`).emit('order_update', orderData);
    io.to(`orders:${userId}`).emit('order_update', orderData);
  }
};

// Push trade notification
const pushTradeNotification = (userId, tradeData) => {
  if (io) {
    io.to(`user:${userId}`).emit('trade_executed', tradeData);
  }
};

module.exports = { initWebSocket, pushOrderUpdate, pushTradeNotification };
