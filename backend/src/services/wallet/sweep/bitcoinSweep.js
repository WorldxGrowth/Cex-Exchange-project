/**
 * Bitcoin Sweep Service (UTXO consolidation)
 * Unlike account-balance chains, Bitcoin addresses hold a SET
 * of "unspent transaction outputs" (UTXOs) - like separate cash
 * notes, not a single balance number. Sweeping means:
 * 1. Fetch all UTXOs for the address (via BlockCypher)
 * 2. Combine them all as inputs into ONE transaction
 * 3. Send (sum - network fee) to the master address
 * 4. Sign with the user's derived private key, broadcast
 */
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');
const db = require('../../../config/database');
const bitcoinWalletService = require('../bitcoinWalletService');

const ECPair = ECPairFactory(ecc);
const BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN;
const NETWORK = bitcoin.networks.bitcoin;

class BitcoinSweepService {
  constructor() {
    this.running = false;
    this.sweepInterval = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('🧹 BitcoinSweepService started');

    setTimeout(() => this.runSweepCycle().catch(e =>
      console.error('[BitcoinSweep] Cycle error:', e.message)
    ), 60000);

    this.scheduleNext();
  }

  async scheduleNext() {
    if (!this.running) return;
    const { rows: [settings] } = await db.query(
      `SELECT ss.sweep_interval_sec FROM sweep_settings ss
       JOIN networks n ON n.id = ss.network_id WHERE n.short_name='BTC' LIMIT 1`
    ).catch(() => ({ rows: [{ sweep_interval_sec: 900 }] }));
    const intervalMs = (settings?.sweep_interval_sec || 900) * 1000;

    this.sweepInterval = setTimeout(async () => {
      await this.runSweepCycle().catch(e => console.error('[BitcoinSweep] Cycle error:', e.message));
      this.scheduleNext();
    }, intervalMs);
  }

  stop() {
    this.running = false;
    if (this.sweepInterval) clearTimeout(this.sweepInterval);
  }

  async runSweepCycle() {
    console.log('[BitcoinSweep] Cycle starting...');

    const { rows: settingsRows } = await db.query(`
      SELECT ss.* FROM sweep_settings ss
      JOIN networks n ON n.id = ss.network_id
      WHERE n.short_name = 'BTC' AND ss.is_active = true
    `);
    const settings = settingsRows[0];
    if (!settings) {
      console.log('[BitcoinSweep] No active sweep_settings for BTC - skipping');
      return;
    }

    // Bitcoin needs confirmed deposits only (longer window since confirmations take time)
    const recentAddresses = await db.query(`
      SELECT DISTINCT d.user_id, uda.address
      FROM deposits d
      JOIN networks n ON n.id = d.network_id
      JOIN user_deposit_addresses uda ON uda.user_id = d.user_id AND uda.network = 'BTC'
      WHERE d.created_at > NOW() - INTERVAL '14 days'
        AND d.status = 'completed'
        AND n.short_name = 'BTC'
    `);

    if (recentAddresses.rows.length === 0) {
      console.log('[BitcoinSweep] No recent deposits - nothing to sweep');
      return;
    }

    console.log(`[BitcoinSweep] ${recentAddresses.rows.length} wallets to check`);

    for (const row of recentAddresses.rows) {
      try {
        await this.processSweep(row, settings);
      } catch (e) {
        console.error(`[BitcoinSweep] User ${row.user_id}:`, e.message);
      }
      await this.sleep(2000); // BlockCypher free tier rate-limit friendly
    }

    console.log('[BitcoinSweep] Cycle complete ✅');
  }

  async getUtxos(address) {
    const res = await axios.get(
      `https://api.blockcypher.com/v1/btc/main/addrs/${address}?unspentOnly=true&includeScript=true&token=${BLOCKCYPHER_TOKEN}`,
      { timeout: 15000 }
    );
    return res.data?.txrefs || [];
  }

