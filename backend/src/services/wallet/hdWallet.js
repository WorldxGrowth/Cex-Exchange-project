const { ethers } = require('ethers');
const bip39 = require('bip39');
const db = require('../../config/database');

// HD Wallet Service - Market Standard BIP44
// Path: m/44'/60'/0'/0/{index}

class HDWalletService {

  constructor() {
    this.mnemonic = process.env.MASTER_MNEMONIC;
    if (!this.mnemonic) throw new Error('MASTER_MNEMONIC not set in .env!');
    this.masterNode = ethers.utils.HDNode.fromMnemonic(this.mnemonic);
  }

  // Derive address for user
  deriveAddress(userIndex) {
    const path = `m/44'/60'/0'/0/${userIndex}`;
    const child = this.masterNode.derivePath(path);
    return {
      address: child.address,
      privateKey: child.privateKey,
      path
    };
  }

  // Get or create deposit address for user
  async getOrCreateDepositAddress(userId, network = 'BSC') {
    try {
      // Check if already exists
      const existing = await db.query(
        'SELECT address FROM user_deposit_addresses WHERE user_id = $1 AND network = $2',
        [userId, network]
      );

      if (existing.rows[0]) return existing.rows[0].address;

      // Create new address
      const { address } = this.deriveAddress(userId);

      await db.query(`
        INSERT INTO user_deposit_addresses (user_id, network, address, wallet_index)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, network) DO UPDATE SET address = $3
      `, [userId, network, address, userId]);

      return address;
    } catch (err) {
      console.error('getOrCreateDepositAddress error:', err.message);
      throw err;
    }
  }

  // Get private key for sweeping
  getPrivateKey(userIndex) {
    return this.deriveAddress(userIndex).privateKey;
  }

  // Master wallet address (for sweeping funds to)
  getMasterAddress() {
    const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
    return this.deriveAddress(masterIndex).address;
  }
}

// Singleton
const hdWallet = new HDWalletService();
module.exports = hdWallet;
