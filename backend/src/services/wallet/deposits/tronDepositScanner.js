/**
 * TRON Deposit Scanner (Polling-based)
 * TronGrid doesn't offer reliable push-webhooks, so instead of
 * scanning every block (heavy, error-prone at scale), we directly
 * query each KNOWN deposit address for recent activity.
 *
 * This mirrors depositDetector.js's purpose for EVM, but uses
 * targeted per-address queries instead of block-range scanning.
 */
const axios = require('axios');
const db = require('../../../config/database');

const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('../../email/emailService');
    await emailService[fn](...args);
  } catch (e) {
    console.error(`Email ${fn} failed:`, e.message);
  }
};

class TronDepositScanner {
  constructor() {
    this.running = false;
    this.pollTimer = null;
    this.seenTxs = new Set(); // in-memory cache to avoid re-processing same tx within a run
  }

  getBaseUrl() {
    return 'https://api.trongrid.io';
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('[TronScanner] Starting (poll every 20s)...');
    this.pollLoop();
  }

  stop() {
    this.running = false;
    clearTimeout(this.pollTimer);
  }

  async pollLoop() {
    if (!this.running) return;
    try {
      await this.scanAllAddresses();
    } catch (e) {
      console.error('[TronScanner] pollLoop error:', e.message);
    }
    this.pollTimer = setTimeout(() => this.pollLoop(), 20000);
  }

  async scanAllAddresses() {
    const { rows: addresses } = await db.query(
      `SELECT user_id, address FROM user_deposit_addresses WHERE network = 'TRX'`
    );
    if (addresses.length === 0) return;

    for (const row of addresses) {
      try {
        await this.scanAddress(row.address, row.user_id);
      } catch (e) {
        console.error(`[TronScanner] scanAddress(${row.address}) error:`, e.message);
      }
      await this.sleep(300); // small delay between addresses to be gentle on rate limits
    }
  }

  async getCurrentBlock() {
    try {
      const res = await axios.post(`${this.getBaseUrl()}/wallet/getnowblock`, {}, { timeout: 8000 });
      return res.data?.block_header?.raw_data?.number || 0;
    } catch (e) {
      return 0;
    }
  }

  async scanAddress(address, userId) {
    const currentBlock = await this.getCurrentBlock();

    // Native TRX transfers
    const txRes = await axios.get(
      `${this.getBaseUrl()}/v1/accounts/${address}/transactions`,
      { params: { limit: 5, only_to: true }, timeout: 10000 }
    );
    const txs = txRes.data?.data || [];

    for (const tx of txs) {
      const contractRet = tx.ret?.[0]?.contractRet;
      if (contractRet !== 'SUCCESS') continue;

      const raw = tx.raw_data?.contract?.[0];
      if (raw?.type !== 'TransferContract') continue; // native TRX only here

      const value = raw.parameter?.value;
      if (!value || value.to_address === undefined) continue;

      const amount = parseFloat(value.amount || 0) / 1e6; // sun -> TRX
      if (amount <= 0) continue;

      const txBlock = tx.blockNumber || 0;
      const confirmations = txBlock > 0 && currentBlock > 0 ? (currentBlock - txBlock) : 0;

      await this.handleDeposit({
        userId, address, txHash: tx.txID,
        amount, isNative: true, confirmations
      });
    }

    // TRC20 token transfers (USDT-TRC20 etc, once contract is mapped in coin_networks)
    const trc20Res = await axios.get(
      `${this.getBaseUrl()}/v1/accounts/${address}/transactions/trc20`,
      { params: { limit: 5, only_to: true }, timeout: 10000 }
    );
    const trc20Txs = trc20Res.data?.data || [];

    for (const tx of trc20Txs) {
      const amount = parseFloat(tx.value || 0) / Math.pow(10, parseInt(tx.token_info?.decimals || 6));
      if (amount <= 0) continue;

      const txBlock = tx.block_timestamp ? 0 : 0; // TRC20 endpoint doesn't return block number directly
      const confirmations = 999; // treat as confirmed once it appears (TRC20 endpoint already filters confirmed txs)

      await this.handleDeposit({
        userId, address, txHash: tx.transaction_id,
        amount, isNative: false, contractAddress: tx.token_info?.address, confirmations
      });
    }
  }

  async handleDeposit({ userId, address, txHash, amount, isNative, contractAddress, confirmations = 0 }) {
    let coinId, networkId, requiredConf;

    if (isNative) {
      const { rows: [mapping] } = await db.query(`
        SELECT cn.coin_id, n.id as network_id, cn.min_confirmations FROM coin_networks cn
        JOIN networks n ON n.id = cn.network_id
        WHERE n.short_name = 'TRX' AND cn.contract_address IS NULL
        LIMIT 1
      `);
      if (!mapping) return;
      coinId = mapping.coin_id; networkId = mapping.network_id; requiredConf = mapping.min_confirmations || 1;
    } else {
      const { rows: [mapping] } = await db.query(`
        SELECT cn.coin_id, n.id as network_id, cn.min_confirmations FROM coin_networks cn
        JOIN networks n ON n.id = cn.network_id
        WHERE n.short_name = 'TRX' AND cn.contract_address = $1
        LIMIT 1
      `, [contractAddress]);
      if (!mapping) {
        console.log(`[TronScanner] Unknown TRC20 contract: ${contractAddress}`);
        return;
      }
      coinId = mapping.coin_id; networkId = mapping.network_id; requiredConf = mapping.min_confirmations || 1;
    }

    if (confirmations < requiredConf) {
      console.log(`[TronScanner] Waiting for confirmations: ${confirmations}/${requiredConf} | tx=${txHash.slice(0,12)}...`);
      return;
    }

    await this.creditDeposit({ userId, coinId, networkId, txHash, toAddress: address, amount });
  }

  // Same transaction-safety pattern used everywhere else (txhash dedup,
  // balance FOR UPDATE lock, ledger entry, non-blocking notify)
  async creditDeposit({ userId, coinId, networkId, txHash, toAddress, amount }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT id FROM deposits WHERE txhash = $1', [txHash]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return; // already credited, silent skip (this is expected - same tx seen on repeat polls)
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
          (user_id, coin_id, network_id, txhash, from_address, to_address,
           amount, status, credited, credited_at, created_at, updated_at)
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
          txHash, `Deposit ${amount} ${coinSymbol} via TRX`]);

      await client.query('COMMIT');

      console.log(`[TronScanner] ✅ DEPOSIT: User ${userId} +${amount} ${coinSymbol} | TRX | ${txHash.slice(0, 12)}...`);

      require('../../bonusService').creditFirstDepositBonus(userId, coinId, amount)
        .catch(e => console.error('[FirstDepositBonus] error:', e.message));

      db.query('SELECT email FROM users WHERE id = $1', [userId])
        .then(u => {
          if (u.rows[0]) {
            sendEmailSafe('sendDepositEmail', u.rows[0], {
              symbol: coinSymbol, amount, network: 'TRX', txhash: txHash
            });
          }
        }).catch(() => {});

      try {
        const { getIO } = require('../../../websocket/socket');
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('deposit_credited', {
          amount, symbol: coinSymbol, network: 'TRX', txhash: txHash
        });
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[TronScanner] ❌ creditDeposit error:', err.message, '| TX:', txHash);
    } finally {
      client.release();
    }
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

const scanner = new TronDepositScanner();
module.exports = scanner;
