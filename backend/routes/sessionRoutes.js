const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  bookSession,
  getSessions,
  completeSession,
  cancelSession,
  undoCancellation
} = require('../controllers/sessionController');

const router = express.Router();

router.use(authMiddleware);
router.post('/book', bookSession);
router.get('/', getSessions);
router.post('/:id/complete', completeSession);
router.post('/:id/cancel', cancelSession);
router.post('/:id/cancel/undo', undoCancellation);

module.exports = router;
