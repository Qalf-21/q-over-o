const express = require('express');
const { body } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  createReview,
  updateReview,
  deleteReview,
  getTutorReviews
} = require('../controllers/reviewController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', [
  body('sessionId').notEmpty(),
  body('tutorId').optional().notEmpty(),
  body('revieweeId').optional().notEmpty(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], createReview);

router.put('/:id', [
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().trim()
], updateReview);

router.delete('/:id', deleteReview);

router.get('/tutor/:tutorId', getTutorReviews);

module.exports = router;
