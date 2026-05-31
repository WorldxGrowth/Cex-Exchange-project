/**
 * feeService.js — Common Fee Engine
 * 
 * Used by:
 *   - Internal matching (orderMatcher.js)
 *   - Binance pass-through (hedgeEngine.js)
 * 
 * Priority order for fee lookup:
 *   1. Active campaign (time-based zero fee / special offer)
 *   2. VIP level specific rule for this pair
 *   3. Default pair rule (VIP 0)
 *   4. VIP level from vip_levels table
 *   5. Fallback: trading_pairs.maker_fee / taker_fee
 */

const db = require('../config/database');

class FeeService {

  // ── Get fee for a user + pair + role ──────────
  // role: 'maker' | 'taker'
  async getFeeRate(userId, pairId, role = 'taker') {
    try {
      // 1. Get user VIP level
      const userRes = await db.query(
        'SELECT vip_level FROM users WHERE id=$1', [userId]
      );
      const vipLevel = parseInt(userRes.rows[0]?.vip_level || 0);
      const ruleType = role === 'maker' ? 'spot_maker' : 'spot_taker';

      // 2. Check active campaign/special rule (highest priority)
      // Time-based: starts_at <= NOW() <= ends_at
      const campaignRes = await db.query(`
        SELECT fee_value, fee_type, title
        FROM fee_rules
        WHERE rule_type = $1
          AND pair_id = $2
          AND is_active = true
          AND starts_at IS NOT NULL
          AND starts_at <= NOW()
          AND (ends_at IS NULL OR ends_at >= NOW())
        ORDER BY priority ASC, fee_value ASC
        LIMIT 1
      `, [ruleType, pairId]);

      if (campaignRes.rows[0]) {
        return {
          rate:     parseFloat(campaignRes.rows[0].fee_value),
          type:     campaignRes.rows[0].fee_type,
          source:   'campaign',
          title:    campaignRes.rows[0].title,
          vip_level: vipLevel
        };
      }

      // 3. VIP specific rule for this pair
      if (vipLevel > 0) {
        const vipRuleRes = await db.query(`
          SELECT fee_value, fee_type
          FROM fee_rules
          WHERE rule_type = $1
            AND pair_id = $2
            AND vip_level = $3
            AND is_active = true
            AND starts_at IS NULL
          ORDER BY priority ASC
          LIMIT 1
        `, [ruleType, pairId, vipLevel]);

        if (vipRuleRes.rows[0]) {
          return {
            rate:     parseFloat(vipRuleRes.rows[0].fee_value),
            type:     vipRuleRes.rows[0].fee_type,
            source:   'vip_pair_rule',
            vip_level: vipLevel
          };
        }
      }

      // 4. Default pair rule (VIP 0)
      const defaultRuleRes = await db.query(`
        SELECT fee_value, fee_type
        FROM fee_rules
        WHERE rule_type = $1
          AND pair_id = $2
          AND vip_level = 0
          AND is_active = true
          AND starts_at IS NULL
        ORDER BY priority ASC
        LIMIT 1
      `, [ruleType, pairId]);

      if (defaultRuleRes.rows[0]) {
        // Apply VIP discount from vip_levels table
        if (vipLevel > 0) {
          const vipRes = await db.query(
            'SELECT spot_maker_fee, spot_taker_fee FROM vip_levels WHERE level=$1',
            [vipLevel]
          );
          if (vipRes.rows[0]) {
            const vipRate = role === 'maker'
              ? parseFloat(vipRes.rows[0].spot_maker_fee)
              : parseFloat(vipRes.rows[0].spot_taker_fee);
            return {
              rate:     vipRate,
              type:     'percentage',
              source:   'vip_level',
              vip_level: vipLevel
            };
          }
        }

        return {
          rate:     parseFloat(defaultRuleRes.rows[0].fee_value),
          type:     defaultRuleRes.rows[0].fee_type,
          source:   'default_rule',
          vip_level: vipLevel
        };
      }

      // 5. Fallback: trading_pairs table
      const pairRes = await db.query(
        'SELECT maker_fee, taker_fee FROM trading_pairs WHERE id=$1', [pairId]
      );
      const fallbackRate = role === 'maker'
        ? parseFloat(pairRes.rows[0]?.maker_fee || 0.001)
        : parseFloat(pairRes.rows[0]?.taker_fee || 0.001);

      return {
        rate:     fallbackRate,
        type:     'percentage',
        source:   'pair_fallback',
        vip_level: vipLevel
      };

    } catch (e) {
      console.error('[FeeService] getFeeRate error:', e.message);
      return { rate: 0.001, type: 'percentage', source: 'error_fallback', vip_level: 0 };
    }
  }

