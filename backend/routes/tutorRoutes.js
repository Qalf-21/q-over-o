const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireTutor } = require('../middleware/roleMiddleware');
const {
  searchTutors,
  getTutorById,
  getTutorReviews,
  getTutorAvailability,
  getMyProfile,
  updateProfile,
  createAvailability,
  deleteAvailability,
  revertTutorApplication,
  getSubjects,
  getDashboardStats
} = require('../controllers/tutorController');

const router = express.Router();

// Public routes
router.get('/', searchTutors);
router.get('/search', searchTutors);
router.get('/subjects', getSubjects);
router.get('/:id', getTutorById);
router.get('/:id/reviews', getTutorReviews);
router.get('/:id/availability', getTutorAvailability);

// Protected routes
router.use(authMiddleware);
router.get('/profile/me', requireTutor, getMyProfile);
router.put('/profile', requireTutor, updateProfile);
router.post('/availability', requireTutor, createAvailability);
router.delete('/availability/:slotId', requireTutor, deleteAvailability);
router.delete('/application', revertTutorApplication);
router.get('/dashboard/stats', requireTutor, getDashboardStats); // NEW

module.exports = router;
