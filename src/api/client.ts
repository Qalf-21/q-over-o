const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  session_id?: string;
};

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
};

export const getAuthToken = () => localStorage.getItem('token');

export const setAuthSession = (token: string | null, user: unknown) => {
  if (token) {
    localStorage.setItem('token', token);
  }
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { body, auth = true, headers, ...requestOptions } = options;
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({
    success: false,
    message: 'Invalid server response'
  }));

  if (!response.ok) {
    throw new Error(result.message || `Request failed with status ${response.status}`);
  }

  return result;
}
