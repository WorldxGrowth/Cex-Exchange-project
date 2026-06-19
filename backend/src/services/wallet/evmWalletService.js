/**
 * EVM Wallet Service
 * Handles ALL EVM-compatible chains: BSC, Ethereum, Polygon, VDChain
 * Same address format (0x...), same signing (ethers.js HD derivation)
 * Path: m/44'/60'/0'/0/{userId}  (Trust Wallet / BIP44 standard)
 */
const { ethers } = require('ethers');
const db = require('../../config/database');

class EvmWalletService {
  constructor() {
    this.mnemonic = process.env.MASTER_MNEMONIC;
    if (!this.mnemonic) throw new Error('MASTER_MNEMONIC not set in .env!');
    this.masterNode = ethers.utils.HDNode.fromMnemonic(this.mnemonic);
  }

  // Derive address for a user — SAME address across all EVM chains
  // (BSC address === Ethereum address === VDChain address for same user)
  deriveAddress(userIndex) {
    const path = `m/44'/60'/0'/0/${userIndex}`;
    const child = this.masterNode.derivePath(path);
    return {
      address: child.address,
      privateKey: child.privateKey,
      path
    };
  }

  getPrivateKey(userIndex) {
    return this.deriveAddress(userIndex).privateKey;
  }

  // Get or create deposit address for user on a specific EVM network
  async getOrCreateDepositAddress(userId, networkShortName) {
    try {
      const existing = await db.query(
        'SELECT address FROM user_deposit_addresses WHERE user_id = $1 AND network = $2',
        [userId, networkShortName]
      );
      if (existing.rows[0]) return existing.rows[0].address;

      const { address } = this.deriveAddress(userId);

      await db.query(`
        INSERT INTO user_deposit_addresses (user_id, network, address, wallet_index)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, network) DO UPDATE SET address = $3
      `, [userId, networkShortName, address, userId]);

      return address;
    } catch (err) {
      console.error('[EvmWallet] getOrCreateDepositAddress error:', err.message);
      throw err;
    }
  }

  getMasterAddress() {
    const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
    return this.deriveAddress(masterIndex).address;
  }
}

const evmWallet = new EvmWalletService();
module.exports = evmWallet;
