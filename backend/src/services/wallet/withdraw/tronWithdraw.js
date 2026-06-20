/**
 * TRON Withdraw — handles native TRX + TRC20 tokens (USDT-TRC20 etc)
 * Uses the same WITHDRAW_WALLET hot wallet concept, but TRON needs
 * its own private key (derived separately, EVM key won't work here)
 */
const { TronWeb } = require('tronweb');

function getHotWalletPrivateKey() {
  // Reuse the SAME master mnemonic-derived TRON master address as
  // sweep destination - sweep deposits land here, withdrawals go out from here
  const tronWalletService = require('../tronWalletService');
  const masterIndex = parseInt(process.env.MASTER_WALLET_INDEX || '0');
  return tronWalletService.getPrivateKey(masterIndex);
}

async function send({ toAddress, amount, decimals, contractAddress }) {
  const privateKey = getHotWalletPrivateKey();
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey });

  if (contractAddress) {
    const contract = await tronWeb.contract().at(contractAddress);
    const amountRaw = Math.floor(amount * Math.pow(10, decimals));
    const tx = await contract.transfer(toAddress, amountRaw).send({
      feeLimit: 50_000_000
    });
    return typeof tx === 'string' ? tx : tx.txid;
  } else {
    const amountSun = Math.floor(amount * 1e6);
    const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, amountSun);
    const signedTx = await tronWeb.trx.sign(tx);
    const result = await tronWeb.trx.sendRawTransaction(signedTx);
    if (!result.result) throw new Error('TRON broadcast failed');
    return result.txid || result.transaction?.txID;
  }
}

async function getHotWalletBalance() {
  const privateKey = getHotWalletPrivateKey();
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey });
  const masterAddress = tronWeb.address.fromPrivateKey(privateKey);
  const balanceSun = await tronWeb.trx.getBalance(masterAddress);
  return balanceSun / 1e6;
}

module.exports = { send, getHotWalletBalance };
