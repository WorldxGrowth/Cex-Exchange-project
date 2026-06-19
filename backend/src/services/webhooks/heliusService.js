/**
 * Helius Service (Solana)
 * Manages webhook creation + address registration
 * Mirrors alchemyService.js pattern
 */
const axios = require('axios');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_BASE = 'https://api.helius.xyz/v0';

class HeliusService {

  // Create the webhook ONCE (run manually, save resulting webhookID to .env)
  async createWebhook(webhookUrl) {
    try {
      const res = await axios.post(
        `${HELIUS_BASE}/webhooks?api-key=${HELIUS_API_KEY}`,
        {
          webhookURL: webhookUrl,
          transactionTypes: ['Any'],
          accountAddresses: [], // start empty, add addresses later
          webhookType: 'enhanced',
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      console.log('[Helius] ✅ Webhook created:', res.data.webhookID);
      return res.data;
    } catch (e) {
      console.error('[Helius] createWebhook failed:', e.response?.data || e.message);
      throw e;
    }
  }

  // Add address(es) to existing webhook
  async addAddresses(addresses) {
    try {
      const webhookId = process.env.HELIUS_WEBHOOK_ID;
      if (!webhookId) {
        console.log('[Helius] HELIUS_WEBHOOK_ID not set, skipping');
        return false;
      }

      // Get current webhook config first (Helius requires full list on update)
      const current = await axios.get(
        `${HELIUS_BASE}/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`,
        { timeout: 15000 }
      );

      const existingAddrs = current.data.accountAddresses || [];
      const addrArray = Array.isArray(addresses) ? addresses : [addresses];
      const merged = [...new Set([...existingAddrs, ...addrArray])];

      await axios.put(
        `${HELIUS_BASE}/webhooks/${webhookId}?api-key=${HELIUS_API_KEY}`,
        {
          webhookURL: current.data.webhookURL,
          transactionTypes: current.data.transactionTypes,
          accountAddresses: merged,
          webhookType: current.data.webhookType,
          authHeader: current.data.authHeader,
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      console.log(`[Helius] ✅ Added ${addrArray.length} address(es), total now: ${merged.length}`);
      return true;
    } catch (e) {
      console.error('[Helius] addAddresses failed:', e.response?.data || e.message);
      return false;
    }
  }

  async registerNewUserAddress(userId, address) {
    const ok = await this.addAddresses([address]);
    if (ok) console.log(`[Helius] User ${userId} registered: ${address}`);
    return ok;
  }
}

const heliusService = new HeliusService();
module.exports = heliusService;
