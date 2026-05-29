/**
 * VDExchange - Order Matching Engine
 * ===================================
 * Market Standard Price-Time Priority Matching
 * 
 * Algorithm:
 * - Buy orders: sorted by price DESC, time ASC (highest buyer first)
 * - Sell orders: sorted by price ASC, time ASC (lowest seller first)
 * - Match when: buy_price >= sell_price
 * - Match price = sell_order price (maker price)
 * - Runs every 3 seconds for limit orders
 * - Market orders: instant match on placement
 * 
 * Balance Flow:
 * - Buy order placed: USDT locked
 * - Sell order placed: Base coin locked
 * - On match: locked released, opposite coin credited
 */

const db = require('../config/database');

class OrderMatcher {
  constructor() {
    this.running = false;
    this.interval = null;
    this.processing = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('⚡ Order Matcher started (interval: 3s)');

    // Run every 3 seconds
    this.interval = setInterval(() => {
      if (!this.processing) {
        this.matchAll().catch(e =>
          console.error('OrderMatcher error:', e.message)
        );
      }
    }, 3000);

    // Initial run after 2 sec
    setTimeout(() => this.matchAll().catch(() => {}), 2000);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    console.log('⛔ Order Matcher stopped');
  }

  // Called externally for instant market order matching
  async matchPairNow(pairId) {
    try {
      const pair = await db.query(`
        SELECT tp.id, tp.symbol, tp.maker_fee, tp.taker_fee,
               bc.id as base_coin_id, bc.symbol as base_symbol,
               qc.id as quote_coin_id, qc.symbol as quote_symbol
        FROM trading_pairs tp
        JOIN coins bc ON bc.id = tp.base_coin_id
        JOIN coins qc ON qc.id = tp.quote_coin_id
        WHERE tp.id = $1 AND tp.is_active = true
      `, [pairId]);

      if (pair.rows[0]) {
        await this.matchPair(pair.rows[0]);
      }
    } catch (err) {
      console.error('matchPairNow error:', err.message);
    }
  }

  async matchAll() {
    this.processing = true;
    try {
      // Get all active trading pairs
      const pairs = await db.query(`
        SELECT tp.id, tp.symbol, tp.maker_fee, tp.taker_fee,
               bc.id as base_coin_id, bc.symbol as base_symbol,
               qc.id as quote_coin_id, qc.symbol as quote_symbol
        FROM trading_pairs tp
        JOIN coins bc ON bc.id = tp.base_coin_id
        JOIN coins qc ON qc.id = tp.quote_coin_id
        WHERE tp.is_active = true
      `);

      for (const pair of pairs.rows) {
        await this.matchPair(pair);
      }
    } catch (err) {
      console.error('matchAll error:', err.message);
    } finally {
      this.processing = false;
    }
  }

  async matchPair(pair) {
    try {
      // Get open buy orders - highest price first, oldest first (price-time priority)
      const buyOrders = await db.query(`
        SELECT o.id, o.order_id, o.user_id, o.price,
               o.quantity, o.filled_qty, o.remaining_qty, o.order_type
        FROM orders o
        WHERE o.pair_id = $1
          AND o.side = 'buy'
          AND o.status IN ('open', 'partial')
          AND o.remaining_qty > 0
        ORDER BY o.price DESC, o.created_at ASC
        LIMIT 20
      `, [pair.id]);

      // Get open sell orders - lowest price first, oldest first
      const sellOrders = await db.query(`
        SELECT o.id, o.order_id, o.user_id, o.price,
               o.quantity, o.filled_qty, o.remaining_qty, o.order_type
        FROM orders o
        WHERE o.pair_id = $1
          AND o.side = 'sell'
          AND o.status IN ('open', 'partial')
          AND o.remaining_qty > 0
        ORDER BY o.price ASC, o.created_at ASC
        LIMIT 20
      `, [pair.id]);

      if (!buyOrders.rows.length || !sellOrders.rows.length) return;

      // ⚡ MATCHING ALGORITHM
      let buyIdx = 0;
      let sellIdx = 0;

      // Local copies to track remaining qty during iteration
      const buys = buyOrders.rows.map(o => ({ ...o,
        remaining: parseFloat(o.remaining_qty) }));
      const sells = sellOrders.rows.map(o => ({ ...o,
        remaining: parseFloat(o.remaining_qty) }));

      while (buyIdx < buys.length && sellIdx < sells.length) {
        const buyOrder = buys[buyIdx];
        const sellOrder = sells[sellIdx];

        const buyPrice = parseFloat(buyOrder.price);
        const sellPrice = parseFloat(sellOrder.price);

        // No match possible - buy price too low
        if (buyPrice < sellPrice) break;

        // ✅ MATCH POSSIBLE!
        // Match price = sell order price (maker = seller)
        const matchPrice = sellPrice;
        const matchQty = Math.min(buyOrder.remaining, sellOrder.remaining);

        if (matchQty < 0.000001) {
          buyIdx++;
          continue;
        }

        // Execute trade
        const success = await this.executeTrade({
          pair,
          buyOrder,
          sellOrder,
          matchPrice,
          matchQty,
        });

        if (success) {
          buyOrder.remaining -= matchQty;
          sellOrder.remaining -= matchQty;
        }

        // Move to next order if fully filled
        if (buyOrder.remaining <= 0.000001) buyIdx++;
        if (sellOrder.remaining <= 0.000001) sellIdx++;
      }
    } catch (err) {
      console.error(`[${pair.symbol}] matchPair error:`, err.message);
    }
  }

