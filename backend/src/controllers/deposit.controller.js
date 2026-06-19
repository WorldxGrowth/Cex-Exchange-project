const walletRouter = require('../services/wallet/walletRouter');
const db = require('../config/database');
const { success, error } = require('../utils/response');

const getDepositAddress = async (req, res) => {
  try {
    const network = (req.query.network || '').toUpperCase();
    const coin    = (req.query.coin    || 'USDT').toUpperCase();

    if (!network) return error(res, 'network is required');

    // ── Coin + Network lookup via coin_networks (multi-chain aware) ──
    const cnCheck = await db.query(`
      SELECT cn.id as cn_id, cn.is_deposit_enabled, cn.min_confirmations,
             c.id as coin_id, c.symbol, c.name, c.logo_url,
             c.is_deposit, c.maintenance_mode,
             c.deposit_disabled_reason, c.deposit_notice,
             c.deposit_enabled_at, c.min_deposit,
             n.id as network_id, n.name as network_name,
             n.short_name, n.chain_type, n.explorer_url
      FROM coin_networks cn
      JOIN coins c ON c.id = cn.coin_id
      JOIN networks n ON n.id = cn.network_id
      WHERE c.symbol = $1 AND n.short_name = $2
        AND c.is_active = true AND n.is_active = true
    `, [coin, network]);

    if (!cnCheck.rows[0]) {
      return error(res, `${coin} is not supported on ${network} network`);
    }
    const c = cnCheck.rows[0];

    // Coin-level deposit controls (same checks as before, unchanged logic)
    if (c.maintenance_mode) {
      return error(res, c.deposit_notice || `${coin} is under maintenance. Please try later.`);
    }
    if (!c.is_deposit || !c.is_deposit_enabled) {
      return error(res, c.deposit_disabled_reason || `Deposits are disabled for ${coin} on ${network}`);
    }
    if (c.deposit_enabled_at && new Date(c.deposit_enabled_at) > new Date()) {
      return error(res, c.deposit_notice || `Deposits for ${coin} will be available at ${new Date(c.deposit_enabled_at).toUTCString()}`);
    }

    // ── Address generate/fetch via walletRouter (multi-chain) ──
    const address = await walletRouter.getOrCreateDepositAddress(req.user.id, network);

    // ── Webhook register — per chain_type (TRON polling pending) ──
    if (c.chain_type === 'evm') {
      setImmediate(async () => {
        try {
          const alchemyService = require('../services/alchemyService');
          const existing = await db.query(
            'SELECT id FROM user_deposit_addresses WHERE user_id=$1 AND network=$2',
            [req.user.id, network]
          );
          if (existing.rows.length > 0) {
            const ok = await alchemyService.registerNewUserAddress(
              req.user.id, network, address
            );
            if (ok) {
              console.log(`[Deposit] ✅ Webhook registered: User ${req.user.id} ${network} ${address}`);
            }
          }
        } catch (e) {
          console.error('[Deposit] Webhook register error (non-blocking):', e.message);
        }
      });
    } else if (c.chain_type === 'solana') {
      setImmediate(async () => {
        try {
          const heliusService = require('../services/webhooks/heliusService');
          const existing = await db.query(
            'SELECT id FROM user_deposit_addresses WHERE user_id=$1 AND network=$2',
            [req.user.id, network]
          );
          if (existing.rows.length > 0) {
            const ok = await heliusService.registerNewUserAddress(req.user.id, address);
            if (ok) {
              console.log(`[Deposit] ✅ Helius webhook registered: User ${req.user.id} ${network} ${address}`);
            }
          }
        } catch (e) {
          console.error('[Deposit] Helius register error (non-blocking):', e.message);
        }
      });
    } else if (c.chain_type === 'bitcoin') {
      setImmediate(async () => {
        try {
          const blockCypherService = require('../services/webhooks/blockCypherService');
          const existing = await db.query(
            'SELECT id FROM user_deposit_addresses WHERE user_id=$1 AND network=$2',
            [req.user.id, network]
          );
          if (existing.rows.length > 0) {
            const callbackUrl = `${process.env.FRONTEND_URL ? 'https://exchange.vdscan.io' : ''}/api/v1/webhook/bitcoin`;
            const ok = await blockCypherService.registerNewUserAddress(req.user.id, address, callbackUrl);
            if (ok) {
              console.log(`[Deposit] ✅ BlockCypher webhook registered: User ${req.user.id} ${network} ${address}`);
            }
          }
        } catch (e) {
          console.error('[Deposit] BlockCypher register error (non-blocking):', e.message);
        }
      });
    }

    return success(res, {
      address,
      network,
      network_info: {
        name: c.network_name,
        explorer: c.explorer_url
      },
      coin: { symbol: c.symbol, name: c.name, logo_url: c.logo_url },
      min_deposit: c.min_deposit || '1',
      confirmations_required: c.min_confirmations || 3,
      warning: `Only send ${coin} on ${network} network!`
    });

  } catch (err) {
    console.error('getDepositAddress:', err.message);
    return error(res, 'Failed to generate address', 500);
  }
};

// ── NEW: list networks a coin actually supports (fixes the frontend bug
//         where all networks showed regardless of coin selection) ──
const getCoinNetworks = async (req, res) => {
  try {
    const coin = (req.query.coin || '').toUpperCase();
    if (!coin) return error(res, 'coin is required');

    const result = await db.query(`
      SELECT n.short_name as network, n.name as network_name, n.chain_type,
             cn.is_deposit_enabled, cn.is_withdraw_enabled, cn.min_confirmations
      FROM coin_networks cn
      JOIN coins c ON c.id = cn.coin_id
      JOIN networks n ON n.id = cn.network_id
      WHERE c.symbol = $1 AND c.is_active = true AND n.is_active = true
        AND cn.is_deposit_enabled = true
      ORDER BY n.id
    `, [coin]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch networks', 500);
  }
};

const getDepositHistory = async (req, res) => {
  try {
    const limit      = parseInt(req.query.limit  || 20);
    const offset     = parseInt(req.query.offset || 0);
    const coinFilter = req.query.coin ? req.query.coin.toUpperCase() : null;

    const params = [req.user.id];
    let coinWhere = '';
    if (coinFilter) {
      params.push(coinFilter);
      coinWhere = `AND c.symbol = $${params.length}`;
    }
    params.push(limit, offset);

    const deposits = await db.query(`
      SELECT d.*, c.symbol, c.name, c.logo_url,
             n.name as network_name, n.short_name as network,
             n.explorer_url
      FROM deposits d
      LEFT JOIN coins c ON c.id = d.coin_id
      LEFT JOIN networks n ON n.id = d.network_id
      WHERE d.user_id = $1 ${coinWhere}
      ORDER BY d.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    return success(res, deposits.rows);
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

module.exports = { getDepositAddress, getDepositHistory, getCoinNetworks };
