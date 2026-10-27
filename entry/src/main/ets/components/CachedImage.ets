import { UiPalette } from '../utils/UiPalette';
import image from '@ohos.multimedia.image';
import { AppService } from '../service/AppService';
import { AppLock } from '../service/AppLock';
import { JellyfinClient } from '../service/JellyfinClient';
import { decodePoster } from '../service/PosterBitmap';
import { PosterTicket, PosterTarget, PosterData } from '../utils/PosterOptions';

@Component
export struct CachedImage {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @Prop @Watch('reload') imageId: string = '';
  @Prop @Watch('reload') tag: string = '';
  @Prop @Watch('reload') backdrop: boolean = false;
  @Prop @Watch('reload') pixelWidth: number = 480;
  @Prop placeholder: Resource = $r('app.media.poster_placeholder');
  @Prop radius: number = 8;
  @Prop label: string = '';
  @StorageLink('cineIsleLocked') @Watch('lockChanged') locked: boolean = true;
  @StorageLink('cineIslePosterRevision') @Watch('reload') cacheRevision: number = 0;
  @State source: image.PixelMap | Resource = $r('app.media.poster_placeholder');
  private owner: JellyfinClient | undefined;
  private ticket: PosterTicket | undefined;
  private bitmap: image.PixelMap | undefined;
  private retired: image.PixelMap[] = [];
  private alive: boolean = false;
  private visible: boolean = false;
  private revision: number = 0;
  aboutToAppear(): void { this.owner = AppService.client; this.source = this.placeholder; this.alive = true; }
  aboutToDisappear(): void { this.alive = false; this.visible = false; this.reset(); this.releaseRetired(); }
  private allowed(revision: number): boolean { return this.alive && this.visible && !this.locked && AppLock.permit() && revision === this.revision && this.owner !== undefined && this.owner === AppService.client; }
  private reset(): void {
    ++this.revision; this.ticket?.cancel(); this.ticket = undefined; this.source = this.placeholder;
    if (this.bitmap) { this.retired.push(this.bitmap); this.bitmap = undefined; }
  }
  private releaseRetired(): void { const old = this.retired; this.retired = []; old.forEach((bitmap: image.PixelMap) => { bitmap.release().catch(() => {}); }); }
  private lockChanged(): void { if (this.locked) { this.reset(); } else { this.reload(); } }
  private visibleArea(visible: boolean): void { if (this.visible === visible) { return; } this.visible = visible; if (visible) { this.reload(); } else { this.reset(); this.releaseRetired(); } }
  private reload(): void { this.reset(); const revision = this.revision; if (this.allowed(revision)) { this.load(revision); } }
  private async load(revision: number): Promise<void> {
    const client = this.owner; const cache = AppService.posters;
    if (!client || !cache || !this.imageId || !this.allowed(revision)) { return; }
    const target: PosterTarget = { id: this.imageId, tag: this.tag, backdrop: this.backdrop, width: this.pixelWidth };
    let data: PosterData | undefined;
    try {
      const ticket = cache.request(client.session.serverId + '\u0000' + client.session.userId, target,
        (allowed: () => boolean) => client.poster(target, allowed), () => !(AppService.experience?.snapshot().offline ?? false), () => this.allowed(revision));
      this.ticket = ticket; data = await ticket.result;
      const bitmap = await decodePoster(data.bytes, this.pixelWidth, () => this.allowed(revision));
      if (!this.allowed(revision)) { await bitmap.release(); return; }
      this.bitmap = bitmap; this.source = bitmap;
    } catch (e) {
      if (data && (e as Error).message !== 'poster_cancelled') { cache.forget(data.key); }
      if (this.allowed(revision)) { this.source = this.placeholder; }
    }
  }
  build() {
    Image(this.source).alt(this.placeholder).width('100%').height('100%').objectFit(ImageFit.Cover).borderRadius(this.radius)
      .backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).accessibilityText(this.label).accessibilityLevel(this.label ? 'yes' : 'no')
      .onComplete(() => this.releaseRetired()).onError(() => { this.reset(); this.releaseRetired(); })
      .onVisibleAreaChange([0], (visible: boolean) => this.visibleArea(visible))
  }
}
