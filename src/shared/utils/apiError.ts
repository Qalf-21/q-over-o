import { ApiException } from '../../features/auth/apiError';

export interface ParsedApiError {
  message: string;
  code?: string;
  status?: number;
  fieldErrors: Record<string, string>;
  retryable: boolean;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export const parseApiError = (error: unknown, fallback = 'Something went wrong. Please try again.'): ParsedApiError => {
  if (error instanceof ApiException) {
    return {
      message: error.message || fallback,
      code: error.code,
      status: error.status,
      fieldErrors: error.errors ?? {},
      retryable: !error.status || error.status >= 500 || error.code === 'NETWORK_ERROR',
    };
  }

  const raw = toRecord(error);
  const response = toRecord(raw.response);
  const data = toRecord(response.data ?? raw.data);
  const errors = toRecord(data.errors ?? raw.errors);
  const code = String(data.code ?? raw.code ?? '') || undefined;
  const status = Number(response.status ?? raw.status) || undefined;
  const message = String(data.message ?? raw.message ?? fallback);

  return {
    message,
    code,
    status,
    fieldErrors: Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, String(value)])),
    retryable: !status || status >= 500 || code === 'NETWORK_ERROR',
  };
};
