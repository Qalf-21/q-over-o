import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';

const ADMIN_ROLES = [
  'super_admin',
  'support_admin',
  'finance_admin',
  'moderator',
  'analytics_admin',
];

interface AdminRouteProps {
  children: React.ReactNode;
  allowedAdminRoles?: string[];
}

export const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  allowedAdminRoles = ADMIN_ROLES,
}) => {
  const { isAuthenticated, isLoading, adminRole, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-indigo-100">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading admin console...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (import.meta.env.DEV) console.info('[auth] admin_route.redirect_login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin || !adminRole || !allowedAdminRoles.includes(adminRole)) {
    if (import.meta.env.DEV) console.info('[auth] admin_route.redirect_dashboard', { isAdmin, adminRole });
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
