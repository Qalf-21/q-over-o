// backend/server.js
// MODIFIED: added profileRoutes mounted at /api/profile

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes      = require('./routes/authRoutes');
const tutorRoutes     = require('./routes/tutorRoutes');
const sessionRoutes   = require('./routes/sessionRoutes');
const walletRoutes    = require('./routes/walletRoutes');
const reviewRoutes    = require('./routes/reviewRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes      = require('./routes/userRoutes');
const profileRoutes   = require('./routes/profileRoutes');   // NEW
const { errorHandler } = require('./utils/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Q-over-o API'
  });
});

// API Routes
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/tutors',    tutorRoutes);
app.use('/api/profile',   profileRoutes);    // NEW — profile management
app.get('/api/subjects',  require('./controllers/tutorController').getSubjects);
app.use('/api/sessions',  sessionRoutes);
app.use('/api/wallet',    walletRoutes);
app.use('/api/reviews',   reviewRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
  Q-over-o API Server running on port ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  Frontend: ${process.env.CLIENT_URL || 'http://localhost:5173'}

  Available endpoints:
    POST   /api/auth/register
    POST   /api/auth/login
    GET    /api/auth/me
    POST   /api/users/become-tutor
    GET    /api/profile/me
    PUT    /api/profile/update
    POST   /api/profile/change-password
    DELETE /api/profile/delete
    GET    /api/tutors
    GET    /api/tutors/:id
    GET    /api/subjects
    POST   /api/sessions/book
    GET    /api/sessions
    POST   /api/sessions/:id/complete
    POST   /api/sessions/:id/cancel
    GET    /api/wallet
    POST   /api/wallet/purchase
    GET    /api/reviews/tutor/:tutorId
    POST   /api/reviews
  `);
});

module.exports = app;