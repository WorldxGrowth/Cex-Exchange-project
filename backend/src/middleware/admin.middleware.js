const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const db = require('../config/database');

// admin.middleware.js →
// Admin routes protect karta hai -
// sirf admin_users table ke logged in
// admins ko access deta hai

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return error(res, 'Unauthorized', 401);

    const decoded = verifyToken(token);
    const admin = await db.query(
      'SELECT id, email, role, permissions FROM admin_users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (!admin.rows[0]) return error(res, 'Admin not found', 401);

    req.adminId = admin.rows[0].id;
    req.adminRole = admin.rows[0].role;
    next();
  } catch (err) {
    return error(res, 'Invalid admin token', 401);
  }
};

module.exports = { adminAuth };
