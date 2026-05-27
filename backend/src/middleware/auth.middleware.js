const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Unauthorized - No token', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Check session in DB
    const session = await db.query(
      'SELECT * FROM user_sessions WHERE token = $1 AND is_active = true AND expires_at > NOW()',
      [token]
    );

    if (session.rows.length === 0) {
      return error(res, 'Session expired or invalid', 401);
    }

    // Get user
    const user = await db.query(
      'SELECT id, uid, email, phone, status, kyc_level, vip_level FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user.rows[0] || user.rows[0].status === 'banned') {
      return error(res, 'Account not found or banned', 401);
    }

    req.user = user.rows[0];
    req.token = token;
    next();
  } catch (err) {
    return error(res, 'Invalid token', 401);
  }
};

module.exports = { authenticate };
