/**
 * backend/middleware/correlationId.js
 *
 * Attaches a correlation ID to every request for distributed tracing.
 * Uses X-Correlation-ID header if provided by client, otherwise generates a UUID.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

const correlationIdMiddleware = (req, res, next) => {
  const id = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
};

module.exports = { correlationIdMiddleware };