// src/app/App.tsx
// MODIFIED: /dashboard/profile is the single private settings page for all roles.
//           /tutors/:id is the new public marketplace tutor page.
//           The old standalone /profile route is removed.

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
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
import { AdminLayout } from '../features/admin/components/AdminLayout';
import { AdminOverview } from '../features/admin/pages/AdminOverview';
import { AdminSectionPage } from '../features/admin/pages/AdminSectionPage';
import { AdminAuditLogs } from '../features/admin/pages/AdminAuditLogs';
import { AdminSubjectRequests } from '../features/admin/pages/AdminSubjectRequests';
import { AdminUsers } from '../features/admin/pages/AdminUsers';
import { AdminTutors } from '../features/admin/pages/AdminTutors';
import { AdminSessions } from '../features/admin/pages/AdminSessions';
import { AdminWallets } from '../features/admin/pages/AdminWallets';
import { adminApi } from '../api/adminApi';
import { JaasMeetingPage } from '../features/sessions/JaasMeetingPage';
import { AdminReportPage } from '../modules/reports/pages/AdminReportPage';
import { TuteeSessionReportPage } from '../modules/reports/pages/TuteeSessionReportPage';
import { TuteeWalletReportPage } from '../modules/reports/pages/TuteeWalletReportPage';
import { TutorEarningsReportPage } from '../modules/reports/pages/TutorEarningsReportPage';
import { TutorPerformanceReportPage } from '../modules/reports/pages/TutorPerformanceReportPage';
import { ReportType } from '../modules/reports/core/report.types';

// ── Role-aware redirect for the dashboard index ──────────────────────────────
// Tutors  → /dashboard/overview
// Tutees  → /dashboard/discover
const DashboardIndex: React.FC = () => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAdmin) {
    if (import.meta.env.DEV) console.info('[auth] dashboard.redirect', { target: '/dashboard/admin' });
    return <Navigate to="/dashboard/admin" replace />;
  }
  if (import.meta.env.DEV) console.info('[auth] dashboard.redirect', { target: user?.role === 'tutor' ? '/dashboard/overview' : '/dashboard/discover', role: user?.role });
  return (
    <Navigate
      to={user?.role === 'tutor' ? '/dashboard/overview' : '/dashboard/discover'}
      replace
    />
  );
};

const AdminDashboard: React.FC = () => (
  <AdminRoute>
    <AdminLayout>
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="tutors" element={<AdminTutors />} />
        <Route path="sessions" element={<AdminSessions />} />
        <Route path="wallets" element={<AdminWallets />} />
        <Route path="reviews" element={<AdminSectionPage title="Reviews" description="Moderate review content and rating signals." loadRows={adminApi.getReviews} />} />
        <Route path="subject-requests" element={<AdminSubjectRequests />} />
        <Route path="reports" element={<Navigate to="/dashboard/admin/reports/financial" replace />} />
        <Route path="reports/analytics" element={<Navigate to="/dashboard/admin/reports/financial" replace />} />
        <Route path="reports/financial" element={<AdminReportPage type={ReportType.ADMIN_PLATFORM_REVENUE} />} />
        <Route path="reports/wallet" element={<AdminReportPage type={ReportType.ADMIN_WALLET_AUDIT} />} />
        <Route path="reports/sessions" element={<AdminReportPage type={ReportType.ADMIN_SESSION_ANALYTICS} />} />
        <Route path="reports/users" element={<AdminReportPage type={ReportType.ADMIN_USER_ANALYTICS} />} />
        <Route path="reports/exceptions" element={<AdminReportPage type={ReportType.ADMIN_EXCEPTION_REPORTS} />} />
        <Route path="reports/subjects" element={<AdminReportPage type={ReportType.ADMIN_SUBJECT_ANALYTICS} />} />
        <Route path="reports/reviews" element={<AdminReportPage type={ReportType.ADMIN_REVIEW_ANALYTICS} />} />
        <Route path="reports/qualifications" element={<AdminReportPage type={ReportType.ADMIN_TUTOR_QUALIFICATION_PROGRESS} />} />
        <Route path="notifications" element={<AdminSectionPage title="Notifications" description="Prepare platform announcements and admin-triggered messages." />} />
        <Route path="settings" element={<AdminSectionPage title="Settings" description="Configure admin policies, roles, and operational controls." />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="*" element={<Navigate to="/dashboard/admin" replace />} />
      </Routes>
    </AdminLayout>
  </AdminRoute>
);

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
    <Routes>
      <Route path="/admin/*" element={<AdminDashboard />} />
      <Route
        path="/*"
        element={
          <DashboardLayout user={user}>
      <Routes>
        {/* Index redirect — role-aware */}
        <Route path="/" element={<DashboardIndex />} />

        {/* ── Tutor-only routes ── */}
        <Route path="/overview"     element={<TutorOnly><Overview /></TutorOnly>} />
        <Route path="/sessions"     element={<TutorOnly><Sessions /></TutorOnly>} />
        <Route path="/availability" element={<TutorOnly><Availability /></TutorOnly>} />
        <Route path="/earnings"     element={<TutorOnly><Earnings /></TutorOnly>} />
        <Route path="/reports/earnings"     element={<TutorOnly><TutorEarningsReportPage /></TutorOnly>} />
        <Route path="/reports/performance"  element={<TutorOnly><TutorPerformanceReportPage /></TutorOnly>} />

        {/* ── Shared private profile/settings page (all authenticated roles) ── */}
        {/* Profile is NOT TutorOnly — tutees also have a settings page here   */}
        <Route path="/profile" element={<Profile />} />

        {/* ── Learner routes — accessible to BOTH tutors and tutees ── */}
        {/* Tutees reach these via /dashboard/*                         */}
        <Route path="/discover"    element={<Discover />} />
        <Route path="/my-sessions" element={<MySessions />} />
        <Route path="/history"     element={<History />} />
        <Route path="/reports/sessions" element={<TuteeSessionReportPage />} />
        <Route path="/reports/wallet" element={<TuteeWalletReportPage />} />

        {/* Tutor learner aliases — keep sidebar "Learn" links working */}
        <Route path="/learn/discover"  element={<Discover />} />
        <Route path="/learn/sessions"  element={<MySessions />} />
        <Route path="/learn/history"   element={<History />} />
        <Route path="/learn/reports/sessions" element={<TuteeSessionReportPage />} />
        <Route path="/learn/reports/wallet" element={<TuteeWalletReportPage />} />

        {/* Catch-all inside dashboard — role-aware index */}
        <Route path="*" element={<DashboardIndex />} />
      </Routes>
          </DashboardLayout>
        }
      />
    </Routes>
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

          <Route
            path="/session/:id/join"
            element={
              <ProtectedRoute>
                <JaasMeetingPage />
              </ProtectedRoute>
            }
          />

          {/* ── Protected dashboard (all routes, including /dashboard/profile) ── */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/tutee/discover" element={<Navigate to="/dashboard/discover" replace />} />
          <Route path="/tutor/overview" element={<Navigate to="/dashboard/overview" replace />} />

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
