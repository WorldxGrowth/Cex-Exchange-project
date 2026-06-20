const axios = require('axios');
const crypto = require('crypto');
const db = require('../../config/database');

class EvmWebhookService {

  // ── Chain config from .env ─────────────────────
  // Alchemy: BSC, ETH, POLYGON
  // VDNotify: VDCHAIN (apna platform)
  getChainConfig(network) {
    const map = {
      'BSC': {
        webhook_id:  process.env.ALCHEMY_WEBHOOK_ID_BSC,
        signing_key: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY_BSC,
        enabled: !!(process.env.ALCHEMY_WEBHOOK_ID_BSC &&
                    process.env.ALCHEMY_WEBHOOK_ID_BSC !== 'wh_xx'),
        provider: 'alchemy'
      },
      'ETH': {
        webhook_id:  process.env.ALCHEMY_WEBHOOK_ID_ETH,
        signing_key: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY_ETH,
        enabled: !!(process.env.ALCHEMY_WEBHOOK_ID_ETH &&
                    process.env.ALCHEMY_WEBHOOK_ID_ETH !== 'wh_xx'),
        provider: 'alchemy'
      },
      'POLYGON': {
        webhook_id:  process.env.ALCHEMY_WEBHOOK_ID_POLYGON,
        signing_key: process.env.ALCHEMY_WEBHOOK_SIGNING_KEY_POLYGON,
        enabled: !!(process.env.ALCHEMY_WEBHOOK_ID_POLYGON &&
                    process.env.ALCHEMY_WEBHOOK_ID_POLYGON !== 'xx'),
        provider: 'alchemy'
      },
      'VDCHAIN': {
        webhook_id:  process.env.VDNOTIFY_WEBHOOK_ID,
        signing_key: process.env.VDNOTIFY_SIGNING_KEY,
        enabled: !!(process.env.VDNOTIFY_WEBHOOK_ID &&
                    process.env.VDNOTIFY_WEBHOOK_ID !== 'wh_xx'),
        provider: 'vdnotify'
      }
    };
    return map[network?.toUpperCase()] || null;
  }

  // ── Network string from payload → our short_name ──
  // Handles both Alchemy and VDNotify network strings
  detectNetwork(alchemyNetwork) {
    const map = {
      'ETH_MAINNET':      'ETH',
      'ETHEREUM_MAINNET': 'ETH',
      'BNB_MAINNET':      'BSC',
      'BSC_MAINNET':      'BSC',
      'BSC':              'BSC',
      'MATIC_MAINNET':    'POLYGON',
      'POLYGON_MAINNET':  'POLYGON',
      'VDCHAIN_MAINNET':  'VDCHAIN',
    };
    return map[alchemyNetwork] || null;
  }

  // ── HMAC Signature Verify ─────────────────────
  verifySignature(rawBody, receivedSignature, signingKey) {
    try {
      if (!signingKey || !receivedSignature) {
        console.log('[Alchemy] Signature or key missing — skipping verify');
        return true;
      }

      const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;

      const computed = crypto
        .createHmac('sha256', signingKey)
        .update(body, 'utf8')
        .digest('hex');

      console.log('[Alchemy] Computed sig:', computed.slice(0, 16) + '...');
      console.log('[Alchemy] Received sig:', receivedSignature.slice(0, 16) + '...');

      return computed === receivedSignature;

    } catch (e) {
      console.error('[Alchemy] Signature verify error:', e.message);
      return false;
    }
  }

