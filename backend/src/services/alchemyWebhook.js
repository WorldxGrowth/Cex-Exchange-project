const crypto = require('crypto');
const db = require('../config/database');
const alchemyService = require('./alchemyService');

// Email helper
const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('./email/emailService');
    await emailService[fn](...args);
  } catch (e) {
    console.error(`Email ${fn} failed:`, e.message);
  }
};

class AlchemyWebhookProcessor {

  // ── Main processor ─────────────────────────────
  async processPayload(rawBody, signature) {
    try {
      const payload = JSON.parse(rawBody);

      // Validate type
      if (payload.type !== 'ADDRESS_ACTIVITY') {
        console.log(`[AlchemyWH] Ignored type: ${payload.type}`);
        return { ok: true, ignored: true };
      }

      const network = payload.event?.network;
      const ourNetwork = alchemyService.detectNetwork(network);

      if (!ourNetwork) {
        console.log(`[AlchemyWH] Unknown network: ${network}`);
        return { ok: true, ignored: true };
      }

      // ── Signature verify ──────────────────────
      const config = alchemyService.getChainConfig(ourNetwork);
      if (config?.signing_key) {
        const valid = alchemyService.verifySignature(rawBody, signature, config.signing_key);
        if (!valid) {
          console.error(`[AlchemyWH] ❌ Invalid signature for ${ourNetwork}`);
          return { ok: false, error: 'Invalid signature' };
        }
      }

      console.log(`[AlchemyWH] Processing ${ourNetwork} webhook: ${payload.id}`);

      // ── Process each activity ─────────────────
      const activities = payload.event?.activity || [];
      let processed = 0;

      for (const activity of activities) {
        try {
          await this.processActivity(activity, ourNetwork);
          processed++;
        } catch (e) {
          console.error(`[AlchemyWH] Activity error:`, e.message);
        }
      }

      console.log(`[AlchemyWH] ✅ Processed ${processed}/${activities.length} activities`);
      return { ok: true, processed };

    } catch (e) {
      console.error('[AlchemyWH] processPayload error:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // ── Process one activity ───────────────────────
  async processActivity(activity, network) {
    const toAddress   = activity.toAddress?.toLowerCase();
    const fromAddress = activity.fromAddress?.toLowerCase();
    const txHash      = activity.hash;
    const category    = activity.category; // 'external', 'token', 'internal'

    if (!toAddress || !txHash) return;

    // Check if toAddress is our user deposit address
    const userRow = await db.query(
      `SELECT user_id, address FROM user_deposit_addresses
       WHERE LOWER(address) = $1 AND network = $2`,
      [toAddress, network]
    );

    if (!userRow.rows[0]) return; // Not our address

    const userId = userRow.rows[0].user_id;

    // ── Determine coin ────────────────────────────
    let coinId, amount, decimals;

    if (category === 'external' || activity.asset === 'ETH' || activity.asset === 'BNB') {
      // Native coin deposit
      const nativeCoin = await db.query(`
        SELECT c.id, c.decimals FROM coins c
        JOIN networks n ON n.id = c.network_id
        WHERE n.short_name = $1 AND c.contract_address IS NULL AND c.is_active = true
        LIMIT 1
      `, [network]);

      if (!nativeCoin.rows[0]) return;
      coinId   = nativeCoin.rows[0].id;
      decimals = nativeCoin.rows[0].decimals || 18;
      amount   = parseFloat(activity.value || 0);

    } else if (category === 'token' && activity.rawContract?.address) {
      // ERC20 token deposit
      const contractAddr = activity.rawContract.address.toLowerCase();
      const tokenCoin = await db.query(`
        SELECT c.id, c.decimals FROM coins c
        JOIN networks n ON n.id = c.network_id
        WHERE n.short_name = $1
          AND LOWER(c.contract_address) = $2
          AND c.is_active = true
        LIMIT 1
      `, [network, contractAddr]);

      if (!tokenCoin.rows[0]) {
        console.log(`[AlchemyWH] Unknown token contract: ${contractAddr} on ${network}`);
        return;
      }

      coinId   = tokenCoin.rows[0].id;
      decimals = activity.rawContract.decimals || tokenCoin.rows[0].decimals || 18;
      amount   = parseFloat(activity.value || 0);
    } else {
      return; // Skip unknown category
    }

    if (!amount || amount <= 0) return;

    // ── Network ID ────────────────────────────────
    const netRow = await db.query(
      'SELECT id FROM networks WHERE short_name = $1', [network]
    );
    if (!netRow.rows[0]) return;
    const networkId = netRow.rows[0].id;

    // ── Credit deposit (atomic) ───────────────────
    await this.creditDeposit({
      userId, coinId, networkId, network,
      txHash, fromAddress: activity.fromAddress,
      toAddress: activity.toAddress,
      amount
    });
  }

  // ── Credit deposit to user ─────────────────────
  async creditDeposit({ userId, coinId, networkId, network, txHash,
                         fromAddress, toAddress, amount }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Duplicate check - txhash unique
      const existing = await client.query(
        'SELECT id FROM deposits WHERE txhash = $1', [txHash]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log(`[AlchemyWH] Duplicate tx skipped: ${txHash}`);
        return;
      }

      // Balance lock
      const balRow = await client.query(`
        SELECT available FROM balances
        WHERE user_id = $1 AND coin_id = $2 AND account_type = 'spot'
        FOR UPDATE
      `, [userId, coinId]);
      const balBefore = parseFloat(balRow.rows[0]?.available || 0);

      // Coin symbol for log
      const coinRow = await client.query(
        'SELECT symbol FROM coins WHERE id = $1', [coinId]
      );
      const coinSymbol = coinRow.rows[0]?.symbol || '?';

      // Insert deposit
      await client.query(`
        INSERT INTO deposits
          (user_id, coin_id, network_id, txhash, from_address,
           to_address, amount, status, credited, credited_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',true,NOW(),NOW(),NOW())
      `, [userId, coinId, networkId, txHash, fromAddress, toAddress, amount]);

      // Update balance
      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1,$2,'spot',$3,0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [userId, coinId, amount]);

      // Ledger
      await client.query(`
        INSERT INTO ledger
          (user_id, coin_id, type, amount, balance_before, balance_after,
           reference_id, description)
        VALUES ($1,$2,'deposit',$3,$4,$5,$6,$7)
      `, [userId, coinId, amount, balBefore, balBefore + amount,
          txHash, `Alchemy Deposit ${amount} ${coinSymbol} via ${network}`]);

      await client.query('COMMIT');

      console.log(`[AlchemyWH] ✅ DEPOSIT: User ${userId} +${amount} ${coinSymbol} | ${network} | TX: ${txHash.slice(0,12)}...`);

      // Email async
      db.query('SELECT email FROM users WHERE id = $1', [userId])
        .then(u => {
          if (u.rows[0]) {
            sendEmailSafe('sendDepositEmail', u.rows[0], {
              symbol: coinSymbol, amount, network, txhash: txHash
            });
          }
        }).catch(() => {});

      // WebSocket notify
      try {
        const { getIO } = require('../websocket/socket');
        const io = getIO();
        if (io) {
          io.to(`user:${userId}`).emit('deposit_credited', {
            amount, symbol: coinSymbol, network, txhash: txHash
          });
        }
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[AlchemyWH] creditDeposit error:', err.message, 'TX:', txHash);
    } finally {
      client.release();
    }
  }
}

const processor = new AlchemyWebhookProcessor();
module.exports = processor;
