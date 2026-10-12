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
  grid() {
    Grid(this.scroller) {
      ForEach(this.visibleItems, (item: MediaItem) => {
        GridItem() {
          Column() {
            if (this.selection) { Checkbox().select(this.selected.includes(item.Id)).enabled(!this.busy).onChange((value: boolean) => this.select(item.Id, value)) }
            MediaCard({ item: item, onSelect: (selected: MediaItem) => this.choose(selected) })
          }.gesture(LongPressGesture().onAction(() => { if (!this.busy) { this.selection = true; this.selected = [item.Id]; } }))
        }
      }, (item: MediaItem) => `${item.Id}|${JSON.stringify(item)}:${this.selection}`)
    }.columnsTemplate('1fr 1fr 1fr').columnsGap(12).rowsGap(16).layoutWeight(1).width('100%')
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column({ space: 10 }) {
      Row({ space: 8 }) {
        Button($r('app.string.back')).backgroundColor($r('app.color.brand_surface')).onClick(() => router.back())
        Text($r('app.string.favorites')).fontColor('#F2F3FA').fontSize(22).layoutWeight(1)
        Button($r('app.string.refresh')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => this.refresh())
      }
      Row() {
        Select([{ value: text('all') }, { value: text('media_movie') }, { value: text('media_series') }, { value: text('media_episode') }])
          .selected(['', 'Movie', 'Series', 'Episode'].indexOf(this.category)).value(text(['all', 'media_movie', 'media_series', 'media_episode'][['', 'Movie', 'Series', 'Episode'].indexOf(this.category)])).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onSelect((i: number) => { this.category = ['', 'Movie', 'Series', 'Episode'][i]; this.genre = ''; this.filter(); })
        Select([{ value: text('all_genres') }, ...this.genres.map((g: string): SelectOption => ({ value: g }))]).enabled(this.genres.length > 0)
          .selected(this.genres.indexOf(this.genre) + 1).value(this.genre || text('all_genres')).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onSelect((i: number) => { this.genre = i ? this.genres[i - 1] : ''; this.filter(); })
      }.width('100%')
      TextInput({ text: this.query, placeholder: text('favorite_search') }).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).onChange((v: string) => { this.query = v; this.filter(); })
      Row({ space: 8 }) {
        Checkbox().select(this.unwatched).onChange((v: boolean) => { this.unwatched = v; this.filter(); })
        Text($r('app.string.unwatched_only')).fontColor('#F2F3FA')
        Select([{ value: text('name_ascending') }, { value: text('name_descending') }, { value: text('continue_first') }])
          .selected(['name', 'nameDesc', 'continue'].indexOf(this.order)).value(text(['name_ascending', 'name_descending', 'continue_first'][['name', 'nameDesc', 'continue'].indexOf(this.order)])).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onSelect((i: number) => { this.order = ['name', 'nameDesc', 'continue'][i]; this.filter(); })
      }
      Row({ space: 8 }) {
        Text(this.preview ? $r('app.string.favorites_loaded', this.visibleItems.length, this.all.length) : $r('app.string.favorites_count', this.visibleItems.length, this.all.length)).fontColor($r('app.color.brand_muted')).layoutWeight(1)
        Button($r('app.string.clear_filters')).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.category = ''; this.genre = ''; this.query = ''; this.unwatched = false; this.order = 'name'; this.filter(); })
        Button(this.selection ? $r('app.string.cancel') : $r('app.string.select_items')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => { this.selection = !this.selection; this.selected = []; })
      }
      if (this.selection) {
        Row({ space: 8 }) {
          Button($r('app.string.select_all')).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.selected = this.visibleItems.map((i: MediaItem) => i.Id); })
          Button($r('app.string.batch_unfavorite')).backgroundColor($r('app.color.brand_action')).enabled(this.selected.length > 0 && !this.busy).onClick(() => this.remove())
        }
      }
      if (this.undoItems.length) { Button($r('app.string.undo')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => this.batch(this.undoItems, true)) }
      if (this.busy) { LoadingProgress().width(24).height(24) }
      if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(12) }
      if (!this.visibleItems.length && !this.busy) { Text(this.all.length ? $r('app.string.no_matches') : $r('app.string.no_favorites')).fontColor($r('app.color.brand_muted')) }
      this.grid()
    }.padding(16).width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%')
  }
}
