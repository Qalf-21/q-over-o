export class ApiException extends Error {
  status?: number;
  errors?: Record<string, string>;

  constructor(message: string, status?: number, errors?: Record<string, string>) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.errors = errors;
  }
}