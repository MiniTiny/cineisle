import http from '@ohos.net.http';
import { NativeHttpTransport } from './NativeHttpTransport';
import { Session } from '../model/Models';
import { NetworkPolicy } from '../utils/NetworkOptions';
import { BIF_LIMIT, BifTransfer, bifWidth } from '../utils/Bif';

// Optional Jellyscrub plugin routes, separate from the core Jellyfin OpenAPI contract.
export class TrickplayTransport extends NativeHttpTransport {
  private owner: Session;
  constructor(session: Session) { super(session); this.owner = session; }
  fetch(id: string, allowed: () => boolean): BifTransfer {
    let cancel: () => void = () => {};
    const result = new Promise<ArrayBuffer | undefined>((resolve) => {
      let connection: http.HttpRequest | undefined; let timer = -1; let watch = -1; let settled = false;
      const close = (): void => { if (timer >= 0) { clearTimeout(timer); timer = -1; } const previous = connection; connection = undefined; try { previous?.destroy(); } catch (e) {} };
      const finish = (bytes?: ArrayBuffer): void => { if (settled) { return; } settled = true; close(); if (watch >= 0) { clearInterval(watch); watch = -1; } resolve(bytes); };
      cancel = () => finish();
      try {
        if (!/^[a-zA-Z0-9-]{1,128}$/.test(id) || !allowed() || !this.owner.token || NetworkPolicy.cacheRequired()) { finish(); return; }
        const token = this.owner.token; const user = this.owner.userId; const server = this.owner.serverId; const endpoint = this.owner.server;
        const current = (): boolean => !settled && allowed() && token === this.owner.token && user === this.owner.userId && server === this.owner.serverId && endpoint === this.owner.server && !NetworkPolicy.cacheRequired();
        watch = setInterval(() => { try { if (!current()) { finish(); } } catch (e) { finish(); } }, 250);
        const policy = NetworkPolicy.snapshot();
        const request = (path: string, binary: boolean): void => {
          if (!current()) { finish(); return; }
          close(); connection = http.createHttp(); timer = setTimeout(() => finish(), Math.min(policy.requestMs, binary ? 8000 : 3000));
          connection.request(endpoint + '/Trickplay/' + encodeURIComponent(id) + path, {
            method: http.RequestMethod.GET, header: { 'Authorization': this.authorization(), 'Accept': binary ? 'application/octet-stream' : 'application/json' },
            expectDataType: binary ? http.HttpDataType.ARRAY_BUFFER : http.HttpDataType.STRING, usingCache: false, maxLimit: binary ? BIF_LIMIT : 16384,
            connectTimeout: Math.min(policy.connectMs, 3000), readTimeout: Math.min(policy.readMs, binary ? 6000 : 2000)
          }).then((response: http.HttpResponse) => {
            if (settled) { return; }
            try {
              if (!current() || response.responseCode !== 200) { finish(); return; }
              if (binary) { const bytes = response.result; finish(bytes instanceof ArrayBuffer && bytes.byteLength <= BIF_LIMIT ? bytes : undefined); }
              else { const width = typeof response.result === 'string' ? bifWidth(response.result) : undefined; if (width === undefined) { finish(); } else { request('/' + width + '/GetBIF', true); } }
            } catch (e) { finish(); }
          }).catch(() => finish());
        };
        request('/GetManifest', false);
      } catch (e) { finish(); }
    });
    return { result: result, cancel: () => cancel() };
  }
}
