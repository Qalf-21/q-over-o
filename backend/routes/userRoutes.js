const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { becomeTutor } = require('../controllers/userController');

const router = express.Router();

router.use(authMiddleware);
router.post('/become-tutor', becomeTutor);

module.exports = router;
