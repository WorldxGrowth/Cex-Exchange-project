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
router.get('/popups',        getPopups);

// Protected routes
router.use(authenticate);
router.get('/',                     getNotifications);
router.put('/:id/read',             markAsRead);
router.delete('/:id',               deleteNotification);
router.post('/popups/:popup_id/view', markPopupViewed);

module.exports = router;
