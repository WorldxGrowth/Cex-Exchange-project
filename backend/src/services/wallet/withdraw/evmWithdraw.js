/**
 * EVM Withdraw — handles BSC/ETH/Polygon/VDChain
 * Signs + broadcasts using the shared hot wallet (WITHDRAW_WALLET_PRIVATE_KEY)
 */
const { ethers } = require('ethers');

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

async function send({ rpcUrl, toAddress, amount, decimals, contractAddress }) {
  const privateKey = process.env.WITHDRAW_WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error('WITHDRAW_WALLET_PRIVATE_KEY not set');

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  if (contractAddress) {
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);
    const tx = await contract.transfer(toAddress, parsedAmount);
    await tx.wait(1);
    return tx.hash;
  } else {
    const parsedAmount = ethers.utils.parseEther(amount.toString());
    const tx = await wallet.sendTransaction({ to: toAddress, value: parsedAmount });
    await tx.wait(1);
    return tx.hash;
  }
}

async function getHotWalletBalance(rpcUrl) {
  const privateKey = process.env.WITHDRAW_WALLET_PRIVATE_KEY;
  if (!privateKey) return 0;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const bal = await provider.getBalance(wallet.address);
  return parseFloat(ethers.utils.formatEther(bal));
}

module.exports = { send, getHotWalletBalance };
