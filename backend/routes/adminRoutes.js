/**
 * backend/routes/adminRoutes.js — FULL REPLACEMENT
 * Adds GET /admin/overview/full for the new rich admin overview dashboard.
 */

const express = require('express');
const { authMiddleware }   = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/roleMiddleware');
const {
  getAdminOverview,   // NEW — full metrics endpoint
  getAuditLogs,
  getOverview,        // legacy thin overview
  getReviews,
  getSessions,
  getSubjectRequests,
  getTutors,
  getUsers,
  getWallets,
  approveSubjectRequest,
  rejectSubjectRequest,
} = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware, requireSuperAdmin);

// ── New full overview (replaces the thin /overview) ──────────────────────────
router.get('/overview/full', getAdminOverview);

// ── Legacy / section routes (kept, not removed) ──────────────────────────────
router.get('/overview',    getOverview);
router.get('/users',       getUsers);
router.get('/tutors',      getTutors);
router.get('/sessions',    getSessions);
router.get('/wallets',     getWallets);
router.get('/reviews',     getReviews);
router.get('/subject-requests', getSubjectRequests);
router.post('/subject-requests/:id/approve', approveSubjectRequest);
router.post('/subject-requests/:id/reject',  rejectSubjectRequest);
router.get('/audit-logs',  getAuditLogs);

module.exports = router;
