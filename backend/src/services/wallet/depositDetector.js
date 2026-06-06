const { ethers } = require('ethers');
const db = require('../../config/database');

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)'
];

const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('../email/emailService');
    await emailService[fn](...args);
  } catch (e) {
    console.error(`Email ${fn} failed:`, e.message);
  }
};

class DepositDetector {
  constructor() {
    this.providers = {};
    this.running = false;
    this.addressMap = {};
    this.coinMap = {};
    this.networkMap = {};
  }

  async init() {
    try {
      const networks = await db.query('SELECT * FROM networks WHERE is_active = true');
      for (const net of networks.rows) {
        if (!net.rpc_url) continue;
        this.networkMap[net.id] = net;
        try {
          this.providers[net.short_name] = {
            provider: new ethers.providers.JsonRpcProvider(net.rpc_url),
            networkId: net.id,
            shortName: net.short_name
          };
        } catch (e) {
          console.error(`Provider init failed for ${net.short_name}`);
        }
      }

      const coins = await db.query(`
        SELECT c.*, n.short_name as network_name
        FROM coins c
        JOIN networks n ON n.id = c.network_id
        WHERE c.is_deposit = true AND c.is_active = true
      `);

      for (const coin of coins.rows) {
        if (!this.coinMap[coin.network_id]) this.coinMap[coin.network_id] = [];
        this.coinMap[coin.network_id].push({
          coinId: coin.id,
          symbol: coin.symbol,
          contractAddr: coin.contract_address,
          decimals: coin.decimals,
          confirmations: coin.confirmations || 3,
          isNative: !coin.contract_address
        });
      }

      await this.loadAddresses();

      console.log('✅ DepositDetector initialized');
      console.log(`📍 Monitoring ${Object.keys(this.addressMap).length} addresses`);
      console.log(`🌐 Networks: ${Object.keys(this.providers).join(', ')}`);
    } catch (err) {
      console.error('DepositDetector init error:', err.message);
    }
  }

  async loadAddresses() {
    try {
      const result = await db.query(
        'SELECT address, user_id, network FROM user_deposit_addresses'
      );
      this.addressMap = {};
      result.rows.forEach(row => {
        this.addressMap[row.address.toLowerCase()] = {
          userId: row.user_id,
          network: row.network
        };
      });
    } catch (err) {
      console.error('loadAddresses error:', err.message);
    }
  }

  async getLastBlock(network) {
    try {
      const res = await db.query(
        'SELECT last_block FROM scanner_state WHERE network = $1', [network]
      );
      return parseInt(res.rows[0]?.last_block || 0);
    } catch { return 0; }
  }

  async saveLastBlock(network, blockNum) {
    try {
      await db.query(`
        INSERT INTO scanner_state (network, last_block, last_scan_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (network) DO UPDATE
        SET last_block = $2, last_scan_at = NOW()
      `, [network, blockNum]);
    } catch (err) {
      console.error('saveLastBlock error:', err.message);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log('🔍 Deposit Scanner started');

    // Per-network intervals: BSC=1hr (Alchemy backup), ETH/VDCHAIN=5min
    const SCAN_INTERVALS = { BSC: 3600000, ETH: 300000, VDCHAIN: 300000 };
    this.networkTimers = {};
    for (const key of Object.keys(this.providers)) {
      const ms = SCAN_INTERVALS[key] || 300000;
      this.networkTimers[key] = setInterval(async () => {
        this.scanNetwork(key).catch(e =>
          console.error(`[${key}] scan error:`, e.message)
        );
      }, ms);
      console.log(`[${key}] scan interval: ${ms/60000} min`);
    }

    this.reloadInterval = setInterval(() => this.loadAddresses(), 5 * 60 * 1000);

    setTimeout(() => {
      for (const key of Object.keys(this.providers)) {
        this.scanNetwork(key).catch(() => {});
      }
    }, 5000);
  }

  stop() {
    this.running = false;
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.networkTimers) {
      Object.values(this.networkTimers).forEach(t => clearInterval(t));
    }
    if (this.reloadInterval) clearInterval(this.reloadInterval);
  }

  async scanNetwork(networkKey) {
    const netObj = this.providers[networkKey];
    if (!netObj) return;

    const { provider, networkId, shortName } = netObj;

    try {
      const currentBlock = await provider.getBlockNumber();
      let lastBlock = await this.getLastBlock(shortName);

      if (lastBlock === 0) {
        await this.saveLastBlock(shortName, currentBlock);
        return;
      }

      if (lastBlock >= currentBlock) return;

      const fromBlock = lastBlock + 1;
      const toBlock = Math.min(fromBlock + 10, currentBlock);

      const coins = this.coinMap[networkId] || [];
      if (coins.length === 0) {
        await this.saveLastBlock(shortName, toBlock);
        return;
      }

      console.log(`[${shortName}] Scanning ${fromBlock}→${toBlock}`);

      const nativeCoins = coins.filter(c => c.isNative);
      if (nativeCoins.length > 0) {
        await this.scanNative(provider, networkId, shortName, fromBlock, toBlock, nativeCoins);
      }

      const erc20Coins = coins.filter(c => !c.isNative && c.contractAddr);
      for (const coin of erc20Coins) {
        await this.scanERC20(provider, networkId, shortName, fromBlock, toBlock, coin);
      }

      await this.saveLastBlock(shortName, toBlock);

    } catch (err) {
      console.error(`[${networkKey}] scanNetwork error:`, err.message);
    }
  }

