import { authApi } from '../../api/authApi';
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
}

export const authService = new AuthService();
