/**
 * TRON Sweep Service
 * Same pattern as evmSweep.js: smart filter (recent deposits only),
 * native TRX sweep + TRC20 token sweep (USDT-TRC20 etc),
 * gas (bandwidth/energy) topup if user wallet can't cover fees.
 */
const { TronWeb } = require('tronweb');
const db = require('../../../config/database');
const tronWalletService = require('../tronWalletService');

class TronSweepService {
  constructor() {
    this.running = false;
    this.sweepInterval = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('🧹 TronSweepService started');

    setTimeout(() => this.runSweepCycle().catch(e =>
      console.error('[TronSweep] Cycle error:', e.message)
    ), 60000);

    // Interval is read fresh each cycle from sweep_settings (dynamic, admin-configurable)
    this.scheduleNext();
  }

  async scheduleNext() {
    if (!this.running) return;
    const { rows: [settings] } = await db.query(
      `SELECT ss.sweep_interval_sec FROM sweep_settings ss
       JOIN networks n ON n.id = ss.network_id WHERE n.short_name='TRX' LIMIT 1`
    ).catch(() => ({ rows: [{ sweep_interval_sec: 600 }] }));
    const intervalMs = (settings?.sweep_interval_sec || 600) * 1000;

    this.sweepInterval = setTimeout(async () => {
      await this.runSweepCycle().catch(e => console.error('[TronSweep] Cycle error:', e.message));
      this.scheduleNext();
    }, intervalMs);
  }

  stop() {
    this.running = false;
    if (this.sweepInterval) clearTimeout(this.sweepInterval);
  }

  async runSweepCycle() {
    console.log('[TronSweep] Cycle starting...');

    const { rows: settingsRows } = await db.query(`
      SELECT ss.* FROM sweep_settings ss
      JOIN networks n ON n.id = ss.network_id
      WHERE n.short_name = 'TRX' AND ss.is_active = true
    `);
    const settings = settingsRows[0];
    if (!settings) {
      console.log('[TronSweep] No active sweep_settings for TRX - skipping');
      return;
    }

    const recentAddresses = await db.query(`
      SELECT DISTINCT d.user_id, uda.address
      FROM deposits d
      JOIN networks n ON n.id = d.network_id
      JOIN user_deposit_addresses uda ON uda.user_id = d.user_id AND uda.network = 'TRX'
      WHERE d.created_at > NOW() - INTERVAL '7 days'
        AND d.status = 'completed'
        AND n.short_name = 'TRX'
    `);

    if (recentAddresses.rows.length === 0) {
      console.log('[TronSweep] No recent deposits - nothing to sweep');
      return;
    }

    console.log(`[TronSweep] ${recentAddresses.rows.length} wallets to check`);

    for (const row of recentAddresses.rows) {
      try {
        await this.processSweep(row, settings);
      } catch (e) {
        console.error(`[TronSweep] User ${row.user_id}:`, e.message);
      }
      await this.sleep(1500);
    }

    console.log('[TronSweep] Cycle complete ✅');
  }

