import http from '@ohos.net.http';
import { NativeHttpTransport } from './NativeHttpTransport';
import { ApiQuery, JellyfinApi } from './generated/JellyfinApi';
import { ImageFormat, ImageType } from './generated/Models';
import { Session } from '../model/Models';
import { queryString } from '../utils/Protocol';
import { PosterImagePolicy, PosterTarget, PosterTransfer, posterByteLimit, rasterImage, validPosterTarget } from '../utils/PosterOptions';

// Generated image routes, header authentication and bounded binary transfer. URLs contain no token.
export class PosterTransport extends NativeHttpTransport {
  private static readonly requestTimeoutMs: number = 10000;
  private static readonly connectTimeoutMs: number = 5000;
  private static readonly readTimeoutMs: number = 8000;
  private owner: Session;
  constructor(session: Session) { super(session); this.owner = session; }
  url(path: string, query: ApiQuery[]): string {
    const encoded = queryString(query); return this.owner.server + path + (encoded ? '?' + encoded : '');
  }
  fetch(target: PosterTarget, allowed: () => boolean): PosterTransfer {
    let cancel: () => void = () => {};
    const result = new Promise<ArrayBuffer>((resolve, reject) => {
      if (!validPosterTarget(target) || !allowed()) { reject(new Error('poster_cancelled')); return; }
      const token = this.owner.token; const user = this.owner.userId; const server = this.owner.serverId;
      const current = (): boolean => allowed() && token === this.owner.token && user === this.owner.userId && server === this.owner.serverId;
      let connection: http.HttpRequest | undefined; let timer = -1; let settled = false;
      const finish = (error?: string, bytes?: ArrayBuffer): void => {
        if (settled) { return; } settled = true; if (timer >= 0) { clearTimeout(timer); }
        try { connection?.destroy(); } catch (e) { /* Already released. */ }
        if (error) { reject(new Error(error)); } else { resolve(bytes!); }
      };
      cancel = () => finish('poster_cancelled');
      try {
        const api = new JellyfinApi(this);
        const url = target.backdrop ? api.getItemImageByIndexUrl({ itemId: target.id, imageType: ImageType.Backdrop, imageIndex: 0,
          maxWidth: target.width, quality: PosterImagePolicy.jpegQuality, format: ImageFormat.Jpg, tag: target.tag || undefined }) :
          api.getItemImageUrl({ itemId: target.id, imageType: ImageType.Primary, maxWidth: target.width, quality: PosterImagePolicy.jpegQuality, format: ImageFormat.Jpg, tag: target.tag || undefined });
        connection = http.createHttp(); timer = setTimeout(() => finish('poster_unavailable'), PosterTransport.requestTimeoutMs);
        connection.request(url, { method: http.RequestMethod.GET, header: { 'Authorization': this.authorization(), 'Accept': 'image/jpeg,image/png,image/webp' },
          expectDataType: http.HttpDataType.ARRAY_BUFFER, usingCache: false, maxLimit: posterByteLimit, connectTimeout: PosterTransport.connectTimeoutMs, readTimeout: PosterTransport.readTimeoutMs }).then((response: http.HttpResponse) => {
          if (settled) { return; }
          if (!current()) { finish('poster_cancelled'); return; }
          if (response.responseCode === 401 || response.responseCode === 403) { finish('poster_denied'); return; }
          if (response.responseCode === 404) { finish('poster_missing'); return; }
          if (response.responseCode !== 200) { finish('poster_unavailable'); return; }
          if (!(response.result instanceof ArrayBuffer) || !response.result.byteLength || response.result.byteLength > posterByteLimit || !rasterImage(response.result)) { finish('poster_invalid'); return; }
          finish(undefined, response.result);
        }).catch(() => finish(current() ? 'poster_unavailable' : 'poster_cancelled'));
      } catch (e) { finish('poster_unavailable'); }
    });
    return { result: result, cancel: () => cancel() };
  }
}
