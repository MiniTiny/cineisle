import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandButton } from '../components/BrandButton';
import { UiLayout } from '../utils/UiLayout';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import common from '@ohos.app.ability.common';
import { errorText, text } from '../utils/Strings';
import { DownloadRecord, MediaItem, MediaSource, Person } from '../model/Models';
import { AppService } from '../service/AppService';
import { JellyfinClient } from '../service/JellyfinClient';
import { loadDetail } from '../service/DetailData';
import { detailMetadata, trailerUrl } from '../utils/DetailPresentation';
import { MediaCard } from '../components/MediaCard';
import { DetailAction } from '../components/DetailAction';
import { DetailMetadataPanel } from '../components/DetailMetadata';

interface DetailRoute { item: MediaItem }

@Entry
@Component
struct Detail {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State item: MediaItem = { Id: '', Name: '', Type: '' };
  @State children: MediaItem[] = [];
  @State nextUp: MediaItem | undefined = undefined;
  @State message: string = '';
  @State busy: boolean = true;
  @State loaded: boolean = false;
  @State usingCache: boolean = false;
  @State deleted: boolean = false;
  @State selectedEpisodes: string[] = [];
  @State selectingEpisodes: boolean = false;
  @State sourceId: string = '';
  @State downloadState: string = '';
  private visible: boolean = true;
  private generation: number = 0;
  private pageClient: JellyfinClient | undefined = undefined;
  private downloadChanged: () => void = () => this.updateDownload();

  onPageShow(): void {
    this.visible = true;
    if (this.pageClient && this.pageClient !== AppService.client) { this.clearPage(); router.back(); return; }
    this.updateDownload(); AppService.subscribeDownloads(this.downloadChanged);
    if (this.loaded && !this.busy && !this.deleted) { this.refresh(); }
  }
  onPageHide(): void { this.visible = false; this.generation++; this.busy = false; AppService.unsubscribeDownloads(this.downloadChanged); }
  aboutToDisappear(): void { this.onPageHide(); }

