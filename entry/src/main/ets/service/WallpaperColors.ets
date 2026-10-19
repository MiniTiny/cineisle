import wallpaper from '@ohos.wallpaper';
import { DynamicPalette, wallpaperPalette } from '../utils/DynamicPalette';

export interface PaletteTicket { result: Promise<DynamicPalette | undefined>; cancel: () => void }
// No wallpaper files or permissions: read only bounded RGB metadata, at most one native RPC at a time.
export class WallpaperColors {
  private pending: Promise<wallpaper.RgbaColor[]> | undefined;
  private pendingRevision: number = 0;
  private revision: number = 0;
  private knownEvent: boolean = false;
  private latest: DynamicPalette | undefined;
  private watching: boolean = false;
  private listenerEpoch: number = 0;
  private handler: ((colors: wallpaper.RgbaColor[], type: wallpaper.WallpaperType) => void) | undefined;
  private notify: ((palette?: DynamicPalette) => void) | undefined;
  private changed = (colors: wallpaper.RgbaColor[], type: wallpaper.WallpaperType): void => {
    if (!this.watching || type !== wallpaper.WallpaperType.WALLPAPER_SYSTEM) { return; }
    ++this.revision; this.knownEvent = true; this.latest = wallpaperPalette(colors); this.notify?.(this.latest);
  };
  start(notify: (palette?: DynamicPalette) => void): void {
    this.notify = notify;
    if (this.watching || !canIUse('SystemCapability.MiscServices.Wallpaper')) { return; }
    const epoch = ++this.listenerEpoch;
    const handler = (colors: wallpaper.RgbaColor[], type: wallpaper.WallpaperType): void => { if (epoch === this.listenerEpoch) { this.changed(colors, type); } };
    this.handler = handler;
    try { wallpaper.on('colorChange', handler); this.watching = true; }
    catch (e) { ++this.listenerEpoch; this.handler = undefined; try { wallpaper.off('colorChange', handler); } catch (ignored) {} }
  }
  stop(): void {
    this.notify = undefined; this.knownEvent = false; ++this.revision; ++this.listenerEpoch;
    const handler = this.handler; this.handler = undefined;
    if (this.watching) { this.watching = false; try { wallpaper.off('colorChange', handler); } catch (e) {} }
  }
  read(allowed: () => boolean): PaletteTicket {
    let cancel: () => void = () => {};
    const result = new Promise<DynamicPalette | undefined>((resolve) => {
      let settled = false; let timer = -1;
      const finish = (palette?: DynamicPalette): void => { if (settled) { return; } settled = true; if (timer >= 0) { clearTimeout(timer); } resolve(palette); };
      cancel = () => finish();
      try {
        if (!allowed() || !canIUse('SystemCapability.MiscServices.Wallpaper')) { finish(); return; }
        if (this.pending && this.pendingRevision !== this.revision) { finish(this.knownEvent ? this.latest : undefined); return; }
        if (!this.pending) {
          this.pendingRevision = this.revision;
          const request = wallpaper.getColors(wallpaper.WallpaperType.WALLPAPER_SYSTEM); this.pending = request;
          request.then(() => { if (this.pending === request) { this.pending = undefined; } }, () => { if (this.pending === request) { this.pending = undefined; } });
        }
        const revision = this.revision; timer = setTimeout(() => finish(), 1500);
        this.pending.then((colors: wallpaper.RgbaColor[]) => { try { if (allowed() && revision === this.revision) { finish(wallpaperPalette(colors)); } else { finish(); } } catch (e) { finish(); } }).catch(() => finish());
      } catch (e) { finish(); }
    });
    return { result: result, cancel: () => cancel() };
  }
}
