/**
 * Bitcoin Wallet Service
 * Path: m/84'/0'/0'/0/{userId}  (BIP84 - Native SegWit, bc1... addresses)
 * UTXO model - fundamentally different from EVM/TRON account-balance model
 */
const { BIP32Factory } = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const bip39 = require('bip39');
const db = require('../../config/database');

const bip32 = BIP32Factory(ecc);

class BitcoinWalletService {
  constructor() {
    this.mnemonic = process.env.MASTER_MNEMONIC;
    if (!this.mnemonic) throw new Error('MASTER_MNEMONIC not set in .env!');
    this.seed = bip39.mnemonicToSeedSync(this.mnemonic);
    this.root = bip32.fromSeed(this.seed);
    this.network = bitcoin.networks.bitcoin; // mainnet
  }

  // Derive Native SegWit (bc1...) address for a user
  deriveAddress(userIndex) {
    const path = `m/84'/0'/0'/0/${userIndex}`;
    const child = this.root.derivePath(path);
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: this.network
    });
    return {
      address,
      privateKey: child.toWIF(), // WIF format for Bitcoin signing
      path
    };
  }

  getPrivateKey(userIndex) {
    return this.deriveAddress(userIndex).privateKey;
  }

  async getOrCreateDepositAddress(userId, networkShortName = 'BTC') {
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
      console.error('[BitcoinWallet] getOrCreateDepositAddress error:', err.message);
      throw err;
    }
  }

  getMasterAddress() {
    const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
    return this.deriveAddress(masterIndex).address;
  }
}

const bitcoinWallet = new BitcoinWalletService();
module.exports = bitcoinWallet;
