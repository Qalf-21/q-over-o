// backend/routes/tutorRoutes.js  — FULL REPLACEMENT
// KEY FIX: specific static paths are now registered BEFORE the /:id wildcard,
// each carrying its own authMiddleware inline so the wildcard public routes
// can stay at the bottom without interfering.

const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireTutor } = require('../middleware/roleMiddleware');
const {
  searchTutors,
  getTutorById,
  getTutorReviews,
  getTutorAvailability,
  getMyAvailability,
  getMyProfile,
  updateProfile,
  createAvailability,
  deleteAvailability,
  toggleAvailability,          // ← new
  revertTutorApplication,
  getSubjects,
  getDashboardStats,
} = require('../controllers/tutorController');
const { becomeTutor } = require('../controllers/userController');

const router = express.Router();

// ── Specific static public routes (must come before /:id wildcard) ────────────
router.get('/',         searchTutors);
router.get('/search',   searchTutors);
router.get('/subjects', getSubjects);

// ── Specific static private routes (must come before /:id wildcard) ───────────
// Inline authMiddleware on each so we don't use router.use() which would also
// apply auth to the wildcard public routes below.

router.post('/become',               authMiddleware, becomeTutor);
router.get('/profile/me',            authMiddleware, requireTutor, getMyProfile);
router.put('/profile',               authMiddleware, requireTutor, updateProfile);
router.get('/dashboard/stats',       authMiddleware, requireTutor, getDashboardStats);
router.delete('/application',        authMiddleware, revertTutorApplication);

// Availability — GET must be before /:id or Express will match id="availability"
router.get('/availability',          authMiddleware, requireTutor, getMyAvailability);
router.post('/availability',         authMiddleware, requireTutor, createAvailability);
// toggle must be before /availability/:slotId or Express matches slotId="toggle"
router.patch('/availability/toggle', authMiddleware, requireTutor, toggleAvailability);
router.delete('/availability/:slotId', authMiddleware, requireTutor, deleteAvailability);

// ── Wildcard public routes (after all specific paths) ─────────────────────────
router.get('/:id',                 getTutorById);
router.get('/:id/reviews',         getTutorReviews);
router.get('/:id/availability',    getTutorAvailability);

module.exports = router;