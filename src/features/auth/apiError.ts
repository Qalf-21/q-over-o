export class ApiException extends Error {
  status?: number;
  code?: string;
  errors?: Record<string, string>;

  constructor(message: string, status?: number, errors?: Record<string, string>, code?: string) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}