  async aboutToAppear(): Promise<void> {
    const params = router.getParams() as DetailRoute;
    if (!params?.item?.Id) { router.back(); return; }
    this.item = params.item; this.pageClient = AppService.client; this.visible = true;
    await this.refresh();
  }
  private clearPage(): void {
    this.generation++; this.loaded = false; this.busy = false;
    this.item = { Id: '', Name: '', Type: '' }; this.children = []; this.nextUp = undefined; this.downloadState = ''; this.sourceId = '';
  }
  private current(token: number, client: JellyfinClient): boolean {
    return this.visible && token === this.generation && client === this.pageClient && client === AppService.client;
  }
  private async refresh(): Promise<void> {
    if (!this.visible || this.deleted || !this.item.Id) { return; }
    const token = ++this.generation; this.busy = true; this.message = '';
    try {
      const client = AppService.requireClient();
      if (this.pageClient && this.pageClient !== client) { this.clearPage(); router.back(); return; }
      this.pageClient = client;
      const result = await loadDetail(client, this.item.Id);
      if (!this.current(token, client)) { return; }
      this.item = result.item; this.children = result.children; this.nextUp = result.nextUp;
      this.usingCache = result.offline; this.loaded = true; this.message = result.warning;
      if (this.sourceId && !this.item.MediaSources?.some((source: MediaSource) => source.Id === this.sourceId)) { this.sourceId = ''; }
      this.updateDownload();
    } catch (e) { if (this.visible && token === this.generation && this.pageClient === AppService.client) { this.message = errorText(e as Error); } }
    finally { if (this.visible && token === this.generation) { this.busy = false; } }
  }
  private record(): DownloadRecord | undefined { return AppService.downloads.find((record: DownloadRecord) => record.id === this.item.Id); }
  private updateDownload(): void {
    if (this.pageClient !== AppService.client) { this.downloadState = ''; return; }
    const record = this.record();
    this.downloadState = !record ? '' : record.state === 'complete' ? text('download_complete') :
      record.state === 'downloading' ? text('download_progress', Math.floor(record.progress * 100)) : text('download_interrupted');
  }
  private canPlay(): boolean {
    return this.loaded && !this.busy && !this.deleted && this.item.PlayAccess !== 'None' &&
      (this.item.Type === 'Series' || this.item.Type === 'Season' ||
      ((this.item.Type === 'Movie' || this.item.Type === 'Episode') && (!!this.item.MediaSources?.length || this.record()?.state === 'complete')));
  }
  private canDownload(): boolean {
    return (this.item.Type === 'Movie' || this.item.Type === 'Episode') &&
      (!!this.record() || (this.loaded && !this.usingCache && this.item.CanDownload === true && !!this.item.MediaSources?.length));
  }
  private async play(restart: boolean = false): Promise<void> {
    if (!this.canPlay()) { return; }
    const client = AppService.requireClient(); const token = this.generation; this.busy = true; this.message = '';
    try {
      const route = await AppService.detailPlayback(this.item, this.usingCache ? '' : this.sourceId, this.usingCache, restart);
      if (this.current(token, client)) { await router.pushUrl({ url: 'pages/Player', params: route }); }
    } catch (e) { if (this.current(token, client)) { this.message = errorText(e as Error); } }
    finally { if (this.current(token, client)) { this.busy = false; } }
  }
  private async setFlag(favorite: boolean): Promise<void> {
    if (this.busy || !this.loaded || this.deleted) { return; }
    const client = AppService.requireClient(); const token = this.generation; const original = this.item;
    const enabled = favorite ? !original.UserData?.IsFavorite : !original.UserData?.Played;
    this.busy = true; this.message = '';
    try {
      const queued = await AppService.edit(original, favorite, enabled, this.usingCache);
      if (queued && this.current(token, client)) { this.message = text('change_queued'); }
      if (!this.current(token, client)) { return; }
      const item = JSON.parse(JSON.stringify(original)) as MediaItem;
      if (!item.UserData) { item.UserData = {}; }
      if (favorite) { item.UserData.IsFavorite = enabled; } else { item.UserData.Played = enabled; }
      this.item = item;
    } catch (e) { if (this.current(token, client)) { this.message = errorText(e as Error); } }
    finally { if (this.current(token, client)) { this.busy = false; } }
  }
  private async trailer(): Promise<void> {
    const uri = trailerUrl(this.item);
    if (!uri || this.busy || !this.loaded || this.deleted) { return; }
    const client = AppService.requireClient(); const token = this.generation; this.busy = true; this.message = '';
    try { await (getContext(this) as common.UIAbilityContext).startAbility({ action: 'ohos.want.action.viewData', uri: uri }); }
    catch (e) { if (this.current(token, client)) { this.message = text('trailer_failed'); } }
    finally { if (this.current(token, client)) { this.busy = false; } }
  }
  private download(): void {
    if (this.busy || !this.canDownload() || this.deleted) { return; }
    const token = this.generation; const client = AppService.requireClient(); const item = this.item;
    const record = this.record(); const sourceId = this.sourceId;
    AlertDialog.show({ title: record ? $r('app.string.remove_download') : $r('app.string.download_wifi'),
      message: record ? $r('app.string.remove_download_confirm') : $r('app.string.download_confirm'),
      primaryButton: { value: $r('app.string.cancel'), fontColor: $r('app.color.brand_accent'), action: () => {} },
      secondaryButton: { value: record ? $r('app.string.remove') : $r('app.string.download'), fontColor: record ? $r('app.color.brand_danger') : $r('app.color.brand_accent'), action: async () => {
        if (!this.current(token, client) || this.busy || this.record() !== record) { return; }
        this.busy = true; this.message = '';
        try { if (record) { await AppService.removeDownload(record); } else { await AppService.download(item, sourceId); } }
        catch (e) { if (this.current(token, client)) { this.message = errorText(e as Error); } }
        finally { if (this.current(token, client)) { this.busy = false; this.updateDownload(); } }
      } }
    });
  }
  private deleteMedia(): void {
    if (!this.loaded || this.busy || this.usingCache || this.deleted || this.item.Type !== 'Movie' || this.item.CanDelete !== true) { return; }
    const token = this.generation; const client = AppService.requireClient(); const item = this.item;
    AlertDialog.show({ title: $r('app.string.server_delete'), message: $r('app.string.server_delete_confirm'),
      primaryButton: { value: $r('app.string.cancel'), fontColor: $r('app.color.brand_accent'), action: () => {} },
      secondaryButton: { value: $r('app.string.server_delete'), fontColor: $r('app.color.brand_danger'), action: async () => {
        if (!this.current(token, client) || this.busy || this.deleted) { return; }
        this.busy = true; this.message = '';
        try { await AppService.deleteMedia(item); if (this.current(token, client)) { this.deleted = true; router.back(); } }
        catch (e) {
          if (this.current(token, client)) {
            if ((e as Error).message === 'media_deleted_cache_failed') { this.deleted = true; }
            this.message = errorText(e as Error);
          }
        } finally { if (this.current(token, client)) { this.busy = false; } }
      } }
    });
  }
  private openChild(item: MediaItem): void {
    if (this.visible && this.pageClient === AppService.client) { router.pushUrl({ url: 'pages/Detail', params: { item: item } }); }
  }
  private openPerson(person: Person): void {
    if (this.visible && this.pageClient === AppService.client) { router.pushUrl({ url: 'pages/Actor', params: { personId: person.Id, personName: person.Name } }); }
  }

