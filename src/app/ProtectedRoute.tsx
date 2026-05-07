/**
 * ProtectedRoute
 *
 * Guards routes that require authentication.
 * Optionally restricts to specific roles via `allowedRoles`.
 *
 * Unauthenticated users are redirected to /login, with the attempted
 * path saved in location state so LoginForm can redirect back after login.
 *
 * Authenticated users who lack the required role are sent to the dashboard
 * root, which performs a role-aware redirect for them.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, only users whose role is in this list may proceed. */
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the attempted URL so the login page can redirect back
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // User is authenticated but lacks the required role.
    // Redirect to their own dashboard root (which handles the role-aware redirect).
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
