/* eslint-disable react-refresh/only-export-components */
// ─────────────────────────────────────────────────────────────────────────────
// AuthContext — single React auth context for the entire frontend
//
// Session restoration on app init (initAuth):
//   1. If localStorage has no token → guest, done.
//   2. If token exists → call GET /api/auth/me to validate against the server.
//      • Success        → use the freshly-fetched user profile (avoids stale data).
//      • 401 failure    → client.ts 401 interceptor fires automatically:
//                         it attempts refresh → if successful, /me is retried.
//                         If refresh also fails → client.ts clears storage and
//                         redirects to /login before this code even catches.
//      • Network error  → fall back to the locally-stored user so the app
//                         stays usable offline; token will be validated on
//                         the next real API call.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../auth/authService';
import type { AdminRole, Profile, User } from './types';
import { parseApiError } from '../../shared/utils/apiError';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextType {
  user:            User | null;
  profile:         Profile | null;
  adminRole:       AdminRole | null;
  isAdmin:         boolean;
  isAuthenticated: boolean;
  isLoading:       boolean;
  authReady:       boolean;
  login:           (email: string, password: string) => Promise<void>;
  register:        (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  refreshUser:     () => Promise<void>;
  logout:          () => void;
  error:           string | null;
  clearError:      () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const authDebug = (event: string, payload: Record<string, unknown> = {}) => {
    if (import.meta.env.DEV) {
      console.info('[auth]', event, payload);
    }
  };

  // ── Session restoration on mount ────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = authService.getToken();
      const storedUser  = authService.getStoredUser();

      // No credentials in storage → guest user, nothing to do
      if (!storedToken || !storedUser) {
        authDebug('init.guest');
        setIsLoading(false);
        return;
      }

      // Optimistically set the stored user so the UI doesn't flash blank
      setUser(storedUser);
      authDebug('init.stored_user', {
        userId: storedUser.id,
        role: storedUser.role,
        adminRole: storedUser.adminRole,
        isAdmin: storedUser.isAdmin,
      });

      try {
        // Validate the stored access token against the server.
        // If the token is expired, client.ts will transparently:
        //   • call POST /api/auth/refresh
        //   • update localStorage with the new tokens
        //   • retry GET /api/auth/me automatically
        const { data } = await authService.getMe();
        // Sync with latest server-side profile (role changes, name updates, etc.)
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        authDebug('init.server_user', {
          userId: data.user.id,
          role: data.user.role,
          adminRole: data.user.adminRole,
          isAdmin: data.user.isAdmin,
        });
      } catch {
        // If we end up here it means both the original request AND the automatic
        // refresh attempt failed (i.e., the Supabase refresh token is also dead).
        // client.ts will have already called clearAuthSession() and redirected
        // to /login, but we also clean up React state defensively here.
        authService.logout();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.login({ email, password });
      setUser(response.data.user);
      authDebug('login.done', {
        userId: response.data.user.id,
        role: response.data.user.role,
        adminRole: response.data.user.adminRole,
        isAdmin: response.data.user.isAdmin,
      });
    } catch (err) {
      const message = parseApiError(err, 'Login failed. Something went wrong.').message;
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    firstName: string,
    lastName:  string,
    email:     string,
    password:  string,
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authService.register({
        first_name: firstName,
        last_name:  lastName,
        email,
        password,
      });
      setUser(response.data.user);
    } catch (err) {
      const message = parseApiError(err, 'Registration failed. Something went wrong.').message;
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    authService.logout();
    setUser(null);
    setError(null);
  };

  /**
   * Forces a server-side profile refresh and updates React state.
   * Used after profile edits, role promotions (become-tutor), etc.
   */
  const refreshUser = async (): Promise<void> => {
    const { data } = await authService.getMe();
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    authDebug('refresh_user.done', {
      userId: data.user.id,
      role: data.user.role,
      adminRole: data.user.adminRole,
      isAdmin: data.user.isAdmin,
    });
  };

  const clearError = (): void => setError(null);
  const profile = (user ? {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    role: user.role,
  } : null) as Profile | null;
  const adminRole = user?.adminRole ?? null;
  const isAdmin = Boolean(adminRole || user?.isAdmin);

  // ── Context value ────────────────────────────────────────────────────────────

  const value: AuthContextType = {
    user,
    profile,
    adminRole,
    isAdmin,
    isAuthenticated: !!user,
    isLoading,
    authReady: !isLoading,
    login,
    register,
    refreshUser,
    logout,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