  async executeTrade({ pair, buyOrder, sellOrder, matchPrice, matchQty }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const totalValue = matchPrice * matchQty;

      // Fee calculation (taker = market side, maker = limit side)
      const buyerFee  = totalValue * parseFloat(pair.taker_fee  || 0.001);
      const sellerFee = totalValue * parseFloat(pair.maker_fee  || 0.001);
      const sellerReceives = totalValue - sellerFee;

      // Generate unique trade ID
      const tradeId = 'TR' + Date.now() +
        Math.random().toString(36).substr(2,4).toUpperCase();

      // ── 1. Insert trade record ──────────────────────────────
      await client.query(`
        INSERT INTO trades
          (trade_id, pair_id, buy_order_id, sell_order_id,
           buyer_id, seller_id, price, quantity, total_value,
           buyer_fee, seller_fee, is_maker_buy, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,NOW())
      `, [tradeId, pair.id, buyOrder.id, sellOrder.id,
          buyOrder.user_id, sellOrder.user_id,
          matchPrice, matchQty, totalValue,
          buyerFee, sellerFee]);

      // ── 2. Update buy order status ─────────────────────────
      const buyFilled    = parseFloat(buyOrder.filled_qty || 0) + matchQty;
      const buyRemaining = Math.max(0, parseFloat(buyOrder.remaining_qty) - matchQty);
      const buyStatus    = buyRemaining <= 0.000001 ? 'filled' : 'partial';

      await client.query(`
        UPDATE orders
        SET filled_qty = $1, remaining_qty = $2,
            status = $3, avg_fill_price = $4, updated_at = NOW()
        WHERE id = $5
      `, [buyFilled, buyRemaining, buyStatus, matchPrice, buyOrder.id]);

      // ── 3. Update sell order status ────────────────────────
      const sellFilled    = parseFloat(sellOrder.filled_qty || 0) + matchQty;
      const sellRemaining = Math.max(0, parseFloat(sellOrder.remaining_qty) - matchQty);
      const sellStatus    = sellRemaining <= 0.000001 ? 'filled' : 'partial';

      await client.query(`
        UPDATE orders
        SET filled_qty = $1, remaining_qty = $2,
            status = $3, avg_fill_price = $4, updated_at = NOW()
        WHERE id = $5
      `, [sellFilled, sellRemaining, sellStatus, matchPrice, sellOrder.id]);

      // ── 4. BUYER receives base coin (e.g. VDC) ─────────────
      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1, $2, 'spot', $3, 0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [buyOrder.user_id, pair.base_coin_id, matchQty]);

      // Release buyer's locked USDT (the matched portion)
      await client.query(`
        UPDATE balances
        SET locked = GREATEST(0, locked - $1), updated_at = NOW()
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [totalValue, buyOrder.user_id, pair.quote_coin_id]);

      // ── 5. SELLER receives quote coin (e.g. USDT) ──────────
      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1, $2, 'spot', $3, 0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [sellOrder.user_id, pair.quote_coin_id, sellerReceives]);

      // Release seller's locked base coin
      await client.query(`
        UPDATE balances
        SET locked = GREATEST(0, locked - $1), updated_at = NOW()
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [matchQty, sellOrder.user_id, pair.base_coin_id]);

      // ── 6. Ledger entries ──────────────────────────────────
      const ledger = [
        [buyOrder.user_id,  pair.base_coin_id,  'trade_buy',
         matchQty,       `Buy ${matchQty} ${pair.base_symbol} @ ${matchPrice}`],
        [sellOrder.user_id, pair.quote_coin_id, 'trade_sell',
         sellerReceives, `Sell ${matchQty} ${pair.base_symbol} @ ${matchPrice}`],
      ];
      for (const [uid, cid, type, amt, desc] of ledger) {
        await client.query(`
          INSERT INTO ledger (user_id, coin_id, type, amount, description)
          VALUES ($1,$2,$3,$4,$5)
        `, [uid, cid, type, amt, desc]).catch(() => {});
      }

      // ── 7. Update price feed ───────────────────────────────
      await client.query(`
        INSERT INTO price_feeds (coin_id, price_usdt, source, updated_at)
        VALUES ($1, $2, 'internal', NOW())
        ON CONFLICT (coin_id)
        DO UPDATE SET price_usdt = $2, updated_at = NOW()
      `, [pair.base_coin_id, matchPrice]).catch(() => {});

      await client.query('COMMIT');

      console.log(
        `✅ TRADE: ${pair.symbol} | ${matchQty} @ ${matchPrice}` +
        ` | buyer:${buyOrder.user_id} seller:${sellOrder.user_id} | ${tradeId}`
      );

      // ── 8. Real-time WebSocket broadcast ──────────────────
      try {
        const { getIO } = require('../websocket/socket');
        const io = getIO();
        if (io) {
          io.emit('trade_executed', {
            symbol: pair.symbol, price: matchPrice,
            quantity: matchQty, total: totalValue,
            side: 'buy', time: new Date()
          });
          // Update ticker for all subscribers
          io.to(`ticker:${pair.symbol}`).emit('ticker', {
            symbol: pair.symbol, price: matchPrice,
            timestamp: Date.now()
          });
        }
      } catch (e) {}

      return true; // success

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('executeTrade error:', err.message);
      return false;
    } finally {
      client.release();
    }
  }
}

const matcher = new OrderMatcher();
module.exports = matcher;
