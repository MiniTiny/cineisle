import * as native from 'libcineisle_ass.so';
import image from '@ohos.multimedia.image';
import { UIContext } from '@ohos.arkui.UIContext';
import { SubtitleRun } from './InlineSubtitle';
import { SubtitleMetrics } from './SubtitleMetrics';
import { CaptionColor, CaptionRenderStyle, captionColor } from './CaptionStyle';
import { captionShadows } from './CaptionUI';

export interface CaptionPicture {
  bitmap: image.PixelMap;
  width: number; height: number; layoutWidth: number; layoutHeight: number; halo: number;
}
export function captionArgb(value: CaptionColor): number {
  let hex = (captionColor(value) ?? '#FFFFFFFF').slice(1);
  if (hex.length === 3 || hex.length === 4) { hex = hex.split('').map((v: string): string => v + v).join(''); }
  if (hex.length === 6) { hex = 'FF' + hex; }
  return Number.parseInt(hex, 16);
}
export function captionRequest(runs: SubtitleRun[], style: CaptionRenderStyle, size: number, width: number,
  maxLines: number, intrinsic: boolean, context: UIContext, metrics: SubtitleMetrics, fontScale?: number, revision: string = ''): native.NativeCaptionRequest {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(size) || size <= 0 ||
    !Number.isInteger(maxLines) || maxLines < 1 || maxLines > 1000 || (fontScale !== undefined && (!Number.isFinite(fontScale) || fontScale <= 0 || fontScale > 3))) { throw new Error('subtitle_failed'); }
  return { revision: revision, width: context.vp2px(width), maxLines: maxLines, intrinsic: intrinsic,
    runs: runs.map((run: SubtitleRun): native.NativeCaptionRun => ({ text: run.text,
      family: run.family || style.family, size: style.system ? context.vp2px(size * (run.sizeScale ?? 1)) : fontScale === undefined ? context.fp2px(size * (run.sizeScale ?? 1)) : context.vp2px(size * (run.sizeScale ?? 1) * fontScale),
      baseline: metrics.offset(run, style, size, context, fontScale), color: captionArgb(run.color || style.foreground),
      bold: !!run.bold, italic: !!run.italic, underline: !!run.underline, strike: !!run.strike })),
    shadows: captionShadows(style.edge).map((shadow: ShadowOptions): native.NativeCaptionShadow => ({ color: captionArgb(shadow.color as CaptionColor),
      x: context.vp2px(Number(shadow.offsetX ?? 0)), y: context.vp2px(Number(shadow.offsetY ?? 0)),
      radius: context.vp2px(Number(shadow.radius ?? 0)) })).filter((shadow: native.NativeCaptionShadow): boolean => (shadow.color >>> 24) !== 0) };
}
interface Job { request: native.NativeCaptionRequest; revision: number }
// One job at a time per window. Newer requests replace the queued request; late pictures never reach ArkUI.
export class CaptionRasterizer {
  private pending: Job | undefined;
  private running: boolean = false;
  private closed: boolean = false;
  private revision: number = 0;
  private key: string = '';
  private publish: (picture: CaptionPicture | undefined) => void;
  private failure: () => void;
  constructor(publish: (picture: CaptionPicture | undefined) => void, failure: () => void) { this.publish = publish; this.failure = failure; }

  request(value: native.NativeCaptionRequest): void {
    if (this.closed) { return; }
    const key = JSON.stringify(value); if (key === this.key) { return; }
    this.key = key; this.pending = { request: value, revision: ++this.revision }; this.publish(undefined);
    if (!this.running) { this.drain(); }
  }
  private current(job: Job): boolean { return !this.closed && job.revision === this.revision; }
  private async drain(): Promise<void> {
    this.running = true;
    try {
      while (!this.closed && this.pending) {
        const job = this.pending; this.pending = undefined;
        try {
          const frame = await native.renderCaption(job.request);
          if (!this.current(job)) { continue; }
          if (![frame.width, frame.height, frame.layoutWidth, frame.layoutHeight, frame.halo].every((n: number): boolean => Number.isInteger(n) && n >= 0) ||
            !frame.layoutWidth || !frame.layoutHeight || frame.width !== frame.layoutWidth + frame.halo * 2 ||
            frame.height !== frame.layoutHeight + frame.halo * 2 || frame.width * frame.height > 1920 * 1080 || frame.rgba.byteLength !== frame.width * frame.height * 4) { throw new Error('subtitle_failed'); }
          const bitmap = await image.createPixelMap(frame.rgba, { size: { width: frame.width, height: frame.height },
            srcPixelFormat: image.PixelMapFormat.RGBA_8888, pixelFormat: image.PixelMapFormat.RGBA_8888,
            alphaType: image.AlphaType.PREMUL, editable: false });
          if (!this.current(job)) { await bitmap.release(); continue; }
          this.publish({ bitmap: bitmap, width: frame.width, height: frame.height,
            layoutWidth: frame.layoutWidth, layoutHeight: frame.layoutHeight, halo: frame.halo });
        } catch (e) {
          if (this.current(job)) { this.publish(undefined); this.failure(); }
        }
      }
    } finally { this.running = false; if (!this.closed && this.pending) { this.drain(); } }
  }
  clear(): void { ++this.revision; this.pending = undefined; this.key = ''; this.publish(undefined); }
  close(): void { this.closed = true; this.clear(); }
}
