/**
 * Solana Sweep Service
 * Same pattern as tronSweep.js: smart filter, native SOL sweep
 * + SPL token sweep (USDC-SPL etc).
 * Key difference: Solana uses "rent-exempt minimum balance"
 * instead of a flat gas reserve - sweeping below that minimum
 * would mark the account for garbage collection.
 */
const {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const db = require('../../../config/database');
const solanaWalletService = require('../solanaWalletService');

const RENT_EXEMPT_MINIMUM_SOL = 0.00089088; // standard Solana account rent-exempt minimum

class SolanaSweepService {
  constructor() {
    this.running = false;
    this.sweepInterval = null;
    this.connection = new Connection(
      process.env.HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('🧹 SolanaSweepService started');

    setTimeout(() => this.runSweepCycle().catch(e =>
      console.error('[SolanaSweep] Cycle error:', e.message)
    ), 60000);

    this.scheduleNext();
  }

  async scheduleNext() {
    if (!this.running) return;
    const { rows: [settings] } = await db.query(
      `SELECT ss.sweep_interval_sec FROM sweep_settings ss
       JOIN networks n ON n.id = ss.network_id WHERE n.short_name='SOL' LIMIT 1`
    ).catch(() => ({ rows: [{ sweep_interval_sec: 300 }] }));
    const intervalMs = (settings?.sweep_interval_sec || 300) * 1000;

    this.sweepInterval = setTimeout(async () => {
      await this.runSweepCycle().catch(e => console.error('[SolanaSweep] Cycle error:', e.message));
      this.scheduleNext();
    }, intervalMs);
  }

  stop() {
    this.running = false;
    if (this.sweepInterval) clearTimeout(this.sweepInterval);
  }

  async runSweepCycle() {
    console.log('[SolanaSweep] Cycle starting...');

    const { rows: settingsRows } = await db.query(`
      SELECT ss.* FROM sweep_settings ss
      JOIN networks n ON n.id = ss.network_id
      WHERE n.short_name = 'SOL' AND ss.is_active = true
    `);
    const settings = settingsRows[0];
    if (!settings) {
      console.log('[SolanaSweep] No active sweep_settings for SOL - skipping');
      return;
    }

    const recentAddresses = await db.query(`
      SELECT DISTINCT d.user_id, uda.address
      FROM deposits d
      JOIN networks n ON n.id = d.network_id
      JOIN user_deposit_addresses uda ON uda.user_id = d.user_id AND uda.network = 'SOL'
      WHERE d.created_at > NOW() - INTERVAL '7 days'
        AND d.status = 'completed'
        AND n.short_name = 'SOL'
    `);

    if (recentAddresses.rows.length === 0) {
      console.log('[SolanaSweep] No recent deposits - nothing to sweep');
      return;
    }

    console.log(`[SolanaSweep] ${recentAddresses.rows.length} wallets to check`);

    for (const row of recentAddresses.rows) {
      try {
        await this.processSweep(row, settings);
      } catch (e) {
        console.error(`[SolanaSweep] User ${row.user_id}:`, e.message);
      }
      await this.sleep(1500);
    }

    console.log('[SolanaSweep] Cycle complete ✅');
  }

  async processSweep({ user_id, address }, settings) {
    const { master_address, min_sweep_usdt, gas_reserve_native } = settings;

    const userKeypair = solanaWalletService.deriveAddress(user_id);
    const keypairObj = this.toKeypair(userKeypair.privateKey);

    // ── Native SOL sweep ──
    const balanceLamports = await this.connection.getBalance(new PublicKey(address));
    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
    const reserve = Math.max(parseFloat(gas_reserve_native || 0.01), RENT_EXEMPT_MINIMUM_SOL);
    const sweepAmt = balanceSol - reserve;

    if (sweepAmt > 0.001) {
      const usdVal = await this.getUsdValue('SOL', sweepAmt);
      if (usdVal >= parseFloat(min_sweep_usdt || 1)) {
        console.log(`[SolanaSweep] Native ${sweepAmt.toFixed(4)} SOL | User ${user_id}`);
        await this.sendNative(keypairObj, address, master_address, sweepAmt, user_id);
        await this.sleep(2000);
      }
    }

    // ── SPL token sweep (dynamic from coin_networks) ──
    const { rows: splCoins } = await db.query(`
      SELECT c.id, c.symbol, cn.contract_address as mint_address, cn.decimals
      FROM coin_networks cn
      JOIN coins c ON c.id = cn.coin_id
      JOIN networks n ON n.id = cn.network_id
      WHERE n.short_name = 'SOL' AND cn.contract_address IS NOT NULL
        AND c.is_active = true AND cn.is_deposit_enabled = true
    `);

    for (const coin of splCoins) {
      try {
        await this.sweepSplToken(keypairObj, address, master_address, coin, user_id, min_sweep_usdt);
      } catch (e) {
        console.error(`[SolanaSweep] SPL ${coin.symbol} user ${user_id}:`, e.message);
      }
      await this.sleep(1000);
    }
  }

  toKeypair(privateKeyHex) {
    const { Keypair: KP } = require('@solana/web3.js');
    return KP.fromSecretKey(Buffer.from(privateKeyHex, 'hex'));
  }

  async sendNative(fromKeypair, fromAddress, toAddress, amount, user_id) {
    try {
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(fromAddress),
          toPubkey: new PublicKey(toAddress),
          lamports
        })
      );

      const txHash = await sendAndConfirmTransaction(this.connection, tx, [fromKeypair]);
      console.log(`[SolanaSweep] TX sent: ${txHash.slice(0,16)}...`);

      await this.logSweep({
        user_id, coinSymbol: 'SOL', fromAddress, toAddress,
        amount, txhash: txHash, status: 'completed'
      });
    } catch (e) {
      console.error('[SolanaSweep] sendNative error:', e.message);
      await this.logSweep({
        user_id, coinSymbol: 'SOL', fromAddress, toAddress,
        amount, txhash: null, status: 'failed', errorMsg: e.message
      });
    }
  }

  async sweepSplToken(fromKeypair, fromAddress, toAddress, coin, user_id, minSweepUsdt) {
    const {
      getAssociatedTokenAddress, getAccount, createTransferInstruction,
      TOKEN_PROGRAM_ID
    } = require('@solana/spl-token');

    const mintPubkey = new PublicKey(coin.mint_address);
    const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, new PublicKey(fromAddress));

    let accountInfo;
    try {
      accountInfo = await getAccount(this.connection, fromTokenAccount);
    } catch (e) {
      return; // no token account = no balance, skip silently
    }

    const balance = Number(accountInfo.amount) / Math.pow(10, coin.decimals);
    if (balance <= 0) return;

    const usdVal = await this.getUsdValue(coin.symbol, balance);
    if (usdVal < parseFloat(minSweepUsdt || 1)) return;

    console.log(`[SolanaSweep] SPL ${balance.toFixed(4)} ${coin.symbol} | User ${user_id}`);

    try {
      const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, new PublicKey(toAddress));
      const tx = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount, toTokenAccount, new PublicKey(fromAddress),
          Math.floor(balance * Math.pow(10, coin.decimals)), [], TOKEN_PROGRAM_ID
        )
      );

      const txHash = await sendAndConfirmTransaction(this.connection, tx, [fromKeypair]);
      console.log(`[SolanaSweep] SPL TX sent: ${txHash.slice(0,16)}...`);

      await this.logSweep({
        user_id, coinSymbol: coin.symbol, coinId: coin.id,
        fromAddress, toAddress, amount: balance, txhash: txHash, status: 'completed'
      });
    } catch (e) {
      console.error(`[SolanaSweep] SPL transfer error (${coin.symbol}):`, e.message);
      await this.logSweep({
        user_id, coinSymbol: coin.symbol, coinId: coin.id,
        fromAddress, toAddress, amount: balance, txhash: null, status: 'failed', errorMsg: e.message
      });
    }
  }

  async getUsdValue(symbol, amount) {
    try {
      const res = await db.query(
        `SELECT pf.price_usdt FROM price_feeds pf
         JOIN coins c ON c.id = pf.coin_id WHERE c.symbol = $1`, [symbol]
      );
      return parseFloat(res.rows[0]?.price_usdt || 1) * amount;
    } catch { return 0; }
  }

  async logSweep({ user_id, coinSymbol, coinId, fromAddress, toAddress, amount, txhash, status, errorMsg }) {
    try {
      let resolvedCoinId = coinId;
      if (!resolvedCoinId) {
        const { rows: [c] } = await db.query('SELECT id FROM coins WHERE symbol=$1', [coinSymbol]);
        resolvedCoinId = c?.id;
      }
      const { rows: [net] } = await db.query(`SELECT id FROM networks WHERE short_name='SOL'`);

      await db.query(`
        INSERT INTO sweep_logs
          (user_id, network_id, coin_id, from_address, to_address,
           amount, txhash, status, error_msg)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [user_id, net?.id, resolvedCoinId, fromAddress, toAddress,
          amount, txhash, status, errorMsg || null]);
    } catch (e) {
      console.error('[SolanaSweep] logSweep DB error:', e.message);
    }
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

const solanaSweep = new SolanaSweepService();
module.exports = solanaSweep;
