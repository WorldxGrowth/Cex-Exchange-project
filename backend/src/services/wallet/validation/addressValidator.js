/**
 * Address Validator — per chain_type format check
 * Prevents the exact mistake the client described: selecting
 * Solana but pasting an Ethereum address (or vice versa).
 * This is checked BEFORE any signing/broadcasting happens.
 */

function isValidEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidTronAddress(address) {
  // TRON addresses: Base58Check, start with 'T', 34 chars
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

function isValidSolanaAddress(address) {
  // Solana addresses: Base58, 32-44 chars (Ed25519 public key)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isValidBitcoinAddress(address) {
  // Native SegWit (bc1...), Legacy (1...), or P2SH (3...)
  const segwit = /^bc1[a-z0-9]{25,62}$/.test(address);
  const legacy = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
  return segwit || legacy;
}

/**
 * Main entry point - validates address format matches the chain_type
 * Returns { valid: boolean, reason?: string }
 */
function validateAddress(address, chainType) {
  if (!address || typeof address !== 'string') {
    return { valid: false, reason: 'Address is required' };
  }

  switch (chainType) {
    case 'evm':
      return isValidEvmAddress(address)
        ? { valid: true }
        : { valid: false, reason: 'Invalid EVM address format (must start with 0x, 42 characters)' };

    case 'tron':
      return isValidTronAddress(address)
        ? { valid: true }
        : { valid: false, reason: 'Invalid TRON address format (must start with T, 34 characters)' };

    case 'solana':
      return isValidSolanaAddress(address)
        ? { valid: true }
        : { valid: false, reason: 'Invalid Solana address format (Base58, 32-44 characters)' };

    case 'bitcoin':
      return isValidBitcoinAddress(address)
        ? { valid: true }
        : { valid: false, reason: 'Invalid Bitcoin address format (must start with bc1, 1, or 3)' };

    default:
      return { valid: false, reason: `Unknown chain type: ${chainType}` };
  }
}

module.exports = { validateAddress, isValidEvmAddress, isValidTronAddress, isValidSolanaAddress, isValidBitcoinAddress };
