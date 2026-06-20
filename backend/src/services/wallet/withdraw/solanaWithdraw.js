/**
 * Solana Withdraw — handles native SOL + SPL tokens
 */
const {
  Connection, PublicKey, SystemProgram, Transaction,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL, Keypair
} = require('@solana/web3.js');

function getConnection() {
  return new Connection(
    process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );
}

function getHotWalletKeypair() {
  const solanaWalletService = require('../solanaWalletService');
  const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
  const { privateKey } = solanaWalletService.deriveAddress(masterIndex);
  return Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
}

async function send({ toAddress, amount, decimals, contractAddress }) {
  const connection = getConnection();
  const fromKeypair = getHotWalletKeypair();

  if (contractAddress) {
    const { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
    const mintPubkey = new PublicKey(contractAddress);

    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection, fromKeypair, mintPubkey, fromKeypair.publicKey
    );
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection, fromKeypair, mintPubkey, new PublicKey(toAddress)
    );

    const amountRaw = Math.floor(amount * Math.pow(10, decimals));
    const tx = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount.address, toTokenAccount.address,
        fromKeypair.publicKey, amountRaw, [], TOKEN_PROGRAM_ID
      )
    );
    return await sendAndConfirmTransaction(connection, tx, [fromKeypair]);
  } else {
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports
      })
    );
    return await sendAndConfirmTransaction(connection, tx, [fromKeypair]);
  }
}

async function getHotWalletBalance() {
  const connection = getConnection();
  const fromKeypair = getHotWalletKeypair();
  const balanceLamports = await connection.getBalance(fromKeypair.publicKey);
  return balanceLamports / LAMPORTS_PER_SOL;
}

module.exports = { send, getHotWalletBalance };
