import { BusinessError } from '@ohos.base';
import http from '@ohos.net.http';
import { ApiQuery, ApiTransport } from './generated/JellyfinApi';
import { Session } from '../model/Models';
import { queryString } from '../utils/Protocol';
import { text } from '../utils/Strings';
import { ProductIdentity } from '../utils/ProductIdentity';

// The generated client owns wire routes/types; this adapter owns native HTTP and credentials.
export class NativeHttpTransport implements ApiTransport {
  private session: Session;
  constructor(session: Session) { this.session = session; }

  private authorization(): string {
    if ([this.session.deviceId, this.session.token].some((value: string) => /["\r\n]/.test(value))) { throw new Error('api_session_invalid'); }
    const base = `MediaBrowser Client="${ProductIdentity.CLIENT_NAME}", Device="HarmonyOS Phone", DeviceId="${this.session.deviceId}", Version="${ProductIdentity.VERSION}"`;
    return this.session.token ? `${base}, Token="${this.session.token}"` : base;
  }

  private method(value: string): http.RequestMethod {
    switch (value) {
      case 'GET': return http.RequestMethod.GET;
      case 'POST': return http.RequestMethod.POST;
      case 'DELETE': return http.RequestMethod.DELETE;
      default: throw new Error('api_parameter_invalid');
    }
  }

  // Image/AVPlayer/system download consume URLs. Credentials never enter generated DTOs.
  url(path: string, query: ApiQuery[]): string {
    const encoded = queryString([...query, { key: 'api_key', value: this.session.token }]);
    return `${this.session.server}${path}?${encoded}`;
  }

  async request<T>(path: string, method: string, query: ApiQuery[], body: string): Promise<T> {
    const response = await this.read(path, method, query, body, 'application/json');
    if (!response) { return undefined as T; }
    const value = parseJson(response);
    return value as T;
  }

  async text(path: string, method: string, query: ApiQuery[], body: string): Promise<string> {
    return this.read(path, method, query, body, 'text/plain');
  }

  private async read(path: string, method: string, params: ApiQuery[], body: string, accept: string): Promise<string> {
    const nativeMethod = this.method(method);
    const authorization = this.authorization();
    if (body) { parseJson(body); }
    const query = queryString(params);
    const connection = http.createHttp();
    try {
      const options: http.HttpRequestOptions = {
        method: nativeMethod,
        header: { 'Authorization': authorization, 'Content-Type': 'application/json', 'Accept': accept },
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 15000,
        readTimeout: 30000
      };
      // Native HTTP rejects an explicitly empty body on some POST/DELETE requests.
      if (body) { options.extraData = body; }
      const response = await connection.request(`${this.session.server}${path}${query ? '?' + query : ''}`, options);
      if (response.responseCode === 401) { throw new Error('login_expired'); }
      if (response.responseCode === 403) { throw new Error('permission_denied'); }
      if (response.responseCode < 200 || response.responseCode >= 300) { throw new Error(text('http_failed', response.responseCode)); }
      if (response.responseCode === 204) { return ''; }
      if (typeof response.result !== 'string') { throw new Error('api_response_invalid'); }
      if (response.result.trim().startsWith('<')) { throw new Error('html_response'); }
      return response.result;
    } catch (e) {
      const code = (e as BusinessError).code;
      if (code !== undefined && code >= 2300000 && code < 2400000) { throw new Error('network_failed'); }
      throw e as Error;
    } finally { connection.destroy(); }
  }
}

function parseJson(source: string): Object | null {
  let value: Object | null;
  try { value = JSON.parse(source) as Object | null; } catch (e) { throw new Error('api_response_invalid'); }
  validateNumbers(value, 0);
  return value;
}

function validateNumbers(value: Object | null, depth: number): void {
  if (depth > 128) { throw new Error('api_response_invalid'); }
  if (typeof value === 'number') {
    const number = value as number;
    if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) { throw new Error('api_numeric_range'); }
  } else if (Array.isArray(value)) {
    (value as Array<Object | null>).forEach((entry: Object | null) => validateNumbers(entry, depth + 1));
  } else if (value !== null && typeof value === 'object') {
    const record = value as Record<string, Object | null>;
    Object.keys(record).forEach((key: string) => validateNumbers(record[key], depth + 1));
  }
}
