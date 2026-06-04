const { ethers } = require('ethers');
const db = require('../config/database');
const { success, error } = require('../utils/response');

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

const sendEmailSafe = async (fn, ...args) => {
  try {
    const emailService = require('../services/email/emailService');
    await emailService[fn](...args);
  } catch (e) { console.error(`Email ${fn} failed:`, e.message); }
};

const checkWithdrawAllowed = async (coinSymbol) => {
  const res = await db.query(`
    SELECT is_withdraw, maintenance_mode,
           withdraw_disabled_reason, withdraw_notice, withdraw_enabled_at
    FROM coins WHERE symbol = $1 AND is_active = true
  `, [coinSymbol.toUpperCase()]);

  if (!res.rows[0]) return { allowed: false, reason: 'Coin not found' };
  const c = res.rows[0];

  if (c.maintenance_mode)
    return { allowed: false, reason: c.withdraw_notice || `${coinSymbol} is under maintenance` };
  if (!c.is_withdraw)
    return { allowed: false, reason: c.withdraw_disabled_reason || `Withdrawals disabled for ${coinSymbol}` };
  if (c.withdraw_enabled_at && new Date(c.withdraw_enabled_at) > new Date())
    return { allowed: false, reason: c.withdraw_notice || `Withdrawals for ${coinSymbol} available at ${new Date(c.withdraw_enabled_at).toUTCString()}` };

  return { allowed: true };
};

const calculateFee = async (coinId, feeFixed, feeType) => {
  if (feeType === 'fixed_qty') return parseFloat(feeFixed);
  const priceRes = await db.query(
    'SELECT price_usdt FROM price_feeds WHERE coin_id = $1', [coinId]
  );
  const price = parseFloat(priceRes.rows[0]?.price_usdt || 0);
  if (price <= 0) { console.warn(`[Fee] No price for coin ${coinId}`); return parseFloat(feeFixed); }
  return parseFloat((parseFloat(feeFixed) / price).toFixed(8));
};

// ── GET WITHDRAW INFO ─────────────────────────────
const getWithdrawInfo = async (req, res) => {
  try {
    const { coin } = req.query;
    if (!coin) return error(res, 'coin required');

    const check = await checkWithdrawAllowed(coin);
    if (!check.allowed) return error(res, check.reason);

    const result = await db.query(`
      SELECT c.id, c.symbol, c.name, c.logo_url, c.decimals,
             c.contract_address, c.is_withdraw,
             n.short_name as network, n.name as network_name,
             ws.min_amount, ws.max_amount, ws.fee_fixed,
             ws.fee_percent, ws.auto_approve_limit, ws.is_enabled, ws.fee_type,
             COALESCE(pf.price_usdt, 0) as price_usdt,
             b.available
      FROM coins c
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN withdrawal_settings ws ON ws.coin_id = c.id
      LEFT JOIN price_feeds pf ON pf.coin_id = c.id
      LEFT JOIN balances b ON b.coin_id = c.id
        AND b.user_id = $1 AND b.account_type = 'spot'
      WHERE c.symbol = $2 AND c.is_active = true
    `, [req.user.id, coin.toUpperCase()]);

    if (!result.rows[0]) return error(res, 'Coin not found');
    const info = result.rows[0];
    if (!info.is_enabled) return error(res, 'Withdrawals disabled for this coin');

    const feeQty = await calculateFee(info.id, info.fee_fixed, info.fee_type || 'fixed_qty');

    // Check 2FA enabled
    const twofa = await db.query(
      'SELECT is_enabled FROM two_factor_auth WHERE user_id = $1', [req.user.id]
    );

    return success(res, {
      coin:               info.symbol,
      name:               info.name,
      logo_url:           info.logo_url,
      network:            info.network,
      network_name:       info.network_name,
      available:          parseFloat(info.available || 0),
      min_amount:         parseFloat(info.min_amount || 1),
      max_amount:         parseFloat(info.max_amount || 100000),
      fee_type:           info.fee_type || 'fixed_qty',
      fee_fixed:          parseFloat(info.fee_fixed || 0),
      fee_qty:            feeQty,
      fee_usd:            info.fee_type === 'fixed_usd'
                            ? parseFloat(info.fee_fixed)
                            : feeQty * parseFloat(info.price_usdt),
      price_usdt:         parseFloat(info.price_usdt || 0),
      auto_approve_limit: parseFloat(info.auto_approve_limit || 100),
      two_fa_enabled:     twofa.rows[0]?.is_enabled || false,
    });
  } catch (err) {
    console.error('getWithdrawInfo:', err.message);
    return error(res, 'Failed', 500);
  }
};

