// src/features/auth/authService.ts
// MODIFIED: added updatePassword() using Supabase auth via backend

import { authApi } from '../../api/authApi';
import { apiRequest } from '../../api/client';
import type {
  AuthResponse,
  GetMeResponse,
  LoginData,
  RegisterData,
  User
} from './types';

class AuthService {
  register(data: RegisterData): Promise<AuthResponse> {
    return authApi.register(data);
  }

  login(data: LoginData): Promise<AuthResponse> {
    return authApi.login(data);
  }

  getMe(): Promise<GetMeResponse> {
    return authApi.me();
  }

  logout(): void {
    authApi.logout();
  }

  getToken(): string | null {
    return authApi.getToken();
  }

  getStoredUser(): User | null {
    return authApi.getStoredUser();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Updates the authenticated user's password.
   * Re-authenticates first with currentPassword, then calls
   * POST /api/profile/change-password with the new password.
   * Supabase handles the actual password update server-side.
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiRequest('/profile/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    });
  }
}

export const authService = new AuthService();