  // ── Calculate fee amount ───────────────────────
  // Returns: { fee_amount, gross_value, net_value, fee_rate, fee_type, source }
  calculateFee(grossAmount, feeRate, feeType = 'percentage') {
    let feeAmount = 0;

    if (feeType === 'percentage') {
      feeAmount = grossAmount * feeRate;
    } else if (feeType === 'fixed') {
      feeAmount = feeRate;
    } else if (feeType === 'zero' || feeRate === 0) {
      feeAmount = 0;
    }

    return {
      fee_amount:  parseFloat(feeAmount.toFixed(10)),
      gross_value: parseFloat(grossAmount.toFixed(10)),
      net_value:   parseFloat((grossAmount - feeAmount).toFixed(10)),
      fee_rate:    feeRate,
      fee_type:    feeType
    };
  }

  // ── Determine maker/taker ──────────────────────
  // Limit order that was resting = maker
  // Market order or aggressor = taker
  determineMakerTaker(orderType, isAggressor = true) {
    if (orderType === 'market') return 'taker';
    if (orderType === 'limit' && !isAggressor) return 'maker';
    return 'taker';
  }

  // ── Credit fee to treasury ─────────────────────
  async creditToTreasury(client, coinId, feeAmount, referenceId, description) {
    if (!feeAmount || feeAmount <= 0) return;

    try {
      // Get treasury user ID from system_settings
      const settingRes = await client.query(
        "SELECT value FROM system_settings WHERE key='exchange_treasury_user_id'"
      );
      const treasuryUserId = parseInt(settingRes.rows[0]?.value || 0);
      if (!treasuryUserId) return;

      // Check fee enabled
      const feeEnabledRes = await client.query(
        "SELECT value FROM system_settings WHERE key='fee_credit_to_treasury'"
      );
      if (feeEnabledRes.rows[0]?.value !== 'true') return;

      // Credit treasury balance
      await client.query(`
        INSERT INTO balances (user_id, coin_id, account_type, available, locked)
        VALUES ($1, $2, 'spot', $3, 0)
        ON CONFLICT (user_id, coin_id, account_type)
        DO UPDATE SET available = balances.available + $3, updated_at = NOW()
      `, [treasuryUserId, coinId, feeAmount]);

      // Ledger entry
      await client.query(`
        INSERT INTO ledger (user_id, coin_id, type, amount, reference_id, description)
        VALUES ($1, $2, 'trading_fee', $3, $4, $5)
      `, [treasuryUserId, coinId, feeAmount, referenceId, description]).catch(() => {});

    } catch (e) {
      console.error('[FeeService] creditToTreasury error:', e.message);
    }
  }

  // ── Full fee info for order placement ─────────
  // Used in order.controller.js to save fee_rate upfront
  async getOrderFeeInfo(userId, pairId, orderType, isMaker = false) {
    const role = this.determineMakerTaker(orderType, !isMaker);
    const feeInfo = await this.getFeeRate(userId, pairId, role);
    return {
      fee_rate:   feeInfo.rate,
      fee_type:   feeInfo.type,
      fee_source: feeInfo.source,
      role
    };
  }
}

const feeService = new FeeService();
module.exports = feeService;