// ── SEND WITHDRAWAL OTP ───────────────────────────
const sendWithdrawalOTP = async (req, res) => {
  try {
    const user = await db.query(
      'SELECT id, email FROM users WHERE id = $1', [req.user.id]
    );
    if (!user.rows[0]) return error(res, 'User not found');

    const otpService = require('../services/otpService');
    const result = await otpService.sendOTP(user.rows[0].email, 'withdrawal');

    if (!result.ok) return error(res, result.error || 'Failed to send OTP');

    return success(res, {}, 'OTP sent to your email');
  } catch (err) {
    console.error('sendWithdrawalOTP:', err.message);
    return error(res, 'Failed', 500);
  }
};

// ── REQUEST WITHDRAWAL (with OTP + 2FA verify) ───
const requestWithdrawal = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { coin, network, amount, address, email_otp, totp_code } = req.body;

    if (!coin || !amount || !address)
      return error(res, 'coin, amount, address required');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return error(res, 'Invalid amount');

    if (!ethers.utils.isAddress(address))
      return error(res, 'Invalid wallet address');

    // ── Email OTP verify ──────────────────────────
    if (!email_otp) return error(res, 'Email OTP required');

    const userRow = await db.query(
      'SELECT id, email FROM users WHERE id = $1', [req.user.id]
    );
    const userEmail = userRow.rows[0]?.email;

    const otpService = require('../services/otpService');
    const otpResult  = await otpService.verifyOTP(userEmail, email_otp, 'withdrawal');
    if (!otpResult.ok) {
      await client.query('ROLLBACK');
      return error(res, otpResult.error || 'Invalid email OTP');
    }

    // ── 2FA verify (if enabled) ───────────────────
    const twofa = await db.query(
      'SELECT is_enabled, secret_key FROM two_factor_auth WHERE user_id = $1', [req.user.id]
    );
    if (twofa.rows[0]?.is_enabled) {
      if (!totp_code) {
        await client.query('ROLLBACK');
        return error(res, '2FA code required');
      }
      const speakeasy = require('speakeasy');
      const valid = speakeasy.totp.verify({
        secret: twofa.rows[0].secret_key,
        encoding: 'base32',
        token: totp_code,
        window: 1
      });
      if (!valid) {
        await client.query('ROLLBACK');
        return error(res, 'Invalid 2FA code');
      }
    }

    // ── Phase 1 check ──────────────────────────────
    const check = await checkWithdrawAllowed(coin);
    if (!check.allowed) { await client.query('ROLLBACK'); return error(res, check.reason); }

    const coinData = await client.query(`
      SELECT c.id as coin_id, c.symbol, c.decimals, c.contract_address,
             c.is_withdraw, n.id as network_id, n.short_name as network_name,
             ws.min_amount, ws.max_amount, ws.fee_fixed,
             ws.fee_type, ws.auto_approve_limit, ws.is_enabled
      FROM coins c
      LEFT JOIN networks n ON n.id = c.network_id
      LEFT JOIN withdrawal_settings ws ON ws.coin_id = c.id
      WHERE c.symbol = $1 AND c.is_active = true
    `, [coin.toUpperCase()]);

    if (!coinData.rows[0]) return error(res, 'Coin not found');
    const c = coinData.rows[0];

    if (!c.is_withdraw || !c.is_enabled)
      return error(res, 'Withdrawals disabled');

    if (amt < parseFloat(c.min_amount))
      return error(res, `Min withdrawal: ${c.min_amount} ${coin}`);
    if (amt > parseFloat(c.max_amount))
      return error(res, `Max withdrawal: ${c.max_amount} ${coin}`);

    const feeQty     = await calculateFee(c.coin_id, c.fee_fixed, c.fee_type || 'fixed_qty');
    const totalDeduct = amt + feeQty;
    const receiveAmt  = amt;

    console.log(`[Withdraw] ${coin}: amt=${amt} fee=${feeQty} total=${totalDeduct}`);

    const balance = await client.query(`
      SELECT available FROM balances
      WHERE user_id = $1 AND coin_id = $2 AND account_type = 'spot'
      FOR UPDATE
    `, [req.user.id, c.coin_id]);

    const available = parseFloat(balance.rows[0]?.available || 0);
    if (available < totalDeduct)
      return error(res, `Insufficient balance. Need: ${totalDeduct.toFixed(6)} ${coin}, Available: ${available.toFixed(6)}`);

    await client.query(`
      UPDATE balances SET available = available - $1, updated_at = NOW()
      WHERE user_id = $2 AND coin_id = $3 AND account_type = 'spot'
    `, [totalDeduct, req.user.id, c.coin_id]);

    const autoApproveLimit = parseFloat(c.auto_approve_limit || 100);
    const status = amt <= autoApproveLimit ? 'processing' : 'pending';
    const txId   = 'WD' + Date.now() + Math.random().toString(36).substr(2,6).toUpperCase();

    const withdrawal = await client.query(`
      INSERT INTO withdrawals
        (user_id, coin_id, network_id, tx_id, to_address,
         amount, fee, receive_amount, status, two_fa_verified, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING *
    `, [req.user.id, c.coin_id, c.network_id, txId,
        address, amt, feeQty, receiveAmt, status,
        twofa.rows[0]?.is_enabled || false]);

    await client.query(`
      INSERT INTO ledger (user_id, coin_id, type, amount,
                          balance_before, balance_after, reference_id, description)
      VALUES ($1,$2,'withdrawal',$3,$4,$5,$6,$7)
    `, [req.user.id, c.coin_id, totalDeduct, available,
        available - totalDeduct, txId,
        `Withdraw ${receiveAmt} ${coin} | fee:${feeQty.toFixed(8)} (${c.fee_type})`
    ]).catch(() => {});

    await client.query('COMMIT');

    db.query('SELECT email FROM users WHERE id = $1', [req.user.id])
      .then(u => {
        if (u.rows[0]) {
          sendEmailSafe('sendWithdrawalEmail', u.rows[0], {
            symbol: coin, amount: amt, fee: feeQty,
            receive_amount: receiveAmt, to_address: address,
            status, tx_id: txId, txhash: null
          });
        }
      }).catch(() => {});

    if (status === 'processing') {
      processWithdrawal(withdrawal.rows[0].id).catch(err => {
        console.error('Auto process error:', err.message);
      });
    }

    return success(res, {
      tx_id: txId, amount: amt, fee: feeQty,
      fee_type: c.fee_type, receive_amount: receiveAmt, status,
      message: status === 'processing' ? 'Processing automatically' : 'Pending admin approval'
    }, 'Withdrawal request submitted');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('requestWithdrawal:', err.message);
    return error(res, err.message || 'Failed', 500);
  } finally { client.release(); }
};

