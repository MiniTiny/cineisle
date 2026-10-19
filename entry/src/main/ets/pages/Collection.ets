import router from '@ohos.router';
import { AppService } from '../service/AppService';
import { JellyfinClient } from '../service/JellyfinClient';
import { MediaItem } from '../model/Models';
import { applyPending } from '../utils/Experience';
import { errorText } from '../utils/Strings';
import { UiLayout } from '../utils/UiLayout';
import { MediaCard } from '../components/MediaCard';
import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandState } from '../components/BrandState';
import { PinGate } from '../components/PinGate';

interface CollectionRoute { item: MediaItem }
@Entry
@Component
struct Collection {
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State item: MediaItem = { Id: '', Name: '', Type: 'BoxSet' };
  @State items: MediaItem[] = [];
  @State busy: boolean = false;
  @State loaded: boolean = false;
  @State message: string = '';
  private owner: JellyfinClient | undefined;
  private alive: boolean = false;
  private revision: number = 0;
  private categories: string[] = ['Movie', 'Series', 'Episode'];

  aboutToAppear(): void {
    const route = router.getParams() as CollectionRoute;
    if (route?.item?.Type !== 'BoxSet' || !route.item.Id) { router.back(); return; }
    this.item = route.item; this.owner = AppService.client; this.alive = true; this.load();
  }
  onPageShow(): void { if (this.owner !== AppService.client) { this.items = []; this.alive = false; router.back(); } }
  aboutToDisappear(): void { this.alive = false; ++this.revision; this.items = []; }
  private async load(): Promise<void> {
    const client = this.owner; const revision = ++this.revision;
    this.busy = true; this.loaded = false; this.message = ''; this.items = [];
    try {
      if (!client || client !== AppService.client) { throw new Error('login_required'); }
      if (AppService.experience?.snapshot().offline) { throw new Error('collection_online_required'); }
      const state = AppService.experience?.snapshot();
      const values = await AppService.allItems([{ key: 'ParentId', value: this.item.Id }, { key: 'Recursive', value: 'false' },
        { key: 'IncludeItemTypes', value: 'Movie,Series,Episode' }, { key: 'SortBy', value: state?.librarySort ?? 'SortName' },
        { key: 'SortOrder', value: state?.libraryDescending ? 'Descending' : 'Ascending' }], () => {
        if (!this.alive || revision !== this.revision || client !== AppService.client) { throw new Error('collection_cancelled'); }
      });
      if (!this.alive || revision !== this.revision || client !== AppService.client) { return; }
      if (values.some((value: MediaItem) => !this.categories.includes(value.Type))) { throw new Error('api_response_invalid'); }
      this.items = applyPending(values, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []); this.loaded = true;
    } catch (e) {
      if (this.alive && revision === this.revision && client === AppService.client) { this.items = []; this.message = errorText(e as Error); }
    } finally { if (this.alive && revision === this.revision) { this.busy = false; } }
  }
  private open(item: MediaItem): void { router.pushUrl({ url: 'pages/Detail', params: { item: item } }); }
  private label(type: string): Resource { return type === 'Movie' ? $r('app.string.media_movie') : type === 'Series' ? $r('app.string.media_series') : $r('app.string.media_episode'); }
  build() {
    Column({ space: 12 }) {
      if (this.locked) { PinGate() }
      else {
        BrandHeader({ label: this.item.Name, refreshable: true, available: !this.busy, onRefresh: () => this.load(), onBack: () => router.back() })
        Grid() {
          if (this.busy || this.message) {
            GridItem() {
              Column({ space: 12 }) {
                if (this.busy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
                if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(14).width('100%') }
              }.width('100%')
            }.columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
          }
          ForEach(this.categories, (type: string) => {
            if (this.items.some((value: MediaItem) => value.Type === type)) {
              GridItem() { BrandHeading({ label: this.label(type), icon: $r('app.media.nav_library_active') }) }
                .columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
              ForEach(this.items.filter((value: MediaItem) => value.Type === type), (item: MediaItem) => {
                GridItem() { MediaCard({ item: item, onSelect: (selected: MediaItem) => this.open(selected) }) }
              }, (item: MediaItem) => `${item.Id}|${JSON.stringify(item)}`)
            }
          }, (type: string) => type)
          if (this.loaded && !this.items.length) {
            GridItem() { BrandState({ label: $r('app.string.collection_empty'), icon: $r('app.media.nav_library_active') }) }
              .columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
          }
        }.columnsTemplate(UiLayout.columns(this.viewportWidth, this.fontScale)).columnsGap(12).rowsGap(20).width('100%').layoutWeight(1)
      }
    }.padding(16).width('100%').height('100%').backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_background')))
      .onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); })
  }
}
