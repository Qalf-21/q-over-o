const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, resetPassword, updatePassword } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('first_name').trim().isLength({ min: 2 }),
  body('last_name').trim().isLength({ min: 2 })
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], login);

router.post('/reset-password', [
  body('email').isEmail().normalizeEmail()
], resetPassword);

router.post('/update-password', authMiddleware, [
  body('password').isLength({ min: 8 })
], updatePassword);

router.get('/me', authMiddleware, getMe);

module.exports = router;
