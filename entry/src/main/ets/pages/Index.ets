import { UiLayout } from '../utils/UiLayout';
import { PinGate } from '../components/PinGate';
import common from '@ohos.app.ability.common';
import router from '@ohos.router';
import { errorText, text } from '../utils/Strings';
import { ActorSummary, DownloadRecord, HomeSection, MediaItem, QueryParam } from '../model/Models';
import { AppService } from '../service/AppService';
import { MediaCard } from '../components/MediaCard';
import { HomeShelf } from '../components/HomeShelf';
import { cachedHome } from '../service/HomeFeed';
import { JellyfinClient } from '../service/JellyfinClient';
import { browseParams, cachedItems } from '../utils/Browse';

import { ProgressiveHome, HomeFailure, HomeUpdate } from '../service/ProgressiveHome';
import { ActorProfile, ActorTag, Discovery, ExperienceState, actorProfiles, sortActors, discovery, applyPending, connectionFailure, authorizationFailure } from '../utils/Experience';

interface PersonRoute { personId?: string; personName?: string }

@Entry
@Component
struct Index {
  @StorageLink('cineIsleLandscape') landscape: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State ready: boolean = false;
  @State signedIn: boolean = false;
  @State server: string = '';
  @State username: string = '';
  @State password: string = '';
  @State busy: boolean = false;
  @State message: string = '';
  @State tab: number = 1;
  @State search: string = '';
  @State mode: string = '';
  @State parentId: string = '';
  @State personId: string = '';
  @State sectionTitle: string = '';
  @State items: MediaItem[] = [];
  @State resume: MediaItem[] = [];
  @State homeSections: HomeSection[] = [];
  @State searchExpanded: boolean = false;
  @State libraries: MediaItem[] = [];
  @State actors: ActorSummary[] = [];
  @State offline: boolean = false;
  @State profiles: ActorProfile[] = [];
  @State actorQuery: string = '';
  @State actorTag: string = '';
  @State actorOrder: string = 'playCount';
  @State followedOnly: boolean = false;
  @State showTags: boolean = true;
  @State homeFailures: HomeFailure[] = [];
  @State discover: boolean = true;
  @State discoveries: Discovery[] = [];
  @State recentSearches: string[] = [];
  private homeLoader: ProgressiveHome | undefined = undefined;
  @State downloads: DownloadRecord[] = [];
  @State total: number = 0;
  @State lastSyncedAt: number = 0;
  @State pendingCount: number = 0;
  @State syncMessage: string = '';
  @State syncing: boolean = false;
  @State cacheMessage: string = '';
  @State usingCache: boolean = false;
  private generation: number = 0;
  private sessionClient: JellyfinClient | undefined = undefined;
  private accountChanged: () => void = () => { if (this.ready) { this.resetAccountState(); if (this.signedIn) { this.load(); } } };
  private downloadChanged: () => void = () => { this.downloads = [...AppService.downloads]; };

  async aboutToAppear(): Promise<void> {
    try {
      await AppService.initialize(getContext(this) as common.UIAbilityContext);
      this.resetAccountState();
      this.ready = true;
      if (this.signedIn) {
        const route = router.getParams() as PersonRoute;
        if (route?.personId) { router.replaceUrl({ url: 'pages/Actor', params: route }); return; }
        await this.load();
      }
    } catch (e) { this.message = errorText(e as Error); this.ready = true; }
  }

  onPageHide(): void { this.homeLoader?.cancel(); AppService.unsubscribeDownloads(this.downloadChanged); AppService.unsubscribeAccount(this.accountChanged); }

  onPageShow(): void {
    AppService.subscribeDownloads(this.downloadChanged); AppService.subscribeAccount(this.accountChanged);
    if (this.sessionClient !== AppService.client) { this.resetAccountState(); }
    if (this.ready && this.signedIn && !this.busy) { this.load(); }
  }

  private async login(): Promise<void> {
    if (this.busy || !this.server.trim() || !this.username.trim()) { return; }
    this.busy = true; this.message = '';
    try {
      await AppService.login(this.server, this.username, this.password);
      this.password = ''; this.resetAccountState();
      await this.load();
    } catch (e) { this.message = errorText(e as Error); this.busy = false; }
  }

  private params(): QueryParam[] {
    return browseParams(this.mode, this.search, this.parentId, this.personId);
  }

