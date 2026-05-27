const db = require('../config/database');
const { cache } = require('../config/redis');
const { success, error } = require('../utils/response');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/helpers');

// HD Wallet - deterministic address generation
// Format: master_seed + user_id + coin_id = unique address
const generateDepositAddress = (userId, coinSymbol, networkChainId) => {
  const seed = process.env.ENCRYPTION_KEY + userId + coinSymbol + networkChainId;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  
  // EVM compatible address (ETH, BSC, VDChain)
  const evmAddress = '0x' + hash.slice(0, 40);
  return evmAddress;
};

// GET all balances
const getBalances = async (req, res) => {
  try {
    const { account_type = 'all' } = req.query;

    let query = `
      SELECT b.account_type, b.available, b.locked,
             c.symbol, c.name, c.logo_url, c.decimals,
             p.price_usdt,
             (b.available + b.locked) as total,
             ((b.available + b.locked) * COALESCE(p.price_usdt, 0)) as total_usdt_value
      FROM balances b
      JOIN coins c ON c.id = b.coin_id
      LEFT JOIN price_feeds p ON p.coin_id = b.coin_id
      WHERE b.user_id = $1
    `;
    const params = [req.user.id];

    if (account_type !== 'all') {
      params.push(account_type);
      query += ` AND b.account_type = $2`;
    }

    query += ` ORDER BY total_usdt_value DESC`;

    const balances = await db.query(query, params);

    // Total portfolio value
    const totalUSDT = balances.rows.reduce((sum, b) => {
      return sum + parseFloat(b.total_usdt_value || 0);
    }, 0);

    return success(res, {
      total_usdt: totalUSDT.toFixed(2),
      balances: balances.rows
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to get balances', 500);
  }
};

// GET deposit address for a coin
const getDepositAddress = async (req, res) => {
  try {
    const { coin } = req.params;
    const { network } = req.query;

    // Get coin info
    const coinData = await db.query(`
      SELECT c.*, n.chain_id, n.name as network_name, n.short_name as network_short,
             n.explorer_url
      FROM coins c
      JOIN networks n ON n.id = c.network_id
      WHERE c.symbol = $1 AND c.is_active = true AND c.is_deposit = true
    `, [coin.toUpperCase()]);

    if (!coinData.rows[0]) {
      return error(res, 'Coin not found or deposits disabled');
    }

    const coinInfo = coinData.rows[0];

    // Check if address already exists
    let wallet = await db.query(`
      SELECT address FROM user_wallets
      WHERE user_id = $1 AND coin_id = $2
    `, [req.user.id, coinInfo.id]);

    let address;

    if (wallet.rows.length > 0) {
      address = wallet.rows[0].address;
    } else {
      // Generate new address
      address = generateDepositAddress(req.user.id, coinInfo.symbol, coinInfo.chain_id);

      // Save to DB
      await db.query(`
        INSERT INTO user_wallets (user_id, coin_id, network_id, address)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, coin_id, network_id) DO UPDATE SET address = $4
      `, [req.user.id, coinInfo.id, coinInfo.network_id, address]);
    }

    return success(res, {
      coin: coinInfo.symbol,
      network: coinInfo.network_short,
      network_name: coinInfo.network_name,
      chain_id: coinInfo.chain_id,
      address,
      min_deposit: coinInfo.min_deposit,
      confirmations: coinInfo.confirmations,
      contract_address: coinInfo.contract_address,
      explorer_url: coinInfo.explorer_url,
      warning: `Only send ${coinInfo.symbol} on ${coinInfo.network_short} network to this address`
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to get deposit address', 500);
  }
};

// GET deposit history
const getDepositHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, coin } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT d.id, d.txhash, d.amount, d.fee, d.status,
             d.confirmations, d.required_confirmations,
             d.credited, d.created_at, d.updated_at,
             c.symbol, c.logo_url,
             n.name as network_name, n.short_name as network
      FROM deposits d
      JOIN coins c ON c.id = d.coin_id
      JOIN networks n ON n.id = d.network_id
      WHERE d.user_id = $1
    `;
    const params = [req.user.id];

    if (status) { params.push(status); query += ` AND d.status = $${params.length}`; }
    if (coin)   { params.push(coin.toUpperCase()); query += ` AND c.symbol = $${params.length}`; }

    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const deposits = await db.query(query, params);
    const total = await db.query(
      'SELECT COUNT(*) FROM deposits WHERE user_id = $1', [req.user.id]
    );

    return success(res, {
      deposits: deposits.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total.rows[0].count) }
    });
  } catch (err) {
    return error(res, 'Failed to get deposit history', 500);
  }
};

// SUBMIT withdrawal request
const submitWithdrawal = async (req, res) => {
  try {
    const { coin, network, to_address, amount, fund_password } = req.body;

    if (!coin || !to_address || !amount) {
      return error(res, 'coin, to_address and amount required');
    }

    // Get coin info
    const coinData = await db.query(`
      SELECT c.*, n.id as net_id, n.short_name as network_short
      FROM coins c
      JOIN networks n ON n.id = c.network_id
      WHERE c.symbol = $1 AND c.is_withdraw = true AND c.is_active = true
    `, [coin.toUpperCase()]);

    if (!coinData.rows[0]) return error(res, 'Coin not found or withdrawals disabled');

    const coinInfo = coinData.rows[0];
    const withdrawAmount = parseFloat(amount);
    const fee = parseFloat(coinInfo.withdraw_fee);
    const amountReceived = withdrawAmount - fee;

    if (withdrawAmount < parseFloat(coinInfo.min_withdraw)) {
      return error(res, `Minimum withdrawal is ${coinInfo.min_withdraw} ${coin}`);
    }

    if (amountReceived <= 0) {
      return error(res, 'Amount too small after fee deduction');
    }

    // Check balance
    const balance = await db.query(`
      SELECT available FROM balances
      WHERE user_id = $1 AND coin_id = $2 AND account_type = 'spot'
    `, [req.user.id, coinInfo.id]);

    const available = parseFloat(balance.rows[0]?.available || 0);
    if (available < withdrawAmount) {
      return error(res, `Insufficient balance. Available: ${available} ${coin}`);
    }

    // Verify fund password if set
    const user = await db.query('SELECT fund_password FROM users WHERE id = $1', [req.user.id]);
    if (user.rows[0].fund_password) {
      if (!fund_password) return error(res, 'Fund password required');
      const bcrypt = require('bcryptjs');
      const valid = await bcrypt.compare(fund_password, user.rows[0].fund_password);
      if (!valid) return error(res, 'Invalid fund password');
    }

    // Lock balance
    await db.query(`
      UPDATE balances
      SET available = available - $1, locked = locked + $1
      WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
    `, [withdrawAmount, req.user.id, coinInfo.id]);

    // Create withdrawal record
    const withdrawal = await db.query(`
      INSERT INTO withdrawals
        (user_id, coin_id, network_id, to_address, amount, fee, amount_received, status, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      RETURNING id, amount, fee, amount_received, status, created_at
    `, [req.user.id, coinInfo.id, coinInfo.net_id, to_address,
        withdrawAmount, fee, amountReceived, req.ip]);

    return success(res, {
      withdrawal: withdrawal.rows[0],
      coin,
      to_address,
      message: 'Withdrawal submitted. Processing within 24 hours.'
    }, 'Withdrawal request submitted');

  } catch (err) {
    console.error(err);
    return error(res, 'Withdrawal failed', 500);
  }
};

// GET withdrawal history
const getWithdrawalHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const withdrawals = await db.query(`
      SELECT w.id, w.to_address, w.amount, w.fee, w.amount_received,
             w.txhash, w.status, w.created_at, w.updated_at,
             c.symbol, c.logo_url,
             n.name as network_name, n.short_name as network
      FROM withdrawals w
      JOIN coins c ON c.id = w.coin_id
      JOIN networks n ON n.id = w.network_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    return success(res, withdrawals.rows);
  } catch (err) {
    return error(res, 'Failed to get withdrawal history', 500);
  }
};

// INTERNAL transfer (spot ↔ futures ↔ earn)
const internalTransfer = async (req, res) => {
  try {
    const { coin, from_account, to_account, amount } = req.body;

    if (!coin || !from_account || !to_account || !amount) {
      return error(res, 'All fields required');
    }

    if (from_account === to_account) {
      return error(res, 'From and to accounts must be different');
    }

    const coinData = await db.query('SELECT id FROM coins WHERE symbol = $1', [coin.toUpperCase()]);
    if (!coinData.rows[0]) return error(res, 'Coin not found');

    const coinId = coinData.rows[0].id;
    const transferAmount = parseFloat(amount);

    // Check balance
    const fromBalance = await db.query(`
      SELECT available FROM balances
      WHERE user_id = $1 AND coin_id = $2 AND account_type = $3
    `, [req.user.id, coinId, from_account]);

    const available = parseFloat(fromBalance.rows[0]?.available || 0);
    if (available < transferAmount) {
      return error(res, `Insufficient ${from_account} balance`);
    }

    // Deduct from source
    await db.query(`
      UPDATE balances SET available = available - $1
      WHERE user_id = $2 AND coin_id = $3 AND account_type = $4
    `, [transferAmount, req.user.id, coinId, from_account]);

    // Add to destination (create if not exists)
    await db.query(`
      INSERT INTO balances (user_id, coin_id, account_type, available)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, coin_id, account_type)
      DO UPDATE SET available = balances.available + $4
    `, [req.user.id, coinId, to_account, transferAmount]);

    // Log transfer
    await db.query(`
      INSERT INTO transfers (user_id, coin_id, from_account, to_account, amount, status)
      VALUES ($1, $2, $3, $4, $5, 'completed')
    `, [req.user.id, coinId, from_account, to_account, transferAmount]);

    return success(res, {}, `${amount} ${coin} transferred from ${from_account} to ${to_account}`);
  } catch (err) {
    console.error(err);
    return error(res, 'Transfer failed', 500);
  }
};

// GET transaction history (deposits + withdrawals combined)
const getTransactionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    let rows = [];

    if (!type || type === 'deposit') {
      const deposits = await db.query(`
        SELECT 'deposit' as type, d.amount, d.status, d.txhash,
               d.created_at, c.symbol, n.short_name as network
        FROM deposits d
        JOIN coins c ON c.id = d.coin_id
        JOIN networks n ON n.id = d.network_id
        WHERE d.user_id = $1
      `, [req.user.id]);
      rows = [...rows, ...deposits.rows];
    }

    if (!type || type === 'withdrawal') {
      const withdrawals = await db.query(`
        SELECT 'withdrawal' as type, w.amount, w.status, w.txhash,
               w.created_at, c.symbol, n.short_name as network
        FROM withdrawals w
        JOIN coins c ON c.id = w.coin_id
        JOIN networks n ON n.id = w.network_id
        WHERE w.user_id = $1
      `, [req.user.id]);
      rows = [...rows, ...withdrawals.rows];
    }

    // Sort by date
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const paginated = rows.slice(offset, offset + parseInt(limit));

    return success(res, {
      transactions: paginated,
      total: rows.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    return error(res, 'Failed to get transactions', 500);
  }
};

module.exports = {
  getBalances, getDepositAddress, getDepositHistory,
  submitWithdrawal, getWithdrawalHistory,
  internalTransfer, getTransactionHistory
};
