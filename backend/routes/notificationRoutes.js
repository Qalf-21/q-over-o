const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getNotifications,
  streamNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/stream', streamNotifications);
router.use(authMiddleware);
router.get('/', getNotifications);
router.post('/read-all', markAllNotificationsRead);
router.post('/:id/read', markNotificationRead);

module.exports = router;
