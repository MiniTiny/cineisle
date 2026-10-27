import http from '@ohos.net.http';
import { NativeHttpTransport } from '../api/NativeHttpTransport';
import { ApiQuery } from '../api/generated/JellyfinApi';
import { Session } from '../model/Models';
import { discoveryAddress } from '../utils/ServerDiscovery';

// A single public-system request with no Authorization header, cookies or saved account.
export class DiscoveryProbe extends NativeHttpTransport {
  private static readonly requestTimeoutMs: number = 6000;
  private static readonly connectTimeoutMs: number = 4000;
  private static readonly readTimeoutMs: number = 4000;
  private static readonly maxResponseBytes: number = 65536;
  private static readonly maxResponseCodeUnits: number = 65536;
  private address: string;
  private aborted: boolean = false;
  private used: boolean = false;
  private abort: (() => void) | undefined;
  constructor(address: string) {
    const anonymous = new Session(); anonymous.server = discoveryAddress(address);
    super(anonymous); this.address = anonymous.server;
  }
  cancel(): void { this.aborted = true; this.abort?.(); }
  request<T>(path: string, method: string, query: ApiQuery[], body: string): Promise<T> {
    if (this.aborted) { return Promise.reject(new Error('discovery_cancelled')); }
    if (this.used || path !== '/System/Info/Public' || method !== 'GET' || query.length || body) { return Promise.reject(new Error('api_parameter_invalid')); }
    this.used = true;
    return new Promise<T>((resolve, reject) => {
      const connection = http.createHttp(); let settled = false; let timer = -1;
      const finish = (error: Error | undefined, value?: T): void => {
        if (settled) { return; } settled = true;
        if (timer >= 0) { clearTimeout(timer); } this.abort = undefined;
        try { connection.destroy(); } catch (e) { /* Native request may already be closed. */ }
        if (error) { reject(error); } else { resolve(value as T); }
      };
      this.abort = () => finish(new Error('discovery_cancelled'));
      timer = setTimeout(() => finish(new Error('discovery_verify_timeout')), DiscoveryProbe.requestTimeoutMs);
      try {
        connection.request(this.address + path, { method: http.RequestMethod.GET,
          header: { 'Accept': 'application/json' }, expectDataType: http.HttpDataType.STRING,
          connectTimeout: DiscoveryProbe.connectTimeoutMs, readTimeout: DiscoveryProbe.readTimeoutMs, maxLimit: DiscoveryProbe.maxResponseBytes }).then((response: http.HttpResponse) => {
          if (settled) { return; }
          try {
            if (response.responseCode !== 200 || typeof response.result !== 'string' || response.result.length > DiscoveryProbe.maxResponseCodeUnits) { throw new Error('discovery_verify_failed'); }
            finish(undefined, JSON.parse(response.result) as T);
          } catch (e) { finish(new Error('discovery_verify_failed')); }
        }).catch(() => finish(new Error('discovery_verify_failed')));
      } catch (e) { finish(new Error('discovery_verify_failed')); }
    });
  }
}
