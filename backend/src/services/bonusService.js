/**
 * Bonus Service — shared helpers for signup/KYC/first-deposit bonuses.
 * All settings read dynamically from system_settings (DB) every time,
 * so admin can enable/disable or change amounts anytime, no deploy needed.
 *
 * Called from: auth.controller.js (signup), admin.controller.js (KYC
 * approve), and every chain's deposit-credit path (EVM webhook, Solana
 * webhook, Bitcoin webhook, TRON scanner) for first-deposit bonus.
 */
const db = require('../config/database');

async function getSetting(key) {
  const row = await db.query(`SELECT value FROM system_settings WHERE key=$1`, [key]);
  return row.rows[0]?.value;
}

// ── Shared credit logic (balance + ledger entry, same safety pattern
//    used everywhere else in this codebase: balance row lock, ledger entry) ──
async function creditBonus(userId, coinId, amount, description) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const balRow = await client.query(`
      SELECT available FROM balances
      WHERE user_id=$1 AND coin_id=$2 AND account_type='spot' FOR UPDATE
    `, [userId, coinId]);
    const balBefore = parseFloat(balRow.rows[0]?.available || 0);

    await client.query(`
      INSERT INTO balances (user_id, coin_id, account_type, available, locked)
      VALUES ($1,$2,'spot',$3,0)
      ON CONFLICT (user_id, coin_id, account_type)
      DO UPDATE SET available = balances.available + $3, updated_at = NOW()
    `, [userId, coinId, amount]);

    await client.query(`
      INSERT INTO ledger (user_id, coin_id, type, amount, balance_before, balance_after, description)
      VALUES ($1,$2,'bonus',$3,$4,$5,$6)
    `, [userId, coinId, amount, balBefore, balBefore + amount, description]);

    await client.query('COMMIT');
    console.log(`[Bonus] ✅ ${description} -> user ${userId}: +${amount}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Bonus] creditBonus error:', err.message);
  } finally {
    client.release();
  }
}

// ── First Deposit Bonus ──────────────────────────
// Call this from EVERY chain's deposit-credit path, right after a
// deposit is marked 'completed'. Safe to call on every deposit -
// internally checks if this was genuinely the user's FIRST ever
// completed deposit before doing anything.
async function creditFirstDepositBonus(userId, coinId, depositAmount) {
  try {
    const enabled = await getSetting('first_deposit_bonus_enabled');
    if (enabled !== 'true') return;

    // Was this genuinely the user's first completed deposit (across ALL
    // coins/chains)? If more than 1 completed deposit exists, this isn't it.
    const countRow = await db.query(
      `SELECT COUNT(*) FROM deposits WHERE user_id=$1 AND status='completed'`,
      [userId]
    );
    if (parseInt(countRow.rows[0].count) !== 1) return; // not the first deposit

    const minUsdt = parseFloat(await getSetting('first_deposit_bonus_min_usdt') || 0);
    const percent = parseFloat(await getSetting('first_deposit_bonus_percent') || 0);
    const maxUsdt = parseFloat(await getSetting('first_deposit_bonus_max_usdt') || 0);
    if (percent <= 0) return;

    // Convert deposit amount to USDT value for the threshold/cap checks
    // (deposit could be in any coin - BTC, SOL, etc, not just USDT)
    const priceRow = await db.query(
      `SELECT price_usdt FROM price_feeds WHERE coin_id=$1`, [coinId]
    );
    const priceUsdt = parseFloat(priceRow.rows[0]?.price_usdt || 1);
    const depositUsdtValue = depositAmount * priceUsdt;

    if (depositUsdtValue < minUsdt) return; // below minimum threshold, no bonus

    let bonusUsdt = depositUsdtValue * (percent / 100);
    if (maxUsdt > 0 && bonusUsdt > maxUsdt) bonusUsdt = maxUsdt;
    if (bonusUsdt <= 0) return;

    const usdtCoinRow = await db.query(`SELECT id FROM coins WHERE symbol='USDT' LIMIT 1`);
    const usdtCoinId = usdtCoinRow.rows[0]?.id;
    if (!usdtCoinId) { console.error('[FirstDepositBonus] USDT coin not found'); return; }

    await creditBonus(userId, usdtCoinId, bonusUsdt,
      `First deposit bonus: ${bonusUsdt.toFixed(4)} USDT (${percent}% of $${depositUsdtValue.toFixed(2)})`);
  } catch (err) {
    console.error('[FirstDepositBonus] error:', err.message);
  }
}

module.exports = { creditBonus, creditFirstDepositBonus, getSetting };
