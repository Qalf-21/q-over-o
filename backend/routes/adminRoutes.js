const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/roleMiddleware');
const {
  getAuditLogs,
  getOverview,
  getReviews,
  getSessions,
  getTutors,
  getUsers,
  getWallets,
} = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware, requireSuperAdmin);

router.get('/overview', getOverview);
router.get('/users', getUsers);
router.get('/tutors', getTutors);
router.get('/sessions', getSessions);
router.get('/wallets', getWallets);
router.get('/reviews', getReviews);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
