/**
 * Futures Funding Rate Cron
 * Every 8 hours: apply funding fee to all open positions
 */
const db = require('../../../config/database');

let fundingTimer = null;

async function applyFundingFees() {
  console.log('[FundingCron] Applying funding fees...');
  try {
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
    const { rows: positions } = await db.query(
      `SELECT * FROM futures_positions WHERE pair_id=$1 AND status='open'`,
      [pairId]
    );
    if (!positions.length) return;

    const { rows: [usdt] } = await db.query(
      `SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`
    );
    if (!usdt) return;
    const usdtId = parseInt(usdt.id);

    for (const pos of positions) {
      const notional = parseFloat(pos.notional || 0);
      if (notional <= 0) continue;

      let fundingFee;
      if (pos.side === 'long') {
        fundingFee = notional * fundingRate;
      } else {
        fundingFee = notional * (-fundingRate);
      }

      // Deduct fee from balance
      await db.query(
        `UPDATE balances SET available=available-$1, updated_at=NOW()
         WHERE user_id=$2 AND coin_id=$3 AND account_type='futures'`,
        [fundingFee, pos.user_id, usdtId]
      );

      // Update position
      await db.query(
        `UPDATE futures_positions SET funding_fee=COALESCE(funding_fee,0)+$1, updated_at=NOW()
         WHERE id=$2`,
        [fundingFee, pos.id]
      );

      // Ledger - direct VALUES (no subquery)
      const { rows: [balRow] } = await db.query(
        `SELECT available FROM balances WHERE user_id=$1 AND coin_id=$2 AND account_type='futures'`,
        [pos.user_id, usdtId]
      );
      await db.query(
        `INSERT INTO ledger (user_id, coin_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, $2, 'futures_funding', $3, $4, $5, $6)`,
        [
          pos.user_id, usdtId,
          -fundingFee,
          parseFloat(balRow?.available || 0),
          String(pos.id),
          `Funding ${symbol} ${pos.side} rate=${fundingRate.toFixed(6)}`
        ]
      );
    }
  } catch (err) {
    console.error(`[FundingCron] applyFundingForPair error ${symbol}:`, err.message);
  }
}

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
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [
              pair.id, pair.symbol,
              parseFloat(r.fundingRate),
              parseFloat(r.markPrice || 0),
              r.nextFundingTime ? new Date(parseInt(r.nextFundingTime)) : new Date(Date.now() + 8*3600*1000)
            ]
          );
        }
      } catch(e) {
        console.error(`[FundingCron] ${pair.symbol}:`, e.message);
      }
    }
  } catch(err) {
    console.error('[FundingCron] updateFundingRates error:', err.message);
  }
}

function start() {
  console.log('[FundingCron] Starting...');
  setInterval(updateFundingRates, 30 * 60 * 1000);
  updateFundingRates();
  scheduleNextFunding();
}

function scheduleNextFunding() {
  const now   = new Date();
  const h     = now.getUTCHours();
  const nextH = h < 8 ? 8 : h < 16 ? 16 : 24;
  const next  = new Date();
  next.setUTCHours(nextH, 0, 5, 0);
  const delay = next.getTime() - now.getTime();
  console.log(`[FundingCron] Next funding in ${Math.round(delay/60000)} min`);
  setTimeout(async () => {
    await applyFundingFees();
    scheduleNextFunding();
  }, delay);
}

function stop() { clearInterval(fundingTimer); }

module.exports = { start, stop, applyFundingFees, updateFundingRates };