  async scanNative(provider, networkId, shortName, fromBlock, toBlock, nativeCoins) {
    try {
      for (let b = fromBlock; b <= toBlock; b++) {
        const block = await provider.getBlockWithTransactions(b);
        if (!block?.transactions) continue;

        for (const tx of block.transactions) {
          if (!tx.to) continue;
          const toAddr = tx.to.toLowerCase();
          if (!this.addressMap[toAddr]) continue;

          const amount = parseFloat(ethers.utils.formatEther(tx.value));
          if (amount < 0.00001) continue;

          const coin = nativeCoins[0];
          await this.creditDeposit({
            networkId, shortName,
            txHash: tx.hash,
            fromAddress: tx.from,
            toAddress: tx.to,
            amount,
            coinId: coin.coinId,
            coinSymbol: coin.symbol,
            userId: this.addressMap[toAddr].userId
          });
        }
      }
    } catch (err) {
      console.error(`[${shortName}] native scan error:`, err.message);
    }
  }

  async scanERC20(provider, networkId, shortName, fromBlock, toBlock, coin) {
    try {
      const contract = new ethers.Contract(coin.contractAddr, ERC20_ABI, provider);
      const events = await contract.queryFilter(
        contract.filters.Transfer(), fromBlock, toBlock
      );

      for (const event of events) {
        const toAddr = event.args.to.toLowerCase();
        if (!this.addressMap[toAddr]) continue;

        const amount = parseFloat(
          ethers.utils.formatUnits(event.args.value, coin.decimals)
        );
        if (amount < 0.01) continue;

        await this.creditDeposit({
          networkId, shortName,
          txHash: event.transactionHash,
          fromAddress: event.args.from,
          toAddress: event.args.to,
          amount,
          coinId: coin.coinId,
          coinSymbol: coin.symbol,
          userId: this.addressMap[toAddr].userId
        });
      }
    } catch (err) {
      if (err.message && err.message.includes('limit exceeded')) {
        console.log(`[${shortName}] ERC20 rate limited - will retry next cycle`);
      } else {
        console.error(`[${shortName}] ERC20 ${coin.symbol} scan error:`, err.message);
      }
    }
  }

  // ── creditDeposit - SAME as alchemyWebhook ────
  async creditDeposit({ networkId, shortName, txHash, fromAddress,
                        toAddress, amount, coinId, coinSymbol, userId }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Duplicate check - txhash UNIQUE index
      const existing = await client.query(
        'SELECT id FROM deposits WHERE txhash = $1', [txHash]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log(`[Scanner] Duplicate tx skipped: ${txHash}`);
        return;
      }

      // Balance row lock (double-spend safe)
      const balRow = await client.query(`
        SELECT available FROM balances
        WHERE user_id = $1 AND coin_id = $2 AND account_type = 'spot'
        FOR UPDATE
      `, [userId, coinId]);
      const balBefore = parseFloat(balRow.rows[0]?.available || 0);

      // Insert deposit - full columns
      await client.query(`
        INSERT INTO deposits
          (user_id, coin_id, network_id, txhash, from_address,
           to_address, amount, status, credited, credited_at,
           created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',true,NOW(),NOW(),NOW())
      `, [userId, coinId, networkId, txHash, fromAddress, toAddress, amount]);

      // Update balance
      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1,$2,'spot',$3,0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [userId, coinId, amount]);

      // Ledger entry
      await client.query(`
        INSERT INTO ledger
          (user_id, coin_id, type, amount, balance_before, balance_after,
           reference_id, description)
        VALUES ($1,$2,'deposit',$3,$4,$5,$6,$7)
      `, [userId, coinId, amount, balBefore, balBefore + amount,
          txHash, `Deposit ${amount} ${coinSymbol} via ${shortName}`]);

      await client.query('COMMIT');

      console.log(`✅ DEPOSIT: User ${userId} | +${amount} ${coinSymbol} | ${shortName} | TX: ${txHash.slice(0,12)}...`);

      // Deposit email - safe async
      db.query('SELECT email FROM users WHERE id = $1', [userId])
        .then(u => {
          if (u.rows[0]) {
            sendEmailSafe('sendDepositEmail', u.rows[0], {
              symbol: coinSymbol, amount,
              network: shortName, txhash: txHash
            });
          }
        }).catch(() => {});

      // WebSocket notify
      try {
        const { getIO } = require('../../websocket/socket');
        const io = getIO();
        if (io) {
          io.to(`user:${userId}`).emit('deposit_credited', {
            amount, symbol: coinSymbol,
            network: shortName, txhash: txHash
          });
        }
      } catch (e) {}

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('creditDeposit error:', err.message, 'TX:', txHash);
    } finally {
      client.release();
    }
  }
}

const detector = new DepositDetector();
module.exports = detector;
