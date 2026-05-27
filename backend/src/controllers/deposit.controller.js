const hdWallet = require('../services/wallet/hdWallet');
const db = require('../config/database');
const { success, error } = require('../utils/response');

const NETWORK_INFO = {
  BSC:     { name: 'BNB Smart Chain', chainId: 56,     explorer: 'https://bscscan.com' },
  ETH:     { name: 'Ethereum',        chainId: 1,      explorer: 'https://etherscan.io' },
  VDCHAIN: { name: 'VDChain',         chainId: 882022, explorer: 'https://vdscan.io' }
};

const getDepositAddress = async (req, res) => {
  try {
    const network = (req.query.network || 'BSC').toUpperCase();
    const coin = (req.query.coin || 'USDT').toUpperCase();

    if (!NETWORK_INFO[network]) return error(res, 'Invalid network');

    const address = await hdWallet.getOrCreateDepositAddress(req.user.id, network);

    const coinInfo = await db.query(
      'SELECT id, symbol, name, logo_url FROM coins WHERE symbol = $1', [coin]
    );

    return success(res, {
      address,
      network,
      network_info: NETWORK_INFO[network],
      coin: coinInfo.rows[0] || { symbol: coin },
      min_deposit: '1',
      confirmations_required: network === 'ETH' ? 12 : 3,
      warning: 'Only send ' + coin + ' on ' + network + ' network!'
    });
  } catch (err) {
    console.error('getDepositAddress:', err.message);
    return error(res, 'Failed to generate address', 500);
  }
};

const getDepositHistory = async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const offset = req.query.offset || 0;

    const deposits = await db.query(`
      SELECT d.*, c.symbol, c.name, c.logo_url
      FROM deposits d
      LEFT JOIN coins c ON c.id = d.coin_id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    return success(res, deposits.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

module.exports = { getDepositAddress, getDepositHistory };
