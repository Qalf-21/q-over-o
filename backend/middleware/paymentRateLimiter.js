/**
 * backend/middleware/paymentRateLimiter.js
 *
 * Rate Limiting for Payment Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 * Protects:
 *   — STK Push initiation (1 per 30s per user; 5 per 10min per IP)
 *   — Callback endpoint (200/min per IP — to absorb Safaricom retries)
 *   — Withdrawal endpoint (3 per hour per user)
 */

'use strict';

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

// ── Custom rate-limit exceeded handler ───────────────────────────────────────

function rateLimitExceededHandler(req, res) {
  const correlationId = req.correlationId || 'unknown';

  logger.warn({
    event:         'rate_limit_exceeded',
    ip:            req.ip,
    path:          req.path,
    userId:        req.user?.id,
    correlationId,
  }, 'Rate limit hit');

  res.status(429).json({
    success: false,
    code:    'RATE_LIMITED',
    message: 'Too many requests. Please wait before trying again.',
    retryAfter: res.getHeader('Retry-After'),
  });
}

// ── IPv6-safe IP helper ───────────────────────────────────────────────────────
// express-rate-limit v7+ requires IP-based keyGenerators to normalise IPv6.
// We extract the helper if available, otherwise fall back to req.ip.

const { ipKeyGenerator } = rateLimit;
const safeIp = (req) =>
  typeof ipKeyGenerator === 'function' ? ipKeyGenerator(req) : req.ip;

// ── STK Push: 1 request per 30 seconds per authenticated user ────────────────
// Prevents accidental double-taps and intentional abuse.
const stkPushLimiter = rateLimit({
  windowMs:        30 * 1000,   // 30-second window
  max:             1,
  keyGenerator:    (req) => `stk:${req.user?.id || safeIp(req)}`,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitExceededHandler,
  skip:            (req) => req.method === 'OPTIONS',
  message:         'Please wait 30 seconds before initiating another payment.',
});

// ── STK Push burst: 5 per 10 minutes per IP (bot/scraper protection) ─────────
const stkPushBurstLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,  // 10 minutes
  max:             5,
  keyGenerator:    (req) => `stk_burst:${safeIp(req)}`,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitExceededHandler,
});

// ── Callback endpoint: 200 per minute per IP ─────────────────────────────────
// Higher limit — Safaricom can retry callbacks multiple times.
const callbackLimiter = rateLimit({
  windowMs:        60 * 1000,  // 1 minute
  max:             200,
  keyGenerator:    (req) => `callback:${safeIp(req)}`,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitExceededHandler,
});

// ── Withdrawal: 3 per hour per authenticated user ────────────────────────────
const withdrawalLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,  // 1 hour
  max:             3,
  keyGenerator:    (req) => `withdraw:${req.user?.id || safeIp(req)}`,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitExceededHandler,
});

// ── Generic wallet read: 60 per minute per user ───────────────────────────────
const walletReadLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  keyGenerator:    (req) => `wallet_read:${req.user?.id || safeIp(req)}`,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitExceededHandler,
});

module.exports = {
  stkPushLimiter,
  stkPushBurstLimiter,
  callbackLimiter,
  withdrawalLimiter,
  walletReadLimiter,
};