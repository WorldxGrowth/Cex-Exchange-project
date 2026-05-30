const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/database');

// ─────────────────────────────────────────────────
// ALCHEMY SERVICE
// - Address add/remove to webhook
// - Signature verification
// - Chain config dynamic from .env
// ─────────────────────────────────────────────────

class AlchemyService {

  // ── Chain config from .env ─────────────────────
  getChainConfig(network) {
    const map = {
      'BSC': {
        webhook_id:  process.env.ALCHEMY_WEBHOOK_ID_BSC,
        signing_key: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY_BSC,
        enabled:     !!(process.env.ALCHEMY_WEBHOOK_ID_BSC && process.env.ALCHEMY_WEBHOOK_ID_BSC !== 'wh_xx')
      },
      'ETH': {
        webhook_id:  process.env.ALCHEMY_WEBHOOK_ID_ETH,
        signing_key: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY_ETH,
        enabled:     !!(process.env.ALCHEMY_WEBHOOK_ID_ETH && process.env.ALCHEMY_WEBHOOK_ID_ETH !== 'wh_xx')
      },
      'POLYGON': {
        webhook_id:  process.env.ALCHEMY_WEBHOOK_ID_POLYGON,
        signing_key: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY_POLYGON,
        enabled:     !!(process.env.ALCHEMY_WEBHOOK_ID_POLYGON && process.env.ALCHEMY_WEBHOOK_ID_POLYGON !== 'xx')
      }
    };
    return map[network?.toUpperCase()] || null;
  }

  // ── Network string from Alchemy payload → our short_name ──
  detectNetwork(alchemyNetwork) {
    const map = {
      'ETH_MAINNET':     'ETH',
      'ETHEREUM_MAINNET':'ETH',
      'BNB_MAINNET':     'BSC',
      'BSC_MAINNET':     'BSC',
      'BSC':             'BSC',
      'MATIC_MAINNET':   'POLYGON',
      'POLYGON_MAINNET': 'POLYGON',
    };
    return map[alchemyNetwork] || null;
  }

  // ── HMAC Signature Verify ──────────────────────
  verifySignature(rawBody, receivedSignature, signingKey) {
    try {
      if (!signingKey) return false;
      const computed = crypto
        .createHmac('sha256', signingKey)
        .update(rawBody, 'utf8')
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
    } catch (e) {
      console.error('[Alchemy] Signature verify error:', e.message);
      return false;
    }
  }

  // ── Add addresses to Alchemy webhook ──────────
  async addAddresses(addresses, network) {
    try {
      if (!process.env.ALCHEMY_NOTIFY_ENABLED || process.env.ALCHEMY_NOTIFY_ENABLED !== 'true') {
        console.log('[Alchemy] Disabled in .env, skipping');
        return false;
      }

      const config = this.getChainConfig(network);
      if (!config || !config.enabled) {
        console.log(`[Alchemy] Chain ${network} not configured/enabled`);
        return false;
      }

      const authToken = process.env.ALCHEMY_AUTH_TOKEN;
      if (!authToken) {
        console.error('[Alchemy] ALCHEMY_AUTH_TOKEN not set!');
        return false;
      }

      const addrArray = Array.isArray(addresses) ? addresses : [addresses];

      console.log(`[Alchemy] Adding ${addrArray.length} address(es) to ${network} webhook...`);

      const response = await axios.patch(
        'https://dashboard.alchemy.com/api/update-webhook-addresses',
        {
          webhook_id: config.webhook_id,
          addresses_to_add: addrArray,
          addresses_to_remove: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': authToken
          },
          timeout: 15000
        }
      );

      console.log(`[Alchemy] ✅ Address added to ${network}: ${addrArray.join(', ')}`);
      return true;

    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data || e.message;
      console.error(`[Alchemy] ❌ addAddresses failed (${status}):`, msg);
      if (status === 401) console.error('[Alchemy] Check ALCHEMY_AUTH_TOKEN!');
      if (status === 404) console.error('[Alchemy] Check ALCHEMY_WEBHOOK_ID!');
      return false;
    }
  }

  // ── Remove addresses from Alchemy webhook ─────
  async removeAddresses(addresses, network) {
    try {
      const config = this.getChainConfig(network);
      if (!config || !config.enabled) return false;

      const authToken = process.env.ALCHEMY_AUTH_TOKEN;
      if (!authToken) return false;

      const addrArray = Array.isArray(addresses) ? addresses : [addresses];

      await axios.patch(
        'https://dashboard.alchemy.com/api/update-webhook-addresses',
        {
          webhook_id: config.webhook_id,
          addresses_to_add: [],
          addresses_to_remove: addrArray
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': authToken
          },
          timeout: 15000
        }
      );

      console.log(`[Alchemy] ✅ Address removed from ${network}: ${addrArray.join(', ')}`);
      return true;

    } catch (e) {
      console.error('[Alchemy] removeAddresses error:', e.message);
      return false;
    }
  }

  // ── Get all addresses from Alchemy webhook ────
  async getWebhookAddresses(network) {
    try {
      const config = this.getChainConfig(network);
      if (!config || !config.enabled) return [];

      const authToken = process.env.ALCHEMY_AUTH_TOKEN;
      if (!authToken) return [];

      const response = await axios.get(
        'https://dashboard.alchemy.com/api/webhook-addresses',
        {
          params: { webhook_id: config.webhook_id, limit: 1000 },
          headers: { 'X-Alchemy-Token': authToken },
          timeout: 15000
        }
      );

      return response.data?.data || [];

    } catch (e) {
      console.error('[Alchemy] getWebhookAddresses error:', e.message);
      return [];
    }
  }

  // ── Sync all DB addresses to Alchemy ──────────
  async syncAllAddresses() {
    try {
      console.log('[Alchemy] Syncing all addresses...');

      const addresses = await db.query(
        'SELECT network, address FROM user_deposit_addresses'
      );

      // Group by network
      const grouped = {};
      for (const row of addresses.rows) {
        const net = row.network.toUpperCase();
        if (!grouped[net]) grouped[net] = [];
        grouped[net].push(row.address);
      }

      for (const [network, addrs] of Object.entries(grouped)) {
        if (network === 'VDCHAIN') continue; // VDChain = apna node
        const config = this.getChainConfig(network);
        if (!config?.enabled) continue;

        // Batch of 100
        for (let i = 0; i < addrs.length; i += 100) {
          const batch = addrs.slice(i, i + 100);
          await this.addAddresses(batch, network);
          await new Promise(r => setTimeout(r, 500));
        }

        console.log(`[Alchemy] Synced ${addrs.length} addresses for ${network}`);
      }

      console.log('[Alchemy] ✅ Sync complete');
      return true;

    } catch (e) {
      console.error('[Alchemy] syncAllAddresses error:', e.message);
      return false;
    }
  }

  // ── Register single new user address ──────────
  async registerNewUserAddress(userId, network, address) {
    try {
      if (network === 'VDCHAIN') return true; // Apna node handle karega
      const success = await this.addAddresses([address], network);
      if (success) {
        console.log(`[Alchemy] New user ${userId} address registered: ${address} (${network})`);
      }
      return success;
    } catch (e) {
      console.error('[Alchemy] registerNewUserAddress error:', e.message);
      return false;
    }
  }
}

const alchemyService = new AlchemyService();
module.exports = alchemyService;