  private resetAccountState(): void {
    this.homeLoader?.cancel(); this.homeLoader = undefined;
    this.profiles = []; this.discoveries = []; this.homeFailures = []; this.actorQuery = ''; this.actorTag = ''; this.password = '';
    this.generation++; this.sessionClient = AppService.client; this.signedIn = this.sessionClient !== undefined;
    const state = AppService.experience?.snapshot();
    this.tab = state?.tab ?? 1; this.offline = state?.offline ?? false; if (this.offline && this.tab === 0) { this.tab = 1; } this.actorOrder = state?.actorOrder ?? 'playCount'; this.followedOnly = state?.followedOnly ?? false; this.showTags = state?.showTags ?? true; this.recentSearches = state?.searches ?? [];
    this.mode = ''; this.search = ''; this.searchExpanded = false; this.parentId = ''; this.personId = ''; this.sectionTitle = '';
    this.items = []; this.resume = []; this.homeSections = []; this.libraries = []; this.actors = []; this.downloads = []; this.total = 0;
    this.message = ''; this.syncMessage = ''; this.syncing = false; this.busy = false; this.usingCache = false;
    this.cacheMessage = AppService.cacheRecovered ? getContext(this).resourceManager.getStringSync($r('app.string.cache_recovered').id) : '';
  }

  private async logout(): Promise<void> {
    try { await AppService.logout(); this.password = ''; this.resetAccountState(); }
    catch (e) { this.message = errorText(e as Error); }
  }

  private current(version: number, client: JellyfinClient): boolean {
    return version === this.generation && AppService.client === client && this.sessionClient === client;
  }

  private useCache(): void {
    if (!AppService.snapshot.syncedAt) { this.items = []; this.resume = []; this.homeSections = []; this.total = 0; return; }
    if (this.tab === 2 && (!this.mode || this.mode === 'offline-library') && !this.parentId) {
      this.libraries = AppService.snapshot.libraries;
      if (this.libraries.length > 0) { this.mode = ''; this.items = []; this.total = 0; }
      else {
        this.mode = 'offline-library';
        this.sectionTitle = getContext(this).resourceManager.getStringSync($r('app.string.cached_media').id);
        this.items = cachedItems(AppService.snapshot, this.mode, '', '', ''); this.total = this.items.length;
      }
    } else {
      this.items = cachedItems(AppService.snapshot, this.mode, this.search, this.parentId, this.personId);
      this.total = this.items.length;
    }
    this.resume = [];
    if (this.tab === 1 && !this.mode) { this.homeSections = cachedHome(AppService.snapshot); }
    this.usingCache = true;
    this.message += ' · ' + getContext(this).resourceManager.getStringSync($r('app.string.offline_cache').id);
  }

  private async load(more: boolean = false): Promise<void> {
    if (this.sessionClient !== AppService.client) { this.resetAccountState(); }
    this.homeLoader?.cancel();
    const version = ++this.generation;
    const client = AppService.client;
    this.busy = true; this.message = '';
    this.lastSyncedAt = AppService.snapshot.syncedAt; this.pendingCount = (AppService.experience?.snapshot().pending.length ?? 0) + (AppService.experience?.snapshot().positions.length ?? 0);
    if (!more) { this.items = []; this.resume = []; this.homeSections = []; this.total = 0; this.usingCache = false; }
    try {
      if (!client) { throw new Error('login_required'); }
      if (this.tab === 3 && !this.mode) { this.refreshActors(); return; }
      this.offline = AppService.experience?.snapshot().offline ?? false;
      if (this.offline && (this.tab === 1 || this.tab === 2 || this.mode)) { this.useCache(); return; }
      if (this.mode === 'downloads') { this.downloads = [...AppService.downloads]; return; }
      if (this.tab === 4 && !this.mode) { return; }
      if (this.tab === 2 && (!this.mode || this.mode === 'offline-library') && !this.parentId) {
        this.libraries = [];
        const libraries = await client.libraries();
        if (this.current(version, client)) { this.libraries = libraries; this.mode = ''; }
        return;
      }
      if (this.mode || this.parentId || this.personId) {
        const start = more ? this.items.length : 0;
        const result = await client.items([...this.params(), { key: 'StartIndex', value: start.toString() }, { key: 'Limit', value: '60' }]);
        if (this.current(version, client)) {
          this.items = more ? [...this.items, ...(result.Items ?? [])] : result.Items ?? []; this.total = result.TotalRecordCount;
        }
      } else if (this.tab === 0) {
        const candidates = this.discover ? (await client.items([{ key: 'IncludeItemTypes', value: 'Movie,Series' }, { key: 'Limit', value: '200' }, { key: 'SortBy', value: 'DateCreated' }, { key: 'SortOrder', value: 'Descending' }])).Items ?? [] : await client.recommend();
        this.discoveries = discovery(applyPending(candidates, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []), AppService.snapshot.items, AppService.experience?.snapshot().follows ?? []);
        const items = this.discover ? this.discoveries.map((d: Discovery) => d.item) : candidates;
        if (this.current(version, client)) { this.items = items; this.total = items.length; }
      } else {
        const stored = AppService.local?.home() ?? [];
        const preview = stored.length ? stored : cachedHome(AppService.snapshot);
        this.homeLoader = new ProgressiveHome(client, (value: HomeUpdate) => {
          if (!this.current(version, client)) { return; }
          this.homeSections = value.sections.map((section: HomeSection): HomeSection => ({ id: section.id, kind: section.kind, name: section.name, libraryId: section.libraryId, items: applyPending(section.items, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []) }));
          this.homeFailures = value.failures; this.busy = value.busy; this.usingCache = value.cached;
          this.resume = this.homeSections.find((section: HomeSection) => section.kind === 'resume')?.items ?? [];
          this.items = this.homeSections.filter((section: HomeSection) => section.kind === 'latest').flatMap((section: HomeSection) => section.items);
          this.total = this.items.length;
          if (!value.busy) { try { AppService.local?.saveHome(this.homeSections); } catch (e) { this.cacheMessage = errorText(e as Error); } }
        });
        await this.homeLoader.start(preview);
      }
    } catch (e) {
      if (version !== this.generation || AppService.client !== client) { return; }
      this.message = errorText(e as Error);
      // A failed append must retain its list and offset so the same page can be retried.
      if (more) { return; }
      if (!connectionFailure(e as Error)) { this.homeSections = []; return; }
      try { this.useCache(); }
      catch (cacheError) { this.message += ' · ' + errorText(cacheError as Error); this.items = []; this.total = 0; }
    } finally { if (version === this.generation && AppService.client === client) { this.busy = false; } }
  }