  async getFeeRate() {
    try {
      const res = await axios.get(
        `https://api.blockcypher.com/v1/btc/main?token=${BLOCKCYPHER_TOKEN}`,
        { timeout: 10000 }
      );
      // medium_fee_per_kb is in satoshis per KB
      return Math.ceil((res.data?.medium_fee_per_kb || 20000) / 1000); // sat/byte estimate
    } catch (e) {
      return 20; // fallback: 20 sat/byte
    }
  }

  async processSweep({ user_id, address }, settings) {
    const { master_address, min_sweep_usdt } = settings;

    const utxos = await this.getUtxos(address);
    if (!utxos || utxos.length === 0) return;

    const totalSats = utxos.reduce((sum, u) => sum + (u.value || 0), 0);
    const totalBtc = totalSats / 1e8;

    if (totalBtc <= 0.00001) return;

    const usdVal = await this.getUsdValue('BTC', totalBtc);
    if (usdVal < parseFloat(min_sweep_usdt || 10)) return;

    console.log(`[BitcoinSweep] ${totalBtc.toFixed(8)} BTC from ${utxos.length} UTXOs | User ${user_id}`);

    try {
      const userPrivKeyWIF = bitcoinWalletService.getPrivateKey(user_id);
      const keyPair = ECPair.fromWIF(userPrivKeyWIF, NETWORK);

      const feeRateSatPerByte = await this.getFeeRate();
      // Rough size estimate: ~68 bytes per input (P2WPKH) + ~31 bytes per output + 10 overhead
      const estimatedSize = (utxos.length * 68) + 31 + 10;
      const estimatedFee = estimatedSize * feeRateSatPerByte;

      const sendAmountSats = totalSats - estimatedFee;
      if (sendAmountSats <= 0) {
        console.log(`[BitcoinSweep] Fee (${estimatedFee} sats) exceeds balance - skipping User ${user_id}`);
        return;
      }

      const psbt = new bitcoin.Psbt({ network: NETWORK });

      for (const utxo of utxos) {
        psbt.addInput({
          hash: utxo.tx_hash,
          index: utxo.tx_output_n,
          witnessUtxo: {
            script: Buffer.from(utxo.script, 'hex'),
            value: BigInt(utxo.value)
          }
        });
      }

      psbt.addOutput({ address: master_address, value: BigInt(sendAmountSats) });

      for (let i = 0; i < utxos.length; i++) {
        psbt.signInput(i, keyPair);
      }
      psbt.finalizeAllInputs();

      const txHex = psbt.extractTransaction().toHex();
      const broadcastRes = await axios.post(
        `https://api.blockcypher.com/v1/btc/main/txs/push?token=${BLOCKCYPHER_TOKEN}`,
        { tx: txHex },
        { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
      );

      const txHash = broadcastRes.data?.tx?.hash;
      console.log(`[BitcoinSweep] TX broadcast: ${txHash?.slice(0,16)}...`);

      await this.logSweep({
        user_id, fromAddress: address, toAddress: master_address,
        amount: sendAmountSats / 1e8, txhash: txHash, status: 'pending'
      });

    } catch (e) {
      console.error('[BitcoinSweep] sweep error:', e.response?.data || e.message);
      await this.logSweep({
        user_id, fromAddress: address, toAddress: master_address,
        amount: totalBtc, txhash: null, status: 'failed',
        errorMsg: e.response?.data?.error || e.message
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

  async logSweep({ user_id, fromAddress, toAddress, amount, txhash, status, errorMsg }) {
    try {
      const { rows: [coin] } = await db.query(`SELECT id FROM coins WHERE symbol='BTC'`);
      const { rows: [net] } = await db.query(`SELECT id FROM networks WHERE short_name='BTC'`);

      await db.query(`
        INSERT INTO sweep_logs
          (user_id, network_id, coin_id, from_address, to_address,
           amount, txhash, status, error_msg)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [user_id, net?.id, coin?.id, fromAddress, toAddress,
          amount, txhash, status, errorMsg || null]);
    } catch (e) {
      console.error('[BitcoinSweep] logSweep DB error:', e.message);
    }
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

const bitcoinSweep = new BitcoinSweepService();
module.exports = bitcoinSweep;
