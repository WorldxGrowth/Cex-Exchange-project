/**
 * Wallet Router
 * Decides which chain-family service to call based on networks.chain_type
 * Mirrors the existing trading services/trading/router.js pattern
 * (Binance-vs-internal decision logic), applied here as
 * EVM-vs-TRON-vs-Bitcoin-vs-Solana decision logic.
 */
const db = require('../../config/database');

const evmWallet     = require('./evmWalletService');
const tronWallet    = require('./tronWalletService');
const solanaWallet  = require('./solanaWalletService');
const bitcoinWallet = require('./bitcoinWalletService');

// Map chain_type → service instance
const SERVICE_MAP = {
  evm:     evmWallet,
  tron:    tronWallet,
  solana:  solanaWallet,
  bitcoin: bitcoinWallet,
};

/**
 * Get network's chain_type from DB (cached lookup pattern, simple for now)
 */
async function getChainType(networkShortName) {
  const { rows } = await db.query(
    'SELECT chain_type FROM networks WHERE short_name = $1 AND is_active = true',
    [networkShortName.toUpperCase()]
  );
  if (!rows[0]) throw new Error(`Network ${networkShortName} not found or inactive`);
  return rows[0].chain_type;
}

/**
 * Get the correct wallet service for a given network
 */
async function getWalletService(networkShortName) {
  const chainType = await getChainType(networkShortName);
  const service = SERVICE_MAP[chainType];
  if (!service) throw new Error(`No wallet service for chain_type: ${chainType}`);
  return service;
}

/**
 * MAIN ENTRY POINT — get or create a deposit address for a user on any network
 * Used by deposit.controller.js (replaces direct hdWallet calls)
 */
async function getOrCreateDepositAddress(userId, networkShortName) {
  const service = await getWalletService(networkShortName);
  return service.getOrCreateDepositAddress(userId, networkShortName.toUpperCase());
}

/**
 * Get private key for a user on any network (used by sweepService)
 */
async function getPrivateKey(userId, networkShortName) {
  const service = await getWalletService(networkShortName);
  return service.getPrivateKey(userId);
}

module.exports = {
  getChainType,
  getWalletService,
  getOrCreateDepositAddress,
  getPrivateKey,
};