  private switchTab(index: number): void {
    try { AppService.experience?.update((state: ExperienceState) => { state.tab = index === 2 ? 4 : index; }); } catch (e) { this.message = errorText(e as Error); }
    this.tab = index; this.mode = ''; this.parentId = ''; this.personId = ''; this.search = ''; this.searchExpanded = false;
    this.items = []; this.resume = []; this.homeSections = []; this.libraries = []; this.actors = []; this.downloads = [];
    this.sectionTitle = ''; this.total = 0; this.usingCache = false;
    this.load();
  }

  private open(item: MediaItem): void { router.pushUrl({ url: 'pages/Detail', params: { item: item } }); }

  private async sync(): Promise<void> {
    this.syncing = true;
    try {
      await AppService.sync((message: string) => { this.syncMessage = message; });
      this.refreshActors();
    } catch (e) { this.syncMessage = errorText(e as Error); } finally { this.lastSyncedAt = AppService.snapshot.syncedAt; this.syncing = false; }
  }

  private openLibrary(section: HomeSection): void {
    this.tab = 2; this.mode = 'library'; this.parentId = section.libraryId; this.personId = '';
    this.sectionTitle = section.name; this.search = ''; this.searchExpanded = false; this.load();
  }

  private tabTitle(): Resource {
    switch (this.tab) {
      case 0: return $r('app.string.tab_recommend');
      case 2: return $r('app.string.tab_library');
      case 3: return $r('app.string.tab_actors');
      case 4: return $r('app.string.tab_more');
      default: return $r('app.string.tab_home');
    }
  }

