const db = require('../config/database');

// Email helper
const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('./email/emailService');
    await emailService[fn](...args);
  } catch (e) {}
};

class OrderMatcher {
  constructor() {
    this.running = false;
    this.interval = null;
    this.processing = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('⚡ Order Matcher started');

    // Run every 5 seconds
    this.interval = setInterval(() => {
      if (!this.processing) {
        this.matchAll().catch(e =>
          console.error('OrderMatcher error:', e.message)
        );
      }
    }, 5000);

    // Initial run after 3 sec
    setTimeout(() => this.matchAll().catch(() => {}), 3000);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
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
    } finally {
      this.processing = false;
    }
  }

  async matchPair(pair) {
    try {
      // Get best buy order (highest price, oldest first)
      const buyOrders = await db.query(`
        SELECT o.*, u.email FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.pair_id = $1
          AND o.side = 'buy'
          AND o.status IN ('open', 'partial')
          AND o.remaining_qty > 0
        ORDER BY o.price DESC, o.created_at ASC
        LIMIT 10
      `, [pair.id]);

      // Get best sell order (lowest price, oldest first)
      const sellOrders = await db.query(`
        SELECT o.*, u.email FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.pair_id = $1
          AND o.side = 'sell'
          AND o.status IN ('open', 'partial')
          AND o.remaining_qty > 0
        ORDER BY o.price ASC, o.created_at ASC
        LIMIT 10
      `, [pair.id]);

      if (!buyOrders.rows.length || !sellOrders.rows.length) return;

      // Try to match
      for (const buyOrder of buyOrders.rows) {
        for (const sellOrder of sellOrders.rows) {
          // Skip if same user
          if (buyOrder.user_id === sellOrder.user_id) continue;

          // Check price match: buy_price >= sell_price
          const buyPrice = parseFloat(buyOrder.price);
          const sellPrice = parseFloat(sellOrder.price);

          if (buyPrice < sellPrice) break; // No more matches possible

          // Match price = sell order price (maker price)
          const matchPrice = sellPrice;

          // Match quantity = min of remaining quantities
          const matchQty = Math.min(
            parseFloat(buyOrder.remaining_qty),
            parseFloat(sellOrder.remaining_qty)
          );

          if (matchQty <= 0) continue;

          // Execute the trade
          await this.executeTrade({
            pair,
            buyOrder,
            sellOrder,
            matchPrice,
            matchQty,
          });

          // Update local remaining qty for next iteration
          buyOrder.remaining_qty -= matchQty;
          sellOrder.remaining_qty -= matchQty;

          if (buyOrder.remaining_qty <= 0) break;
        }
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
      const buyerFee = totalValue * parseFloat(pair.taker_fee || 0.001);
      const sellerFee = totalValue * parseFloat(pair.maker_fee || 0.001);

      // Generate trade ID
      const tradeId = 'TR' + Date.now() + Math.random().toString(36).substr(2,4).toUpperCase();

      // 1. Create trade record
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

      // 2. Update buy order
      const buyFilled = parseFloat(buyOrder.filled_qty || 0) + matchQty;
      const buyRemaining = parseFloat(buyOrder.remaining_qty) - matchQty;
      const buyStatus = buyRemaining <= 0.000001 ? 'filled' : 'partial';

      await client.query(`
        UPDATE orders SET
          filled_qty = $1, remaining_qty = $2,
          status = $3, avg_fill_price = $4, updated_at = NOW()
        WHERE id = $5
      `, [buyFilled, Math.max(0, buyRemaining), buyStatus, matchPrice, buyOrder.id]);

      // 3. Update sell order
      const sellFilled = parseFloat(sellOrder.filled_qty || 0) + matchQty;
      const sellRemaining = parseFloat(sellOrder.remaining_qty) - matchQty;
      const sellStatus = sellRemaining <= 0.000001 ? 'filled' : 'partial';

      await client.query(`
        UPDATE orders SET
          filled_qty = $1, remaining_qty = $2,
          status = $3, avg_fill_price = $4, updated_at = NOW()
        WHERE id = $5
      `, [sellFilled, Math.max(0, sellRemaining), sellStatus, matchPrice, sellOrder.id]);

      // 4. BUYER: credit base coin, deduct quote coin lock
      // Buyer already paid (locked) quote coin when placing order
      // Now receive base coin
      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1, $2, 'spot', $3, 0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [buyOrder.user_id, pair.base_coin_id, matchQty]);

      // Unlock + deduct quote coin from buyer
      const quoteCostWithFee = (matchPrice * matchQty) + buyerFee;
      await client.query(`
        UPDATE balances SET
          locked = GREATEST(0, locked - $1),
          updated_at = NOW()
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [matchPrice * matchQty, buyOrder.user_id, pair.quote_coin_id]);

      // 5. SELLER: credit quote coin, unlock base coin
      // Seller already locked base coin when placing order
      const sellerReceives = (matchPrice * matchQty) - sellerFee;

      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1, $2, 'spot', $3, 0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [sellOrder.user_id, pair.quote_coin_id, sellerReceives]);

      // Unlock base coin from seller
      await client.query(`
        UPDATE balances SET
          locked = GREATEST(0, locked - $1),
          updated_at = NOW()
        WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
      `, [matchQty, sellOrder.user_id, pair.base_coin_id]);

      // 6. Ledger entries
      const ledgerEntries = [
        // Buyer receives base coin
        [buyOrder.user_id, pair.base_coin_id, 'trade_buy',
         matchQty, `Buy ${matchQty} ${pair.base_symbol} @ ${matchPrice}`],
        // Seller receives quote coin
        [sellOrder.user_id, pair.quote_coin_id, 'trade_sell',
         sellerReceives, `Sell ${matchQty} ${pair.base_symbol} @ ${matchPrice}`],
      ];

      for (const [uid, cid, type, amt, desc] of ledgerEntries) {
        await client.query(`
          INSERT INTO ledger (user_id, coin_id, type, amount, description)
          VALUES ($1,$2,$3,$4,$5)
        `, [uid, cid, type, amt, desc]).catch(() => {});
      }

      // 7. Update price feed (last trade price)
      await client.query(`
        INSERT INTO price_feeds (coin_id, price_usdt, last_trade_price, source, updated_at)
        VALUES ($1, $2, $2, 'internal', NOW())
        ON CONFLICT (coin_id) DO UPDATE SET
          price_usdt = EXCLUDED.price_usdt,
          last_trade_price = EXCLUDED.last_trade_price,
          updated_at = NOW()
      `, [pair.base_coin_id, matchPrice]).catch(() => {});

      await client.query('COMMIT');

      console.log(`✅ TRADE: ${pair.symbol} | ${matchQty} @ ${matchPrice} | ${tradeId}`);

      // Emit to websocket (real-time price update)
      try {
        const { getIO } = require('../websocket/socket');
        const io = getIO();
        if (io) {
          io.emit('trade_executed', {
            symbol: pair.symbol,
            price: matchPrice,
            quantity: matchQty,
            total: totalValue,
            side: 'buy',
            time: new Date()
          });
        }
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('executeTrade error:', err.message);
    } finally {
      client.release();
    }
  }
}

const matcher = new OrderMatcher();
module.exports = matcher;
