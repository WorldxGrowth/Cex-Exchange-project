/**
 * Bitcoin Webhook Processor (BlockCypher)
 * BlockCypher fires the same event MULTIPLE times for one transaction
 * as confirmations increase (0-conf -> 1-conf -> 2-conf...).
 * We only credit the deposit once confirmations >= coin_networks.min_confirmations.
 * Until then, we just log/update the pending record (no credit yet).
 */
const db = require('../../config/database');

const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('../email/emailService');
    await emailService[fn](...args);
  } catch (e) {
    console.error(`Email ${fn} failed:`, e.message);
  }
};

class BitcoinWebhookProcessor {

  async processPayload(payload) {
    try {
      const txHash       = payload.hash;
      const confirmations = payload.confirmations || 0;
      const outputs       = payload.outputs || [];

      if (!txHash) return { ok: true, ignored: true };

      let processed = 0;
      for (const output of outputs) {
        const addresses = output.addresses || [];
        const amountSats = output.value || 0;
        if (amountSats <= 0) continue;

        for (const address of addresses) {
          try {
            await this.handleOutput({ address, amountSats, txHash, confirmations });
            processed++;
          } catch (e) {
            console.error('[BitcoinWH] Output error:', e.message);
          }
        }
      }

      console.log(`[BitcoinWH] Processed ${processed} outputs | tx=${txHash.slice(0,12)}... | conf=${confirmations}`);
      return { ok: true, processed };

    } catch (e) {
      console.error('[BitcoinWH] processPayload error:', e.message);
      return { ok: false, error: e.message };
    }
  }

  async handleOutput({ address, amountSats, txHash, confirmations }) {
    const userRow = await db.query(
      `SELECT user_id FROM user_deposit_addresses WHERE address = $1 AND network = 'BTC'`,
      [address]
    );
    if (!userRow.rows[0]) return; // not our address
    const userId = userRow.rows[0].user_id;

    const { rows: [mapping] } = await db.query(`
      SELECT cn.coin_id, cn.min_confirmations, n.id as network_id
      FROM coin_networks cn
      JOIN networks n ON n.id = cn.network_id
      WHERE n.short_name = 'BTC' AND cn.contract_address IS NULL
      LIMIT 1
    `);
    if (!mapping) { console.log('[BitcoinWH] BTC coin mapping not found'); return; }

    const amount = amountSats / 1e8; // satoshis -> BTC
    const requiredConf = mapping.min_confirmations || 2;

    // Always upsert a 'pending' record so we can see deposits in progress
    await db.query(`
      INSERT INTO deposits
        (user_id, coin_id, network_id, txhash, from_address, to_address,
         amount, status, credited, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',false,NOW(),NOW())
      ON CONFLICT (txhash) DO UPDATE SET updated_at = NOW()
    `, [userId, mapping.coin_id, mapping.network_id, txHash, null, address, amount])
      .catch(() => {}); // ignore if txhash unique constraint differs - handled below too

    if (confirmations < requiredConf) {
      console.log(`[BitcoinWH] Waiting for confirmations: ${confirmations}/${requiredConf} | tx=${txHash.slice(0,12)}...`);
      return;
    }

    // Enough confirmations - credit now (idempotent via deposits.credited flag)
    await this.creditDeposit({
      userId, coinId: mapping.coin_id, networkId: mapping.network_id,
      txHash, toAddress: address, amount
    });
  }

  async creditDeposit({ userId, coinId, networkId, txHash, toAddress, amount }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id, credited FROM deposits WHERE txhash = $1 FOR UPDATE`, [txHash]
      );
      if (existing.rows[0]?.credited) {
        await client.query('ROLLBACK');
        console.log(`[BitcoinWH] Already credited, skipping: ${txHash.slice(0,12)}...`);
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

      if (existing.rows[0]) {
        await client.query(
          `UPDATE deposits SET status='completed', credited=true, credited_at=NOW(), updated_at=NOW() WHERE txhash=$1`,
          [txHash]
        );
      } else {
        await client.query(`
          INSERT INTO deposits
            (user_id, coin_id, network_id, txhash, from_address, to_address,
             amount, status, credited, credited_at, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',true,NOW(),NOW(),NOW())
        `, [userId, coinId, networkId, txHash, null, toAddress, amount]);
      }

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
          txHash, `Deposit ${amount} ${coinSymbol} via BTC`]);

      await client.query('COMMIT');

      console.log(`[BitcoinWH] ✅ DEPOSIT CONFIRMED: User ${userId} +${amount} ${coinSymbol} | BTC | ${txHash.slice(0,12)}...`);

      require('../bonusService').creditFirstDepositBonus(userId, coinId, amount)
        .catch(e => console.error('[FirstDepositBonus] error:', e.message));

      db.query('SELECT email FROM users WHERE id = $1', [userId])
        .then(u => {
          if (u.rows[0]) {
            sendEmailSafe('sendDepositEmail', u.rows[0], {
              symbol: coinSymbol, amount, network: 'BTC', txhash: txHash
            });
          }
        }).catch(() => {});

      try {
        const { getIO } = require('../../websocket/socket');
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('deposit_credited', {
          amount, symbol: coinSymbol, network: 'BTC', txhash: txHash
        });
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[BitcoinWH] ❌ creditDeposit error:', err.message, '| TX:', txHash);
    } finally {
      client.release();
    }
  }
}

const processor = new BitcoinWebhookProcessor();
module.exports = processor;
