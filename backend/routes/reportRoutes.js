'use strict';

const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireAdmin, requireTutor, requireTutee } = require('../middleware/roleMiddleware');
const {
  getTuteeSessionHistory,
  getTuteeWalletSpending,
  getTutorEarnings,
  getTutorPerformance,
  getAdminRevenue,
  getAdminWallet,
  getAdminSessions,
  getAdminUsers,
  getAdminExceptions,
  getAdminSubjects,
  getAdminReviews,
  getAdminQualifications,
} = require('../controllers/reportController');

const router = express.Router();

router.use(authMiddleware);

router.get('/tutee/sessions', requireTutee, getTuteeSessionHistory);
router.get('/tutee/wallet', requireTutee, getTuteeWalletSpending);

router.get('/tutor/earnings', requireTutor, getTutorEarnings);
router.get('/tutor/performance', requireTutor, getTutorPerformance);

router.get('/admin/revenue', requireAdmin, getAdminRevenue);
router.get('/admin/wallet', requireAdmin, getAdminWallet);
router.get('/admin/sessions', requireAdmin, getAdminSessions);
router.get('/admin/users', requireAdmin, getAdminUsers);
router.get('/admin/exceptions', requireAdmin, getAdminExceptions);
router.get('/admin/subjects', requireAdmin, getAdminSubjects);
router.get('/admin/reviews', requireAdmin, getAdminReviews);
router.get('/admin/qualifications', requireAdmin, getAdminQualifications);

module.exports = router;
