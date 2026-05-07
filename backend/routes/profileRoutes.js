// profileRoutes.js
const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteProfile,
} = require('../controllers/profileController');

const router = express.Router();
router.use(authMiddleware);

router.get('/me',              getProfile);
router.put('/update',          updateProfile);
router.post('/change-password', changePassword);
router.delete('/delete',       deleteProfile);

module.exports = router;