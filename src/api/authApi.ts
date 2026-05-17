// ─────────────────────────────────────────────────────────────────────────────
// authApi — all auth-related API calls
//
// Changes from original:
//   • login()    now stores refresh_token returned by the backend
//   • register() now stores refresh_token returned by the backend
//   • refreshSession() added — used by AuthContext on app init
// ─────────────────────────────────────────────────────────────────────────────

import {
  apiRequest,
  clearAuthSession,
  getAuthToken,
  getRefreshToken,
  setAuthSession,
  updateTokens,
} from './client';
import type {
  AdminRole,
  AuthResponse,
  GetMeResponse,
  LoginData,
  RegisterData,
  User,
} from '../features/auth/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const adminRoles: AdminRole[] = ['super_admin', 'support_admin', 'finance_admin', 'moderator', 'analytics_admin'];

const normalizeUser = (user: Record<string, unknown>): User => {
  const profile = (user.profile as Record<string, unknown> | undefined) ?? {};
  const rawRole = String(user.role ?? profile.role ?? 'tutee');
  const adminRoleValue = user.adminRole ?? user.admin_role;
  const adminRole = adminRoles.includes(adminRoleValue as AdminRole) ? adminRoleValue as AdminRole : null;
  return {
    id:        String(user.id ?? ''),
    firstName: String(user.firstName ?? user.first_name  ?? profile.first_name ?? ''),
    lastName:  String(user.lastName  ?? user.last_name   ?? profile.last_name  ?? ''),
    email:     String(user.email     ?? profile.email ?? ''),
    role:      (rawRole === 'tutor' ? 'tutor' : 'tutee'),
    adminRole,
    isAdmin:   Boolean(adminRole || user.isAdmin || user.is_admin),
    createdAt: String(user.createdAt ?? user.created_at ?? profile.created_at ?? ''),
  };
};

// ─── authApi ──────────────────────────────────────────────────────────────────

export const authApi = {

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiRequest<{
      user: Record<string, unknown>;
      token?: string;
      refresh_token?: string;
    }>('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        first_name: data.first_name,
        last_name:  data.last_name,
        email:      data.email,
        password:   data.password,
      },
    });

    const user         = normalizeUser(response.data?.user ?? {});
    const accessToken  = response.data?.token;
    const refreshToken = response.data?.refresh_token;

    // Persist both tokens plus user profile
    setAuthSession(accessToken ?? null, user, refreshToken);

    return {
      success: response.success,
      message: response.message ?? 'Registration successful',
      data: { user, token: accessToken ?? '' },
    };
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiRequest<{
      user: Record<string, unknown>;
      token: string;
      refresh_token?: string;
    }>('/auth/login', {
      method: 'POST',
      auth: false,
      body: data,
    });

    const user         = normalizeUser(response.data?.user ?? {});
    const accessToken  = response.data?.token ?? '';
    const refreshToken = response.data?.refresh_token;

    setAuthSession(accessToken, user, refreshToken);

    return {
      success: response.success,
      message: response.message ?? 'Login successful',
      data: { user, token: accessToken },
    };
  },

  async me(): Promise<GetMeResponse> {
    const response = await apiRequest<{ user: Record<string, unknown> }>('/auth/me');
    return {
      success: response.success,
      data: { user: normalizeUser(response.data?.user ?? {}) },
    };
  },

  /**
   * Exchanges a stored refresh_token for a new access_token.
   * Called by AuthContext on app initialization to eagerly validate the session.
   *
   * Returns true if the session was refreshed successfully.
   * Returns false if there is no refresh token (guest user).
   * Throws if the refresh_token is invalid/expired (session is dead).
   */
  async refreshSession(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const response = await apiRequest<{
      access_token: string;
      refresh_token?: string;
    }>('/auth/refresh', {
      method: 'POST',
      auth: false,
      body: { refresh_token: refreshToken },
    });

    const newAccessToken  = response.data?.access_token;
    const newRefreshToken = response.data?.refresh_token;

    if (!newAccessToken) throw new Error('Refresh response missing access_token');

    updateTokens(newAccessToken, newRefreshToken);
    return true;
  },

  async resetPassword(email: string, redirectTo?: string) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      auth: false,
      body: { email, redirectTo },
    });
  },

  async updatePassword(password: string) {
    return apiRequest('/auth/update-password', {
      method: 'POST',
      body: { password },
    });
  },

  logout: clearAuthSession,

  getToken: getAuthToken,

  getRefreshToken,

  getStoredUser(): User | null {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
};