  // ── Add addresses to Alchemy webhook (BSC/ETH/POLYGON) ──
  async addAddressesToAlchemy(addresses, network) {
    try {
      if (process.env.ALCHEMY_NOTIFY_ENABLED !== 'true') {
        console.log('[Alchemy] Disabled in .env, skipping');
        return false;
      }

      const config = this.getChainConfig(network);
      if (!config || !config.enabled || config.provider !== 'alchemy') {
        console.log(`[Alchemy] Chain ${network} not configured/enabled for Alchemy`);
        return false;
      }

      const authToken = process.env.ALCHEMY_AUTH_TOKEN;
      if (!authToken) {
        console.error('[Alchemy] ALCHEMY_AUTH_TOKEN not set!');
        return false;
      }

      const addrArray = Array.isArray(addresses) ? addresses : [addresses];
      console.log(`[Alchemy] Adding ${addrArray.length} address(es) to ${network}...`);

      await axios.patch(
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

      console.log(`[Alchemy] ✅ Added to ${network}: ${addrArray.join(', ')}`);
      return true;

    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data || e.message;
      console.error(`[Alchemy] addAddresses failed (${status}):`, msg);
      if (status === 401) console.error('[Alchemy] Check ALCHEMY_AUTH_TOKEN!');
      if (status === 404) console.error('[Alchemy] Check ALCHEMY_WEBHOOK_ID!');
      return false;
    }
  }

  // ── Add addresses to VDNotify webhook (VDCHAIN) ──
  async addAddressesToVDNotify(addresses) {
    try {
      const webhookId  = process.env.VDNOTIFY_WEBHOOK_ID;
      const apiKey     = process.env.VDNOTIFY_API_KEY;

      if (!webhookId || !apiKey) {
        console.log('[VDNotify] Not configured, skipping');
        return false;
      }

      if (webhookId === 'wh_xx') {
        console.log('[VDNotify] Webhook ID not set');
        return false;
      }

      const addrArray = Array.isArray(addresses) ? addresses : [addresses];
      console.log(`[VDNotify] Adding ${addrArray.length} address(es) to VDCHAIN...`);

      await axios.patch(
        `https://vdnotify.vdscan.io/api/webhooks/${process.env.VDNOTIFY_WEBHOOK_UUID}/addresses`,
        {
          addresses_to_add: addrArray,
          addresses_to_remove: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          timeout: 15000
        }
      );

      console.log(`[VDNotify] ✅ Added to VDCHAIN: ${addrArray.join(', ')}`);
      return true;

    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data || e.message;
      console.error(`[VDNotify] addAddresses failed (${status}):`, msg);
      return false;
    }
  }

  // ── Remove addresses from Alchemy webhook ─────
  async removeAddresses(addresses, network) {
    try {
      const config = this.getChainConfig(network);
      if (!config || !config.enabled) return false;

      const addrArray = Array.isArray(addresses) ? addresses : [addresses];

      if (config.provider === 'vdnotify') {
        // VDNotify remove
        const apiKey = process.env.VDNOTIFY_API_KEY;
        if (!apiKey) return false;

        await axios.patch(
          `https://vdnotify.vdscan.io/api/webhooks/${config.webhook_id}/addresses`,
          { addresses_to_add: [], addresses_to_remove: addrArray },
          { headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }, timeout: 15000 }
        );
      } else {
        // Alchemy remove
        const authToken = process.env.ALCHEMY_AUTH_TOKEN;
        if (!authToken) return false;

        await axios.patch(
          'https://dashboard.alchemy.com/api/update-webhook-addresses',
          { webhook_id: config.webhook_id, addresses_to_add: [], addresses_to_remove: addrArray },
          { headers: { 'Content-Type': 'application/json', 'X-Alchemy-Token': authToken }, timeout: 15000 }
        );
      }

      console.log(`[Webhook] ✅ Removed from ${network}: ${addrArray.join(', ')}`);
      return true;

    } catch (e) {
      console.error('[Webhook] removeAddresses error:', e.message);
      return false;
    }
  }

  // ── addAddresses - unified (backward compat) ──
  async addAddresses(addresses, network) {
    if (network === 'VDCHAIN') {
      return this.addAddressesToVDNotify(addresses);
    }
    return this.addAddressesToAlchemy(addresses, network);
  }

  // ── Get all addresses from webhook ────────────
  async getWebhookAddresses(network) {
    try {
      const config = this.getChainConfig(network);
      if (!config || !config.enabled) return [];

      if (config.provider === 'vdnotify') {
        const apiKey = process.env.VDNOTIFY_API_KEY;
        if (!apiKey) return [];
        const response = await axios.get(
          `https://vdnotify.vdscan.io/api/webhooks/${config.webhook_id}/addresses`,
          { headers: { 'X-API-Key': apiKey }, timeout: 15000 }
        );
        return response.data?.addresses || [];
      }

      // Alchemy
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
      console.error('[Webhook] getWebhookAddresses error:', e.message);
      return [];
    }
  }

  // ── Sync all DB addresses to webhooks ─────────
  async syncAllAddresses() {
    try {
      console.log('[Webhook] Syncing all addresses...');

      const addresses = await db.query(
        'SELECT network, address FROM user_deposit_addresses'
      );

      const grouped = {};
      for (const row of addresses.rows) {
        const net = row.network.toUpperCase();
        if (!grouped[net]) grouped[net] = [];
        grouped[net].push(row.address);
      }

      for (const [network, addrs] of Object.entries(grouped)) {
        const config = this.getChainConfig(network);
        if (!config?.enabled) continue;

        for (let i = 0; i < addrs.length; i += 100) {
          const batch = addrs.slice(i, i + 100);
          await this.addAddresses(batch, network);
          await new Promise(r => setTimeout(r, 500));
        }
        console.log(`[Webhook] Synced ${addrs.length} addresses for ${network}`);
      }

      console.log('[Webhook] ✅ Sync complete');
      return true;

    } catch (e) {
      console.error('[Webhook] syncAllAddresses error:', e.message);
      return false;
    }
  }

  // ── Register single new user address ──────────
  async registerNewUserAddress(userId, network, address) {
    try {
      const ok = await this.addAddresses([address], network);
      if (ok) {
        console.log(`[Webhook] User ${userId} registered: ${address} (${network})`);
      }
      return ok;
    } catch (e) {
      console.error('[Webhook] registerNewUserAddress error:', e.message);
      return false;
    }
  }
}

const evmWebhookService = new EvmWebhookService();
module.exports = evmWebhookService;
