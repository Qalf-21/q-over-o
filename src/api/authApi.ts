import { apiRequest, clearAuthSession, getAuthToken, setAuthSession } from './client';
import type { AuthResponse, GetMeResponse, LoginData, RegisterData, User } from '../features/auth/types';

const normalizeUser = (user: any): User => ({
  id: user.id,
  firstName: user.firstName || user.first_name || user.profile?.first_name || '',
  lastName: user.lastName || user.last_name || user.profile?.last_name || '',
  email: user.email,
  role: user.role || user.profile?.role || 'tutee',
  createdAt: user.createdAt || user.created_at || ''
});

export const authApi = {
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiRequest<{ user: any; token?: string }>('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        password: data.password
      }
    });

    const user = normalizeUser(response.data?.user || {});
    const token = response.data?.token;
    if (token) {
      setAuthSession(token, user);
    } else {
      localStorage.setItem('user', JSON.stringify(user));
    }

    return {
      success: response.success,
      message: response.message || 'Registration successful',
      data: { user, token: token || '' }
    };
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiRequest<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      auth: false,
      body: data
    });

    const user = normalizeUser(response.data?.user || {});
    const token = response.data?.token || '';
    setAuthSession(token, user);

    return {
      success: response.success,
      message: response.message || 'Login successful',
      data: { user, token }
    };
  },

  async me(): Promise<GetMeResponse> {
    const response = await apiRequest<{ user: any }>('/auth/me');
    return {
      success: response.success,
      data: { user: normalizeUser(response.data?.user || {}) }
    };
  },

  async resetPassword(email: string, redirectTo?: string) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      auth: false,
      body: { email, redirectTo }
    });
  },

  async updatePassword(password: string) {
    return apiRequest('/auth/update-password', {
      method: 'POST',
      body: { password }
    });
  },

  logout: clearAuthSession,
  getToken: getAuthToken,
  getStoredUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};
