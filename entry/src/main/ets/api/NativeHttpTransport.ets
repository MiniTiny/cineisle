import { BusinessError } from '@ohos.base';
import http from '@ohos.net.http';
import { ApiQuery, ApiTransport } from './generated/JellyfinApi';
import { Session } from '../model/Models';
import { queryString } from '../utils/Protocol';
import { text } from '../utils/Strings';
import { PublicSystemInfo } from './generated/Models';
import { addresses } from '../utils/Accounts';
import { ProductIdentity } from '../utils/ProductIdentity';
import { NetworkOptions, NetworkPolicy } from '../utils/NetworkOptions';
import { AppFailure, endpointRecoveryFailure } from '../utils/Failures';

// Shared by response decoding, outgoing JSON validation, and recovery identity checks.
class NativeJsonLimits {
  static readonly maximumValidationDepth: number = 128;
}

class HttpFailure extends AppFailure {
  constructor(status: number) { super('http_failed', 'response', text('http_failed', status), [status], status); }
}
// The generated client owns wire routes/types; this adapter owns native HTTP and credentials.
export class NativeHttpTransport implements ApiTransport {
  private session: Session;
  private recovery: Promise<string> | undefined = undefined;
  endpointChanged: ((address: string) => void) | undefined = undefined;
  constructor(session: Session) { this.session = session; }

  protected authorization(includeToken: boolean = true): string {
    if ([this.session.deviceId, this.session.token].some((value: string) => /["\r\n]/.test(value))) { throw new Error('api_session_invalid'); }
    const base = `MediaBrowser Client="${ProductIdentity.CLIENT_NAME}", Device="HarmonyOS Phone", DeviceId="${this.session.deviceId}", Version="${ProductIdentity.VERSION}"`;
    return includeToken && this.session.token ? `${base}, Token="${this.session.token}"` : base;
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
    if (method === 'GET' && NetworkPolicy.cacheRequired()) { throw new AppFailure('network_failed', 'network'); }
    return this.readAttempt(path, method, params, body, accept, [], NetworkPolicy.snapshot());
  }
  private async readAttempt(path: string, method: string, params: ApiQuery[], body: string, accept: string, tried: string[], policy: NetworkOptions): Promise<string> {
    const address = this.session.server;
    try { return await this.at(address, path, method, params, body, accept, policy); }
    catch (e) {
      if (!this.session.serverId || (!this.session.token && path !== '/System/Info/Public') || !endpointRecoveryFailure(e as Error)) { throw e as Error; }
      const attempted = [...tried, address]; const candidates = addresses(this.session.addresses ?? [address]).filter((v: string) => !attempted.includes(v)); if (!candidates.length) { throw e as Error; }
      if (!this.recovery) {
        this.recovery = this.recover(address, candidates, policy);
        this.recovery.finally(() => { this.recovery = undefined; }).catch(() => {});
      }
      let replacement: string;
      try { replacement = await this.recovery; } catch (ignored) { throw e as Error; }
      // An unknown write outcome is never replayed automatically.
      if (method !== 'GET') { throw e as Error; }
      if (attempted.includes(replacement)) { throw e as Error; }
      return this.readAttempt(path, method, params, body, accept, attempted, policy);
    }
  }
  private async recover(failed: string, candidates: string[], policy: NetworkOptions): Promise<string> {
    if (this.session.server !== failed) { return this.session.server; }
    for (const candidate of candidates.filter((v: string) => v !== failed)) {
      const anonymous = new Session(); anonymous.server = candidate; anonymous.deviceId = this.session.deviceId;
      try {
        const response = await new NativeHttpTransport(anonymous).at(candidate, '/System/Info/Public', 'GET', [], '', 'application/json', policy);
        const info = parseJson(response) as PublicSystemInfo;
        if (info?.Id !== this.session.serverId) { continue; }
        this.session.server = candidate; this.endpointChanged?.(candidate); return candidate;
      } catch (e) { /* No credentials reach an unverified backup address. */ }
    }
    throw new Error('server_unavailable');
  }
  private async at(address: string, path: string, method: string, params: ApiQuery[], body: string, accept: string, policy: NetworkOptions): Promise<string> {
    const nativeMethod = this.method(method);
    const authorization = this.authorization(path !== '/System/Info/Public' && path !== '/Users/Public');
    if (body) { parseJson(body); }
    const query = queryString(params);
    const connection = http.createHttp();
    try {
      const options: http.HttpRequestOptions = {
        method: nativeMethod,
        header: { 'Authorization': authorization, 'Content-Type': 'application/json', 'Accept': accept },
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: policy.connectMs,
        readTimeout: policy.readMs,
        usingCache: false
      };
      // Native HTTP rejects an explicitly empty body on some POST/DELETE requests.
      if (body) { options.extraData = body; }
      const response = await this.timed(connection, `${address}${path}${query ? '?' + query : ''}`, options, policy.requestMs);
      if (response.responseCode === 401) { throw new AppFailure('login_expired', 'authorization'); }
      if (response.responseCode === 403) { throw new AppFailure('permission_denied', 'authorization'); }
      if (response.responseCode < 200 || response.responseCode >= 300) { throw new HttpFailure(response.responseCode); }
      if (response.responseCode === 204) { return ''; }
      if (typeof response.result !== 'string') { throw new Error('api_response_invalid'); }
      if (response.result.trim().startsWith('<')) { throw new Error('html_response'); }
      return response.result;
    } catch (e) {
      const code = (e as BusinessError).code;
      if (code !== undefined && code >= 2300000 && code < 2400000) { throw new AppFailure('network_failed', 'network'); }
      throw e as Error;
    } finally { connection.destroy(); }
  }
  private timed(connection: http.HttpRequest, url: string, options: http.HttpRequestOptions, duration: number): Promise<http.HttpResponse> {
    return new Promise<http.HttpResponse>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; reject(new AppFailure('network_failed', 'network')); } }, duration);
      try {
        connection.request(url, options).then((response: http.HttpResponse) => {
          if (!settled) { settled = true; clearTimeout(timer); resolve(response); }
        }).catch((error: Error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
      } catch (e) { settled = true; clearTimeout(timer); reject(e as Error); }
    });
  }
}

function parseJson(source: string): Object | null {
  let value: Object | null;
  try { value = JSON.parse(source) as Object | null; } catch (e) { throw new Error('api_response_invalid'); }
  validateNumbers(value, 0);
  return value;
}

function validateNumbers(value: Object | null, depth: number): void {
  if (depth > NativeJsonLimits.maximumValidationDepth) { throw new Error('api_response_invalid'); }
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
