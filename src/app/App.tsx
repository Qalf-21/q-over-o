// src/app/App.tsx
// MODIFIED: /dashboard/profile is the single private settings page for all roles.
//           /tutors/:id is the new public marketplace tutor page.
//           The old standalone /profile route is removed.

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { LandingPage } from '../features/landing/LandingPage';
import { Login } from '../features/auth/pages/Login';
import { Register } from '../features/auth/pages/Register';
import { ForgotPassword } from '../features/auth/pages/ForgotPassword';
import { DashboardLayout } from '../features/dashboard/components/DashboardLayout';
import { Overview } from '../features/tutor/pages/Overview';
import { Sessions } from '../features/tutor/pages/Sessions';
import { Availability } from '../features/tutor/pages/Availability';
import { Earnings } from '../features/tutor/pages/Earnings';
import { Profile } from '../features/tutor/pages/Profile';
import { Discover } from '../features/tutee/pages/Discover';
import { MySessions } from '../features/tutee/pages/MySessions';
import { History } from '../features/tutee/pages/History';
import { TutorPublicPage } from '../features/tutor/pages/TutorPublicPage';

// ── Role-aware redirect for the dashboard index ──────────────────────────────
// Tutors  → /dashboard/overview
// Tutees  → /dashboard/discover
const DashboardIndex: React.FC = () => {
  const { user } = useAuth();
  return (
    <Navigate
      to={user?.role === 'tutor' ? '/dashboard/overview' : '/dashboard/discover'}
      replace
    />
  );
};

// ── Tutor-only guard ─────────────────────────────────────────────────────────
// Non-tutors are redirected to the tutee discover page instead of a dead end.
const TutorOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'tutor') {
    return <Navigate to="/dashboard/discover" replace />;
  }
  return <>{children}</>;
};

// ── Dashboard shell ──────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  return (
    <DashboardLayout user={user}>
      <Routes>
        {/* Index redirect — role-aware */}
        <Route path="/" element={<DashboardIndex />} />

        {/* ── Tutor-only routes ── */}
        <Route path="/overview"     element={<TutorOnly><Overview /></TutorOnly>} />
        <Route path="/sessions"     element={<TutorOnly><Sessions /></TutorOnly>} />
        <Route path="/availability" element={<TutorOnly><Availability /></TutorOnly>} />
        <Route path="/earnings"     element={<TutorOnly><Earnings /></TutorOnly>} />

        {/* ── Shared private profile/settings page (all authenticated roles) ── */}
        {/* Profile is NOT TutorOnly — tutees also have a settings page here   */}
        <Route path="/profile" element={<Profile />} />

        {/* ── Learner routes — accessible to BOTH tutors and tutees ── */}
        {/* Tutees reach these via /dashboard/*                         */}
        <Route path="/discover"    element={<Discover />} />
        <Route path="/my-sessions" element={<MySessions />} />
        <Route path="/history"     element={<History />} />

        {/* Tutor learner aliases — keep sidebar "Learn" links working */}
        <Route path="/learn/discover"  element={<Discover />} />
        <Route path="/learn/sessions"  element={<MySessions />} />
        <Route path="/learn/history"   element={<History />} />

        {/* Catch-all inside dashboard — role-aware index */}
        <Route path="*" element={<DashboardIndex />} />
      </Routes>
    </DashboardLayout>
  );
};

// ── Root app ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/"                element={<LandingPage />} />
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* ── Public marketplace tutor page ── */}
          <Route path="/tutors/:id" element={<TutorPublicPage />} />

          {/* ── Protected dashboard (all routes, including /dashboard/profile) ── */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Legacy /profile redirect → /dashboard/profile */}
          <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />

          {/* Catch-all — redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
