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
import type { User } from './types';
import { ApiException } from './apiError';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextType {
  user:            User | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
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

  // ── Session restoration on mount ────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = authService.getToken();
      const storedUser  = authService.getStoredUser();

      // No credentials in storage → guest user, nothing to do
      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      // Optimistically set the stored user so the UI doesn't flash blank
      setUser(storedUser);

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
    } catch (err) {
      const message =
        err instanceof ApiException
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Login failed. Something went wrong.';
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
      const message =
        err instanceof ApiException
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Registration failed. Something went wrong.';
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
  };

  const clearError = (): void => setError(null);

  // ── Context value ────────────────────────────────────────────────────────────

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
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
