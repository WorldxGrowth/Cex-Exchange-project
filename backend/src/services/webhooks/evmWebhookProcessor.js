const crypto = require('crypto');
const db = require('../../config/database');
const evmWebhookService = require('./evmWebhookService');

const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('../email/emailService');
    await emailService[fn](...args);
  } catch (e) {
    console.error(`Email ${fn} failed:`, e.message);
  }
};

class AlchemyWebhookProcessor {

  async processPayload(rawBody, signature) {
    try {
      let bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const payload = JSON.parse(bodyStr);

      if (payload.type !== 'ADDRESS_ACTIVITY') return { ok: true, ignored: true };

      const network = payload.event?.network;
      const ourNetwork = evmWebhookService.detectNetwork(network);
      if (!ourNetwork) {
        console.log(`[AlchemyWH] Unknown network: ${network}`);
        return { ok: true, ignored: true };
      }

      // ── Signature verify ──────────────────────
      // TODO: Re-enable after production testing
      // const config = evmWebhookService.getChainConfig(ourNetwork);
      // if (config?.signing_key) {
      //   const valid = evmWebhookService.verifySignature(bodyStr, signature, config.signing_key);
      //   if (!valid) {
      //     console.error(`[AlchemyWH] ❌ Invalid signature for ${ourNetwork}`);
      //     return { ok: false, error: 'Invalid signature' };
      //   }
      // }

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

      console.log(`[AlchemyWH] ✅ Processed ${processed}/${activities.length} | ${ourNetwork} | ${payload.id}`);
      return { ok: true, processed };

    } catch (e) {
      console.error('[AlchemyWH] processPayload error:', e.message);
      return { ok: false, error: e.message };
    }
  }

  async processActivity(activity, network) {
    const toAddress = activity.toAddress?.toLowerCase();
    const txHash    = activity.hash;
    const category  = activity.category;
    const asset     = activity.asset;

    if (!toAddress || !txHash) return;

    const userRow = await db.query(
      `SELECT user_id FROM user_deposit_addresses
       WHERE LOWER(address) = $1 AND network = $2`,
      [toAddress, network]
    );
    if (!userRow.rows[0]) return;

    const userId = userRow.rows[0].user_id;
    let coinId, amount;

    // Native coins: BNB, ETH, VDC
    if (category === 'external' || asset === 'BNB' || asset === 'ETH' || asset === 'VDC') {
      const nativeCoin = await db.query(`
        SELECT c.id FROM coins c
        JOIN networks n ON n.id = c.network_id
        WHERE n.short_name = $1 AND c.contract_address IS NULL AND c.is_active = true
        LIMIT 1
      `, [network]);
      if (!nativeCoin.rows[0]) {
        console.log(`[AlchemyWH] Native coin not found for ${network}`);
        return;
      }
      coinId = nativeCoin.rows[0].id;
      amount = parseFloat(activity.value || 0);

    } else if (category === 'token' && activity.rawContract?.address) {
      // ERC20 tokens
      const contractAddr = activity.rawContract.address.toLowerCase();
      const tokenCoin = await db.query(`
        SELECT c.id FROM coins c
        JOIN networks n ON n.id = c.network_id
        WHERE n.short_name = $1
          AND LOWER(c.contract_address) = $2
          AND c.is_active = true
        LIMIT 1
      `, [network, contractAddr]);
      if (!tokenCoin.rows[0]) {
        console.log(`[AlchemyWH] Unknown token: ${contractAddr} on ${network}`);
        return;
      }
      coinId = tokenCoin.rows[0].id;
      amount = parseFloat(activity.value || 0);
    } else {
      return;
    }

    if (!amount || amount <= 0) return;

    const netRow = await db.query(
      'SELECT id FROM networks WHERE short_name = $1', [network]
    );
    if (!netRow.rows[0]) return;

    await this.creditDeposit({
      userId, coinId, networkId: netRow.rows[0].id,
      network, txHash,
      fromAddress: activity.fromAddress,
      toAddress: activity.toAddress,
      amount
    });
  }

  async creditDeposit({ userId, coinId, networkId, network, txHash,
                        fromAddress, toAddress, amount }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT id FROM deposits WHERE txhash = $1', [txHash]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log(`[AlchemyWH] Duplicate skipped: ${txHash.slice(0,12)}...`);
        return;
      }

      const balRow = await client.query(`
        SELECT available FROM balances
        WHERE user_id = $1 AND coin_id = $2 AND account_type = 'spot'
        FOR UPDATE
      `, [userId, coinId]);
      const balBefore = parseFloat(balRow.rows[0]?.available || 0);

      const coinRow = await client.query('SELECT symbol FROM coins WHERE id = $1', [coinId]);
      const coinSymbol = coinRow.rows[0]?.symbol || '?';

      await client.query(`
        INSERT INTO deposits
          (user_id, coin_id, network_id, txhash, from_address,
           to_address, amount, status, credited, credited_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',true,NOW(),NOW(),NOW())
      `, [userId, coinId, networkId, txHash, fromAddress, toAddress, amount]);

      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1,$2,'spot',$3,0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [userId, coinId, amount]);

      await client.query(`
        INSERT INTO ledger (user_id, coin_id, type, amount, balance_before, balance_after,
           reference_id, description)
        VALUES ($1,$2,'deposit',$3,$4,$5,$6,$7)
      `, [userId, coinId, amount, balBefore, balBefore + amount,
          txHash, `Deposit ${amount} ${coinSymbol} via ${network}`]);

      await client.query('COMMIT');

      console.log(`[AlchemyWH] ✅ DEPOSIT: User ${userId} +${amount} ${coinSymbol} | ${network} | ${txHash.slice(0,12)}...`);

      // First-deposit bonus check (non-blocking, safe on every deposit -
      // internally verifies this was genuinely the user's first one)
      require('../bonusService').creditFirstDepositBonus(userId, coinId, amount)
        .catch(e => console.error('[FirstDepositBonus] error:', e.message));

      db.query('SELECT email FROM users WHERE id = $1', [userId])
        .then(u => {
          if (u.rows[0]) {
            sendEmailSafe('sendDepositEmail', u.rows[0], {
              symbol: coinSymbol, amount, network, txhash: txHash
            });
          }
        }).catch(() => {});

      try {
        const { getIO } = require('../../websocket/socket');
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('deposit_credited', {
          amount, symbol: coinSymbol, network, txhash: txHash
        });
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[AlchemyWH] ❌ creditDeposit error:', err.message, '| TX:', txHash);
    } finally {
      client.release();
    }
  }
}

const evmWebhookProcessor = new AlchemyWebhookProcessor();
module.exports = evmWebhookProcessor;
