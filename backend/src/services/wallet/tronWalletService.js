/**
 * TRON Wallet Service
 * Path: m/44'/195'/0'/0/{userId}  (Trust Wallet standard for TRON)
 * Uses same MASTER_MNEMONIC, different curve-application (still secp256k1
 * but Base58Check address encoding, not 0x-hex like EVM)
 */
const { ethers } = require('ethers');
const { TronWeb } = require('tronweb');
const db = require('../../config/database');

class TronWalletService {
  constructor() {
    this.mnemonic = process.env.MASTER_MNEMONIC;
    if (!this.mnemonic) throw new Error('MASTER_MNEMONIC not set in .env!');
    // Use ethers HDNode with TRON's coin_type=195 path
    this.masterNode = ethers.utils.HDNode.fromMnemonic(this.mnemonic);
  }

  // Derive TRON address for a user
  deriveAddress(userIndex) {
    const path = `m/44'/195'/0'/0/${userIndex}`;
    const child = this.masterNode.derivePath(path);
    // child.privateKey is a standard secp256k1 key (0x-prefixed hex)
    // TronWeb converts this into a Base58Check 'T...' address
    const privateKeyHex = child.privateKey.replace('0x', '');
    const address = TronWeb.address.fromPrivateKey(privateKeyHex);
    return {
      address,
      privateKey: privateKeyHex,
      path
    };
  }

  getPrivateKey(userIndex) {
    return this.deriveAddress(userIndex).privateKey;
  }

  async getOrCreateDepositAddress(userId, networkShortName = 'TRX') {
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
      console.error('[TronWallet] getOrCreateDepositAddress error:', err.message);
      throw err;
    }
  }

  getMasterAddress() {
    const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
    return this.deriveAddress(masterIndex).address;
  }
}

const tronWallet = new TronWalletService();
module.exports = tronWallet;
