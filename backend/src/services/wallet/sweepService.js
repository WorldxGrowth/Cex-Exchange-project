const { ethers } = require('ethers');
const db = require('../../config/database');
const hdWallet = require('./hdWallet');

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

class SweepService {
  constructor() {
    this.running = false;
    this.sweepInterval = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('🧹 SweepService started');

    // First run after 60s
    setTimeout(() => this.runSweepCycle().catch(e =>
      console.error('[Sweep] Cycle error:', e.message)
    ), 60000);

    // Every 5 min
    this.sweepInterval = setInterval(() => {
      this.runSweepCycle().catch(e =>
        console.error('[Sweep] Cycle error:', e.message)
      );
    }, 5 * 60 * 1000);
  }

  stop() {
    this.running = false;
    if (this.sweepInterval) clearInterval(this.sweepInterval);
  }

  // ─────────────────────────────────────────────────
  // MAIN CYCLE
  // Smart: sirf recent deposit wale users ko sweep karo
  // ─────────────────────────────────────────────────
  async runSweepCycle() {
    console.log('[Sweep] Cycle starting...');

    // Step 1: Last 48hr mein deposit aaye users + networks
    const recentDeposits = await db.query(`
      SELECT DISTINCT
        d.user_id,
        d.network_id,
        uw.address,
        n.rpc_url,
        n.short_name,
        ss.master_address,
        ss.min_sweep_usdt,
        ss.gas_reserve_native
      FROM deposits d
      JOIN user_wallets uw ON uw.user_id = d.user_id AND uw.network_id = d.network_id
      JOIN networks n ON n.id = d.network_id
      JOIN sweep_settings ss ON ss.network_id = d.network_id
      WHERE d.created_at > NOW() - INTERVAL '48 hours'
        AND d.status = 'completed'
        AND ss.is_active = true
        AND n.is_active = true
        AND n.rpc_url IS NOT NULL
      ORDER BY d.user_id
    `);

    if (recentDeposits.rows.length === 0) {
      console.log('[Sweep] No recent deposits - nothing to sweep');
      return;
    }

    console.log(`[Sweep] ${recentDeposits.rows.length} wallets to check`);

    // Step 2: Har wallet sweep karo
    for (const row of recentDeposits.rows) {
      try {
        await this.processSweep(row);
      } catch (e) {
        console.error(`[Sweep] User ${row.user_id} ${row.short_name}:`, e.message);
      }
      await this.sleep(1000); // 1s delay between wallets
    }

    console.log('[Sweep] Cycle complete ✅');
  }

  // ─────────────────────────────────────────────────
  // PROCESS ONE WALLET
  // ─────────────────────────────────────────────────
  async processSweep(row) {
    const { user_id, network_id, address, rpc_url, short_name,
            master_address, min_sweep_usdt, gas_reserve_native } = row;

    const provider = new ethers.providers.JsonRpcProvider(rpc_url);
    const masterPrivKey = process.env.MASTER_SWEEP_PRIVATE_KEY
                       || process.env.WITHDRAW_WALLET_PRIVATE_KEY;

    if (!masterPrivKey) {
      console.error('[Sweep] No master private key in .env!');
      return;
    }

    const masterSigner = new ethers.Wallet(masterPrivKey, provider);
    const userPrivKey  = hdWallet.getPrivateKey(user_id);
    const userSigner   = new ethers.Wallet(userPrivKey, provider);

    // Coins for this network
    const coins = await db.query(`
      SELECT id, symbol, contract_address, decimals
      FROM coins
      WHERE network_id = $1 AND is_active = true AND is_deposit = true
    `, [network_id]);

    for (const coin of coins.rows) {
      try {
        const isNative = !coin.contract_address;

        if (isNative) {
          // ── Native coin sweep (BNB / ETH / VDC)
          const bal = await provider.getBalance(address);
          const balFloat = parseFloat(ethers.utils.formatEther(bal));
          const reserve  = parseFloat(gas_reserve_native || 0.002);
          const sweepAmt = balFloat - reserve;

          if (sweepAmt < 0.00001) {
            continue;
          }

          const usdVal = await this.getUsdValue(coin.id, sweepAmt);
          if (usdVal < parseFloat(min_sweep_usdt || 2)) {
            continue;
          }

          console.log(`[Sweep][${short_name}] Native ${sweepAmt} ${coin.symbol} | User ${user_id}`);
          await this.sendNative({
            provider, signer: userSigner, to: master_address,
            amount: sweepAmt, coin, user_id, network_id
          });

        } else {
          // ── ERC20 token sweep (USDT / USDC etc)
          const contract  = new ethers.Contract(coin.contract_address, ERC20_ABI, provider);
          const bal       = await contract.balanceOf(address);
          const balFloat  = parseFloat(ethers.utils.formatUnits(bal, coin.decimals));

          if (balFloat < 0.001) continue;

          const usdVal = await this.getUsdValue(coin.id, balFloat);
          if (usdVal < parseFloat(min_sweep_usdt || 2)) continue;

          // Gas check — user ke wallet mein native coin hai?
          const nativeBal   = await provider.getBalance(address);
          const nativeFloat = parseFloat(ethers.utils.formatEther(nativeBal));
          const reserve     = parseFloat(gas_reserve_native || 0.002);

          if (nativeFloat < reserve) {
            // Gas topup karo master se
            console.log(`[Sweep][${short_name}] Gas topup → User ${user_id} (${address})`);
            await this.sendNative({
              provider, signer: masterSigner, to: address,
              amount: reserve, coin: { id: null, symbol: 'GAS' },
              user_id, network_id, isTopup: true
            });
            await this.sleep(8000); // TX confirm hone do
          }

          console.log(`[Sweep][${short_name}] ERC20 ${balFloat} ${coin.symbol} | User ${user_id}`);
          await this.sendERC20({
            provider, signer: userSigner,
            contractAddr: coin.contract_address,
            to: master_address, balance: bal,
            coin, user_id, network_id, address
          });
        }
      } catch (e) {
        console.error(`[Sweep] ${coin.symbol} user ${user_id}:`, e.message);
      }
      await this.sleep(500);
    }
  }

