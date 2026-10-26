import { AppRoutes } from '../utils/Navigation';
import { UiPalette } from '../utils/UiPalette';
import { downloadVersion } from '../utils/DownloadIdentity';
import { showBrandDialog } from '../components/CompactDialog';
import { BrandState } from '../components/BrandState';
import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandButton } from '../components/BrandButton';
import { UiLayout } from '../utils/UiLayout';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { DownloadRecord } from '../model/Models';
import { AppService } from '../service/AppService';
import { JellyfinClient } from '../service/JellyfinClient';
import { errorText, text } from '../utils/Strings';

@Entry
@Component
struct Downloads {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleLandscape') landscape: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State records: DownloadRecord[] = [];
  @State category: string = 'active';
  @State message: string = '';
  @State busy: boolean = false;
  private client: JellyfinClient | undefined = undefined;
  private changed: () => void = () => { this.records = [...AppService.downloads]; };
  private timer: number = -1;
  aboutToAppear(): void { this.client = AppService.client; this.records = [...AppService.downloads]; }
  onPageShow(): void {
    if (this.client && this.client !== AppService.client) { this.records = []; router.back(); return; }
    AppService.subscribeDownloads(this.changed); this.changed();
    if (this.timer >= 0) { clearInterval(this.timer); }
    this.timer = setInterval(() => { AppService.pollDownloads(); }, 1000);
  }
  onPageHide(): void { AppService.unsubscribeDownloads(this.changed); if (this.timer >= 0) { clearInterval(this.timer); this.timer = -1; } }
  aboutToDisappear(): void { this.onPageHide(); }
  private visibleRecords(): DownloadRecord[] {
    return this.records.filter((r: DownloadRecord) => this.category === 'active' ? ['queued', 'downloading'].includes(r.state) :
      this.category === 'complete' ? r.state === 'complete' : ['failed', 'interrupted', 'missing'].includes(r.state));
  }
  private async retry(record: DownloadRecord): Promise<void> {
    this.busy = true; this.message = '';
    try { await AppService.retryDownload(record); this.category = 'active'; }
    catch (e) { if (this.client === AppService.client) { this.message = errorText(e as Error); } }
    finally { this.busy = false; this.changed(); }
  }
  private async retrySubtitles(record: DownloadRecord): Promise<void> {
    if (this.busy || this.client !== AppService.client) { return; }
    this.busy = true; this.message = '';
    try { await AppService.retrySubtitles(record); }
    catch (e) { if (this.client === AppService.client) { this.message = errorText(e as Error); } }
    finally { this.busy = false; this.changed(); }
  }
  private remove(record: DownloadRecord): void {
    showBrandDialog(() => this.getUIContext(), { width: this.viewportHeight < 440 ? Math.min(720, this.viewportWidth - 32) : undefined, height: this.viewportHeight < 440 ? '90%' : undefined, backgroundColor: (this.amoled ? this.palette.amoledBackground : this.palette.raised), backgroundBlurStyle: BlurStyle.NONE, cornerRadius: 20, title: $r('app.string.remove_download'), message: $r('app.string.remove_download_confirm'),
      buttonDirection: this.viewportHeight < 440 && this.viewportWidth >= 600 ? DialogButtonDirection.HORIZONTAL : DialogButtonDirection.VERTICAL, buttons: [{ defaultFocus: true, value: $r('app.string.cancel'), fontColor: this.palette.accent, action: () => {} }, { value: $r('app.string.remove'), fontColor: this.palette.danger, action: async () => {
        if (this.client !== AppService.client) { return; }
        try { await AppService.removeDownload(record); this.changed(); } catch (e) { this.message = errorText(e as Error); }
      } }] }, this.viewportWidth, this.viewportHeight);
  }
  @Builder
  private filtersPanel() {
      Column({ space: 12 }) {
        BrandHeading({ label: $r('app.string.download_status'), icon: $r('app.media.detail_download') })
        Flex({ wrap: FlexWrap.Wrap }) {
          Column() { BrandButton({ label: $r('app.string.download_active'), icon: $r('app.media.detail_download'), compact: true, primary: this.category === 'active', onSelect: () => { this.category = 'active'; } }) }.width(this.fontScale > 1 || this.viewportWidth < 360 ? '100%' : '31%').margin({ right: '2%', bottom: 8 })
          Column() { BrandButton({ label: $r('app.string.download_completed'), icon: $r('app.media.nav_check_active'), compact: true, primary: this.category === 'complete', onSelect: () => { this.category = 'complete'; } }) }.width(this.fontScale > 1 || this.viewportWidth < 360 ? '100%' : '31%').margin({ right: '2%', bottom: 8 })
          Column() { BrandButton({ label: $r('app.string.download_failed'), icon: $r('app.media.menu_reset'), compact: true, primary: this.category === 'failed', onSelect: () => { this.category = 'failed'; } }) }.width(this.fontScale > 1 || this.viewportWidth < 360 ? '100%' : '32%').margin({ bottom: 8 })
        }.width('100%')
        if (this.busy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
        if (this.message) { Text(this.message).fontColor(this.palette.danger) }
      }.padding(16).borderRadius(20).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).width('100%')
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column({ space: 12 }) {
      BrandHeader({ label: $r('app.string.downloads'), onBack: () => router.back() })
      if (UiLayout.separateFilters(this.viewportHeight, this.landscape)) {
        Scroll() { this.filtersPanel() }.width('100%').height(UiLayout.filters(this.viewportHeight, this.fontScale)).align(Alignment.TopStart)
      }
      List({ space: 12 }) {
      if (!UiLayout.separateFilters(this.viewportHeight, this.landscape)) { ListItem() { this.filtersPanel() } }

        ForEach(this.visibleRecords(), (record: DownloadRecord) => {
          ListItem() {
            Column({ space: 10 }) {
              Text(record.item.Name).fontColor(this.palette.foreground).fontSize(18).width('100%')
                Text(downloadVersion(record) || $r('app.string.download_legacy_version')).fontColor(this.palette.muted).fontSize(13).width('100%')
              if (record.expectedSize === undefined) { Text($r('app.string.download_size_unknown')).fontColor(this.palette.warm).fontSize(12).width('100%') }
              Text(record.state === 'queued' ? $r('app.string.download_queued') : record.state === 'complete' ? $r('app.string.download_complete') : record.state === 'downloading' ?
                $r('app.string.download_progress', Math.floor(record.progress * 100)) : record.failure || $r('app.string.download_interrupted')).fontColor(this.palette.muted).width('100%')
              if (record.state === 'downloading') { Progress({ value: record.progress * 100, total: 100 }).color(this.palette.accent).width('100%') }
                Column({ space: 8 }) {
                  if (record.state === 'complete') {
                    BrandButton({ label: $r('app.string.play'), icon: $r('app.media.detail_play'), primary: true, available: !this.busy, onSelect: async () => {
                      try { await router.pushUrl({ url: AppRoutes.player, params: AppService.downloadPlayback(record) }); } catch (e) { this.message = errorText(e as Error); }
                    } })
                    if (record.subtitleState !== 'ready') {
                      Text(record.subtitleState === 'pending' ? $r('app.string.offline_subtitles_pending') : $r('app.string.offline_subtitles_incomplete')).fontColor(this.palette.warm).fontSize(12).width('100%')
                      BrandButton({ label: $r('app.string.retry_subtitles'), icon: $r('app.media.menu_sync'), available: !this.busy, onSelect: () => this.retrySubtitles(record) })
                    }
                  } else if (!['downloading', 'queued'].includes(record.state)) {
                    BrandButton({ label: $r('app.string.retry'), icon: $r('app.media.menu_sync'), primary: true, available: !this.busy, onSelect: () => this.retry(record) })
                  }
                  if (['downloading', 'queued'].includes(record.state)) {
                    BrandButton({ label: $r('app.string.stop_download'), icon: $r('app.media.menu_cancel'), available: !this.busy, onSelect: () => this.remove(record) })
                  } else {
                    BrandButton({ label: $r('app.string.remove_download'), icon: $r('app.media.detail_remove'), destructive: true, available: !this.busy, onSelect: () => this.remove(record) })
                  }
                }.width('100%')
            }.padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20).width('100%')
          }
        }, (r: DownloadRecord) => `${r.path}:${r.state}:${r.progress}:${r.failure}:${r.subtitleState}`)
        if (!this.visibleRecords().length) { ListItem() {
          BrandState({ label: $r('app.string.no_downloads'), icon: $r('app.media.menu_offline') })
        } }
      }.layoutWeight(1).width('100%')

    }.padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.background)).width('100%').height('100%')
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
