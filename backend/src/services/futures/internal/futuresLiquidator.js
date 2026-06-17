/**
 * Futures Liquidation Engine
 * Runs every 5 seconds — checks all open positions
 * Uses real Binance futures mark price (not spot price)
 */
const db = require('../../../config/database');

let liquidatorTimer = null;

function getMarkPrice(symbol) {
  try {
    const { getMarkPrice: _get } = require('../shared/futuresMarkPrice');
    return _get(symbol);
  } catch(e) {
    return null;
  }
}

async function runLiquidationCheck() {
  try {
    const { rows: positions } = await db.query(
      `SELECT p.*, fp.maintenance_margin, fp.is_custom, fp.base_coin_id
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       WHERE p.status = 'open'
         AND p.liquidation_price IS NOT NULL`
    );

    for (const pos of positions) {
      // Use futures mark price for non-custom, spot price for custom (VDC)
      let markPrice = null;
      if (!pos.is_custom) {
        markPrice = getMarkPrice(pos.symbol);
      }
      // Fallback to spot price_feeds for custom pairs or if mark price unavailable
      if (!markPrice) {
        const { rows: [feed] } = await db.query(
          `SELECT price_usdt FROM price_feeds WHERE coin_id=$1 LIMIT 1`,
          [pos.base_coin_id]
        );
        markPrice = feed?.price_usdt ? parseFloat(feed.price_usdt) : null;
      }
      if (!markPrice) continue;

      const mp       = parseFloat(markPrice);
      const liqPrice = parseFloat(pos.liquidation_price);
      const side     = pos.side;

      const shouldLiq =
        (side === 'long'  && mp <= liqPrice) ||
        (side === 'short' && mp >= liqPrice);

      if (shouldLiq) {
        console.log(`[Liquidator] LIQUIDATING pos=${pos.id} ${side} @ liq=${liqPrice} mark=${mp}`);
        await liquidatePosition(pos, mp);
      }
    }
  } catch (err) {
    console.error('[Liquidator] runLiquidationCheck error:', err.message);
  }
}

async function liquidatePosition(pos, markPrice) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const qty    = parseFloat(pos.quantity);
    const ep     = parseFloat(pos.entry_price);
    const margin = parseFloat(pos.margin);
    const liqFee = margin * 0.015;

    let realizedPnl;
    if (pos.side === 'long') {
      realizedPnl = (markPrice - ep) * qty - liqFee;
    } else {
      realizedPnl = (ep - markPrice) * qty - liqFee;
    }

    await client.query(
      `UPDATE futures_positions SET
         status='liquidated', realized_pnl=$1, mark_price=$2,
         closed_at=NOW(), updated_at=NOW()
       WHERE id=$3`,
      [realizedPnl, markPrice, pos.id]
    );

    await client.query(
      `INSERT INTO futures_liquidation_logs
         (user_id, position_id, pair_id, symbol, side, quantity,
          entry_price, liquidation_price, mark_price,
          margin_lost, realized_pnl, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'margin_call')`,
      [
        pos.user_id, pos.id, pos.pair_id, pos.symbol,
        pos.side, qty, ep, pos.liquidation_price, markPrice,
        margin, realizedPnl
      ]
    );

    const { rows: [usdt] } = await client.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );

    if (usdt) {
      const usdtId    = parseInt(usdt.id);
      const returnAmt = Math.max(0, margin + realizedPnl);

      await client.query(
        `UPDATE balances SET
           locked    = GREATEST(locked - $1, 0),
           available = available + $2,
           updated_at = NOW()
         WHERE user_id=$3 AND coin_id=$4 AND account_type='futures'`,
        [margin, returnAmt, pos.user_id, usdtId]
      );

      const { rows: [balRow] } = await client.query(
        `SELECT available FROM balances
         WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'`,
        [pos.user_id, usdtId]
      );

      await client.query(
        `INSERT INTO ledger (user_id, coin_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'futures_liquidation', $3, $4, $5, $6)`,
        [
          pos.user_id, usdtId,
          realizedPnl,
          parseFloat(balRow?.available || 0),
          String(pos.id),
          `Liquidated ${pos.side} ${pos.symbol} @ ${markPrice} margin_lost=${margin.toFixed(4)}`
        ]
      );
    }

    await client.query('COMMIT');

    try {
      const io = require('../../../websocket/socket').getIO?.();
      if (io) {
        io.to(`user:${pos.user_id}`).emit('futures_update', {
          type:       'position_liquidated',
          positionId: pos.id,
          symbol:     pos.symbol,
          side:       pos.side,
          markPrice,
          realizedPnl,
          message:    `Your ${pos.side} ${pos.symbol} position was liquidated at $${markPrice}`
        });
      }
    } catch(e) {}

    console.log(`[Liquidator] pos=${pos.id} liquidated. PnL=${realizedPnl.toFixed(4)}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Liquidator] liquidatePosition error:', err.message);
  } finally {
    client.release();
  }
}

function start() {
  console.log('[Liquidator] Starting liquidation engine (5s interval)...');
  liquidatorTimer = setInterval(runLiquidationCheck, 5000);
}

function stop() {
  clearInterval(liquidatorTimer);
}

module.exports = { start, stop, runLiquidationCheck, liquidatePosition };

// ── TP/SL check for internal pairs (VDC) ──────────────
async function checkTpSl() {
  try {
    const { rows: positions } = await db.query(
      `SELECT p.*, fp.base_coin_id
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       WHERE p.status='open'
         AND fp.is_custom=true
         AND (p.take_profit IS NOT NULL OR p.stop_loss IS NOT NULL)`
    );

    for (const pos of positions) {
      // VDC uses spot price_feeds
      const { rows: [feed] } = await db.query(
        `SELECT price_usdt FROM price_feeds WHERE coin_id=$1 LIMIT 1`,
        [pos.base_coin_id]
      );
      const mp = parseFloat(feed?.price_usdt || 0);
      if (!mp) continue;

      const tp = pos.take_profit ? parseFloat(pos.take_profit) : null;
      const sl = pos.stop_loss   ? parseFloat(pos.stop_loss)   : null;

      let triggered = null;
      if (pos.side === 'long') {
        if (tp && mp >= tp) triggered = 'take_profit';
        if (sl && mp <= sl) triggered = 'stop_loss';
      } else {
        if (tp && mp <= tp) triggered = 'take_profit';
        if (sl && mp >= sl) triggered = 'stop_loss';
      }

      if (triggered) {
        console.log(`[Liquidator] ${triggered.toUpperCase()} hit! pos=${pos.id} ${pos.side} @ ${mp}`);
        const { closePosition } = require('./futuresEngine');
        await closePosition(pos.id, pos.user_id, pos.quantity, mp, true);

        try {
          const io = require('../../../websocket/socket').getIO?.();
          if (io) {
            io.to(`user:${pos.user_id}`).emit('futures_update', {
              type:       triggered,
              positionId: pos.id,
              symbol:     pos.symbol,
              side:       pos.side,
              markPrice:  mp,
              message:    `${triggered === 'take_profit' ? 'Take Profit' : 'Stop Loss'} triggered for ${pos.symbol}`
            });
          }
        } catch(e) {}
      }
    }
  } catch(err) {
    console.error('[Liquidator] checkTpSl error:', err.message);
  }
}

module.exports.checkTpSl = checkTpSl;