// ── PROCESS WITHDRAWAL ────────────────────────────
const processWithdrawal = async (withdrawalId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const wd = await client.query(`
      SELECT w.*, c.symbol, c.decimals, c.contract_address,
             n.rpc_url, n.short_name as network
      FROM withdrawals w
      JOIN coins c ON c.id = w.coin_id
      JOIN networks n ON n.id = w.network_id
      WHERE w.id = $1 FOR UPDATE
    `, [withdrawalId]);

    if (!wd.rows[0]) throw new Error('Withdrawal not found');
    const w = wd.rows[0];

    if (!['pending', 'processing'].includes(w.status))
      throw new Error('Invalid status for processing');

    const privateKey = process.env.WITHDRAW_WALLET_PRIVATE_KEY;
    if (!privateKey) throw new Error('WITHDRAW_WALLET_PRIVATE_KEY not set');

    const provider = new ethers.providers.JsonRpcProvider(w.rpc_url);
    const wallet   = new ethers.Wallet(privateKey, provider);
    let txHash;

    if (w.contract_address) {
      const contract = new ethers.Contract(w.contract_address, ERC20_ABI, wallet);
      const amount = ethers.utils.parseUnits(w.receive_amount.toString(), w.decimals);
      const tx = await contract.transfer(w.to_address, amount);
      await tx.wait(1);
      txHash = tx.hash;
    } else {
      const amount = ethers.utils.parseEther(w.receive_amount.toString());
      const tx = await wallet.sendTransaction({ to: w.to_address, value: amount });
      await tx.wait(1);
      txHash = tx.hash;
    }

    await client.query(`
      UPDATE withdrawals SET status='completed', txhash=$1,
        processed_at=NOW(), updated_at=NOW() WHERE id=$2
    `, [txHash, withdrawalId]);

    await client.query('COMMIT');
    console.log(`✅ WITHDRAWAL: ${w.receive_amount} ${w.symbol} → ${w.to_address} | TX: ${txHash}`);

    db.query('SELECT email FROM users WHERE id = $1', [w.user_id])
      .then(u => {
        if (u.rows[0]) sendEmailSafe('sendWithdrawalEmail', u.rows[0], { ...w, txhash: txHash });
      }).catch(() => {});

  } catch (err) {
    await client.query('ROLLBACK');
    await db.query(`
      UPDATE withdrawals SET status='failed', updated_at=NOW(), notes=$1 WHERE id=$2
    `, [err.message, withdrawalId]).catch(() => {});
    console.error('processWithdrawal error:', err.message);
    throw err;
  } finally { client.release(); }
};

