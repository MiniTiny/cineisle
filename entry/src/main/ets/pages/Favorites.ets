import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandButton } from '../components/BrandButton';
import { UiLayout } from '../utils/UiLayout';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { MediaItem } from '../model/Models';
import { AppService } from '../service/AppService';
import { JellyfinClient } from '../service/JellyfinClient';
import { ExperienceState, FavoriteFilter, filterFavorites, favoriteGenres, applyPending, connectionFailure } from '../utils/Experience';
import { errorText, text } from '../utils/Strings';
import { MediaCard } from '../components/MediaCard';

@Entry
@Component
struct Favorites {
  @StorageLink('cineIsleLandscape') landscape: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State all: MediaItem[] = [];
  @State visibleItems: MediaItem[] = [];
  @State genres: string[] = [];
  @State category: string = '';
  @State genre: string = '';
  @State query: string = '';
  @State unwatched: boolean = false;
  @State order: string = 'name';
  @State busy: boolean = false;
  @State selection: boolean = false;
  @State selected: string[] = [];
  @State undoItems: MediaItem[] = [];
  @State message: string = '';
  @State preview: boolean = true;
  private client: JellyfinClient | undefined = undefined;
  private revision: number = 0;
  private scroller: Scroller = new Scroller();
  aboutToAppear(): void {
    this.client = AppService.client;
    const prefs = AppService.experience?.snapshot() ?? new ExperienceState();
    this.category = prefs.favoriteCategory; this.genre = prefs.favoriteGenre; this.query = prefs.favoriteQuery;
    this.unwatched = prefs.favoriteUnwatched; this.order = prefs.favoriteOrder; this.refresh();
  }
  onPageShow(): void { if (this.client && this.client !== AppService.client) { this.all = []; this.visibleItems = []; router.back(); return; } if (!this.busy) { this.refresh(); } }
  onPageHide(): void { ++this.revision; this.busy = false; }
  private current(revision: number): boolean { return revision === this.revision && this.client === AppService.client; }
  private filter(save: boolean = true): void {
    this.genres = favoriteGenres(this.all, this.category);
    if (this.genre && !this.preview && !this.genres.includes(this.genre)) { this.genre = ''; }
    const filter: FavoriteFilter = { category: this.category, genre: this.genre, query: this.query, unwatched: this.unwatched, order: this.order };
    this.visibleItems = filterFavorites(this.all, filter);
    this.selected = this.selected.filter((id: string) => this.visibleItems.some((i: MediaItem) => i.Id === id));
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
    if (save) {
      try { AppService.experience?.update((next: ExperienceState) => {
        next.favoriteCategory = this.category; next.favoriteGenre = this.genre; next.favoriteQuery = this.query;
        next.favoriteUnwatched = this.unwatched; next.favoriteOrder = this.order;
      }); } catch (e) { this.message = errorText(e as Error); }
    }
  }
  private async refresh(): Promise<void> {
    const revision = ++this.revision; this.busy = true; this.message = ''; this.preview = true;
    this.all = AppService.snapshot.items.filter((i: MediaItem) => i.UserData?.IsFavorite === true); this.filter(false);
    if (AppService.experience?.snapshot().offline) { this.preview = false; this.busy = false; return; }
    try {
      const online = await AppService.allItems([{ key: 'IncludeItemTypes', value: 'Movie,Series,Episode' }, { key: 'Filters', value: 'IsFavorite' },
        { key: 'SortBy', value: 'SortName' }, { key: 'SortOrder', value: 'Ascending' }], (items: MediaItem[]) => {
          if (this.current(revision)) { this.all = applyPending(items, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []).filter((i: MediaItem) => i.UserData?.IsFavorite); this.filter(false); }
        });
      if (!this.current(revision)) { return; }
      this.all = applyPending(online, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []).filter((i: MediaItem) => i.UserData?.IsFavorite === true);
      const pending = AppService.snapshot.items.filter((i: MediaItem) => i.UserData?.IsFavorite &&
        AppService.experience?.snapshot().pending.some((p) => p.id === i.Id && p.field === 'favorite' && p.value));
      this.all = [...this.all, ...pending.filter((i: MediaItem) => !this.all.some((v: MediaItem) => v.Id === i.Id))];
      // Complete refresh reconciles favorites, while retaining cached catalog and offline edits.
      const ids = new Set(this.all.map((i: MediaItem) => i.Id));
      AppService.snapshot.items.forEach((i: MediaItem) => { if (i.UserData) { i.UserData.IsFavorite = ids.has(i.Id); } });
      this.all.forEach((i: MediaItem) => { if (!AppService.snapshot.items.some((v: MediaItem) => v.Id === i.Id)) { AppService.snapshot.items.push(i); } });
      AppService.local?.saveSnapshot(AppService.snapshot); this.preview = false; this.filter(false);
    } catch (e) {
      if (!this.current(revision)) { return; }
      if (!connectionFailure(e as Error)) { this.all = []; this.visibleItems = []; }
      this.message = errorText(e as Error);
    } finally { if (this.current(revision)) { this.busy = false; } }
  }
  private choose(item: MediaItem): void {
    if (!this.selection) { router.pushUrl({ url: 'pages/Detail', params: { item: item } }); return; }
    this.selected = this.selected.includes(item.Id) ? this.selected.filter((id: string) => id !== item.Id) : [...this.selected, item.Id];
  }
  private select(id: string, value: boolean): void {
    if (this.busy) { return; }
    if (value && !this.selected.includes(id)) { this.selected = [...this.selected, id]; }
    else if (!value && this.selected.includes(id)) { this.selected = this.selected.filter((selected: string) => selected !== id); }
  }
  private remove(): void {
    const chosen = this.all.filter((i: MediaItem) => this.selected.includes(i.Id)); const client = this.client;
    AlertDialog.show({ title: $r('app.string.batch_unfavorite'), message: text('batch_unfavorite_confirm', chosen.length),
      primaryButton: { value: text('cancel'), action: () => {} }, secondaryButton: { value: text('confirm'), action: () => {
        if (client === AppService.client && !this.busy) { this.batch(chosen, false); }
      } } });
  }
  private async batch(items: MediaItem[], restore: boolean): Promise<void> {
    const revision = this.revision; this.busy = true; this.message = ''; const success: MediaItem[] = []; let failed = 0; let failure = '';
    for (const item of items) {
      if (!this.current(revision)) { return; }
      try { await AppService.edit(item, true, restore); if (!this.current(revision)) { return; } success.push(item); }
      catch (e) { ++failed; if (!failure) { failure = errorText(e as Error); } }
    }
    if (!this.current(revision)) { return; }
    if (restore) {
      this.all = [...this.all, ...success.filter((i: MediaItem) => !this.all.some((v: MediaItem) => v.Id === i.Id))];
      this.undoItems = items.filter((i: MediaItem) => !success.some((v: MediaItem) => v.Id === i.Id));
    } else {
      this.all = this.all.filter((i: MediaItem) => !success.some((v: MediaItem) => v.Id === i.Id)); this.undoItems = success;
    }
    this.selected = []; this.selection = false; this.message = text('batch_result', success.length, failed) + (failure ? ` · ${failure}` : ''); this.busy = false; this.filter(false);
  }
  @Builder
  private filtersPanel() {
      Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.favorite_filters'), icon: $r('app.media.menu_settings') })
      Flex({ wrap: FlexWrap.Wrap }) {
        Select([{ value: text('all') }, { value: text('media_movie') }, { value: text('media_series') }, { value: text('media_episode') }])
          .selected(['', 'Movie', 'Series', 'Episode'].indexOf(this.category)).value(text(['all', 'media_movie', 'media_series', 'media_episode'][['', 'Movie', 'Series', 'Episode'].indexOf(this.category)])).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).width('100%').margin({ bottom: 8 }).onSelect((i: number) => { this.category = ['', 'Movie', 'Series', 'Episode'][i]; this.genre = ''; this.filter(); })
        Select([{ value: text('all_genres') }, ...this.genres.map((g: string): SelectOption => ({ value: g }))]).enabled(this.genres.length > 0)
          .selected(this.genres.indexOf(this.genre) + 1).value(this.genre || text('all_genres')).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).width('100%').margin({ bottom: 8 }).onSelect((i: number) => { this.genre = i ? this.genres[i - 1] : ''; this.filter(); })
      }.width('100%')
      Text($r('app.string.favorite_search')).fontSize(12).fontColor($r('app.color.brand_muted'))
      TextInput({ text: this.query, placeholder: text('favorite_search') }).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).onChange((v: string) => { this.query = v; this.filter(); })
      Flex({ wrap: FlexWrap.Wrap }) {
        Row({ space: 12 }) {
          Text($r('app.string.unwatched_only')).fontSize(14).fontColor('#F2F3FA').layoutWeight(1)
          Checkbox().select(this.unwatched).selectedColor($r('app.color.brand_action')).onChange((v: boolean) => { this.unwatched = v; this.filter(); })
        }.width('100%').margin({ bottom: 8 })
        Select([{ value: text('name_ascending') }, { value: text('name_descending') }, { value: text('continue_first') }])
          .selected(['name', 'nameDesc', 'continue'].indexOf(this.order)).value(text(['name_ascending', 'name_descending', 'continue_first'][['name', 'nameDesc', 'continue'].indexOf(this.order)])).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).width('100%').margin({ bottom: 8 }).onSelect((i: number) => { this.order = ['name', 'nameDesc', 'continue'][i]; this.filter(); })
      }
      Flex({ wrap: FlexWrap.Wrap }) {
        Text(this.preview ? $r('app.string.favorites_loaded', this.visibleItems.length, this.all.length) : $r('app.string.favorites_count', this.visibleItems.length, this.all.length)).fontColor($r('app.color.brand_muted')).width('100%')
        Column() { BrandButton({ label: $r('app.string.clear_filters'), icon: $r('app.media.menu_reset'), onSelect: () => { this.category = ''; this.genre = ''; this.query = ''; this.unwatched = false; this.order = 'name'; this.filter(); } }) }.width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8, right: '2%' })
        Column() {
          if (this.selection) { BrandButton({ label: $r('app.string.cancel'), icon: $r('app.media.menu_cancel'), available: !this.busy, onSelect: () => { this.selection = false; this.selected = []; } }) }
          else { BrandButton({ label: $r('app.string.select_items'), icon: $r('app.media.nav_check_active'), available: !this.busy, onSelect: () => { this.selection = true; this.selected = []; } }) }
        }.width(this.viewportWidth < 360 || this.fontScale > 1 ? '100%' : '48%').margin({ bottom: 8 })
      }.width('100%')
      if (this.selection) {
        BrandButton({ label: $r('app.string.select_all'), icon: $r('app.media.nav_check_active'), available: !this.busy, onSelect: () => { this.selected = this.visibleItems.map((i: MediaItem) => i.Id); } })
        Text($r('app.string.selected_count', this.selected.length)).fontSize(12).fontColor($r('app.color.brand_muted'))
        BrandButton({ label: $r('app.string.batch_unfavorite'), icon: $r('app.media.detail_remove'), available: this.selected.length > 0 && !this.busy, destructive: true, onSelect: () => this.remove() })
      }
      if (this.undoItems.length) { BrandButton({ label: $r('app.string.undo'), icon: $r('app.media.menu_back'), available: !this.busy, onSelect: () => this.batch(this.undoItems, true) }) }
      if (this.busy) { LoadingProgress().width(24).height(24) }
      if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(12) }
      if (!this.visibleItems.length && !this.busy) { Text(this.all.length ? $r('app.string.no_matches') : $r('app.string.no_favorites')).fontColor($r('app.color.brand_muted')) }
      }.padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder
  grid() {
    Grid(this.scroller) {
      if (!UiLayout.separateFilters(this.viewportHeight, this.landscape)) { GridItem() { this.filtersPanel() }.columnStart(0).columnEnd(UiLayout.columns(this.viewportWidth, this.fontScale).split(' ').length - 1) }

      ForEach(this.visibleItems, (item: MediaItem) => {
        GridItem() {
          Column() {
            if (this.selection) { Checkbox().select(this.selected.includes(item.Id)).enabled(!this.busy).onChange((value: boolean) => this.select(item.Id, value)) }
            MediaCard({ item: item, onSelect: (selected: MediaItem) => this.choose(selected) })
          }.gesture(LongPressGesture().onAction(() => { if (!this.busy) { this.selection = true; this.selected = [item.Id]; } }))
        }
      }, (item: MediaItem) => `${item.Id}|${JSON.stringify(item)}:${this.selection}`)
    }.columnsTemplate(UiLayout.columns(this.viewportWidth, this.fontScale)).columnsGap(12).rowsGap(16).layoutWeight(1).width('100%')
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column({ space: 10 }) {
      BrandHeader({ label: $r('app.string.favorites'), refreshable: true, available: !this.busy, onBack: () => router.back(), onRefresh: () => this.refresh() })
      if (UiLayout.separateFilters(this.viewportHeight, this.landscape)) {
        Scroll() { this.filtersPanel() }.width('100%').height(UiLayout.filters(this.viewportHeight, this.fontScale)).align(Alignment.TopStart)
      }
      this.grid()
    }.padding(16).width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
