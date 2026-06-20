/**
 * Withdraw Router — decides which chain-family withdraw service to call,
 * mirrors walletRouter.js's EVM-vs-TRON-vs-Bitcoin-vs-Solana decision logic.
 */
const db = require('../../../config/database');

const evmWithdraw = require('./evmWithdraw');
const tronWithdraw = require('./tronWithdraw');
const solanaWithdraw = require('./solanaWithdraw');
const bitcoinWithdraw = require('./bitcoinWithdraw');

const SERVICE_MAP = {
  evm: evmWithdraw,
  tron: tronWithdraw,
  solana: solanaWithdraw,
  bitcoin: bitcoinWithdraw,
};

async function getChainType(networkShortName) {
  const { rows } = await db.query(
    'SELECT chain_type FROM networks WHERE short_name = $1 AND is_active = true',
    [networkShortName.toUpperCase()]
  );
  if (!rows[0]) throw new Error(`Network ${networkShortName} not found or inactive`);
  return rows[0].chain_type;
}

async function getWithdrawService(networkShortName) {
  const chainType = await getChainType(networkShortName);
  const service = SERVICE_MAP[chainType];
  if (!service) throw new Error(`No withdraw service for chain_type: ${chainType}`);
  return { service, chainType };
}

/**
 * MAIN ENTRY POINT — send a withdrawal on any chain
 * params: { networkShortName, rpcUrl, toAddress, amount, decimals, contractAddress }
 */
async function send(params) {
  const { service } = await getWithdrawService(params.networkShortName);
  return service.send(params);
}

async function getHotWalletBalance(networkShortName, rpcUrl) {
  const { service, chainType } = await getWithdrawService(networkShortName);
  // EVM needs rpcUrl passed since it can vary per-network within the EVM family
  return chainType === 'evm' ? service.getHotWalletBalance(rpcUrl) : service.getHotWalletBalance();
}

module.exports = { getChainType, getWithdrawService, send, getHotWalletBalance };
