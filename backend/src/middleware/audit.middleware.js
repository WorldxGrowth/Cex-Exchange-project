/**
 * VDExchange — Admin Audit Log Middleware
 * ========================================
 * Usage: router.put('/users/:id/status', audit('user_status_change', 'users'), updateUserStatus);
 * 
 * Captures: admin_id, action, resource, resource_id, ip, user_agent
 * Non-blocking: errors silently logged, never breaks the request
 */

const db = require('../config/database');

const audit = (action, resource = null) => {
  return async (req, res, next) => {
    // Original json method store karo
    const originalJson = res.json.bind(res);

    // Override res.json to capture response
    res.json = async (data) => {
      // Restore original
      res.json = originalJson;

      // Only log if admin is authenticated
      if (req.adminId) {
        try {
          // Resource ID extract karo (params se)
          const resourceId = req.params?.id ||
                             req.params?.kyc_id ||
                             req.params?.level ||
                             req.params?.key ||
                             null;

          // Status determine karo
          const status = (data?.status === '1' || data?.status === 1)
            ? 'success' : 'failed';

          // Admin info get karo
          const adminResult = await db.query(
            'SELECT email, role FROM admin_users WHERE id=$1',
            [req.adminId]
          );
          const admin = adminResult.rows[0];

          // Request body se new_value (sensitive fields remove)
          const bodyClean = { ...req.body };
          delete bodyClean.password;
          delete bodyClean.password_hash;
          delete bodyClean.secret;
          delete bodyClean.api_secret;
          delete bodyClean.private_key;

          await db.query(`
            INSERT INTO admin_audit_logs
              (admin_id, admin_email, admin_role, action, resource,
               resource_id, new_value, ip_address, user_agent, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `, [
            req.adminId,
            admin?.email || null,
            admin?.role  || req.adminRole || null,
            action,
            resource,
            resourceId ? resourceId.toString() : null,
            Object.keys(bodyClean).length > 0 ? JSON.stringify(bodyClean) : null,
            req.ip || null,
            req.headers['user-agent'] || null,
            status
          ]);
        } catch (e) {
          // Never break the request
          console.error('[Audit] Log failed (non-blocking):', e.message);
        }
      }

      // Call original json
      return originalJson(data);
    };

    next();
  };
};

module.exports = { audit };