  // ─────────────────────────────────────────────────
  // SEND NATIVE (BNB/ETH/VDC)
  // ─────────────────────────────────────────────────
  async sendNative({ provider, signer, to, amount, coin, user_id, network_id, isTopup }) {
    try {
      const gasPrice = await provider.getGasPrice();
      let value;

      if (isTopup) {
        value = ethers.utils.parseEther(amount.toFixed(18));
      } else {
        // Gas cost minus karke bhejo
        const gasCost = gasPrice.mul(21000);
        value = ethers.utils.parseEther(amount.toFixed(18)).sub(gasCost);
        if (value.lte(0)) return;
      }

      const tx = await signer.sendTransaction({
        to,
        value,
        gasLimit: 21000,
        gasPrice: gasPrice.mul(110).div(100)
      });

      console.log(`[Sweep] TX sent: ${tx.hash.slice(0,16)}...`);

      if (!isTopup && coin.id) {
        await this.logSweep({
          user_id, network_id, coin_id: coin.id,
          fromAddress: signer.address, toAddress: to,
          amount, txhash: tx.hash, status: 'pending'
        });
      } else {
        await db.query(`
          INSERT INTO gas_topup_logs
            (user_id, network_id, to_address, amount, txhash, status)
          VALUES ($1,$2,$3,$4,$5,'pending')
        `, [user_id, network_id, to, amount, tx.hash]).catch(() => {});
      }

      // Confirm async
      tx.wait(1).then(() => {
        if (!isTopup && coin.id) {
          db.query('UPDATE sweep_logs SET status=$1 WHERE txhash=$2',
            ['completed', tx.hash]).catch(() => {});
          console.log(`✅ [Sweep] ${amount} ${coin.symbol} swept!`);
        } else {
          db.query('UPDATE gas_topup_logs SET status=$1 WHERE txhash=$2',
            ['completed', tx.hash]).catch(() => {});
          console.log(`✅ [GasTopup] Done`);
        }
      }).catch(() => {
        db.query('UPDATE sweep_logs SET status=$1 WHERE txhash=$2',
          ['failed', tx.hash]).catch(() => {});
      });

    } catch (e) {
      console.error('[sendNative] error:', e.message);
      if (!isTopup && coin.id) {
        await this.logSweep({
          user_id, network_id, coin_id: coin.id,
          fromAddress: signer.address, toAddress: to,
          amount, txhash: null, status: 'failed', errorMsg: e.message
        });
      }
    }
  }

  // ─────────────────────────────────────────────────
  // SEND ERC20
  // ─────────────────────────────────────────────────
  async sendERC20({ provider, signer, contractAddr, to, balance, coin, user_id, network_id, address }) {
    try {
      const contract  = new ethers.Contract(contractAddr, ERC20_ABI, signer);
      const gasPrice  = await provider.getGasPrice();
      const tx = await contract.transfer(to, balance, {
        gasLimit: 100000,
        gasPrice: gasPrice.mul(110).div(100)
      });

      const amount = parseFloat(ethers.utils.formatUnits(balance, coin.decimals));
      console.log(`[Sweep][ERC20] TX: ${tx.hash.slice(0,16)}...`);

      await this.logSweep({
        user_id, network_id, coin_id: coin.id,
        fromAddress: address, toAddress: to,
        amount, txhash: tx.hash, status: 'pending'
      });

      tx.wait(1).then(() => {
        db.query('UPDATE sweep_logs SET status=$1 WHERE txhash=$2',
          ['completed', tx.hash]).catch(() => {});
        console.log(`✅ [Sweep][ERC20] ${amount} ${coin.symbol} swept!`);
      }).catch(() => {
        db.query('UPDATE sweep_logs SET status=$1 WHERE txhash=$2',
          ['failed', tx.hash]).catch(() => {});
      });

    } catch (e) {
      const amount = parseFloat(ethers.utils.formatUnits(balance, coin.decimals));
      console.error('[sendERC20] error:', e.message);
      await this.logSweep({
        user_id, network_id, coin_id: coin.id,
        fromAddress: address, toAddress: to,
        amount, txhash: null, status: 'failed', errorMsg: e.message
      });
    }
  }

  // ─────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────
  async getUsdValue(coinId, amount) {
    try {
      const res = await db.query(
        'SELECT price_usdt FROM price_feeds WHERE coin_id = $1', [coinId]
      );
      return parseFloat(res.rows[0]?.price_usdt || 1) * amount;
    } catch { return 0; }
  }

  async logSweep({ user_id, network_id, coin_id, fromAddress, toAddress,
                   amount, txhash, status, errorMsg }) {
    try {
      await db.query(`
        INSERT INTO sweep_logs
          (user_id, network_id, coin_id, from_address, to_address,
           amount, txhash, status, error_msg)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [user_id, network_id, coin_id, fromAddress, toAddress,
          amount, txhash, status, errorMsg || null]);
    } catch (e) {
      console.error('logSweep DB error:', e.message);
    }
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

const sweepService = new SweepService();
module.exports = sweepService;
