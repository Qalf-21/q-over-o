// src/app/App.tsx
// MODIFIED: TutorOnly guard redirects to tutee index; /profile unguarded inside dashboard shell
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
import { UserProfilePage } from '../features/profile/pages/UserProfilePage';

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
        <Route path="/profile"      element={<TutorOnly><Profile /></TutorOnly>} />

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

          {/* ── Protected dashboard ── */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Protected user profile page ── */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <DashboardLayout user={null}>
                  <UserProfilePage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all — redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
