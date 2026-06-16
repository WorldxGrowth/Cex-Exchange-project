/**
 * Futures Margin & PnL Calculator
 * Market Standard formulas (same as Binance)
 */

/**
 * Calculate Initial Margin Required
 * Isolated: margin = (quantity * entryPrice) / leverage
 * Cross: margin = (quantity * entryPrice) * maintenanceMarginRate
 */
function calcInitialMargin(quantity, entryPrice, leverage, marginType = 'isolated') {
  const notional = parseFloat(quantity) * parseFloat(entryPrice);
  if (marginType === 'isolated') {
    return notional / parseFloat(leverage);
  }
  // cross — same formula for initial lock
  return notional / parseFloat(leverage);
}

/**
 * Calculate Liquidation Price
 * 
 * LONG Isolated:
 *   liqPrice = entryPrice * (1 - 1/leverage + maintenanceMarginRate)
 * 
 * SHORT Isolated:
 *   liqPrice = entryPrice * (1 + 1/leverage - maintenanceMarginRate)
 */
function calcLiquidationPrice(side, entryPrice, leverage, maintenanceMarginRate = 0.004, walletBalance = null, marginType = 'isolated') {
  const ep  = parseFloat(entryPrice);
  const lev = parseFloat(leverage);
  const mmr = parseFloat(maintenanceMarginRate);

  if (marginType === 'isolated') {
    if (side === 'long') {
      return ep * (1 - (1 / lev) + mmr);
    } else {
      return ep * (1 + (1 / lev) - mmr);
    }
  }

  // Cross margin — requires walletBalance
  // liqPrice (long)  = (walletBalance - entryPrice * qty) / (qty * (mmr - 1))
  // Simplified version:
  if (side === 'long') {
    return ep * (1 - (1 / lev) + mmr);
  } else {
    return ep * (1 + (1 / lev) - mmr);
  }
}

/**
 * Calculate Unrealized PnL
 * LONG:  pnl = (markPrice - entryPrice) * quantity
 * SHORT: pnl = (entryPrice - markPrice) * quantity
 */
function calcUnrealizedPnl(side, entryPrice, markPrice, quantity) {
  const ep  = parseFloat(entryPrice);
  const mp  = parseFloat(markPrice);
  const qty = parseFloat(quantity);

  if (side === 'long') {
    return (mp - ep) * qty;
  } else {
    return (ep - mp) * qty;
  }
}

/**
 * Calculate ROE % (Return on Equity)
 * roe = unrealizedPnl / initialMargin * 100
 */
function calcROE(unrealizedPnl, initialMargin) {
  if (!initialMargin || parseFloat(initialMargin) === 0) return 0;
  return (parseFloat(unrealizedPnl) / parseFloat(initialMargin)) * 100;
}

/**
 * Calculate Margin Ratio (for liquidation check)
 * marginRatio = maintenanceMargin / (walletBalance + unrealizedPnl)
 * If marginRatio >= 1 → LIQUIDATE
 */
function calcMarginRatio(maintenanceMargin, walletBalance, unrealizedPnl) {
  const wb   = parseFloat(walletBalance);
  const upnl = parseFloat(unrealizedPnl);
  const mm   = parseFloat(maintenanceMargin);
  const equity = wb + upnl;
  if (equity <= 0) return 999; // force liquidate
  return mm / equity;
}

/**
 * Calculate Maintenance Margin
 * mm = quantity * markPrice * maintenanceMarginRate
 */
function calcMaintenanceMargin(quantity, markPrice, maintenanceMarginRate = 0.004) {
  return parseFloat(quantity) * parseFloat(markPrice) * parseFloat(maintenanceMarginRate);
}

/**
 * Calculate notional value
 * notional = quantity * price
 */
function calcNotional(quantity, price) {
  return parseFloat(quantity) * parseFloat(price);
}

/**
 * Calculate Trading Fee
 * fee = notional * feeRate
 */
function calcFee(quantity, price, feeRate = 0.0004) {
  return calcNotional(quantity, price) * parseFloat(feeRate);
}

/**
 * Check if position should be liquidated
 * Returns true if liquidation should happen
 */
function shouldLiquidate(side, markPrice, liquidationPrice) {
  const mp  = parseFloat(markPrice);
  const lp  = parseFloat(liquidationPrice);
  if (side === 'long')  return mp <= lp;
  if (side === 'short') return mp >= lp;
  return false;
}

/**
 * Calculate max order quantity based on available balance
 * maxQty = (availableBalance * leverage) / markPrice
 */
function calcMaxOrderQty(availableBalance, leverage, markPrice, fee = 0.0004) {
  const bal = parseFloat(availableBalance);
  const lev = parseFloat(leverage);
  const mp  = parseFloat(markPrice);
  // Account for fee
  return (bal * lev) / (mp * (1 + fee));
}

/**
 * Calculate order cost (margin required to place order)
 * cost = (quantity * price) / leverage + fee
 */
function calcOrderCost(quantity, price, leverage, feeRate = 0.0004) {
  const notional = parseFloat(quantity) * parseFloat(price);
  const margin   = notional / parseFloat(leverage);
  const fee      = notional * feeRate;
  return margin + fee;
}

/**
 * Round quantity to stepSize (same as spot LOT_SIZE)
 */
function roundToStepSize(qty, stepSize) {
  const step = parseFloat(stepSize);
  const q    = parseFloat(qty);
  if (step <= 0) return q;
  return Math.floor(q / step) * step;
}

/**
 * Round price to tickSize
 */
function roundToTickSize(price, tickSize) {
  const tick = parseFloat(tickSize);
  const p    = parseFloat(price);
  if (tick <= 0) return p;
  return Math.round(p / tick) * tick;
}

module.exports = {
  calcInitialMargin,
  calcLiquidationPrice,
  calcUnrealizedPnl,
  calcROE,
  calcMarginRatio,
  calcMaintenanceMargin,
  calcNotional,
  calcFee,
  shouldLiquidate,
  calcMaxOrderQty,
  calcOrderCost,
  roundToStepSize,
  roundToTickSize,
};