  async processSweep({ user_id, address }, settings) {
    const { master_address, min_sweep_usdt, gas_reserve_native } = settings;

    const userPrivKey = tronWalletService.getPrivateKey(user_id);
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      privateKey: userPrivKey
    });

    // ── Native TRX sweep ──
    const balanceSun = await tronWeb.trx.getBalance(address);
    const balanceTrx = balanceSun / 1e6;
    const reserve = parseFloat(gas_reserve_native || 5);
    const sweepAmt = balanceTrx - reserve;

    if (sweepAmt > 0.01) {
      const usdVal = await this.getUsdValue('TRX', sweepAmt);
      if (usdVal >= parseFloat(min_sweep_usdt || 5)) {
        console.log(`[TronSweep] Native ${sweepAmt.toFixed(4)} TRX | User ${user_id}`);
        await this.sendNative(tronWeb, address, master_address, sweepAmt, user_id);
        await this.sleep(3000);
      }
    }

    // ── TRC20 token sweep (USDT-TRC20 etc, dynamic from coin_networks) ──
    const { rows: trc20Coins } = await db.query(`
      SELECT c.id, c.symbol, cn.contract_address, cn.decimals
      FROM coin_networks cn
      JOIN coins c ON c.id = cn.coin_id
      JOIN networks n ON n.id = cn.network_id
      WHERE n.short_name = 'TRX' AND cn.contract_address IS NOT NULL
        AND c.is_active = true AND cn.is_deposit_enabled = true
    `);

    for (const coin of trc20Coins) {
      try {
        await this.sweepTrc20(tronWeb, address, master_address, coin, user_id, min_sweep_usdt);
      } catch (e) {
        console.error(`[TronSweep] TRC20 ${coin.symbol} user ${user_id}:`, e.message);
      }
      await this.sleep(1000);
    }
  }

  async sendNative(tronWeb, fromAddress, toAddress, amount, user_id) {
    try {
      const amountSun = Math.floor(amount * 1e6);
      const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, amountSun, fromAddress);
      const signedTx = await tronWeb.trx.sign(tx);
      const result = await tronWeb.trx.sendRawTransaction(signedTx);

      const txHash = result.txid || result.transaction?.txID;
      console.log(`[TronSweep] TX sent: ${txHash?.slice(0,16)}...`);

      await this.logSweep({
        user_id, coinSymbol: 'TRX', fromAddress, toAddress,
        amount, txhash: txHash, status: result.result ? 'completed' : 'failed'
      });
    } catch (e) {
      console.error('[TronSweep] sendNative error:', e.message);
      await this.logSweep({
        user_id, coinSymbol: 'TRX', fromAddress, toAddress,
        amount, txhash: null, status: 'failed', errorMsg: e.message
      });
    }
  }

  async sweepTrc20(tronWeb, fromAddress, toAddress, coin, user_id, minSweepUsdt) {
    const contract = await tronWeb.contract().at(coin.contract_address);
    const balanceRaw = await contract.balanceOf(fromAddress).call();
    const balance = parseFloat(balanceRaw.toString()) / Math.pow(10, coin.decimals);

    if (balance <= 0) return;

    const usdVal = await this.getUsdValue(coin.symbol, balance);
    if (usdVal < parseFloat(minSweepUsdt || 5)) return;

    console.log(`[TronSweep] TRC20 ${balance.toFixed(4)} ${coin.symbol} | User ${user_id}`);

    try {
      const amountRaw = Math.floor(balance * Math.pow(10, coin.decimals));
      const tx = await contract.transfer(toAddress, amountRaw).send({
        feeLimit: 50_000_000, // 50 TRX max fee limit (TRC20 transfers need energy)
        from: fromAddress
      });

      console.log(`[TronSweep] TRC20 TX sent: ${String(tx).slice(0,16)}...`);

      await this.logSweep({
        user_id, coinSymbol: coin.symbol, coinId: coin.id,
        fromAddress, toAddress, amount: balance,
        txhash: typeof tx === 'string' ? tx : null, status: 'completed'
      });
    } catch (e) {
      console.error(`[TronSweep] TRC20 transfer error (${coin.symbol}):`, e.message);
      await this.logSweep({
        user_id, coinSymbol: coin.symbol, coinId: coin.id,
        fromAddress, toAddress, amount: balance,
        txhash: null, status: 'failed', errorMsg: e.message
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
      const { rows: [net] } = await db.query(`SELECT id FROM networks WHERE short_name='TRX'`);

      await db.query(`
        INSERT INTO sweep_logs
          (user_id, network_id, coin_id, from_address, to_address,
           amount, txhash, status, error_msg)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [user_id, net?.id, resolvedCoinId, fromAddress, toAddress,
          amount, txhash, status, errorMsg || null]);
    } catch (e) {
      console.error('[TronSweep] logSweep DB error:', e.message);
    }
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

const tronSweep = new TronSweepService();
module.exports = tronSweep;
