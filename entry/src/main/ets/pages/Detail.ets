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
      primaryButton: { value: $r('app.string.cancel'), action: () => {} },
      secondaryButton: { value: record ? $r('app.string.remove') : $r('app.string.download'), action: async () => {
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
      primaryButton: { value: $r('app.string.cancel'), action: () => {} },
      secondaryButton: { value: $r('app.string.server_delete'), action: async () => {
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
      primaryButton: { value: text('cancel'), action: () => {} }, secondaryButton: { value: text('download'), action: async () => {
        if (!client || !this.current(token, client) || this.busy) { return; }
        this.busy = true;
        try { const failures = await AppService.batchDownload(chosen); if (this.current(token, client)) { this.message = text('batch_result', chosen.length - failures.length, failures.length); this.selectedEpisodes = failures; } }
        catch (e) { if (this.current(token, client)) { this.message = errorText(e as Error); } }
        finally { if (this.current(token, client)) { this.busy = false; } }
      } } });
  }
  @Builder
  private childrenPanel() {
    if (this.children.length > 0) {
      Text(this.item.Type === 'Series' ? $r('app.string.seasons') : $r('app.string.episodes')).fontSize(20).fontColor('#F2F3FA').width('100%')
      if (this.item.Type === 'Series') {
        List({ space: 12 }) {
          ForEach(this.children, (child: MediaItem) => {
            ListItem() { MediaCard({ item: child, onSelect: (item: MediaItem) => this.openChild(item) }).width(120) }
          }, (child: MediaItem) => `${child.Id}:${child.Name}:${child.UserData?.Played}:${child.ImageTags?.Primary}:${child.ProductionYear}:${child.CommunityRating}:${child.SeriesName}:${child.ParentIndexNumber}:${child.IndexNumber}`)
        }.listDirection(Axis.Horizontal).height(242).width('100%')
      } else {
        if (!this.usingCache) {
          Row({ space: 8 }) {
            Button(this.selectingEpisodes ? $r('app.string.cancel') : $r('app.string.batch_download')).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.selectingEpisodes = !this.selectingEpisodes; this.selectedEpisodes = []; })
            if (this.selectingEpisodes) {
              Button($r('app.string.select_all')).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.selectedEpisodes = this.children.filter((i: MediaItem) => i.CanDownload).map((i: MediaItem) => i.Id); })
              Button($r('app.string.download')).backgroundColor($r('app.color.brand_action')).enabled(!this.busy && this.selectedEpisodes.length > 0).onClick(() => this.batchEpisodes())
            }
          }.width('100%')
        }
        ForEach(this.children, (child: MediaItem) => {
          if (this.selectingEpisodes) { Checkbox().select(this.selectedEpisodes.includes(child.Id)).enabled(child.CanDownload === true).onChange((value: boolean) => { if (value && !this.selectedEpisodes.includes(child.Id)) { this.selectedEpisodes = [...this.selectedEpisodes, child.Id]; } else if (!value) { this.selectedEpisodes = this.selectedEpisodes.filter((id: string) => id !== child.Id); } }) }
          MediaCard({ item: child, wide: true, onSelect: (item: MediaItem) => this.openChild(item) }).width('100%')
        }, (child: MediaItem) => `${child.Id}:${child.Name}:${child.UserData?.Played}:${child.ImageTags?.Primary}:${child.ProductionYear}:${child.CommunityRating}:${child.SeriesName}:${child.ParentIndexNumber}:${child.IndexNumber}`)
      }
    }
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column() {
      Row({ space: 12 }) {
        Button($r('app.string.back')).backgroundColor($r('app.color.brand_surface')).onClick(() => router.back())
        Text(this.item.Name).fontSize(18).fontColor('#F2F3FA').layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        Button($r('app.string.refresh')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy && !this.deleted).onClick(() => this.refresh())
      }.width('100%').padding(16)
      Scroll() {
        Column({ space: 18 }) {
          Stack({ alignContent: Alignment.BottomStart }) {
            Image(AppService.client?.image(this.item.Id, this.item.BackdropImageTags?.[0], true) ?? '').alt($r('app.media.poster_placeholder'))
              .width('100%').height(200).objectFit(ImageFit.Cover).borderRadius(12).backgroundColor($r('app.color.brand_surface'))
            Column({ space: 4 }) {
              Text(this.item.Name).fontSize(28).fontWeight(FontWeight.Bold).fontColor('#F2F3FA').width('100%').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
              if (detailMetadata(this.item, this.sourceId).original) {
                Text(detailMetadata(this.item, this.sourceId).original).fontSize(15).fontColor('#BDC5D6').width('100%')
              }
            }.width('100%').padding(12).backgroundColor('#B30D1924')
          }.width('100%')
          if (detailMetadata(this.item, this.sourceId).summary) {
            Text(detailMetadata(this.item, this.sourceId).summary).fontColor($r('app.color.brand_muted')).fontSize(14).width('100%')
          }
          if (this.usingCache) { Text($r('app.string.offline_cache')).fontColor('#EFC86A').fontSize(13).width('100%') }
          if (this.message) { Text(this.message).fontColor('#FF9F9F').fontSize(13).width('100%') }
          if (this.busy) { LoadingProgress().width(28).height(28).color($r('app.color.brand_accent')) }
          Button(this.nextUp && this.item.Type === 'Series' ? $r('app.string.play_next_episode') :
            (this.item.UserData?.PlaybackPositionTicks ?? 0) > 0 ? $r('app.string.continue_play') : $r('app.string.play'))
            .width('100%').backgroundColor($r('app.color.brand_action')).enabled(this.canPlay()).onClick(() => this.play())
          Flex({ wrap: FlexWrap.Wrap }) {
            if ((this.item.Type === 'Movie' || this.item.Type === 'Episode') && (this.item.UserData?.PlaybackPositionTicks ?? 0) > 0) {
              DetailAction({ label: $r('app.string.start_over'), icon: $r('app.media.detail_play'), available: this.canPlay(), onSelect: () => this.play(true) })
            }
            if (trailerUrl(this.item)) {
              DetailAction({ label: $r('app.string.trailer'), icon: $r('app.media.detail_film'), available: this.loaded && !this.busy && !this.deleted, onSelect: () => this.trailer() })
            }
            DetailAction({ label: this.item.UserData?.Played ? $r('app.string.mark_unplayed') : $r('app.string.mark_played'),
              icon: this.item.UserData?.Played ? $r('app.media.nav_check_active') : $r('app.media.nav_check_muted'),
              available: this.loaded && !this.busy && !this.deleted, onSelect: () => this.setFlag(false) })
            DetailAction({ label: this.item.UserData?.IsFavorite ? $r('app.string.unfavorite') : $r('app.string.favorite'),
              icon: this.item.UserData?.IsFavorite ? $r('app.media.detail_heart_filled') : $r('app.media.detail_heart'),
              available: this.loaded && !this.busy && !this.deleted, onSelect: () => this.setFlag(true) })
            if (this.canDownload()) {
              DetailAction({ label: this.record() ? $r('app.string.remove_download') : $r('app.string.download'),
                icon: this.record() ? $r('app.media.detail_trash') : $r('app.media.detail_download'), available: !this.busy && !this.deleted, onSelect: () => this.download() })
            }
            if (this.loaded && !this.usingCache && this.item.Type === 'Movie' && this.item.CanDelete === true) {
              DetailAction({ label: $r('app.string.server_delete'), icon: $r('app.media.detail_remove'), destructive: true,
                available: !this.busy && !this.deleted, onSelect: () => this.deleteMedia() })
            }
          }.width('100%')
          if (this.downloadState) { Text(this.downloadState).fontSize(13).fontColor($r('app.color.brand_muted')).width('100%') }
          if (!this.usingCache && (this.item.Type === 'Movie' || this.item.Type === 'Episode') && (this.item.MediaSources?.length ?? 0) > 1) {
            Text($r('app.string.media_versions')).fontSize(18).fontColor('#F2F3FA').width('100%')
            Flex({ wrap: FlexWrap.Wrap }) {
              ForEach(this.item.MediaSources ?? [], (source: MediaSource, index: number) => {
                Button(source.Name || $r('app.string.source_number', index + 1))
                  .fontSize(12).margin({ right: 8, bottom: 8 }).enabled(!this.busy && !this.deleted)
                  .backgroundColor((this.sourceId || this.item.MediaSources?.[0]?.Id) === source.Id ? $r('app.color.brand_action') : $r('app.color.brand_surface'))
                  .onClick(() => { this.sourceId = source.Id; })
              }, (source: MediaSource) => `${source.Id}:${source.Name}`)
            }.width('100%')
          }
          DetailMetadataPanel({ item: this.item, sourceId: this.usingCache ? this.record()?.mediaSourceId ?? '' : this.sourceId,
            onPerson: (person: Person) => this.openPerson(person) })
          if (this.nextUp) {
            Text($r('app.string.next_up')).fontSize(20).fontColor('#F2F3FA').width('100%')
            MediaCard({ item: this.nextUp, wide: true, onSelect: (item: MediaItem) => this.openChild(item) }).width('100%')
          }
          this.childrenPanel()
        }.padding(16).width('100%')
      }.layoutWeight(1).width('100%')
    }.width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%')
  }
}
