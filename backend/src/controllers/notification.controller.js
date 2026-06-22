const db = require('../config/database');
const { success, error } = require('../utils/response');

// notification.controller.js →
// User notifications manage karta hai -
// unread count, mark read, delete etc

// GET notifications
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, type, title, message, data, is_read, created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params = [req.user.id];

    if (unread_only === 'true') {
      query += ' AND is_read = false';
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);

    const notifications = await db.query(query, params);

    const unreadCount = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    return success(res, {
      notifications: notifications.rows,
      unread_count: parseInt(unreadCount.rows[0].count)
    });
  } catch (err) {
    return error(res, 'Failed to get notifications', 500);
  }
};

// MARK as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'all') {
      await db.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1',
        [req.user.id]
      );
      return success(res, {}, 'All notifications marked as read');
    }

    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    return success(res, {}, 'Notification marked as read');
  } catch (err) {
    return error(res, 'Failed to mark notification', 500);
  }
};

// DELETE notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    return success(res, {}, 'Notification deleted');
  } catch (err) {
    return error(res, 'Failed to delete notification', 500);
  }
};

// CREATE notification (internal use - other controllers call this)
const createNotification = async (userId, type, title, message, data = null) => {
  try {
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, type, title, message, data ? JSON.stringify(data) : null]);
  } catch (err) {
    console.error('Notification create error:', err.message);
  }
};

// GET announcements (public)
const getAnnouncements = async (req, res) => {
  try {
    const announcements = await db.query(`
      SELECT id, title, content, type, published_at
      FROM announcements
      WHERE is_published = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY published_at DESC
      LIMIT 20
    `);
    return success(res, announcements.rows);
  } catch (err) {
    return error(res, 'Failed to get announcements', 500);
  }
};

// GET banners
const getBanners = async (req, res) => {
  try {
    const { platform = 'all', position } = req.query;

    let query = `
      SELECT id, title, image_url, link_url, link_type, position, sort_order
      FROM banners
      WHERE is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
        AND (platform = $1 OR platform = 'all')
    `;
    const params = [platform];

    if (position) {
      params.push(position);
      query += ` AND position = $${params.length}`;
    }

    query += ' ORDER BY sort_order ASC';

    const banners = await db.query(query, params);
    return success(res, banners.rows);
  } catch (err) {
    return error(res, 'Failed to get banners', 500);
  }
};

// GET popups — FIXED: now actually excludes popups the user has already
// seen today when show_once=true. Previously this just had a comment
// placeholder ("Filter already viewed") and returned EVERY active popup
// unconditionally, which is why it appeared to "not work" - the popup
// would show on every single page load regardless of show_once.
const getPopups = async (req, res) => {
  try {
    const { platform = 'all' } = req.query;
    const userId = req.user?.id || null; // present if a valid token was sent, null for guests

    let query = `
      SELECT p.*
      FROM app_popups p
      WHERE p.is_active = true
        AND (p.platform = $1 OR p.platform = 'all')
        AND (p.starts_at IS NULL OR p.starts_at <= NOW())
        AND (p.ends_at IS NULL OR p.ends_at > NOW())
    `;
    const params = [platform];

    // Only logged-in users get the "already seen today" exclusion -
    // guests always see show_once popups since we have no way to
    // remember them between visits without an account.
    if (userId) {
      params.push(userId);
      query += `
        AND (
          p.show_once = false
          OR NOT EXISTS (
            SELECT 1 FROM user_popup_views v
            WHERE v.popup_id = p.id
              AND v.user_id = $${params.length}
              AND v.viewed_at::date = CURRENT_DATE
          )
        )
      `;
    }

    query += ` ORDER BY p.created_at DESC`;

    const popups = await db.query(query, params);
    return success(res, popups.rows);
  } catch (err) {
    console.error('getPopups error:', err.message);
    return error(res, 'Failed to get popups', 500);
  }
};

// MARK popup viewed
const markPopupViewed = async (req, res) => {
  try {
    const { popup_id } = req.params;
    await db.query(`
      INSERT INTO user_popup_views (user_id, popup_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [req.user.id, popup_id]);
    return success(res, {}, 'Popup marked as viewed');
  } catch (err) {
    return error(res, 'Failed', 500);
  }
};

module.exports = {
  getNotifications, markAsRead, deleteNotification,
  createNotification, getAnnouncements, getBanners,
  getPopups, markPopupViewed
};
