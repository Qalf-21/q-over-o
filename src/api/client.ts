// ─────────────────────────────────────────────────────────────────────────────
// API Client — single source of truth for all HTTP communication
//
// Token lifecycle managed here:
//   • access_token  – short-lived Supabase JWT, stored in localStorage
//   • refresh_token – long-lived Supabase token, stored in localStorage
//
// On every 401 response this module:
//   1. Attempts one token refresh via POST /api/auth/refresh
//   2. Retries the original request with the new access token
//   3. If refresh fails → clears all auth state → redirects to /login
//
// Concurrent requests that 401 while a refresh is in-flight are queued and
// replayed automatically once the refresh resolves — no duplicate refreshes.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  session_id?: string;
};

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Send Authorization header. Default: true */
  auth?: boolean;
  /** Internal flag — marks a retry after token refresh to prevent loops */
  _isRetry?: boolean;
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

export const getAuthToken    = (): string | null => localStorage.getItem('token');
export const getRefreshToken = (): string | null => localStorage.getItem('refresh_token');

export const setAuthSession = (
  accessToken: string | null,
  user: unknown,
  refreshToken?: string | null,
): void => {
  if (accessToken) localStorage.setItem('token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
};

export const updateTokens = (accessToken: string, refreshToken?: string | null): void => {
  localStorage.setItem('token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
};

export const clearAuthSession = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

// ─── Refresh machinery ────────────────────────────────────────────────────────
//
// isRefreshing prevents concurrent refresh calls.
// refreshQueue collects requests that arrive while a refresh is in-flight.
// They are all replayed once the refresh resolves/rejects.

let isRefreshing = false;
type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };
let refreshQueue: QueueEntry[] = [];

const drainQueue = (err: unknown, newToken: string | null): void => {
  refreshQueue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(newToken!),
  );
  refreshQueue = [];
};

/**
 * Calls the backend refresh endpoint and updates localStorage.
 * Returns the new access token on success, throws on failure.
 */
const executeRefresh = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Session refresh failed');
  }

  const body: ApiResponse<{ access_token: string; refresh_token: string }> = await res.json();
  const newAccessToken  = body.data?.access_token;
  const newRefreshToken = body.data?.refresh_token;

  if (!newAccessToken) throw new Error('Refresh response missing access_token');

  updateTokens(newAccessToken, newRefreshToken);
  return newAccessToken;
};

// ─── Core request function ────────────────────────────────────────────────────

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { body, auth = true, headers, _isRetry = false, ...requestOptions } = options;

  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  if (response.ok) {
    const result = await response.json().catch(() => ({ success: false, message: 'Invalid server response' }));
    return result as ApiResponse<T>;
  }

  // ── 401 handling — attempt one token refresh then retry ─────────────────────
  if (
    response.status === 401 &&
    !_isRetry &&                          // never loop on a retry
    !path.includes('/auth/refresh') &&    // never recurse on the refresh call itself
    !path.includes('/auth/login') &&      // login failures are not refresh-able
    !path.includes('/auth/register')
  ) {
    // If a refresh is already running, queue this request
    if (isRefreshing) {
      return new Promise<ApiResponse<T>>((resolve, reject) => {
        refreshQueue.push({
          resolve: () => resolve(apiRequest<T>(path, { ...options, _isRetry: true })),
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const newToken = await executeRefresh();
      drainQueue(null, newToken);
      // Retry with the new token (flag _isRetry to prevent any further loops)
      return apiRequest<T>(path, { ...options, _isRetry: true });
    } catch (refreshError) {
      drainQueue(refreshError, null);
      // Unrecoverable — clear state and send to login
      clearAuthSession();
      window.location.href = '/login';
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  }

  // ── Other error responses ───────────────────────────────────────────────────
  const result = await response.json().catch(() => ({
    success: false,
    message: `Request failed with status ${response.status}`,
  }));

  throw new Error((result as { message?: string }).message ?? `Request failed with status ${response.status}`);
}