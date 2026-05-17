/**
 * backend/server.js  (UPDATED — adds correlation ID + structured request logging)
 *
 * Drop-in replacement for the existing server.js.
 * Only the payment-infrastructure additions are marked NEW.
 */

'use strict';

const path = require('path');

require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '.env') });

const express    = require('express');
const cors       = require('cors');
const { logger } = require('./utils/logger');           // NEW
const { correlationIdMiddleware } = require('./middleware/correlationId'); // NEW
const { errorHandler }            = require('./utils/errorHandler');

// ── Routes ─────────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/authRoutes');
const profileRoutes   = require('./routes/profileRoutes');
const tutorRoutes     = require('./routes/tutorRoutes');
const sessionRoutes   = require('./routes/sessionRoutes');
const walletRoutes    = require('./routes/walletRoutes');    // NEW (full replacement)
const reviewRoutes    = require('./routes/reviewRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes      = require('./routes/userRoutes');
const adminRoutes     = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes    = require('./routes/reportRoutes');
const { expireOverdueSessions } = require('./controllers/sessionController');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Core middleware ─────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));         // prevent large payload attacks
app.use(express.urlencoded({ extended: true }));

// NEW: attach correlation ID to every request
app.use(correlationIdMiddleware);

// NEW: structured HTTP access log
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      event:          'http_request',
      method:         req.method,
      path:           req.path,
      status:         res.statusCode,
      durationMs:     Date.now() - start,
      correlationId:  req.correlationId,
      ip:             req.ip,
    });
  });
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/profile',   profileRoutes);
app.use('/api/tutors',    tutorRoutes);
app.use('/api/sessions',  sessionRoutes);
app.use('/api/wallet',    walletRoutes);
app.use('/api/reviews',   reviewRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports',   reportRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

setInterval(() => {
  expireOverdueSessions().catch(error => {
    logger.error({ event: 'session_expiry_failed', error }, 'Failed to expire overdue sessions');
  });
}, 60 * 1000).unref();

// ── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ event: 'server_start', port: PORT, env: process.env.NODE_ENV },
    `Q-over-o backend listening on port ${PORT}`);
});

module.exports = app;
