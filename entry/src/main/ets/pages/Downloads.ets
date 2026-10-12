import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { DownloadRecord } from '../model/Models';
import { AppService } from '../service/AppService';
import { JellyfinClient } from '../service/JellyfinClient';
import { errorText } from '../utils/Strings';

@Entry
@Component
struct Downloads {
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
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column({ space: 12 }) {
      Row({ space: 8 }) {
        Button($r('app.string.back')).backgroundColor($r('app.color.brand_surface')).onClick(() => router.back())
        Text($r('app.string.downloads')).fontSize(22).fontColor('#F2F3FA').layoutWeight(1)
      }
      Row({ space: 8 }) {
        Button($r('app.string.download_active')).backgroundColor(this.category === 'active' ? $r('app.color.brand_action') : $r('app.color.brand_surface')).onClick(() => { this.category = 'active'; })
        Button($r('app.string.download_completed')).backgroundColor(this.category === 'complete' ? $r('app.color.brand_action') : $r('app.color.brand_surface')).onClick(() => { this.category = 'complete'; })
        Button($r('app.string.download_failed')).backgroundColor(this.category === 'failed' ? $r('app.color.brand_action') : $r('app.color.brand_surface')).onClick(() => { this.category = 'failed'; })
      }
      if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')) }
      List({ space: 12 }) {
        ForEach(this.visibleRecords(), (record: DownloadRecord) => {
          ListItem() {
            Column({ space: 10 }) {
              Text(record.item.Name).fontColor('#F2F3FA').fontSize(18).width('100%')
              Text(record.state === 'queued' ? $r('app.string.download_queued') : record.state === 'complete' ? $r('app.string.download_complete') : record.state === 'downloading' ?
                $r('app.string.download_progress', Math.floor(record.progress * 100)) : record.failure || $r('app.string.download_interrupted')).fontColor($r('app.color.brand_muted')).width('100%')
              if (record.state === 'downloading') { Progress({ value: record.progress * 100, total: 100 }).color($r('app.color.brand_accent')).width('100%') }
              Row({ space: 8 }) {
                if (record.state === 'complete') {
                  Button($r('app.string.play')).backgroundColor($r('app.color.brand_action')).onClick(async () => {
                    try { await router.pushUrl({ url: 'pages/Player', params: await AppService.playback(record.item, '', true) }); } catch (e) { this.message = errorText(e as Error); }
                  })
                } else if (!['downloading', 'queued'].includes(record.state)) {
                  Button($r('app.string.retry')).enabled(!this.busy).backgroundColor($r('app.color.brand_action')).onClick(() => this.retry(record))
                }
                Button(['downloading', 'queued'].includes(record.state) ? $r('app.string.stop_download') : $r('app.string.remove_download'))
                  .backgroundColor($r('app.color.brand_surface')).onClick(() => this.remove(record))
              }
            }.padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(14).width('100%')
          }
        }, (r: DownloadRecord) => `${r.id}:${r.state}:${r.progress}:${r.failure}`)
      }.layoutWeight(1).width('100%')
      if (!this.visibleRecords().length) { Text($r('app.string.no_downloads')).fontColor($r('app.color.brand_muted')) }
    }.padding(16).backgroundColor($r('app.color.brand_background')).width('100%').height('100%')
      }
    }.width('100%').height('100%')
  }
}
