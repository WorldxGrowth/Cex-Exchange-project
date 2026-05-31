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
    const coin    = (req.query.coin    || 'USDT').toUpperCase();

    if (!NETWORK_INFO[network]) return error(res, 'Invalid network');

    // ── Phase 1: Coin deposit controls ────────────
    const coinCheck = await db.query(`
      SELECT id, symbol, name, logo_url,
             is_deposit, maintenance_mode,
             deposit_disabled_reason, deposit_notice,
             deposit_enabled_at, min_deposit
      FROM coins WHERE symbol = $1 AND is_active = true
    `, [coin]);

    if (coinCheck.rows[0]) {
      const c = coinCheck.rows[0];

      // 1. Maintenance check
      if (c.maintenance_mode) {
        return error(res, c.deposit_notice || `${coin} is under maintenance. Please try later.`);
      }
      // 2. Deposit enabled check
      if (!c.is_deposit) {
        return error(res, c.deposit_disabled_reason || `Deposits are disabled for ${coin}`);
      }
      // 3. Scheduled deposit check (future date)
      if (c.deposit_enabled_at && new Date(c.deposit_enabled_at) > new Date()) {
        return error(res, c.deposit_notice || `Deposits for ${coin} will be available at ${new Date(c.deposit_enabled_at).toUTCString()}`);
      }
    }
    // ── End Phase 1 ───────────────────────────────

    // Address generate/fetch (existing logic - unchanged)
    const address = await hdWallet.getOrCreateDepositAddress(req.user.id, network);

    // Webhook register (existing logic - unchanged)
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

    const coinInfo = coinCheck.rows[0] || null;

    return success(res, {
      address,
      network,
      network_info: NETWORK_INFO[network],
      coin: coinInfo || { symbol: coin },
      min_deposit: coinInfo?.min_deposit || '1',
      confirmations_required: network === 'ETH' ? 12 : 3,
      warning: `Only send ${coin} on ${network} network!`
    });

  } catch (err) {
    console.error('getDepositAddress:', err.message);
    return error(res, 'Failed to generate address', 500);
  }
};

const getDepositHistory = async (req, res) => {
  try {
    const limit  = req.query.limit  || 20;
    const offset = req.query.offset || 0;
    const deposits = await db.query(`
      SELECT d.*, c.symbol, c.name, c.logo_url,
             n.name as network_name, n.short_name as network,
             n.explorer_url
      FROM deposits d
      LEFT JOIN coins c ON c.id = d.coin_id
      LEFT JOIN networks n ON n.id = d.network_id
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
