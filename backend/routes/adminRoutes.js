/**
 * backend/routes/adminRoutes.js — FULL REPLACEMENT
 * Adds GET /admin/overview/full for the new rich admin overview dashboard.
 */

const express = require('express');
const { authMiddleware }   = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const {
  getAdminOverview,   // NEW — full metrics endpoint
  getAuditLogs,
  getOverview,        // legacy thin overview
  getReports,
  getReviews,
  getSessions,
  getSubjectRequests,
  getTutors,
  getUsers,
  getWallets,
  updateUserStatus,
  deleteUser,
  promoteAdmin,
  revokeAdmin,
  updateTutorStatus,
  verifyTutor,
  cancelAdminSession,
  resolveSessionDispute,
  approveSubjectRequest,
  rejectSubjectRequest,
} = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware, requireAdmin);

// ── New full overview (replaces the thin /overview) ──────────────────────────
router.get('/overview/full', getAdminOverview);

// ── Legacy / section routes (kept, not removed) ──────────────────────────────
router.get('/overview',    getOverview);
router.get('/reports',     getReports);
router.get('/users',       getUsers);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/admin', promoteAdmin);
router.delete('/users/:id/admin', revokeAdmin);
router.get('/tutors',      getTutors);
router.patch('/tutors/:id/status', updateTutorStatus);
router.patch('/tutors/:id/verify', verifyTutor);
router.get('/sessions',    getSessions);
router.post('/sessions/:id/cancel', cancelAdminSession);
router.post('/sessions/:id/resolve-dispute', resolveSessionDispute);
router.get('/wallets',     getWallets);
router.get('/reviews',     getReviews);
router.get('/subject-requests', getSubjectRequests);
router.post('/subject-requests/:id/approve', approveSubjectRequest);
router.post('/subject-requests/:id/reject',  rejectSubjectRequest);
router.get('/audit-logs',  getAuditLogs);

module.exports = router;
