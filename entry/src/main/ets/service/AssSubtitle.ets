import { AssRenderLimits } from '../utils/SubtitleLimits';
import ass, { NativeAssFrame, NativeAssHandle } from 'libcineisle_ass.so';
import image from '@ohos.multimedia.image';
import { AssFonts } from './AssFonts';
import { StyledSubtitleFrame, StyledSubtitleSession } from '../utils/StyledSubtitle';

interface RenderRequest { time: number; width: number; height: number; epoch: number }

// One native request at a time; keep the latest requested clock without queuing every video tick.
export class AssSubtitle implements StyledSubtitleSession {
  private handle: NativeAssHandle;
  private publish: (frame: StyledSubtitleFrame | undefined) => void;
  private failure: () => void;
  private pending: RenderRequest | undefined;
  private running: boolean = false;
  private closed: boolean = false;
  private epoch: number = 0;
  private cached: StyledSubtitleFrame | undefined;

  private constructor(handle: NativeAssHandle, publish: (frame: StyledSubtitleFrame | undefined) => void, failure: () => void) {
    this.handle = handle; this.publish = publish; this.failure = failure;
  }

  static async create(document: string, cacheDirectory: string, publish: (frame: StyledSubtitleFrame | undefined) => void, failure: () => void): Promise<StyledSubtitleSession> {
    const fonts = AssFonts.prepare(cacheDirectory);
    const handle = await ass.create(document, fonts.path, fonts.family, fonts.configuration);
    return new AssSubtitle(handle, publish, failure);
  }

  render(milliseconds: number, videoWidth: number, videoHeight: number): void {
    if (this.closed || !Number.isFinite(milliseconds) || milliseconds < 0 ||
      !Number.isInteger(videoWidth) || !Number.isInteger(videoHeight) || videoWidth <= 0 || videoHeight <= 0 || videoWidth > AssRenderLimits.maxSourceDimensionPx || videoHeight > AssRenderLimits.maxSourceDimensionPx) { return; }
    this.pending = { time: Math.floor(milliseconds), width: videoWidth, height: videoHeight, epoch: this.epoch };
    if (!this.running) { this.drain(); }
  }

  private async bitmap(frame: NativeAssFrame): Promise<StyledSubtitleFrame | undefined> {
    if (!frame.present) { return undefined; }
    const bitmap = await image.createPixelMap(frame.rgba, { size: { width: frame.width, height: frame.height },
      srcPixelFormat: image.PixelMapFormat.RGBA_8888, pixelFormat: image.PixelMapFormat.RGBA_8888,
      alphaType: image.AlphaType.PREMUL, editable: false });
    return { bitmap: bitmap, canvasWidth: frame.canvasWidth, canvasHeight: frame.canvasHeight,
      left: frame.left, top: frame.top, width: frame.width, height: frame.height };
  }

  private async drain(): Promise<void> {
    this.running = true;
    try {
      while (!this.closed && this.pending) {
        const request = this.pending; this.pending = undefined;
        const scale = Math.min(1, AssRenderLimits.targetWidthPx / request.width, AssRenderLimits.targetHeightPx / request.height);
        const width = Math.max(1, Math.floor(request.width * scale));
        const height = Math.max(1, Math.floor(request.height * scale));
        const frame = await ass.render(this.handle, request.time, width, height, request.width, request.height);
        if (this.closed) { return; }
        if (frame.changed) {
          const next = await this.bitmap(frame);
          if (this.closed) { await next?.bitmap.release(); return; }
          // Consume changed native frames even when clear() invalidated their publication.
          // A following unchanged result can then safely reuse the exact matching native image.
          this.cached = next;
        }
        if (request.epoch === this.epoch) { this.publish(this.cached); }
      }
    } catch (e) {
      if (!this.closed) { this.close(); this.failure(); }
    } finally {
      this.running = false;
      if (!this.closed && this.pending) { this.drain(); }
    }
  }

  clear(): void {
    if (this.closed) { return; }
    ++this.epoch; this.pending = undefined; this.publish(undefined);
  }

  close(): void {
    if (this.closed) { return; }
    this.closed = true; ++this.epoch; this.pending = undefined; this.cached = undefined;
    try { this.publish(undefined); } finally { ass.close(this.handle); }
    // Published PixelMaps remain owned by ArkUI/PiP references until GC releases them.
    // Explicit release is reserved for a new map discarded before it reaches any consumer.
  }
}