  @Builder
  loginPanel() {
    Scroll() {
    Column({ space: 20 }) {
      Image($r('app.media.app_icon')).width(76).height(76).borderRadius(20)
      Text($r('app.string.app_name')).fontSize(34).fontWeight(FontWeight.Bold).fontColor('#F2F3FA')
      Text($r('app.string.login_intro')).fontSize(14).fontColor($r('app.color.brand_muted'))
      TextInput({ text: this.server, placeholder: $r('app.string.server_placeholder') }).height(UiLayout.buttonHeight(this.fontScale)).onChange((value: string) => { this.server = value; })
        .fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy)
      TextInput({ text: this.username, placeholder: $r('app.string.username') }).height(UiLayout.buttonHeight(this.fontScale)).onChange((value: string) => { this.username = value; })
        .fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy)
      TextInput({ text: this.password, placeholder: $r('app.string.password') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.Password)
        .onChange((value: string) => { this.password = value; }).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy)
      Text($r('app.string.https_hint')).fontSize(12).fontColor($r('app.color.brand_muted'))
      Button(this.busy ? $r('app.string.connecting') : $r('app.string.login')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_action'))
        .enabled(this.ready && !this.busy && this.server.trim().length > 0 && this.username.trim().length > 0).onClick(() => this.login())
      Button($r('app.string.quick_connect_login')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface')).enabled(this.ready && !this.busy).onClick(() => router.pushUrl({ url: 'pages/Accounts', params: { server: this.server, quick: true } }))
      Button($r('app.string.accounts_servers')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface')).enabled(this.ready && !this.busy).onClick(() => router.pushUrl({ url: 'pages/Accounts' }))
      if (this.message) { Text(this.message).fontColor('#FF9F9F').fontSize(13) }
    }.padding(28).width('100%')
    }.width('100%').height('100%').align(Alignment.TopStart)
  }

  @Builder
  private recommendFilters() {
Column({ space: 8 }) {
                Flex({ wrap: FlexWrap.Wrap }) {
                  Button($r('app.string.discover')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor(this.discover ? $r('app.color.brand_action') : $r('app.color.brand_surface')).onClick(() => { this.discover = true; this.load(); })
                  Button($r('app.string.rewatch')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor(this.discover ? $r('app.color.brand_surface') : $r('app.color.brand_action')).onClick(() => { this.discover = false; this.load(); })
                }
                Text(this.discover ? $r('app.string.discovery_hint') : $r('app.string.recommend_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
                }.width('100%')
  }

  @Builder
    mediaGrid() {
    Grid() {
      if (!this.mode && this.tab === 0 && !UiLayout.separateFilters(this.viewportHeight, this.landscape)) {
        GridItem() { this.recommendFilters() }.columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
      }

        ForEach(this.items, (item: MediaItem) => {
        GridItem() { MediaCard({ item: item, onReason: this.tab === 0 && this.discover ? (selected: MediaItem) => this.reason(selected) : undefined, onSelect: (selected: MediaItem) => this.open(selected) }) }
      }, (item: MediaItem) => `${item.Id}|${JSON.stringify(item)}`)
    }.columnsTemplate(UiLayout.columns(this.viewportWidth, this.fontScale)).columnsGap(12).rowsGap(20).width('100%').layoutWeight(1)
  }

  @Builder
  libraryPanel() {
    List({ space: 14 }) {
      ForEach(this.libraries, (library: MediaItem) => {
        ListItem() {
          Row({ space: 16 }) {
            Image(AppService.client?.image(library.Id) ?? '').width(64).height(64).borderRadius(10).backgroundColor($r('app.color.brand_surface'))
            Text(library.Name).fontSize(18).fontColor('#F2F3FA').layoutWeight(1)
            Text('›').fontSize(28).fontColor($r('app.color.brand_accent'))
          }.padding(16).width('100%').backgroundColor($r('app.color.brand_surface_raised')).borderRadius(16)
            .onClick(() => { this.parentId = library.Id; this.sectionTitle = library.Name; this.mode = 'library'; this.load(); })
        }
      }, (library: MediaItem) => library.Id)
    }.layoutWeight(1).width('100%')
  }

  private refreshActors(): void {
    this.profiles = sortActors(actorProfiles(AppService.snapshot.items, AppService.experience?.snapshot().follows ?? []), this.actorOrder, this.actorQuery, this.actorTag, this.followedOnly);
  }
  private actorSettings(): void {
    try { AppService.experience?.update((state: ExperienceState) => { state.actorOrder = this.actorOrder; state.followedOnly = this.followedOnly; state.showTags = this.showTags; }); }
    catch (e) { this.message = errorText(e as Error); }
    this.refreshActors();
  }
  private async quickPlay(item: MediaItem): Promise<void> {
    try { router.pushUrl({ url: 'pages/Player', params: await AppService.detailPlayback(item, '', this.usingCache) }); }
    catch (e) { this.message = errorText(e as Error); }
  }
  private performSearch(): void {
    if (!this.search.trim()) { return; }
    try { AppService.experience?.search(this.search); this.recentSearches = AppService.experience?.snapshot().searches ?? []; }
    catch (e) { this.message = errorText(e as Error); }
    this.mode = 'search'; this.parentId = ''; this.personId = ''; this.load();
  }
  private reason(item: MediaItem): void {
    const value = this.discoveries.find((d: Discovery) => d.item.Id === item.Id);
    if (!value) { return; }
    AlertDialog.show({ title: $r('app.string.discovery_reason'), message: value.actors.concat(value.genres).join(' · ') || $r('app.string.discovery_recent'), confirm: { value: $r('app.string.ok'), action: () => {} } });
  }

  @Builder
  private actorFilters() {
    Column({ space: 10 }) {
    TextInput({ text: this.actorQuery, placeholder: $r('app.string.actor_search') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface'))
      .onChange((value: string) => { this.actorQuery = value; this.refreshActors(); })
    Select([{ value: $r('app.string.actor_order_play') }, { value: $r('app.string.actor_order_watched') }, { value: $r('app.string.actor_order_unplayed') }, { value: $r('app.string.actor_order_works') }, { value: $r('app.string.actor_order_recent') }, { value: $r('app.string.actor_order_name') }, { value: $r('app.string.actor_order_recommended') }])
      .selected(['playCount', 'watched', 'unplayed', 'works', 'recent', 'name', 'recommended'].indexOf(this.actorOrder))
      .value(text(['actor_order_play', 'actor_order_watched', 'actor_order_unplayed', 'actor_order_works', 'actor_order_recent', 'actor_order_name', 'actor_order_recommended'][['playCount', 'watched', 'unplayed', 'works', 'recent', 'name', 'recommended'].indexOf(this.actorOrder)]))
      .fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onSelect((index: number) => { this.actorOrder = ['playCount', 'watched', 'unplayed', 'works', 'recent', 'name', 'recommended'][index]; this.actorSettings(); })
    Flex({ wrap: FlexWrap.Wrap }) {
      Row() { Checkbox().select(this.followedOnly).selectedColor($r('app.color.brand_action')).onChange((value: boolean) => { this.followedOnly = value; this.actorSettings(); })
      Text($r('app.string.followed_only')).fontColor($r('app.color.brand_muted')).fontSize(13) }.margin({ right: 8, bottom: 8 })
      Row() { Checkbox().select(this.showTags).selectedColor($r('app.color.brand_action')).onChange((value: boolean) => { this.showTags = value; this.actorSettings(); })
      Text($r('app.string.show_actor_tags')).fontColor($r('app.color.brand_muted')).fontSize(13) }.margin({ right: 8, bottom: 8 })
      if (this.actorTag) { Button($r('app.string.clear_filters')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).onClick(() => { this.actorTag = ''; this.actorQuery = ''; this.followedOnly = false; this.actorSettings(); }) }
    }
    if (!AppService.snapshot.syncedAt) {
      Text($r('app.string.actors_sync_hint')).fontColor($r('app.color.brand_muted'))
      Button($r('app.string.sync_library')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_action')).enabled(!this.syncing).onClick(() => this.sync())
    }
    }.width('100%')
  }

  @Builder
  actorPanel() {
    if (UiLayout.separateFilters(this.viewportHeight, this.landscape)) {
      Scroll() { this.actorFilters() }.height(UiLayout.filters(this.viewportHeight, this.fontScale)).width('100%').align(Alignment.TopStart)
    }
    List({ space: 12 }) {
      if (!UiLayout.separateFilters(this.viewportHeight, this.landscape)) { ListItem() { this.actorFilters() } }

      ForEach(this.profiles, (actor: ActorProfile) => {
        ListItem() {
          Column({ space: 8 }) {
            Row({ space: 14 }) {
              Image(AppService.client?.image(actor.person.Id, actor.person.PrimaryImageTag) ?? '').width(56).height(56).borderRadius(28).backgroundColor($r('app.color.brand_surface'))
              Column({ space: 6 }) {
                Text(actor.person.Name).fontColor('#F2F3FA').fontSize(16)
                Text($r('app.string.actor_counts', actor.works.length, actor.watched, actor.unplayed)).fontColor($r('app.color.brand_muted')).fontSize(12)
                if (actor.followed) { Text($r('app.string.actor_new_count', actor.newCount)).fontColor($r('app.color.brand_accent')).fontSize(12) }
              }.alignItems(HorizontalAlign.Start).layoutWeight(1)
              Text('›').fontColor($r('app.color.brand_accent')).fontSize(24)
            }.width('100%').onClick(() => router.pushUrl({ url: 'pages/Actor', params: { personId: actor.person.Id, personName: actor.person.Name } }))
            if (this.showTags) {
              Flex({ wrap: FlexWrap.Wrap }) {
                ForEach(actor.tags.slice(0, 3), (tag: ActorTag) => {
                  Button(tag.theme ? $r('app.string.theme_' + tag.title) : tag.title, { type: ButtonType.Normal }).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).fontSize(11).fontColor($r('app.color.brand_accent')).backgroundColor($r('app.color.brand_selected')).borderRadius(8).height(30)
                    .onClick(() => { this.actorTag = tag.key; this.refreshActors(); })
                }, (tag: ActorTag) => tag.key)
              }
            }
          }.padding(12).width('100%').backgroundColor($r('app.color.brand_surface_raised')).borderRadius(14)
        }
      }, (actor: ActorProfile) => `${actor.person.Id}|${actor.watched}:${actor.unplayed}:${actor.playCount}:${actor.followed}:${actor.newCount}:${JSON.stringify(actor.tags)}`)
    }.layoutWeight(1).width('100%')
    if (this.profiles.length === 0 && AppService.snapshot.syncedAt) { Text($r('app.string.no_filter_matches')).fontColor($r('app.color.brand_muted')) }
  }

  @Builder
  downloadsPanel() {
    List({ space: 12 }) {
      ForEach(this.downloads, (record: DownloadRecord) => {
        ListItem() {
          Column({ space: 10 }) {
            Text(record.item.Name).fontColor('#F2F3FA').fontSize(16).width('100%')
            Text(record.state === 'complete' ? $r('app.string.download_complete') : record.state === 'downloading' ?
              $r('app.string.download_progress', Math.floor(record.progress * 100)) : $r('app.string.download_interrupted'))
              .fontSize(12).fontColor($r('app.color.brand_muted'))
            Flex({ wrap: FlexWrap.Wrap }) {
              Button($r('app.string.play')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).enabled(record.state === 'complete').backgroundColor($r('app.color.brand_action'))
                .onClick(async () => {
                  try { router.pushUrl({ url: 'pages/Player', params: await AppService.playback(record.item) }); }
                  catch (e) { this.message = errorText(e as Error); }
                })
              Button($r('app.string.remove_download')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).margin({ right: 8, bottom: 8 }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).onClick(() => {
                AlertDialog.show({ title: $r('app.string.remove_download'), message: $r('app.string.remove_download_confirm'),
                  primaryButton: { value: $r('app.string.cancel'), action: () => {} },
                  secondaryButton: { value: $r('app.string.remove'), action: async () => {
                    try { await AppService.removeDownload(record); this.downloads = [...AppService.downloads]; }
                    catch (e) { this.message = errorText(e as Error); }
                  } }
                });
              })
            }
          }.padding(16).width('100%').backgroundColor($r('app.color.brand_surface_raised')).borderRadius(14)
        }
      }, (record: DownloadRecord) => record.id)
    }.layoutWeight(1).width('100%')
    if (this.downloads.length === 0) { Text($r('app.string.no_downloads')).fontColor($r('app.color.brand_muted')).padding(20) }
  }

  @Builder
  morePanel() {
    Scroll() {
    Column({ space: 16 }) {
      Text(AppService.client?.session.userName ?? '').fontSize(24).fontColor('#F2F3FA')
      Text(AppService.client?.session.server ?? '').fontSize(12).fontColor($r('app.color.brand_muted'))
      Button($r('app.string.favorites')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface'))
        .onClick(() => router.pushUrl({ url: 'pages/Favorites' }))
      Button($r('app.string.downloads')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface'))
        .onClick(() => router.pushUrl({ url: 'pages/Downloads' }))
      Button({ type: ButtonType.Capsule }) {
        Stack({ alignContent: Alignment.Center }) {
          Text($r('app.string.tab_library')).fontSize(16).fontWeight(FontWeight.Medium).fontColor('#F2F3FA')
            .width('100%').textAlign(TextAlign.Center).padding({ left: 32, right: 32 })
          Row() {
            Image($r('app.media.nav_library_muted')).width(22).height(22).accessibilityLevel('no')
            Blank()
          }.width('100%').hitTestBehavior(HitTestMode.None)
        }.width('100%')
      }.width('100%').height(UiLayout.buttonHeight(this.fontScale)).padding({ left: 16, right: 16 }).backgroundColor($r('app.color.brand_surface'))
        .accessibilityText($r('app.string.tab_library')).onClick(() => { this.tab = 2; this.mode = ''; this.load(); })
      Button($r('app.string.settings')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface')).onClick(() => router.pushUrl({ url: 'pages/Settings' }))
      Button(this.syncing ? $r('app.string.syncing') : $r('app.string.sync_library')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface'))
        .enabled(!this.syncing).onClick(() => this.sync())
      if (this.syncing) { Button($r('app.string.cancel_sync')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).onClick(() => AppService.cancelSync()) }
      Text($r('app.string.pending_changes', this.pendingCount)).fontSize(12).fontColor($r('app.color.brand_muted'))
      Button($r('app.string.flush_changes')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface')).onClick(async () => { try { await AppService.flushPending(); this.pendingCount = (AppService.experience?.snapshot().pending.length ?? 0) + (AppService.experience?.snapshot().positions.length ?? 0); this.syncMessage = getContext(this).resourceManager.getStringSync($r('app.string.pending_changes').id, (AppService.experience?.snapshot().pending.length ?? 0) + (AppService.experience?.snapshot().positions.length ?? 0)); } catch (e) { this.syncMessage = errorText(e as Error); } })
      Text(this.lastSyncedAt ? $r('app.string.last_sync', new Date(this.lastSyncedAt).toLocaleString()) : $r('app.string.not_synced'))
        .fontSize(12).fontColor($r('app.color.brand_muted'))
      if (this.syncMessage) { Text(this.syncMessage).fontSize(13).fontColor($r('app.color.brand_muted')) }
      Button($r('app.string.accounts_servers')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface')).onClick(() => router.pushUrl({ url: 'pages/Accounts' }))
      Button($r('app.string.change_account')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).width('100%').backgroundColor($r('app.color.brand_surface')).enabled(!this.syncing)
        .onClick(() => {
          AlertDialog.show({ title: $r('app.string.change_account'), message: $r('app.string.logout_confirm'),
            primaryButton: { value: $r('app.string.cancel'), action: () => {} },
            secondaryButton: { value: $r('app.string.logout'), action: async () => {
              await this.logout();
            } }
          });
        })
      Text($r('app.string.version')).fontSize(12).fontColor($r('app.color.brand_muted'))
    }.width('100%').padding({ top: 18, bottom: 18 })
    }.width('100%').layoutWeight(1).align(Alignment.TopStart)
  }

  @Builder
  homePanel() {
    List({ space: 24 }) {
      ListItem() { Column({ space: 8 }) {
    Row({ space: 12 }) {
      Button($r('app.string.favorites')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).layoutWeight(1).backgroundColor($r('app.color.brand_surface')).onClick(() => router.pushUrl({ url: 'pages/Favorites' }))
      Button($r('app.string.downloads')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).layoutWeight(1).backgroundColor($r('app.color.brand_surface')).onClick(() => router.pushUrl({ url: 'pages/Downloads' }))
    }.width('100%').padding({ left: 20, right: 20, bottom: 8 })
    if (this.usingCache) { Text($r('app.string.offline_cache')).fontSize(12).fontColor($r('app.color.brand_muted')) }
    ForEach(this.homeFailures, (failure: HomeFailure) => {
      Row() {
        Text(failure.name || $r('app.string.home_section_failed')).layoutWeight(1).fontSize(12).fontColor('#FF9F9F')
        Button($r('app.string.retry')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).backgroundColor($r('app.color.brand_surface')).onClick(() => this.homeLoader?.retry(failure.id))
      }.width('100%').padding({ left: 20, right: 20 })
    }, (failure: HomeFailure) => failure.id)
      }.width('100%') }

      ForEach(this.homeSections, (section: HomeSection) => {
        ListItem() {
          HomeShelf({ section: section, onPlay: (item: MediaItem) => this.quickPlay(item), onSelect: (item: MediaItem) => this.open(item),
            onLibrary: (selected: HomeSection) => this.openLibrary(selected) })
        }
      }, (section: HomeSection) => `${section.id}|${JSON.stringify(section)}`)
    }.width('100%').layoutWeight(1).padding({ top: 8, bottom: 16 }).scrollBar(BarState.Off)
    if (!this.busy && this.homeSections.length === 0) {
      Text($r('app.string.no_items')).fontColor($r('app.color.brand_muted')).padding(24)
    }
  }

  @Builder
  navItem(index: number, label: Resource, active: Resource, muted: Resource) {
    Button({ type: ButtonType.Normal }) {
      Column({ space: 4 }) {
        Stack() {
          Image((this.tab === index || (index === 4 && this.tab === 2)) ? active : muted).width(24).height(24)
        }.width(56).height(30).borderRadius(15).backgroundColor((this.tab === index || (index === 4 && this.tab === 2)) ? $r('app.color.brand_selected') : Color.Transparent)
        Text(label).fontSize(12).fontWeight((this.tab === index || (index === 4 && this.tab === 2)) ? FontWeight.Medium : FontWeight.Regular)
          .fontColor((this.tab === index || (index === 4 && this.tab === 2)) ? $r('app.color.brand_accent') : $r('app.color.brand_muted')).maxLines(1)
      }.width('100%')
    }.layoutWeight(1).height(34 + 16 * this.fontScale).padding(0).backgroundColor(Color.Transparent)
      .accessibilityText(label).onClick(() => this.switchTab(index))
  }

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column() {
      if (!this.signedIn) { this.loginPanel() }
      else {
        Row({ space: 8 }) {
          Text(this.tabTitle()).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(22).fontWeight(FontWeight.Medium).fontColor('#F2F3FA').layoutWeight(1)
          if (this.tab !== 4 && this.mode !== 'downloads') {
            Button({ type: ButtonType.Normal }) {
              Image($r('app.media.nav_search_muted')).width(24).height(24)
            }.width(44).height(44).padding(10).backgroundColor(Color.Transparent).accessibilityText($r('app.string.search_hint'))
              .onClick(() => { this.searchExpanded = !this.searchExpanded; })
          }
          Button($r('app.string.refresh'), { type: ButtonType.Normal }).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).fontSize(13).fontColor($r('app.color.brand_accent'))
            .backgroundColor(Color.Transparent).height(44).padding({ left: 8, right: 8 }).enabled(!this.busy).onClick(() => this.load())
        }.height(UiLayout.headerHeight(this.fontScale)).width('100%').padding({ left: 20, right: 12 })
        if (this.tab !== 4 && this.mode !== 'downloads' && this.searchExpanded) {
          TextInput({ text: this.search, placeholder: $r('app.string.search_hint') }).height(UiLayout.buttonHeight(this.fontScale)).fontSize(14).fontColor('#F2F3FA')
            .placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).height(44).margin({ left: 16, right: 16, bottom: 12 })
            .enterKeyType(EnterKeyType.Search).onChange((value: string) => { this.search = value; })
            .onSubmit(() => this.performSearch())
        }
        if (this.searchExpanded && !this.mode) {
          Scroll() { Row({ space: 8 }) { ForEach(this.recentSearches, (value: string) => {
            Button(value).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).fontSize(12).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.search = value; this.performSearch(); })
          }, (value: string) => value) } }.scrollable(ScrollDirection.Horizontal).width('100%').height(UiLayout.buttonHeight(this.fontScale))
        }
        if (this.mode) {
          Row() {
            Button($r('app.string.back'), { type: ButtonType.Normal }).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).fontSize(13).fontColor($r('app.color.brand_accent'))
              .backgroundColor(Color.Transparent).onClick(() => this.switchTab(this.tab))
            Text(this.sectionTitle || (this.mode === 'favorites' ? $r('app.string.favorites') : this.mode === 'downloads' ? $r('app.string.downloads') : $r('app.string.search_results')))
              .fontColor('#F2F3FA').fontSize(18).layoutWeight(1).maxLines(1)
          }.width('100%').padding({ left: 8, right: 16 })
        }
        if (this.busy) { LoadingProgress().width(26).height(26).color($r('app.color.brand_accent')) }
        if (this.message) { Text(this.message).fontSize(12).fontColor('#FF9F9F').width('100%').padding({ left: 16, right: 16, bottom: 8 }) }
        if (this.cacheMessage) { Text(this.cacheMessage).fontSize(12).fontColor('#EFC86A').width('100%').padding({ left: 16, right: 16, bottom: 8 }) }
        if (this.tab === 1 && !this.mode) { this.homePanel() }
        else {
          Column({ space: 12 }) {
            if (this.mode === 'downloads') { this.downloadsPanel() }
            else if (this.tab === 4 && !this.mode) { this.morePanel() }
            else if (this.tab === 3 && !this.mode) { this.actorPanel() }
            else if (this.tab === 2 && !this.mode) { this.libraryPanel() }
            else {
              if (!this.mode && this.tab === 0 && UiLayout.separateFilters(this.viewportHeight, this.landscape)) {
                Scroll() { this.recommendFilters() }.width('100%').height(UiLayout.filters(this.viewportHeight, this.fontScale)).align(Alignment.TopStart)
              }
              if (this.items.length === 0 && !this.busy) { Text($r('app.string.no_items')).fontColor($r('app.color.brand_muted')).padding(24) }
              this.mediaGrid()
              if (this.mode && this.items.length < this.total) {
                Button($r('app.string.load_more')).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).enabled(!this.busy).backgroundColor($r('app.color.brand_surface')).onClick(() => this.load(true))
              }
            }
          }.width('100%').layoutWeight(1).padding({ left: 16, right: 16, top: 8, bottom: 8 })
        }
        Row() {
          this.navItem(1, $r('app.string.tab_home'), $r('app.media.nav_home_active'), $r('app.media.nav_home_muted'))
          if (!this.offline) { this.navItem(0, $r('app.string.tab_recommend'), $r('app.media.nav_star_active'), $r('app.media.nav_star_muted')) }
          this.navItem(3, $r('app.string.tab_actors'), $r('app.media.nav_user_active'), $r('app.media.nav_user_muted'))
          this.navItem(4, $r('app.string.tab_more'), $r('app.media.nav_more_active'), $r('app.media.nav_more_muted'))
        }.width('100%').height(UiLayout.navHeight(this.fontScale)).padding({ left: 4, right: 4 }).backgroundColor($r('app.color.brand_surface_raised'))
      }
    }.width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
