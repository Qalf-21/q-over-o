/**
 * backend/routes/walletRoutes.js  (FULL REPLACEMENT)
 *
 * Wallet & Payment Routes for Q-over-o
 * ─────────────────────────────────────────────────────────────────────────────
 * Public (no JWT):
 *   POST /api/wallet/mpesa-callback  — Safaricom callback endpoint
 *   POST /api/wallet/b2c-result      — Safaricom B2C result endpoint
 *   POST /api/wallet/b2c-timeout     — Safaricom B2C timeout endpoint
 *
 * Protected (JWT required):
 *   GET  /api/wallet                          → balance + recent transactions
 *   GET  /api/wallet/balance                  → balance alias
 *   GET  /api/wallet/transactions             → paginated ledger
 *   POST /api/wallet/purchase                 → initiate STK Push
 *   GET  /api/wallet/purchase/:intentId/status → poll payment status
 *   GET  /api/wallet/purchase/checkout/:checkoutRequestId/status → callback-driven status
 *   GET  /api/wallet/spending                 → spending summary
 *   POST /api/wallet/withdraw                 → tutor withdrawal
 */

'use strict';

const express             = require('express');
const { authMiddleware }  = require('../middleware/authMiddleware');
const { requireTutor }    = require('../middleware/roleMiddleware');
const {
  stkPushLimiter,
  stkPushBurstLimiter,
  callbackLimiter,
  withdrawalLimiter,
  walletReadLimiter,
}                         = require('../middleware/paymentRateLimiter');
const {
  getBalance,
  getTransactions,
  purchaseTokens,
  getPurchaseStatus,
  getPurchaseStatusByCheckoutRequestId,
  handleMpesaCallback,
  handleB2CResult,
  handleB2CTimeout,
  getSpending,
  withdraw,
}                         = require('../controllers/walletController');

const router = express.Router();

// ── Public: M-Pesa callback (no JWT) ─────────────────────────────────────────
// Rate limited to absorb Safaricom retries without allowing DoS.
router.post('/mpesa-callback', callbackLimiter, handleMpesaCallback);
router.post('/b2c-result', callbackLimiter, handleB2CResult);
router.post('/b2c-timeout', callbackLimiter, handleB2CTimeout);

// ── All routes below require authentication ───────────────────────────────────
router.use(authMiddleware);

// Balance
router.get('/',           walletReadLimiter, getBalance);
router.get('/balance',    walletReadLimiter, getBalance);
router.get('/transactions', walletReadLimiter, getTransactions);
router.get('/spending',   walletReadLimiter, getSpending);

// STK Push — both rate limiters applied (per-user + per-IP burst)
router.post('/purchase',  stkPushLimiter, stkPushBurstLimiter, purchaseTokens);

// Poll payment status
router.get('/purchase/checkout/:checkoutRequestId/status', walletReadLimiter, getPurchaseStatusByCheckoutRequestId);
router.get('/purchase/:intentId/status', walletReadLimiter, getPurchaseStatus);

// Withdrawal — tutor-only, stricter rate limit
router.post('/withdraw', requireTutor, withdrawalLimiter, withdraw);

module.exports = router;
