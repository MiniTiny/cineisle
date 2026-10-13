import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandButton } from '../components/BrandButton';
import { UiLayout } from '../utils/UiLayout';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { DownloadRecord } from '../model/Models';
import { AppService } from '../service/AppService';
import { JellyfinClient } from '../service/JellyfinClient';
import { errorText } from '../utils/Strings';

@Entry
@Component
struct Downloads {
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
  private remove(record: DownloadRecord): void {
    AlertDialog.show({ title: $r('app.string.remove_download'), message: $r('app.string.remove_download_confirm'),
      primaryButton: { value: $r('app.string.cancel'), action: () => {} }, secondaryButton: { value: $r('app.string.remove'), action: async () => {
        if (this.client !== AppService.client) { return; }
        try { await AppService.removeDownload(record); this.changed(); } catch (e) { this.message = errorText(e as Error); }
      } } });
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
        if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')) }
      }.padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).width('100%')
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
              Text(record.item.Name).fontColor('#F2F3FA').fontSize(18).width('100%')
              Text(record.state === 'queued' ? $r('app.string.download_queued') : record.state === 'complete' ? $r('app.string.download_complete') : record.state === 'downloading' ?
                $r('app.string.download_progress', Math.floor(record.progress * 100)) : record.failure || $r('app.string.download_interrupted')).fontColor($r('app.color.brand_muted')).width('100%')
              if (record.state === 'downloading') { Progress({ value: record.progress * 100, total: 100 }).color($r('app.color.brand_accent')).width('100%') }
                Column({ space: 8 }) {
                  if (record.state === 'complete') {
                    BrandButton({ label: $r('app.string.play'), icon: $r('app.media.detail_play'), primary: true, available: !this.busy, onSelect: async () => {
                      try { await router.pushUrl({ url: 'pages/Player', params: await AppService.playback(record.item, '', true) }); } catch (e) { this.message = errorText(e as Error); }
                    } })
                  } else if (!['downloading', 'queued'].includes(record.state)) {
                    BrandButton({ label: $r('app.string.retry'), icon: $r('app.media.menu_sync'), primary: true, available: !this.busy, onSelect: () => this.retry(record) })
                  }
                  if (['downloading', 'queued'].includes(record.state)) {
                    BrandButton({ label: $r('app.string.stop_download'), icon: $r('app.media.menu_cancel'), available: !this.busy, onSelect: () => this.remove(record) })
                  } else {
                    BrandButton({ label: $r('app.string.remove_download'), icon: $r('app.media.detail_remove'), destructive: true, available: !this.busy, onSelect: () => this.remove(record) })
                  }
                }.width('100%')
            }.padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20).width('100%')
          }
        }, (r: DownloadRecord) => `${r.id}:${r.state}:${r.progress}:${r.failure}`)
        if (!this.visibleRecords().length) { ListItem() {
          Column({ space: 12 }) {
            Image($r('app.media.menu_offline')).width(40).height(40).accessibilityLevel('no')
            Text($r('app.string.no_downloads')).fontColor($r('app.color.brand_muted')).textAlign(TextAlign.Center).width('100%')
          }.width('100%').padding(24).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
        } }
      }.layoutWeight(1).width('100%')

    }.padding(16).backgroundColor($r('app.color.brand_background')).width('100%').height('100%')
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
