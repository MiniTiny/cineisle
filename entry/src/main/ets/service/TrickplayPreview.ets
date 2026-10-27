import image from '@ohos.multimedia.image';
import { BifData, BifFrame, bifFrame } from '../utils/Bif';
import { decodePoster } from './PosterBitmap';

// One decode in flight; intermediate drag positions coalesce. Never decode the entire BIF.
export class TrickplayPreview {
  private static readonly decodeTargetWidthPx: number = 640;
  private data: BifData | undefined;
  private revision: number = 0;
  private decoding: boolean = false;
  private pending: BifFrame | undefined;
  private current: image.PixelMap | undefined;
  private retired: image.PixelMap[] = [];
  private time: number = -1;
  private requestedTime: number = -1;
  private waitingRender: boolean = false;
  private publish: (bitmap?: image.PixelMap, time?: number) => void;
  constructor(publish: (bitmap?: image.PixelMap, time?: number) => void) { this.publish = publish; }
  set(data: BifData): void { this.clear(); this.data = data; }
  request(position: number, duration: number): void {
    const frame = this.data ? bifFrame(this.data, position, duration) : undefined;
    if (!frame) { this.hide(); return; }
    if (this.requestedTime !== frame.time) { ++this.revision; this.requestedTime = frame.time; }
    this.pending = frame; this.drain();
  }
  rendered(): void { this.retired.forEach((map: image.PixelMap) => { map.release().catch(() => {}); }); this.retired = []; this.waitingRender = false; this.drain(); }
  hide(): void { ++this.revision; this.pending = undefined; this.time = -1; this.requestedTime = -1; this.waitingRender = false; this.publish(); if (this.current) { this.retired.push(this.current); this.current = undefined; } this.rendered(); }
  clear(): void { this.hide(); this.data = undefined; }
  private drain(): void {
    if (this.decoding || this.waitingRender || !this.pending || !this.data) { return; }
    const frame = this.pending; this.pending = undefined; if (this.time === frame.time) { return; }
    const revision = this.revision; const data = this.data; this.decoding = true;
    decodePoster(data.bytes.slice(frame.offset, frame.end), TrickplayPreview.decodeTargetWidthPx, () => revision === this.revision && data === this.data).then((bitmap: image.PixelMap) => {
      if (revision !== this.revision || data !== this.data) { bitmap.release().catch(() => {}); return; }
      if (this.current) { this.retired.push(this.current); }
      this.current = bitmap; this.time = frame.time; this.waitingRender = true; this.publish(bitmap, frame.time);
    }).catch(() => { if (revision === this.revision) { this.time = -1; this.publish(); if (this.current) { this.retired.push(this.current); this.current = undefined; } this.rendered(); } }).finally(() => { this.decoding = false; this.drain(); });
  }
}
