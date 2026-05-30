const express = require('express');
const router = express.Router();
const alchemyWebhook = require('../services/alchemyWebhook');
const alchemyService = require('../services/alchemyService');
const { adminAuth } = require('../middleware/admin.middleware');
const db = require('../config/database');
const { success, error } = require('../utils/response');

// ─────────────────────────────────────────────────
// ALCHEMY WEBHOOK RECEIVER (BSC/ETH/POLYGON)
// POST /api/v1/webhook/alchemy
// ─────────────────────────────────────────────────
router.post('/alchemy', async (req, res) => {
  try {
    res.status(200).json({ received: true });

    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }

    // Alchemy signature
    const signature = req.headers['x-alchemy-signature'] || '';

    if (!rawBody) return;

    setImmediate(async () => {
      try {
        const result = await alchemyWebhook.processPayload(rawBody, signature);
        console.log('[WebhookRoute/Alchemy] Result:', result);
      } catch (e) {
        console.error('[WebhookRoute/Alchemy] Error:', e.message);
      }
    });

  } catch (e) {
    console.error('[WebhookRoute/Alchemy] Error:', e.message);
    if (!res.headersSent) res.status(200).json({ received: true });
  }
});

// ─────────────────────────────────────────────────
// VDNOTIFY WEBHOOK RECEIVER (VDCHAIN/VDC)
// POST /api/v1/webhook/vdchain
// Same processor - VDNotify uses same Alchemy format
// ─────────────────────────────────────────────────
router.post('/vdchain', async (req, res) => {
  try {
    res.status(200).json({ received: true });

    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }

    // VDNotify signature header
    const signature = req.headers['x-vdnotify-signature'] || '';

    if (!rawBody) return;

    setImmediate(async () => {
      try {
        const result = await alchemyWebhook.processPayload(rawBody, signature);
        console.log('[WebhookRoute/VDNotify] Result:', result);
      } catch (e) {
        console.error('[WebhookRoute/VDNotify] Error:', e.message);
      }
    });

  } catch (e) {
    console.error('[WebhookRoute/VDNotify] Error:', e.message);
    if (!res.headersSent) res.status(200).json({ received: true });
  }
});

// ── ADMIN APIs ─────────────────────────────────────

router.get('/alchemy/addresses/:network', adminAuth, async (req, res) => {
  try {
    const { network } = req.params;
    const addresses = await alchemyService.getWebhookAddresses(network.toUpperCase());
    return success(res, { network, count: addresses.length, addresses });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get('/alchemy/db-addresses/:network', adminAuth, async (req, res) => {
  try {
    const { network } = req.params;
    const result = await db.query(
      `SELECT uda.id, uda.user_id, u.email, uda.address, uda.created_at
       FROM user_deposit_addresses uda
       LEFT JOIN users u ON u.id = uda.user_id
       WHERE uda.network = $1
       ORDER BY uda.created_at DESC`,
      [network.toUpperCase()]
    );
    return success(res, { network, count: result.rows.length, addresses: result.rows });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post('/alchemy/add-address', adminAuth, async (req, res) => {
  try {
    const { address, network } = req.body;
    if (!address || !network) return error(res, 'address and network required', 400);
    const ok = await alchemyService.addAddresses([address], network.toUpperCase());
    return success(res, { added: ok, address, network });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post('/alchemy/remove-address', adminAuth, async (req, res) => {
  try {
    const { address, network } = req.body;
    if (!address || !network) return error(res, 'address and network required', 400);
    const ok = await alchemyService.removeAddresses([address], network.toUpperCase());
    return success(res, { removed: ok, address, network });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.post('/alchemy/sync', adminAuth, async (req, res) => {
  try {
    res.json({ status: '1', message: 'Sync started in background' });
    setImmediate(() => alchemyService.syncAllAddresses().catch(console.error));
  } catch (e) {
    return error(res, e.message, 500);
  }
});

router.get('/alchemy/status', adminAuth, async (req, res) => {
  try {
    const networks = ['BSC', 'ETH', 'POLYGON', 'VDCHAIN'];
    const status = {};
    for (const net of networks) {
      const config = alchemyService.getChainConfig(net);
      status[net] = {
        enabled:        config?.enabled || false,
        webhook_id:     config?.webhook_id || null,
        has_signing_key: !!config?.signing_key,
        provider:       config?.provider || null
      };
    }
    return success(res, {
      alchemy_enabled: process.env.ALCHEMY_NOTIFY_ENABLED === 'true',
      networks: status
    });
  } catch (e) {
    return error(res, e.message, 500);
  }
});

module.exports = router;
