// ==========================
// CORE DOMAIN MODEL
// ==========================
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'tutee' | 'tutor';
  createdAt: string;
}

// ==========================
// AUTH REQUEST PAYLOADS
// ==========================
export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// ==========================
// AUTH RESPONSES
// ==========================
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

// ==========================
// CURRENT USER (GET /me)
// ==========================
export interface GetMeResponse {
  success: boolean;
  data: {
    user: User;
  };
}

// ==========================
// OPTIONAL (FUTURE SAFE)
// ==========================

// ==========================
// API ERROR STRUCTURE
// ==========================
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string>; // field-level errors (e.g. email: "Invalid")
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string>;
}

// Auth state (for context typing if needed later)
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