  private batchEpisodes(): void {
    const chosen = this.children.filter((item: MediaItem) => this.selectedEpisodes.includes(item.Id));
    const client = this.pageClient; const token = this.generation;
    AlertDialog.show({ title: $r('app.string.batch_download'), message: text('batch_download_confirm', chosen.length),
      primaryButton: { value: text('cancel'), fontColor: $r('app.color.brand_accent'), action: () => {} }, secondaryButton: { value: text('download'), fontColor: $r('app.color.brand_accent'), action: async () => {
        if (!client || !this.current(token, client) || this.busy) { return; }
        this.busy = true;
        try { const failures = await AppService.batchDownload(chosen); if (this.current(token, client)) { this.message = text('batch_result', chosen.length - failures.length, failures.length); this.selectedEpisodes = failures; } }
        catch (e) { if (this.current(token, client)) { this.message = errorText(e as Error); } }
        finally { if (this.current(token, client)) { this.busy = false; } }
      } } });
  }
  private actionWidth(): string { return this.viewportWidth < 400 || this.fontScale > 1.2 ? '100%' : '48%'; }
  @Builder
  private childrenPanel() {
    if (this.children.length > 0) {
      Column({ space: 14 }) {
        BrandHeading({ label: this.item.Type === 'Series' ? $r('app.string.seasons') : $r('app.string.episodes'), icon: $r('app.media.nav_library_active') })
        if (this.item.Type === 'Series') {
          List({ space: 12 }) {
            ForEach(this.children, (child: MediaItem) => {
              ListItem() { MediaCard({ item: child, onSelect: (item: MediaItem) => this.openChild(item) }).width(UiLayout.shelfWidth(this.viewportWidth - 32, false, this.fontScale)) }
            }, (child: MediaItem) => `${child.Id}:${child.Name}:${child.UserData?.Played}:${child.ImageTags?.Primary}:${child.ProductionYear}:${child.CommunityRating}:${child.SeriesName}:${child.ParentIndexNumber}:${child.IndexNumber}`)
          }.listDirection(Axis.Horizontal).height(UiLayout.shelfHeight(this.viewportWidth - 32, this.fontScale, false)).width('100%')
        } else {
          if (!this.usingCache) {
            Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
              DetailAction({ label: this.selectingEpisodes ? $r('app.string.cancel') : $r('app.string.batch_download'), icon: this.selectingEpisodes ? $r('app.media.menu_cancel') : $r('app.media.detail_download'), available: !this.busy && !this.deleted, onSelect: () => { this.selectingEpisodes = !this.selectingEpisodes; this.selectedEpisodes = []; } }).width(this.actionWidth()).margin({ bottom: 8 })
              if (this.selectingEpisodes) {
                DetailAction({ label: $r('app.string.select_all'), icon: $r('app.media.nav_check_active'), available: !this.busy && !this.deleted, onSelect: () => { this.selectedEpisodes = this.children.filter((i: MediaItem) => i.CanDownload === true).map((i: MediaItem) => i.Id); } }).width(this.actionWidth()).margin({ bottom: 8 })
                DetailAction({ label: $r('app.string.download'), icon: $r('app.media.detail_download'), primary: true, available: !this.busy && !this.deleted && this.selectedEpisodes.length > 0, onSelect: () => this.batchEpisodes() }).width(this.actionWidth()).margin({ bottom: 8 })
              }
            }.width('100%')
          }
          ForEach(this.children, (child: MediaItem) => {
            Column({ space: 8 }) {
              if (this.selectingEpisodes) {
                Row({ space: 8 }) {
                  Checkbox().select(this.selectedEpisodes.includes(child.Id)).selectedColor($r('app.color.brand_action')).enabled(!this.busy && !this.deleted && child.CanDownload === true).onChange((value: boolean) => { if (value && !this.selectedEpisodes.includes(child.Id)) { this.selectedEpisodes = [...this.selectedEpisodes, child.Id]; } else if (!value) { this.selectedEpisodes = this.selectedEpisodes.filter((id: string) => id !== child.Id); } })
                  Text(child.Name).fontSize(14).fontColor('#F2F3FA').layoutWeight(1)
                }.width('100%')
              }
              MediaCard({ item: child, wide: true, onSelect: (item: MediaItem) => this.openChild(item) }).width('100%')
            }.width('100%')
          }, (child: MediaItem) => `${child.Id}:${child.Name}:${child.UserData?.Played}:${child.ImageTags?.Primary}:${child.ProductionYear}:${child.CommunityRating}:${child.SeriesName}:${child.ParentIndexNumber}:${child.IndexNumber}`)
        }
      }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
    }
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column() {
      BrandHeader({ label: $r('app.string.media_detail'), refreshable: true, available: !this.busy && !this.deleted, onRefresh: () => this.refresh(), onBack: () => router.back() }).padding({ left: 16, right: 16, top: 8, bottom: 8 })
      Scroll() {
        Column({ space: 18 }) {
          Column({ space: 12 }) {
            Image(AppService.client?.image(this.item.Id, this.item.BackdropImageTags?.[0], true) ?? '').alt($r('app.media.poster_placeholder'))
              .width('100%').height(Math.min(260, Math.max(140, (this.viewportWidth - 32) * 9 / 16))).objectFit(ImageFit.Cover).borderRadius(16).backgroundColor($r('app.color.brand_surface'))
            Text(this.item.Name).fontSize(26).fontWeight(FontWeight.Bold).fontColor('#F2F3FA').width('100%')
            if (detailMetadata(this.item, this.sourceId).original) {
              Text(detailMetadata(this.item, this.sourceId).original).fontSize(14).fontColor($r('app.color.brand_muted')).width('100%')
            }
            if (detailMetadata(this.item, this.sourceId).summary) {
              Text(detailMetadata(this.item, this.sourceId).summary).fontColor($r('app.color.brand_muted')).fontSize(14).width('100%')
            }
          }.width('100%').alignItems(HorizontalAlign.Start)
          if (this.usingCache) { Text($r('app.string.offline_cache')).fontColor('#EFC86A').fontSize(13).width('100%') }
          if (this.message) { Text(this.message).fontColor('#FF9F9F').fontSize(13).width('100%') }
          if (this.busy) { LoadingProgress().width(28).height(28).color($r('app.color.brand_accent')) }
          Column({ space: 12 }) {
            BrandHeading({ label: $r('app.string.detail_actions'), icon: $r('app.media.detail_play') })
            BrandButton({ label: this.nextUp && this.item.Type === 'Series' ? $r('app.string.play_next_episode') :
              (this.item.UserData?.PlaybackPositionTicks ?? 0) > 0 ? $r('app.string.continue_play') : $r('app.string.play'), icon: $r('app.media.detail_play'), primary: true, available: this.canPlay(), onSelect: () => this.play() })
            Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
              if ((this.item.Type === 'Movie' || this.item.Type === 'Episode') && (this.item.UserData?.PlaybackPositionTicks ?? 0) > 0) {
                DetailAction({ label: $r('app.string.start_over'), icon: $r('app.media.menu_sync'), available: this.canPlay(), onSelect: () => this.play(true) }).width(this.actionWidth()).margin({ bottom: 8 })
              }
              if (trailerUrl(this.item)) {
                DetailAction({ label: $r('app.string.trailer'), icon: $r('app.media.detail_film'), available: this.loaded && !this.busy && !this.deleted, onSelect: () => this.trailer() }).width(this.actionWidth()).margin({ bottom: 8 })
              }
              DetailAction({ label: this.item.UserData?.Played ? $r('app.string.mark_unplayed') : $r('app.string.mark_played'),
                icon: this.item.UserData?.Played ? $r('app.media.nav_check_active') : $r('app.media.nav_check_muted'), primary: this.item.UserData?.Played ?? false,
                available: this.loaded && !this.busy && !this.deleted, onSelect: () => this.setFlag(false) }).width(this.actionWidth()).margin({ bottom: 8 })
              DetailAction({ label: this.item.UserData?.IsFavorite ? $r('app.string.unfavorite') : $r('app.string.favorite'),
                icon: this.item.UserData?.IsFavorite ? $r('app.media.detail_heart_filled') : $r('app.media.detail_heart'), primary: this.item.UserData?.IsFavorite ?? false,
                available: this.loaded && !this.busy && !this.deleted, onSelect: () => this.setFlag(true) }).width(this.actionWidth()).margin({ bottom: 8 })
              if (this.canDownload()) {
                DetailAction({ label: this.record() ? $r('app.string.remove_download') : $r('app.string.download'),
                  icon: this.record() ? $r('app.media.detail_trash') : $r('app.media.detail_download'), destructive: !!this.record(), available: !this.busy && !this.deleted, onSelect: () => this.download() }).width(this.actionWidth()).margin({ bottom: 8 })
              }
              if (this.loaded && !this.usingCache && this.item.Type === 'Movie' && this.item.CanDelete === true) {
                DetailAction({ label: $r('app.string.server_delete'), icon: $r('app.media.detail_remove'), destructive: true,
                  available: !this.busy && !this.deleted, onSelect: () => this.deleteMedia() }).width(this.actionWidth()).margin({ bottom: 8 })
              }
            }.width('100%')
          }.width('100%').alignItems(HorizontalAlign.Start).padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
          if (this.downloadState) { Text(this.downloadState).fontSize(13).fontColor($r('app.color.brand_muted')).width('100%') }
          if (!this.usingCache && (this.item.Type === 'Movie' || this.item.Type === 'Episode') && (this.item.MediaSources?.length ?? 0) > 1) {
            Column({ space: 12 }) {
              BrandHeading({ label: $r('app.string.media_versions'), icon: $r('app.media.nav_library_active') })
              Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
                ForEach(this.item.MediaSources ?? [], (source: MediaSource, index: number) => {
                  BrandButton({ label: source.Name || $r('app.string.source_number', index + 1), icon: $r('app.media.nav_library_active'),
                    primary: (this.sourceId || this.item.MediaSources?.[0]?.Id) === source.Id, available: !this.busy && !this.deleted,
                    onSelect: () => { this.sourceId = source.Id; } }).width(this.actionWidth()).margin({ bottom: 8 })
                }, (source: MediaSource) => `${source.Id}:${source.Name}`)
              }.width('100%')
            }.width('100%').alignItems(HorizontalAlign.Start).padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
          }
          DetailMetadataPanel({ item: this.item, sourceId: this.usingCache ? this.record()?.mediaSourceId ?? '' : this.sourceId, stacked: this.viewportWidth < 400 || this.fontScale > 1.2,
            onPerson: (person: Person) => this.openPerson(person) })
          if (this.nextUp) {
            Column({ space: 12 }) {
              BrandHeading({ label: $r('app.string.next_up'), icon: $r('app.media.player_next') })
              MediaCard({ item: this.nextUp, wide: true, onSelect: (item: MediaItem) => this.openChild(item) }).width('100%')
            }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
          }
          this.childrenPanel()
        }.padding(16).width('100%')
      }.layoutWeight(1).width('100%').align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
