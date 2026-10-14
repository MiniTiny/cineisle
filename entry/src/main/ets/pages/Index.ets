import { BrandChoice } from '../components/BrandChoice';
import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandButton } from '../components/BrandButton';
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
  @State searchFocused: boolean = false;
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
    this.mode = ''; this.search = ''; this.searchExpanded = false; this.searchFocused = false; this.parentId = ''; this.personId = ''; this.sectionTitle = '';
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
    this.tab = index; this.mode = ''; this.parentId = ''; this.personId = ''; this.search = ''; this.searchExpanded = false; this.searchFocused = false;
    this.items = []; this.resume = []; this.homeSections = []; this.libraries = []; this.actors = []; this.downloads = [];
    this.sectionTitle = ''; this.total = 0; this.usingCache = false;
    this.load();
  }

  onBackPress(): boolean {
    if (!this.locked && this.signedIn && this.searchFocused && (this.searchExpanded || this.mode === 'search')) {
      this.getUIContext().getFocusController().clearFocus();
      this.searchFocused = false;
      return true;
    }
    if (!this.locked && this.signedIn && (this.searchExpanded || this.mode === 'search')) {
      this.switchTab(this.tab);
      return true;
    }
    if (!this.locked && this.signedIn && this.tab === 2) {
      this.switchTab(this.mode ? 2 : 4);
      return true;
    }
    return false;
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
    this.sectionTitle = section.name; this.search = ''; this.searchExpanded = false; this.searchFocused = false; this.load();
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
      Column({ space: 18 }) {
        Column({ space: 12 }) {
          Image($r('app.media.app_icon')).width(76).height(76).borderRadius(20).accessibilityLevel('no')
          Text($r('app.string.app_name')).fontSize(28).fontWeight(FontWeight.Bold).fontColor('#F2F3FA').width('100%')
          Text($r('app.string.login_intro')).fontSize(14).fontColor($r('app.color.brand_muted')).width('100%')
        }.width('100%').alignItems(HorizontalAlign.Start)
        Column({ space: 12 }) {
          BrandHeading({ label: $r('app.string.login_credentials'), icon: $r('app.media.menu_login') })
          Text($r('app.string.server_address_label')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
          TextInput({ text: this.server, placeholder: $r('app.string.server_placeholder') }).height(UiLayout.buttonHeight(this.fontScale)).fontSize(14).onChange((value: string) => { this.server = value; })
            .fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy)
          Text($r('app.string.username')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
          TextInput({ text: this.username, placeholder: $r('app.string.username') }).height(UiLayout.buttonHeight(this.fontScale)).fontSize(14).onChange((value: string) => { this.username = value; })
            .fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy)
          Text($r('app.string.password')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
          TextInput({ text: this.password, placeholder: $r('app.string.password') }).height(UiLayout.buttonHeight(this.fontScale)).fontSize(14).type(InputType.Password)
            .onChange((value: string) => { this.password = value; }).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy)
          Text($r('app.string.https_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
          if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(13).width('100%') }
          BrandButton({ label: this.busy ? $r('app.string.connecting') : $r('app.string.login'), icon: $r('app.media.menu_login'), primary: true,
            available: this.ready && !this.busy && !!this.server.trim() && !!this.username.trim(), onSelect: () => this.login() })
        }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
        Column({ space: 12 }) {
          BrandHeading({ label: $r('app.string.login_connections'), icon: $r('app.media.menu_accounts') })
          BrandButton({ label: $r('app.string.quick_connect_login'), icon: $r('app.media.menu_quick'), available: this.ready && !this.busy,
            onSelect: () => router.pushUrl({ url: 'pages/Accounts', params: { server: this.server, quick: true } }) })
          BrandButton({ label: $r('app.string.accounts_servers'), icon: $r('app.media.menu_accounts'), available: this.ready && !this.busy,
            onSelect: () => router.pushUrl({ url: 'pages/Accounts' }) })
        }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
      }.padding(20).width('100%').alignItems(HorizontalAlign.Start)
    }.width('100%').height('100%').align(Alignment.TopStart)
  }

  @Builder
  private searchPanel() {
    Grid() {
      GridItem() {
        Column({ space: 12 }) {
          BrandHeading({ label: $r('app.string.search_group'), icon: $r('app.media.nav_search_active') })
          Text($r('app.string.search_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
          TextInput({ text: this.search, placeholder: $r('app.string.search_hint') }).height(UiLayout.buttonHeight(this.fontScale)).fontSize(14).fontColor('#F2F3FA')
            .placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12)
            .enterKeyType(EnterKeyType.Search).onFocus(() => { this.searchFocused = true; }).onBlur(() => { this.searchFocused = false; })
            .onChange((value: string) => { this.search = value; }).onSubmit(() => this.performSearch())
          BrandButton({ label: $r('app.string.search_action'), icon: $r('app.media.nav_search_active'), primary: true, available: !this.busy && !!this.search.trim(), onSelect: () => this.performSearch() })
          BrandButton({ label: $r('app.string.close_search'), icon: $r('app.media.menu_cancel'), onSelect: () => this.switchTab(this.tab) })
          if (this.busy) { LoadingProgress().width(26).height(26).color($r('app.color.brand_accent')) }
          if (this.message) { Text(this.message).fontSize(12).fontColor($r('app.color.brand_danger')).width('100%') }
          if (this.cacheMessage) { Text(this.cacheMessage).fontSize(12).fontColor($r('app.color.brand_warm')).width('100%') }
        }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
      }.columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
      if (this.recentSearches.length > 0) {
        GridItem() {
          Column({ space: 12 }) {
            BrandHeading({ label: $r('app.string.search_history'), icon: $r('app.media.menu_sync') })
            Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
              ForEach(this.recentSearches, (value: string) => {
                Column() { BrandButton({ label: value, icon: $r('app.media.nav_search_muted'), compact: true, available: !this.busy, onSelect: () => { this.search = value; this.performSearch(); } }) }
                  .width(this.viewportWidth < 400 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
              }, (value: string) => value)
            }.width('100%')
          }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
        }.columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
      }
      if (this.mode === 'search') {
        GridItem() { BrandHeading({ label: $r('app.string.search_results'), icon: $r('app.media.detail_film') }) }
          .columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
        if (this.items.length === 0 && !this.busy) {
          GridItem() { Text($r('app.string.no_items')).fontColor($r('app.color.brand_muted')).width('100%').padding(16) }
            .columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
        }
        ForEach(this.items, (item: MediaItem) => {
          GridItem() { MediaCard({ item: item, onSelect: (selected: MediaItem) => this.open(selected) }) }
        }, (item: MediaItem) => `${item.Id}|${JSON.stringify(item)}`)
        if (this.items.length < this.total) {
          GridItem() { BrandButton({ label: $r('app.string.load_more'), icon: $r('app.media.menu_add'), available: !this.busy, onSelect: () => this.load(true) }) }
            .columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
        }
      }
    }.columnsTemplate(UiLayout.columns(this.viewportWidth, this.fontScale)).columnsGap(12).rowsGap(16).width('100%').layoutWeight(1)
      .padding({ left: 16, right: 16, top: 8, bottom: 16 })
  }

  @Builder
  private recommendFilters() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.recommend_group'), icon: $r('app.media.nav_star_active') })
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        Column() { BrandButton({ label: $r('app.string.discover'), icon: $r('app.media.nav_star_active'), primary: this.discover, onSelect: () => { this.discover = true; this.load(); } }) }
          .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
        Column() { BrandButton({ label: $r('app.string.rewatch'), icon: $r('app.media.menu_sync'), primary: !this.discover, onSelect: () => { this.discover = false; this.load(); } }) }
          .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
      }.width('100%')
      Text(this.discover ? $r('app.string.discovery_hint') : $r('app.string.recommend_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
    }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
  }

  @Builder
    mediaGrid() {
    Grid() {
      if (!this.mode && this.tab === 0) {
        GridItem() { this.recommendFilters() }.columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
      }

      if (this.items.length === 0 && !this.busy) {
        GridItem() { Text($r('app.string.no_items')).fontColor($r('app.color.brand_muted')).width('100%').padding(24) }
          .columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1)
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
          Button({ type: ButtonType.Normal }) {
            Row({ space: 14 }) {
              Row() {
                Image(library.CollectionType === 'movies' ? $r('app.media.detail_film') : $r('app.media.nav_library_active')).width(28).height(28).accessibilityLevel('no')
              }.width(52).height(52).flexShrink(0).borderRadius(16).justifyContent(FlexAlign.Center).backgroundColor($r('app.color.brand_selected'))
              Column({ space: 4 }) {
                Text(library.Name).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#F2F3FA').width('100%')
                Text(library.CollectionType === 'movies' ? $r('app.string.media_movie') : library.CollectionType === 'tvshows' ? $r('app.string.media_series') : $r('app.string.tab_library')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
              }.layoutWeight(1).alignItems(HorizontalAlign.Start)
              Image($r('app.media.menu_chevron')).width(16).height(16).flexShrink(0).accessibilityLevel('no')
            }.width('100%').padding({ left: 16, right: 16, top: this.landscape && this.viewportHeight < 440 ? 8 : 16, bottom: this.landscape && this.viewportHeight < 440 ? 8 : 16 }).hitTestBehavior(HitTestMode.None)
          }.padding(0).width('100%').backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
            .accessibilityText(library.Name).onClick(() => { this.parentId = library.Id; this.sectionTitle = library.Name; this.mode = 'library'; this.load(); })
        }
      }, (library: MediaItem) => `${library.Id}|${library.Name}|${library.CollectionType}`)
      if (!this.libraries.length && !this.busy) { ListItem() {
        Column({ space: 12 }) {
          BrandHeading({ label: $r('app.string.tab_library'), icon: $r('app.media.nav_library_active') })
          Text($r('app.string.no_items')).fontColor($r('app.color.brand_muted')).width('100%')
        }.padding(16).width('100%').backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
      } }
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
    if (this.busy || !this.search.trim()) { return; }
    this.getUIContext().getFocusController().clearFocus(); this.searchFocused = false;
    try { AppService.experience?.search(this.search); this.recentSearches = AppService.experience?.snapshot().searches ?? []; }
    catch (e) { this.message = errorText(e as Error); }
    this.mode = 'search'; this.sectionTitle = ''; this.parentId = ''; this.personId = ''; this.searchExpanded = true; this.load();
  }
  private reason(item: MediaItem): void {
    const value = this.discoveries.find((d: Discovery) => d.item.Id === item.Id);
    if (!value) { return; }
    AlertDialog.show({ title: $r('app.string.discovery_reason'), message: value.actors.concat(value.genres).join(' · ') || $r('app.string.discovery_recent'), confirm: { value: $r('app.string.ok'), action: () => {} } });
  }

  @Builder
  private actorFilters() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.actor_filters'), icon: $r('app.media.menu_settings') })
      Text($r('app.string.actor_search')).fontSize(14).fontColor($r('app.color.brand_muted')).width('100%')
      TextInput({ text: this.actorQuery, placeholder: $r('app.string.actor_search') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(14).width('100%')
        .onChange((value: string) => { this.actorQuery = value; this.refreshActors(); })
      BrandChoice({ label: $r('app.string.actor_sort'), icon: $r('app.media.menu_settings'),
        choices: [{ value: text('actor_order_play') }, { value: text('actor_order_watched') }, { value: text('actor_order_unplayed') }, { value: text('actor_order_works') }, { value: text('actor_order_recent') }, { value: text('actor_order_name') }, { value: text('actor_order_recommended') }],
        selected: Math.max(0, ['playCount', 'watched', 'unplayed', 'works', 'recent', 'name', 'recommended'].indexOf(this.actorOrder)),
        onSelect: (index: number) => { this.actorOrder = ['playCount', 'watched', 'unplayed', 'works', 'recent', 'name', 'recommended'][index]; this.actorSettings(); } })
      Row({ space: 8 }) {
        Checkbox().select(this.followedOnly).selectedColor($r('app.color.brand_action')).onChange((value: boolean) => { this.followedOnly = value; this.actorSettings(); })
        Text($r('app.string.followed_only')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
      }.width('100%')
      Row({ space: 8 }) {
        Checkbox().select(this.showTags).selectedColor($r('app.color.brand_action')).onChange((value: boolean) => { this.showTags = value; this.actorSettings(); })
        Text($r('app.string.show_actor_tags')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
      }.width('100%')
      if (this.actorTag || this.actorQuery || this.followedOnly) {
        BrandButton({ label: $r('app.string.clear_filters'), icon: $r('app.media.menu_cancel'), onSelect: () => { this.actorTag = ''; this.actorQuery = ''; this.followedOnly = false; this.actorSettings(); } })
      }
      if (!AppService.snapshot.syncedAt) {
        Text($r('app.string.actors_sync_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
        BrandButton({ label: $r('app.string.sync_library'), icon: $r('app.media.menu_sync'), primary: true, available: !this.syncing, onSelect: () => this.sync() })
      }
    }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
  }

  @Builder
  actorPanel() {
    List({ space: 12 }) {
      ListItem() { this.actorFilters() }

      ForEach(this.profiles, (actor: ActorProfile) => {
        ListItem() {
          Column({ space: 8 }) {
            Button({ type: ButtonType.Normal }) {
            Row({ space: 14 }) {
              Image(AppService.client?.image(actor.person.Id, actor.person.PrimaryImageTag) ?? '').alt($r('app.media.nav_user_active')).width(56).height(56).borderRadius(28).flexShrink(0).backgroundColor($r('app.color.brand_surface'))
              Column({ space: 6 }) {
                Text(actor.person.Name).fontColor('#F2F3FA').fontSize(16).width('100%')
              }.alignItems(HorizontalAlign.Start).layoutWeight(1)
              Image($r('app.media.menu_chevron')).width(16).height(16).flexShrink(0).accessibilityLevel('no')
            }.width('100%').hitTestBehavior(HitTestMode.None)
            }.width('100%').padding(0).backgroundColor(Color.Transparent).borderRadius(14).accessibilityText(actor.person.Name).onClick(() => router.pushUrl({ url: 'pages/Actor', params: { personId: actor.person.Id, personName: actor.person.Name } }))
            Text($r('app.string.actor_counts', actor.works.length, actor.watched, actor.unplayed)).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
            if (actor.followed) { Text($r('app.string.actor_new_count', actor.newCount)).fontColor($r('app.color.brand_accent')).fontSize(12).width('100%') }
            if (this.showTags) {
              Flex({ wrap: FlexWrap.Wrap }) {
                ForEach(actor.tags.slice(0, 3), (tag: ActorTag) => {
                  Column() { BrandButton({ label: tag.theme ? $r('app.string.theme_' + tag.title) : tag.title, icon: $r('app.media.nav_star_active'), compact: true, primary: this.actorTag === tag.key, onSelect: () => { this.actorTag = tag.key; this.refreshActors(); } }) }
                    .width(this.fontScale > 1 || this.viewportWidth < 360 ? '100%' : '48%').margin({ right: 4, bottom: 8 })
                }, (tag: ActorTag) => tag.key)
              }
            }
          }.padding(16).width('100%').backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
        }
      }, (actor: ActorProfile) => `${actor.person.Id}|${actor.watched}:${actor.unplayed}:${actor.playCount}:${actor.followed}:${actor.newCount}:${JSON.stringify(actor.tags)}`)
      if (this.profiles.length === 0 && AppService.snapshot.syncedAt) { ListItem() { Text($r('app.string.no_filter_matches')).fontColor($r('app.color.brand_muted')).width('100%') } }
    }.layoutWeight(1).width('100%')

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
  private menuAction(label: Resource, icon: Resource, activate: () => void, enabled: boolean = true, departure: boolean = false, compact: boolean = false) {
    Button({ type: ButtonType.Normal }) {
      Row({ space: 10 }) {
        Row() {
          Image(icon).width(22).height(22).accessibilityLevel('no')
        }.width(compact ? 32 : 36).height(compact ? 32 : 36).justifyContent(FlexAlign.Center).borderRadius(12)
          .backgroundColor($r('app.color.brand_selected')).flexShrink(0)
        Text(label).fontSize(16).fontWeight(FontWeight.Medium)
          .fontColor(departure ? $r('app.color.brand_warm') : '#F2F3FA')
          .layoutWeight(1).textAlign(TextAlign.Start).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
        if (!compact) { Image($r('app.media.menu_chevron')).width(16).height(16).flexShrink(0).accessibilityLevel('no') }
      }.width('100%').constraintSize({ minHeight: Math.max(36, 32 * this.fontScale) })
        .padding({ left: compact ? 12 : 16, right: compact ? 12 : 16, top: 8, bottom: 8 }).hitTestBehavior(HitTestMode.None)
    }.width('100%').constraintSize({ minHeight: Math.max(36, 32 * this.fontScale) + 16 }).padding(0).borderRadius(18)
      .backgroundColor($r('app.color.brand_surface')).enabled(enabled && (!departure || !this.syncing)).accessibilityText(label).onClick(activate)
  }

  @Builder
  private menuHeading(label: Resource) {
    Text(label).fontSize(12).fontWeight(FontWeight.Medium).fontColor($r('app.color.brand_muted'))
      .width('100%').padding({ left: 4, top: 4, bottom: 2 })
  }

  @Builder
  morePanel() {
    Scroll() {
      Column({ space: 18 }) {
        Row({ space: 14 }) {
          Image($r('app.media.app_icon')).width(48).height(48).borderRadius(14).flexShrink(0).accessibilityLevel('no')
          Column({ space: 4 }) {
            Text(AppService.client?.session.userName ?? '').fontSize(22).fontWeight(FontWeight.Medium)
              .fontColor('#F2F3FA').width('100%').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
            Text(AppService.client?.session.server ?? '').fontSize(12).fontColor($r('app.color.brand_muted'))
              .width('100%').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
          }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
        Column({ space: 8 }) {
          this.menuHeading($r('app.string.menu_collection'))
          this.menuAction($r('app.string.favorites'), $r('app.media.detail_heart'), () => router.pushUrl({ url: 'pages/Favorites' }))
          this.menuAction($r('app.string.downloads'), $r('app.media.detail_download'), () => router.pushUrl({ url: 'pages/Downloads' }))
          this.menuAction($r('app.string.tab_library'), $r('app.media.nav_library_active'), () => { this.tab = 2; this.mode = ''; this.load(); })
        }.width('100%')
        Column({ space: 8 }) {
          this.menuHeading($r('app.string.menu_preferences'))
          this.menuAction($r('app.string.accounts_servers'), $r('app.media.menu_accounts'), () => router.pushUrl({ url: 'pages/Accounts' }))
          this.menuAction($r('app.string.settings'), $r('app.media.menu_settings'), () => router.pushUrl({ url: 'pages/Settings' }))
        }.width('100%')
        Column({ space: 8 }) {
          this.menuHeading($r('app.string.menu_data'))
          if (this.syncing) {
            this.menuAction($r('app.string.syncing'), $r('app.media.menu_sync'), () => {}, false)
          } else {
            this.menuAction($r('app.string.sync_library'), $r('app.media.menu_sync'), () => this.sync())
          }
          if (this.syncing) { this.menuAction($r('app.string.cancel_sync'), $r('app.media.menu_cancel'), () => AppService.cancelSync()) }
          this.menuAction($r('app.string.flush_changes'), $r('app.media.menu_upload'), async () => { try { await AppService.flushPending(); this.pendingCount = (AppService.experience?.snapshot().pending.length ?? 0) + (AppService.experience?.snapshot().positions.length ?? 0); this.syncMessage = getContext(this).resourceManager.getStringSync($r('app.string.pending_changes').id, this.pendingCount); } catch (e) { this.syncMessage = errorText(e as Error); } })
          Text($r('app.string.pending_changes', this.pendingCount)).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%').padding({ left: 4 })
          Text(this.lastSyncedAt ? $r('app.string.last_sync', new Date(this.lastSyncedAt).toLocaleString()) : $r('app.string.not_synced'))
            .fontSize(12).fontColor($r('app.color.brand_muted')).width('100%').padding({ left: 4 })
          if (this.syncMessage) { Text(this.syncMessage).fontSize(13).fontColor($r('app.color.brand_muted')).width('100%') }
        }.width('100%')
        this.menuAction($r('app.string.change_account'), $r('app.media.menu_logout'), () => {
          AlertDialog.show({ title: $r('app.string.change_account'), message: $r('app.string.logout_confirm'),
            primaryButton: { value: $r('app.string.cancel'), action: () => {} },
            secondaryButton: { value: $r('app.string.logout'), action: async () => { await this.logout(); } }
          });
        }, true, true)
        Text($r('app.string.version')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%').textAlign(TextAlign.Center)
      }.width('100%').padding({ top: 8, bottom: 18 })
    }.width('100%').layoutWeight(1).align(Alignment.TopStart)
  }

  @Builder
  homePanel() {
    List({ space: 24 }) {
      ListItem() { Column({ space: 8 }) {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      Column() { this.menuAction($r('app.string.favorites'), $r('app.media.detail_heart'), () => router.pushUrl({ url: 'pages/Favorites' }), true, false, true) }
        .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
      Column() { this.menuAction($r('app.string.downloads'), $r('app.media.detail_download'), () => router.pushUrl({ url: 'pages/Downloads' }), true, false, true) }
        .width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
    }.width('100%').padding({ left: 20, right: 20 })
    if (this.usingCache) { Text($r('app.string.offline_cache')).fontSize(12).fontColor($r('app.color.brand_muted')) }
    ForEach(this.homeFailures, (failure: HomeFailure) => {
      Column({ space: 8 }) {
        Text(failure.name || $r('app.string.home_section_failed')).width('100%').fontSize(12).fontColor('#FF9F9F')
        BrandButton({ label: $r('app.string.retry'), icon: $r('app.media.menu_sync'), onSelect: () => this.homeLoader?.retry(failure.id) })
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
        if (!this.mode) {
          if (this.tab === 2) {
            Column() {
              BrandHeader({ label: $r('app.string.tab_library'), searchable: true, onSearch: () => { this.searchExpanded = !this.searchExpanded; }, refreshable: true, available: !this.busy, onRefresh: () => this.load(), onBack: () => this.switchTab(4) })
            }.width('100%').padding({ left: 16, right: 16, top: 8, bottom: 8 })
          } else {
        Row({ space: 8 }) {
          Text(this.tabTitle()).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(22).fontWeight(FontWeight.Medium).fontColor('#F2F3FA').layoutWeight(1)
          if (this.tab !== 4 && this.mode !== 'downloads') {
            Button({ type: ButtonType.Normal }) {
              Image(this.searchExpanded ? $r('app.media.nav_search_active') : $r('app.media.nav_search_muted')).width(24).height(24).accessibilityLevel('no')
            }.width(44).height(44).padding(0).borderRadius(14).backgroundColor($r('app.color.brand_surface')).accessibilityText($r('app.string.search_hint'))
              .onClick(() => { this.searchExpanded = !this.searchExpanded; })
          }
          Button({ type: ButtonType.Normal }) { Image($r('app.media.menu_sync')).width(24).height(24).accessibilityLevel('no') }
            .width(44).height(44).padding(0).borderRadius(14).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).accessibilityText($r('app.string.refresh')).onClick(() => this.load())
        }.height(UiLayout.primaryHeaderHeight(this.viewportHeight, this.fontScale, this.landscape)).width('100%').padding({ left: 20, right: 12 })
          }
        }
        if (this.mode) {
          Column() {
            BrandHeader({ label: this.sectionTitle || (this.mode === 'favorites' ? $r('app.string.favorites') : this.mode === 'downloads' ? $r('app.string.downloads') : $r('app.string.search_results')), searchable: this.mode !== 'downloads' && this.mode !== 'search', onSearch: () => { this.searchExpanded = !this.searchExpanded; }, refreshable: true, available: !this.busy, onRefresh: () => this.load(), onBack: () => this.switchTab(this.tab) })
          }.width('100%').padding({ left: 16, right: 16, bottom: 8 })
        }
        if (this.searchExpanded || this.mode === 'search') { this.searchPanel() }
        else {
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
              this.mediaGrid()
              if (this.mode && this.items.length < this.total) {
                BrandButton({ label: $r('app.string.load_more'), icon: $r('app.media.menu_add'), available: !this.busy, onSelect: () => this.load(true) })
              }
            }
          }.width('100%').layoutWeight(1).padding({ left: 16, right: 16, top: 8, bottom: 8 })
        }
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
