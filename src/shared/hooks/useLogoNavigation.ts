import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { resolveLogoDestination } from '../utils/logoNavigation';

export const useLogoNavigation = () => {
  const location = useLocation();
  const { user, isAdmin } = useAuth();

  return useMemo(() => (
    resolveLogoDestination({
      pathname: location.pathname,
      role: user?.role,
      isAdmin,
    })
  ), [isAdmin, location.pathname, user?.role]);
};
