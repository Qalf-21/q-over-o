import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { LandingPage } from '../features/landing/LandingPage';
import { Login } from '../features/auth/pages/Login';
import { Register } from '../features/auth/pages/Register';
import { DashboardLayout } from '../features/dashboard/components/DashboardLayout';
import { Overview } from '../features/tutor/pages/Overview';
import { Sessions } from '../features/tutor/pages/Sessions';
import { Availability } from '../features/tutor/pages/Availability';
import { Earnings } from '../features/tutor/pages/Earnings';
import { Profile } from '../features/tutor/pages/Profile';
import { Discover } from '../features/tutee/pages/Discover';
import { MySessions } from '../features/tutee/pages/MySessions';
import { History } from '../features/tutee/pages/History';
// Dashboard wrapper component
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isTutor = user?.role === 'tutor';

  return (
    <DashboardLayout user={user}>
      <Routes>
        {isTutor ? (
        <>
        <Route path="/" element={<Overview />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/learn/discover" element={<Discover />} />
        <Route path="/learn/sessions" element={<MySessions />} />
        <Route path="/learn/history" element={<History />} />
        </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/dashboard/discover" replace />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/sessions" element={<MySessions />} />
            <Route path="/history" element={<History />} />
          </>
        )}
      </Routes>
    </DashboardLayout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Dashboard Routes */}
          <Route 
            path="/dashboard/*" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          {/* 404 Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
