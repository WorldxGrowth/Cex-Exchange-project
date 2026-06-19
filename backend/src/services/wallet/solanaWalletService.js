/**
 * Solana Wallet Service
 * Path: m/44'/501'/0'/0' style derivation via ed25519-hd-key
 * Solana uses Ed25519 keypairs (NOT secp256k1 like EVM/TRON)
 * userId used as account index (so each user gets a unique address)
 */
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const db = require('../../config/database');

class SolanaWalletService {
  constructor() {
    this.mnemonic = process.env.MASTER_MNEMONIC;
    if (!this.mnemonic) throw new Error('MASTER_MNEMONIC not set in .env!');
    this.seed = bip39.mnemonicToSeedSync(this.mnemonic);
  }

  // Derive Solana keypair for a user
  // Path: m/44'/501'/{userIndex}'/0'  (account-index based, Trust Wallet style)
  deriveAddress(userIndex) {
    const path = `m/44'/501'/${userIndex}'/0'`;
    const { key } = derivePath(path, this.seed.toString('hex'));
    const keypair = Keypair.fromSeed(key);
    return {
      address: keypair.publicKey.toBase58(),
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      path
    };
  }

  getPrivateKey(userIndex) {
    return this.deriveAddress(userIndex).privateKey;
  }

  async getOrCreateDepositAddress(userId, networkShortName = 'SOL') {
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
      console.error('[SolanaWallet] getOrCreateDepositAddress error:', err.message);
      throw err;
    }
  }

  getMasterAddress() {
    const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
    return this.deriveAddress(masterIndex).address;
  }
}

const solanaWallet = new SolanaWalletService();
module.exports = solanaWallet;
