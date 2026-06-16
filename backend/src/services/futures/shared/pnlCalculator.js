/**
 * Live PnL Calculator for Futures Positions
 * Called from WebSocket mark price updates
 */
const db = require('../../../config/database');
const { calcUnrealizedPnl, calcLiquidationPrice, shouldLiquidate } = require('./marginCalculator');

/**
 * Update all open positions with latest mark price
 * Called every 1 second from WebSocket price feed
 */
async function updatePositionsPnl(symbol, markPrice) {
  try {
    const mp = parseFloat(markPrice);
    if (!mp || mp <= 0) return;

    // Get all open positions for this symbol
    const { rows: positions } = await db.query(
      `SELECT p.*, fp.maintenance_margin 
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       WHERE p.symbol = $1 AND p.status = 'open'`,
      [symbol]
    );

    if (!positions.length) return;

    const updates = positions.map(async (pos) => {
      const unrealizedPnl = calcUnrealizedPnl(
        pos.side,
        pos.entry_price,
        markPrice,
        pos.quantity
      );

      const liqPrice = calcLiquidationPrice(
        pos.side,
        pos.entry_price,
        pos.leverage,
        pos.maintenance_margin || 0.004,
        null,
        pos.margin_type
      );

      // Update DB
      await db.query(
        `UPDATE futures_positions 
         SET mark_price = $1,
             unrealized_pnl = $2,
             liquidation_price = $3,
             notional = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          markPrice,
          unrealizedPnl.toFixed(8),
          liqPrice.toFixed(8),
          (parseFloat(pos.quantity) * mp).toFixed(8),
          pos.id
        ]
      );

      return {
        positionId: pos.id,
        userId:     pos.user_id,
        symbol:     pos.symbol,
        side:       pos.side,
        unrealizedPnl,
        markPrice:  mp,
        liqPrice,
        shouldLiq:  shouldLiquidate(pos.side, mp, liqPrice)
      };
    });

    const results = await Promise.all(updates);
    return results;

  } catch (err) {
    console.error('[PnlCalculator] updatePositionsPnl error:', err.message);
    return [];
  }
}

/**
 * Get live PnL for a user's all positions
 * Returns enriched position data for frontend
 */
async function getUserPositionsPnl(userId) {
  try {
    const { rows } = await db.query(
      `SELECT 
         p.*,
         fp.symbol as pair_symbol,
         fp.tick_size,
         fp.step_size,
         fp.maintenance_margin,
         fp.taker_fee,
         c.symbol as base_symbol
       FROM futures_positions p
       JOIN futures_pairs fp ON fp.id = p.pair_id
       JOIN coins c ON c.id = fp.base_coin_id
       WHERE p.user_id = $1 AND p.status = 'open'
       ORDER BY p.opened_at DESC`,
      [userId]
    );

    return rows.map(pos => {
      const unrealizedPnl = parseFloat(pos.unrealized_pnl || 0);
      const margin        = parseFloat(pos.margin || 0);
      const roe           = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

      return {
        id:               pos.id,
        symbol:           pos.symbol,
        side:             pos.side,
        marginType:       pos.margin_type,
        leverage:         pos.leverage,
        entryPrice:       parseFloat(pos.entry_price),
        markPrice:        parseFloat(pos.mark_price || 0),
        liquidationPrice: parseFloat(pos.liquidation_price || 0),
        quantity:         parseFloat(pos.quantity),
        margin:           margin,
        unrealizedPnl:    unrealizedPnl,
        realizedPnl:      parseFloat(pos.realized_pnl || 0),
        roe:              roe.toFixed(2),
        notional:         parseFloat(pos.notional || 0),
        takeProfit:       pos.take_profit ? parseFloat(pos.take_profit) : null,
        stopLoss:         pos.stop_loss   ? parseFloat(pos.stop_loss) : null,
        openedAt:         pos.opened_at,
      };
    });

  } catch (err) {
    console.error('[PnlCalculator] getUserPositionsPnl error:', err.message);
    return [];
  }
}

module.exports = { updatePositionsPnl, getUserPositionsPnl };
