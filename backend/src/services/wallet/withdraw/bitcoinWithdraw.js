/**
 * Bitcoin Withdraw — UTXO-based, consolidates hot wallet's UTXOs
 * to fund a single withdrawal output (+ change back to hot wallet)
 */
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');

const ECPair = ECPairFactory(ecc);
const NETWORK = bitcoin.networks.bitcoin;
const BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN;

function getHotWalletKeyPair() {
  const bitcoinWalletService = require('../bitcoinWalletService');
  const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
  const wif = bitcoinWalletService.getPrivateKey(masterIndex);
  return ECPair.fromWIF(wif, NETWORK);
}

function getHotWalletAddress() {
  const bitcoinWalletService = require('../bitcoinWalletService');
  const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
  return bitcoinWalletService.deriveAddress(masterIndex).address;
}

async function getUtxos(address) {
  const res = await axios.get(
    `https://api.blockcypher.com/v1/btc/main/addrs/${address}?unspentOnly=true&includeScript=true&token=${BLOCKCYPHER_TOKEN}`,
    { timeout: 15000 }
  );
  return res.data?.txrefs || [];
}

async function getFeeRate() {
  try {
    const res = await axios.get(
      `https://api.blockcypher.com/v1/btc/main?token=${BLOCKCYPHER_TOKEN}`,
      { timeout: 10000 }
    );
    return Math.ceil((res.data?.medium_fee_per_kb || 20000) / 1000);
  } catch (e) {
    return 20;
  }
}

async function send({ toAddress, amount }) {
  const keyPair = getHotWalletKeyPair();
  const hotWalletAddress = getHotWalletAddress();

  const utxos = await getUtxos(hotWalletAddress);
  if (!utxos || utxos.length === 0) throw new Error('No UTXOs available in hot wallet');

  const sendAmountSats = Math.floor(amount * 1e8);
  const totalAvailableSats = utxos.reduce((sum, u) => sum + (u.value || 0), 0);

  const feeRateSatPerByte = await getFeeRate();
  const estimatedSize = (utxos.length * 68) + (2 * 31) + 10; // 2 outputs: recipient + change
  const estimatedFee = estimatedSize * feeRateSatPerByte;

  const changeSats = totalAvailableSats - sendAmountSats - estimatedFee;
  if (changeSats < 0) throw new Error('Insufficient hot wallet balance to cover amount + fee');

  const psbt = new bitcoin.Psbt({ network: NETWORK });

  for (const utxo of utxos) {
    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      witnessUtxo: {
        script: Buffer.from(utxo.script, 'hex'),
        value: BigInt(utxo.value)
      }
    });
  }

  psbt.addOutput({ address: toAddress, value: BigInt(sendAmountSats) });
  if (changeSats > 546) { // dust threshold
    psbt.addOutput({ address: hotWalletAddress, value: BigInt(changeSats) });
  }

  for (let i = 0; i < utxos.length; i++) {
    psbt.signInput(i, keyPair);
  }
  psbt.finalizeAllInputs();

  const txHex = psbt.extractTransaction().toHex();
  const broadcastRes = await axios.post(
    `https://api.blockcypher.com/v1/btc/main/txs/push?token=${BLOCKCYPHER_TOKEN}`,
    { tx: txHex },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
  );

  return broadcastRes.data?.tx?.hash;
}

async function getHotWalletBalance() {
  const hotWalletAddress = getHotWalletAddress();
  const utxos = await getUtxos(hotWalletAddress);
  const totalSats = utxos.reduce((sum, u) => sum + (u.value || 0), 0);
  return totalSats / 1e8;
}

module.exports = { send, getHotWalletBalance };
