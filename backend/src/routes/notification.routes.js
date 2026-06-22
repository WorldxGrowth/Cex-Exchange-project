const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getNotifications, markAsRead, deleteNotification,
  getAnnouncements, getBanners, getPopups, markPopupViewed
} = require('../controllers/notification.controller');

// Public routes
router.get('/announcements', getAnnouncements);
router.get('/banners',       getBanners);

// Protected routes
router.use(authenticate);

router.get('/',                     getNotifications);
router.put('/:id/read',             markAsRead);
router.delete('/:id',               deleteNotification);

// getPopups moved here (was public) - req.user is required for the
// "already viewed today" filter to actually work. Without auth, req.user
// was always undefined, so that filter silently never applied and the
// popup kept reappearing on every visit regardless of show_once /
// user_popup_views entries.
router.get('/popups',        getPopups);
router.post('/popups/:popup_id/view', markPopupViewed);

module.exports = router;
