/**
 * Solana Webhook Processor (Helius)
 * Receives "Enhanced Webhook" payloads from Helius when SOL/SPL-token
 * activity happens on any monitored address.
 *
 * Flow: Helius detects activity -> POST to our endpoint -> we mark
 * the deposit as 'pending' -> separate verifier confirms via RPC ->
 * status becomes 'completed' and balance is credited.
 *
 * For now (Phase 1): credit directly on webhook receipt, matching the
 * existing EVM pattern (alchemyWebhook.js) which also credits directly.
 * Pending-then-verify upgrade is a planned next phase for ALL chains
 * (including EVM), not unique to Solana - noted as pending work.
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

class SolanaWebhookProcessor {

  async processPayload(payload) {
    try {
      // Helius sends an array of enhanced transaction objects
      const events = Array.isArray(payload) ? payload : [payload];
      let processed = 0;

      for (const event of events) {
        try {
          await this.processEvent(event);
          processed++;
        } catch (e) {
          console.error('[SolanaWH] Event error:', e.message);
        }
      }

      console.log(`[SolanaWH] ✅ Processed ${processed}/${events.length}`);
      return { ok: true, processed };

    } catch (e) {
      console.error('[SolanaWH] processPayload error:', e.message);
      return { ok: false, error: e.message };
    }
  }

  async processEvent(event) {
    const txHash = event.signature;
    if (!txHash) return;

    // Native SOL transfers appear in nativeTransfers[]
    // SPL token transfers appear in tokenTransfers[]
    const nativeTransfers = event.nativeTransfers || [];
    const tokenTransfers  = event.tokenTransfers  || [];

    for (const transfer of nativeTransfers) {
      await this.handleTransfer({
        toAddress: transfer.toUserAccount,
        amount: (transfer.amount || 0) / 1e9, // lamports -> SOL
        isNative: true,
        txHash
      });
    }

    for (const transfer of tokenTransfers) {
      await this.handleTransfer({
        toAddress: transfer.toUserAccount,
        amount: parseFloat(transfer.tokenAmount || 0),
        isNative: false,
        mintAddress: transfer.mint,
        txHash
      });
    }
  }

  async handleTransfer({ toAddress, amount, isNative, mintAddress, txHash }) {
    if (!toAddress || !amount || amount <= 0) return;

    const userRow = await db.query(
      `SELECT user_id FROM user_deposit_addresses WHERE address = $1 AND network = 'SOL'`,
      [toAddress]
    );
    if (!userRow.rows[0]) return; // not one of our addresses

    const userId = userRow.rows[0].user_id;

    let coinId;
    if (isNative) {
      const { rows: [coin] } = await db.query(`
        SELECT cn.coin_id FROM coin_networks cn
        JOIN networks n ON n.id = cn.network_id
        WHERE n.short_name = 'SOL' AND cn.contract_address IS NULL
        LIMIT 1
      `);
      if (!coin) { console.log('[SolanaWH] Native SOL coin mapping not found'); return; }
      coinId = coin.coin_id;
    } else {
      const { rows: [coin] } = await db.query(`
        SELECT cn.coin_id FROM coin_networks cn
        JOIN networks n ON n.id = cn.network_id
        WHERE n.short_name = 'SOL' AND cn.contract_address = $1
        LIMIT 1
      `, [mintAddress]);
      if (!coin) { console.log(`[SolanaWH] Unknown SPL token mint: ${mintAddress}`); return; }
      coinId = coin.coin_id;
    }

    const { rows: [networkRow] } = await db.query(`SELECT id FROM networks WHERE short_name='SOL'`);

    await this.creditDeposit({
      userId, coinId, networkId: networkRow.id,
      txHash, toAddress, amount
    });
  }

  // Same transaction-safety pattern as alchemyWebhook.js / depositDetector.js:
  // txhash dedup, balance FOR UPDATE lock, ledger entry, non-blocking notify
  async creditDeposit({ userId, coinId, networkId, txHash, toAddress, amount }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT id FROM deposits WHERE txhash = $1', [txHash]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log(`[SolanaWH] Duplicate skipped: ${txHash.slice(0, 12)}...`);
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
      `, [userId, coinId, networkId, txHash, null, toAddress, amount]);

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
          txHash, `Deposit ${amount} ${coinSymbol} via SOL`]);

      await client.query('COMMIT');

      console.log(`[SolanaWH] ✅ DEPOSIT: User ${userId} +${amount} ${coinSymbol} | SOL | ${txHash.slice(0, 12)}...`);

      db.query('SELECT email FROM users WHERE id = $1', [userId])
        .then(u => {
          if (u.rows[0]) {
            sendEmailSafe('sendDepositEmail', u.rows[0], {
              symbol: coinSymbol, amount, network: 'SOL', txhash: txHash
            });
          }
        }).catch(() => {});

      try {
        const { getIO } = require('../../websocket/socket');
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('deposit_credited', {
          amount, symbol: coinSymbol, network: 'SOL', txhash: txHash
        });
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[SolanaWH] ❌ creditDeposit error:', err.message, '| TX:', txHash);
    } finally {
      client.release();
    }
  }
}

const processor = new SolanaWebhookProcessor();
module.exports = processor;
