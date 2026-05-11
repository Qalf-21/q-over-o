/**
 * backend/utils/logger.js
 *
 * Structured JSON logger for Q-over-o
 * ─────────────────────────────────────────────────────────────────────────────
 * • JSON output in production (machine-readable, ingestible by Datadog/Logtail)
 * • Pretty output in development
 * • Correlation/trace ID support
 * • Payment-specific audit log helpers
 * • Never logs secrets: consumer key, passkey, raw tokens are scrubbed
 *
 * Install: npm install pino pino-pretty
 */

'use strict';

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  }),
  redact: {
    paths: [
      'consumer_secret',
      'consumerSecret',
      'MPESA_CONSUMER_SECRET',
      'passkey',
      'MPESA_PASSKEY',
      'access_token',
      'password',
      'Password',
      'Authorization',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
  base: {
    service: 'q-over-o-backend',
    env:     process.env.NODE_ENV || 'development',
  },
});

// ── Correlation ID helpers ────────────────────────────────────────────────────

/**
 * Create a child logger that carries a correlationId on every log line.
 * Used per-request or per payment flow.
 *
 * @param {string} correlationId  - e.g. UUID from X-Correlation-ID header
 * @param {object} [extra]        - additional static fields
 */
function withCorrelationId(correlationId, extra = {}) {
  return logger.child({ correlationId, ...extra });
}

// ── Payment audit helpers ─────────────────────────────────────────────────────

/**
 * Log a payment lifecycle event — always at INFO level regardless of environment.
 * These entries form the immutable audit trail.
 */
function auditPayment(fields) {
  logger.info({ audit: true, ...fields }, `[PAYMENT_AUDIT] ${fields.event}`);
}

/**
 * Log a wallet operation (credit / debit / escrow change).
 */
function auditWallet(fields) {
  logger.info({ audit: true, ...fields }, `[WALLET_AUDIT] ${fields.event}`);
}

module.exports = { logger, withCorrelationId, auditPayment, auditWallet };

// Allow `const logger = require('./logger')` (default-import style) as well
module.exports.default = logger;