import http from '@ohos.net.http';
import { NativeHttpTransport } from './NativeHttpTransport';
import { Session } from '../model/Models';
import { NetworkPolicy } from '../utils/NetworkOptions';
import { IntroSegment, IntroTicket, introFromJson } from '../utils/Intro';

// Optional Intro Skipper v1 plugin contract from the fixed Android baseline, outside core OpenAPI.
export class IntroTransport extends NativeHttpTransport {
  private static readonly requestTimeoutMs: number = 3000;
  private static readonly connectTimeoutMs: number = 2000;
  private static readonly readTimeoutMs: number = 2000;
  // HTTP bytes are independent of the parser's UTF-16 code-unit budget.
  private static readonly maxResponseBytes: number = 16384;
  private owner: Session;
  constructor(session: Session) { super(session); this.owner = session; }
  fetch(id: string, allowed: () => boolean): IntroTicket {
    let cancel: () => void = () => {};
    const result = new Promise<IntroSegment | undefined>((resolve) => {
      let connection: http.HttpRequest | undefined; let timer = -1; let settled = false;
      const finish = (value?: IntroSegment): void => { if (settled) { return; } settled = true; if (timer >= 0) { clearTimeout(timer); } try { connection?.destroy(); } catch (e) {} resolve(value); };
      cancel = () => finish();
      try {
        if (!/^[a-zA-Z0-9-]{1,128}$/.test(id) || !allowed() || !this.owner.token || NetworkPolicy.cacheRequired()) { finish(); return; }
        const token = this.owner.token; const user = this.owner.userId; const server = this.owner.serverId;
        const current = (): boolean => allowed() && token === this.owner.token && user === this.owner.userId && server === this.owner.serverId;
        const policy = NetworkPolicy.snapshot(); connection = http.createHttp();
        timer = setTimeout(() => finish(), Math.min(policy.requestMs, IntroTransport.requestTimeoutMs));
        connection.request(this.owner.server + '/Episode/' + encodeURIComponent(id) + '/IntroTimestamps/v1', {
          method: http.RequestMethod.GET, header: { 'Authorization': this.authorization(), 'Accept': 'application/json' },
          expectDataType: http.HttpDataType.STRING, usingCache: false, maxLimit: IntroTransport.maxResponseBytes,
          connectTimeout: Math.min(policy.connectMs, IntroTransport.connectTimeoutMs), readTimeout: Math.min(policy.readMs, IntroTransport.readTimeoutMs)
        }).then((response: http.HttpResponse) => {
          if (settled) { return; }
          try { finish(current() && response.responseCode === 200 && typeof response.result === 'string' ? introFromJson(response.result) : undefined); } catch (e) { finish(); }
        }).catch(() => finish());
      } catch (e) { finish(); }
    });
    return { result: result, cancel: () => cancel() };
  }
}
