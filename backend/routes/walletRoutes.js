const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getBalance,
  getTransactions,
  purchaseTokens,
  handleMpesaCallback,
  getSpending,
  withdraw
} = require('../controllers/walletController');

const router = express.Router();

// M-Pesa callback (no auth - called by Safaricom)
router.post('/mpesa-callback', handleMpesaCallback);

router.use(authMiddleware);

router.get('/', getBalance);
router.get('/balance', getBalance);
router.get('/transactions', getTransactions);
router.post('/purchase', purchaseTokens);
router.get('/spending', getSpending);
router.post('/withdraw', withdraw);

module.exports = router;
