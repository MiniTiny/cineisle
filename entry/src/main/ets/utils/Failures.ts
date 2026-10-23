export type FailureCategory = 'network' | 'authorization' | 'storage' | 'response';

// Machine identity is independent of the legacy message retained for existing callers.
export class AppFailure extends Error {
  readonly failureCode: string;
  readonly category: FailureCategory;
  readonly params: Array<string | number>;
  readonly status?: number;
  constructor(code: string, category: FailureCategory, message: string = code, params: Array<string | number> = [], status?: number) {
    super(message);
    this.failureCode = code;
    this.category = category;
    this.params = params;
    this.status = status;
  }
}

interface HttpError extends Error { status?: number }

export function connectionFailure(error: Error): boolean {
  const status = (error as HttpError).status;
  if (status !== undefined) { return status === 408 || (status >= 500 && status <= 599); }
  if (error instanceof AppFailure) { return error.category === 'network'; }
  // Compatibility for platform, native bridge and older plain Error producers.
  const message = error.message;
  if (/\b(401|403)\b/.test(message)) { return false; }
  return /network|timeout|connection|offline|ECONN|ENET|EHOST|fetch failed|\b408\b|\b50[0-9]\b|^http_[0-9]{3}$/.test(message) && !/^http_4/.test(message);
}

export function authorizationFailure(error: Error): boolean {
  if (error instanceof AppFailure) { return error.category === 'authorization'; }
  return /\b(401|403)\b|http_(401|403)|login_expired|permission_denied/.test(error.message);
}

// Endpoint recovery is deliberately narrower than the sync/offline policy.
export function endpointRecoveryFailure(error: Error): boolean {
  const code = error instanceof AppFailure ? error.failureCode : error.message;
  return code === 'network_failed' || [408, 502, 503, 504].includes((error as HttpError).status!);
}

export function failureCode(error: Error): string { return error instanceof AppFailure ? error.failureCode : error.message; }
