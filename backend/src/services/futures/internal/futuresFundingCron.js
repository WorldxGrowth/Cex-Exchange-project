/**
 * Futures Funding Rate Cron
 * Every 8 hours: apply funding fee to all open positions
 * Funding rate fetched from Binance for non-custom pairs
 */
const db = require('../../../config/database');

let fundingTimer = null;

async function applyFundingFees() {
  console.log('[FundingCron] Applying funding fees...');
  try {
    // Get latest funding rates
    const { rows: rates } = await db.query(
      `SELECT fr.*, fp.is_custom
       FROM funding_rates fr
       JOIN futures_pairs fp ON fp.id = fr.pair_id
       WHERE fr.id IN (
         SELECT MAX(id) FROM funding_rates GROUP BY pair_id
       )`
    );

    for (const rate of rates) {
      await applyFundingForPair(rate.pair_id, rate.symbol, parseFloat(rate.rate));
    }

    console.log('[FundingCron] Funding fees applied for', rates.length, 'pairs');
  } catch (err) {
    console.error('[FundingCron] applyFundingFees error:', err.message);
  }
}

async function applyFundingForPair(pairId, symbol, fundingRate) {
  try {
    // Get all open positions for this pair
    const { rows: positions } = await db.query(
      `SELECT * FROM futures_positions
       WHERE pair_id=$1 AND status='open'`,
      [pairId]
    );

    if (!positions.length) return;

    const { rows: [usdt] } = await db.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    if (!usdt) return;

    for (const pos of positions) {
      const notional    = parseFloat(pos.notional || 0);
      if (notional <= 0) continue;

      // Funding fee = notional * fundingRate
      // Long pays if rate > 0, Short pays if rate < 0
      let fundingFee;
      if (pos.side === 'long') {
        fundingFee = notional * fundingRate;  // positive = pay, negative = receive
      } else {
        fundingFee = notional * (-fundingRate); // opposite of long
      }

      // Deduct/add funding fee from futures balance
      await db.query(
        `UPDATE balances SET
           available = available - $1,
           updated_at = NOW()
         WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
        [fundingFee, pos.user_id, usdt.id]
      );

      // Track funding fee in position
      await db.query(
        `UPDATE futures_positions SET
           funding_fee = funding_fee + $1,
           updated_at = NOW()
         WHERE id=$2`,
        [fundingFee, pos.id]
      );

      // Ledger entry
      await db.query(
        `INSERT INTO ledger (user_id, coin_id, type, amount, balance_after, reference_id, description)
         SELECT $1,$2,'futures_funding',$3,available,$4::varchar,$5
         FROM balances WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'`,
        [pos.user_id, usdt.id, -fundingFee, pos.id,
         `Funding fee ${symbol} ${pos.side} rate=${fundingRate}`]
      );
    }
  } catch (err) {
    console.error(`[FundingCron] applyFundingForPair error ${symbol}:`, err.message);
  }
}

/**
 * Fetch and update funding rates from Binance
 */
async function updateFundingRates() {
  try {
    const { getFuturesBinanceAdapter } = require('../binance/futuresBinanceAdapter');
    const adapter = await getFuturesBinanceAdapter();

    const { rows: pairs } = await db.query(
      `SELECT * FROM futures_pairs WHERE is_custom=false AND is_active=true`
    );

    for (const pair of pairs) {
      try {
        const rates = await adapter.getFundingRate(pair.binance_symbol || pair.symbol);
        if (rates && rates.length > 0) {
          const r = rates[0];
          await db.query(
            `INSERT INTO funding_rates (pair_id, symbol, rate, predicted_rate, next_funding)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT DO NOTHING`,
            [
              pair.id, pair.symbol,
              parseFloat(r.fundingRate),
              parseFloat(r.markPrice || 0),
              r.nextFundingTime ? new Date(parseInt(r.nextFundingTime)) : new Date(Date.now() + 8*3600*1000)
            ]
          );
        }
      } catch (e) {
        console.error(`[FundingCron] updateFundingRates ${pair.symbol}:`, e.message);
      }
    }
  } catch (err) {
    console.error('[FundingCron] updateFundingRates error:', err.message);
  }
}

function start() {
  console.log('[FundingCron] Starting funding rate cron...');
  // Update rates every 30 min
  setInterval(updateFundingRates, 30 * 60 * 1000);
  updateFundingRates(); // immediate first run

  // Calculate next funding time (every 8 hours: 00:00, 08:00, 16:00 UTC)
  scheduleNextFunding();
}

function scheduleNextFunding() {
  const now     = new Date();
  const h       = now.getUTCHours();
  const nextH   = h < 8 ? 8 : h < 16 ? 16 : 24;
  const next    = new Date();
  next.setUTCHours(nextH, 0, 5, 0); // 5 sec after funding time
  const delay   = next.getTime() - now.getTime();

  console.log(`[FundingCron] Next funding in ${Math.round(delay/60000)} minutes`);
  setTimeout(async () => {
    await applyFundingFees();
    scheduleNextFunding(); // schedule next
  }, delay);
}

function stop() {
  clearInterval(fundingTimer);
}

module.exports = { start, stop, applyFundingFees, updateFundingRates };
