const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireTutee } = require('../middleware/roleMiddleware');
const { getTuteeStats } = require('../controllers/dashboardController');

const router = express.Router();

router.use(authMiddleware);
router.get('/tutee/stats', requireTutee, getTuteeStats);

module.exports = router;