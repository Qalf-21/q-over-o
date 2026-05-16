const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', getNotifications);
router.post('/read-all', markAllNotificationsRead);
router.post('/:id/read', markNotificationRead);

module.exports = router;
