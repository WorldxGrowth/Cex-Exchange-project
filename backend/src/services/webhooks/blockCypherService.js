/**
 * BlockCypher Service (Bitcoin)
 * Unlike Helius (one webhook, many addresses), BlockCypher requires
 * a SEPARATE webhook ("WebHook" / "event") per address.
 * We create one whenever a new BTC deposit address is generated.
 *
 * Confidence model: BlockCypher fires the SAME webhook event multiple
 * times as confirmations increase (0-conf seen -> 1 conf -> 2 conf...).
 * We only credit once min_confirmations (from coin_networks) is reached.
 */
const axios = require('axios');

const TOKEN = process.env.BLOCKCYPHER_TOKEN;
const BASE  = 'https://api.blockcypher.com/v1/btc/main';

class BlockCypherService {

  // Create a webhook for ONE address (called right after address generation)
  async createAddressWebhook(address, callbackUrl) {
    try {
      const res = await axios.post(
        `${BASE}/hooks?token=${TOKEN}`,
        {
          event: 'tx-confirmation',
          address: address,
          url: callbackUrl,
          confirmations: 2, // BlockCypher will call us again at each confirmation up to this count
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      console.log(`[BlockCypher] ✅ Webhook created for ${address}: ${res.data.id}`);
      return res.data;
    } catch (e) {
      console.error('[BlockCypher] createAddressWebhook failed:', e.response?.data || e.message);
      return null;
    }
  }

  async registerNewUserAddress(userId, address, callbackUrl) {
    const result = await this.createAddressWebhook(address, callbackUrl);
    if (result) console.log(`[BlockCypher] User ${userId} registered: ${address}`);
    return !!result;
  }
}

const blockCypherService = new BlockCypherService();
module.exports = blockCypherService;