// ── WITHDRAWAL HISTORY ────────────────────────────
const getWithdrawalHistory = async (req, res) => {
  try {
    const history = await db.query(`
      SELECT w.id, w.tx_id, w.to_address, w.amount, w.fee,
             w.receive_amount, w.status, w.txhash, w.created_at,
             c.symbol, c.name, c.logo_url, n.name as network_name
      FROM withdrawals w
      JOIN coins c ON c.id = w.coin_id
      JOIN networks n ON n.id = w.network_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC LIMIT 50
    `, [req.user.id]);
    return success(res, history.rows);
  } catch (err) { return error(res, 'Failed', 500); }
};

// ── ADMIN: APPROVE ────────────────────────────────
const adminApproveWithdrawal = async (req, res) => {
  try {
    const { withdrawal_id } = req.params;
    const wd = await db.query('SELECT * FROM withdrawals WHERE id=$1', [withdrawal_id]);
    if (!wd.rows[0]) return error(res, 'Not found');
    if (wd.rows[0].status !== 'pending')
      return error(res, 'Can only approve pending withdrawals');

    await db.query(
      'UPDATE withdrawals SET status=\'processing\', updated_at=NOW() WHERE id=$1',
      [withdrawal_id]
    );
    processWithdrawal(parseInt(withdrawal_id)).catch(err => {
      console.error('Admin approve process error:', err.message);
    });
    return success(res, {}, 'Withdrawal approved and processing');
  } catch (err) { return error(res, 'Failed', 500); }
};

// ── ADMIN: REJECT ─────────────────────────────────
const adminRejectWithdrawal = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { withdrawal_id } = req.params;
    const { reason } = req.body;

    const wd = await client.query(
      'SELECT * FROM withdrawals WHERE id=$1 FOR UPDATE', [withdrawal_id]
    );
    if (!wd.rows[0]) return error(res, 'Not found');
    if (wd.rows[0].status !== 'pending')
      return error(res, 'Can only reject pending withdrawals');

    const w = wd.rows[0];
    const refundAmt = parseFloat(w.amount) + parseFloat(w.fee);

    await client.query(`
      UPDATE balances SET available=available+$1, updated_at=NOW()
      WHERE user_id=$2 AND coin_id=$3 AND account_type='spot'
    `, [refundAmt, w.user_id, w.coin_id]);

    await client.query(`
      UPDATE withdrawals SET status='cancelled', notes=$1, updated_at=NOW() WHERE id=$2
    `, [reason || 'Rejected by admin', withdrawal_id]);

    await client.query('COMMIT');

    db.query('SELECT email FROM users WHERE id=$1', [w.user_id])
      .then(u => {
        if (u.rows[0]) sendEmailSafe('sendWithdrawalRejectedEmail', u.rows[0], w, reason);
      }).catch(() => {});

    return success(res, {}, 'Withdrawal rejected and refunded');
  } catch (err) {
    await client.query('ROLLBACK');
    return error(res, 'Failed', 500);
  } finally { client.release(); }
};

module.exports = {
  getWithdrawInfo, sendWithdrawalOTP, requestWithdrawal,
  getWithdrawalHistory, adminApproveWithdrawal,
  adminRejectWithdrawal, processWithdrawal
};
