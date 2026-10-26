import { UiPalette } from '../utils/UiPalette';
import { BrandState } from '../components/BrandState';
import { BrandHeader } from '../components/BrandHeader';
import { BrandHeading } from '../components/BrandHeading';
import { BrandButton } from '../components/BrandButton';
import { BrandChoice } from '../components/BrandChoice';
import { UiLayout } from '../utils/UiLayout';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { MediaItem, Person } from '../model/Models';
import { ActorProfile, ActorTag, ExperienceState, actorProfiles, applyPending, authorizationFailure } from '../utils/Experience';
import { AppService } from '../service/AppService';
import { JellyfinClient } from '../service/JellyfinClient';
import { errorText, text } from '../utils/Strings';
import { NetworkPolicy } from '../utils/NetworkOptions';
import { MediaCard } from '../components/MediaCard';

interface ActorRoute { personId: string; personName: string }
@Entry
@Component
struct Actor {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleLandscape') landscape: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State person: Person = { Id: '', Name: '' };
  @State overview: string = '';
  @State works: MediaItem[] = [];
  @State followed: boolean = false;
  @State profile: ActorProfile | undefined = undefined;
  @State unwatched: boolean = false;
  @State tag: string = '';
  @State busy: boolean = false;
  @State biographyLoading: boolean = false;
  @State message: string = '';
  private revision: number = 0;
  private client: JellyfinClient | undefined = undefined;
  aboutToAppear(): void {
    const route = router.getParams() as ActorRoute; if (!route?.personId) { router.back(); return; }
    this.person = { Id: route.personId, Name: route.personName ?? '' }; this.client = AppService.client; this.refresh();
  }
  onPageShow(): void { if (this.client && this.client !== AppService.client) { this.clear(); router.back(); return; } if (!this.busy) { this.works = applyPending(this.works.map((i: MediaItem) => NetworkPolicy.cacheAllowed(AppService.experience?.snapshot().offline ?? false) ? AppService.snapshot.items.find((v: MediaItem) => v.Id === i.Id) ?? i : i), AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []); this.describe(); } }
  onPageHide(): void { ++this.revision; this.busy = false; this.biographyLoading = false; }
  private clear(): void { ++this.revision; this.works = []; this.profile = undefined; this.overview = ''; this.biographyLoading = false; this.busy = false; }
  private current(revision: number): boolean { return revision === this.revision && this.client === AppService.client; }
  private describe(): void { this.followed = AppService.experience?.snapshot().follows.some((f) => f.id === this.person.Id) ?? false; this.profile = actorProfiles(this.works, AppService.experience?.snapshot().follows ?? []).find((a: ActorProfile) => a.person.Id === this.person.Id); }
  private async refresh(): Promise<void> {
    const revision = ++this.revision; const client = AppService.requireClient(); this.busy = true; this.biographyLoading = true; this.message = '';
    this.works = NetworkPolicy.cacheAllowed(AppService.experience?.snapshot().offline ?? false) ? applyPending(AppService.snapshot.items, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? [])
      .filter((i: MediaItem) => ['Movie', 'Series'].includes(i.Type) && (i.People ?? []).some((p: Person) => p.Id === this.person.Id)) : []; this.describe();
    if (AppService.experience?.snapshot().offline) { this.busy = false; this.biographyLoading = false; return; }
    const biography = async (): Promise<void> => {
      try { const item = await client.detail(this.person.Id); if (this.current(revision)) { this.person = { Id: item.Id, Name: item.Name }; this.overview = item.Overview ?? ''; } }
      catch (e) { if (this.current(revision)) { if (authorizationFailure(e as Error)) { this.clear(); } this.message = errorText(e as Error); } }
      finally { if (this.current(revision)) { this.biographyLoading = false; } }
    };
    const credits = async (): Promise<void> => {
      try {
        if (!this.works.length) {
          const works = await AppService.allItems([{ key: 'PersonIds', value: this.person.Id }, { key: 'IncludeItemTypes', value: 'Movie,Series' }]);
          if (!this.current(revision)) { return; }
          this.works = applyPending(works, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []); this.describe();
        }
        if (this.current(revision)) {
          AppService.experience?.update((next: ExperienceState) => {
            const follow = next.follows.find((f) => f.id === this.person.Id); if (follow) { follow.acknowledged = this.works.map((i: MediaItem) => i.Id); }
          }); this.describe();
        }
      } catch (e) { if (this.current(revision)) { if (authorizationFailure(e as Error)) { this.clear(); } this.message = errorText(e as Error); } }
      finally { if (this.current(revision)) { this.busy = false; } }
    };
    await Promise.all([biography(), credits()]);
  }
  private follow(): void {
    try {
      AppService.experience?.update((next: ExperienceState) => {
        if (next.follows.some((f) => f.id === this.person.Id)) { next.follows = next.follows.filter((f) => f.id !== this.person.Id); }
        else { next.follows.push({ id: this.person.Id, acknowledged: this.works.map((i: MediaItem) => i.Id) }); }
      }); this.describe();
    } catch (e) { this.message = errorText(e as Error); }
  }
  private shown(): MediaItem[] {
    const ids = this.tag ? new Set(this.profile?.tags.find((t: ActorTag) => t.key === this.tag)?.works.map((i: MediaItem) => i.Id) ?? []) : undefined;
    return this.works.filter((i: MediaItem) => (!this.unwatched || !i.UserData?.Played) && (!ids || ids.has(i.Id)))
      .sort((a: MediaItem, b: MediaItem) => Number(!!a.UserData?.Played) - Number(!!b.UserData?.Played) || (b.UserData?.PlaybackPositionTicks ?? 0) - (a.UserData?.PlaybackPositionTicks ?? 0) || a.Id.localeCompare(b.Id));
  }
  private currentTagLabel(): string { const tag = this.profile?.tags.find((t: ActorTag) => t.key === this.tag); return tag ? this.tagName(tag) : text('all_tags'); }
  private tagName(tag: ActorTag): string { return tag.theme ? text('theme_' + tag.title) : tag.title; }
  private role(item: MediaItem): string {
    const roles = (item.People ?? []).filter((p: Person) => p.Id === this.person.Id && p.Role).map((p: Person) => p.Role ?? '');
    return Array.from(new Set(roles)).join('、');
  }
  @Builder
  private filtersPanel() {
      Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.actor_profile'), icon: $r('app.media.nav_user_active') })
      BrandButton({ label: this.followed ? $r('app.string.unfollow') : $r('app.string.follow'), icon: this.followed ? $r('app.media.detail_heart_filled') : $r('app.media.detail_heart'), primary: this.followed, onSelect: () => this.follow() })
      if (this.biographyLoading) { BrandState({ label: $r('app.string.biography_loading'), loading: true }) }
      if (this.overview) { Text(this.overview).fontColor(this.palette.foreground).fontSize(14).width('100%') }
      BrandHeading({ label: $r('app.string.actor_credits'), icon: $r('app.media.nav_library_active') })
      Row({ space: 8 }) {
        Checkbox().select(this.unwatched).selectedColor(this.palette.action).onChange((v: boolean) => { this.unwatched = v; })
        Text($r('app.string.unwatched_only')).fontColor(this.palette.foreground).layoutWeight(1)
      }.width('100%')
      BrandChoice({ label: $r('app.string.actor_tags'), icon: $r('app.media.nav_star_active'),
        choices: [{ value: text('all_tags') }, ...(this.profile?.tags ?? []).map((t: ActorTag): SelectOption => ({ value: this.tagName(t) }))],
        selected: (this.profile?.tags ?? []).findIndex((t: ActorTag) => t.key === this.tag) + 1,
        onSelect: (i: number) => { this.tag = i ? this.profile!.tags[i - 1].key : ''; } })
      if (this.tag) {
        Text($r('app.string.tag_evidence', this.profile?.tags.find((t: ActorTag) => t.key === this.tag)?.works.length ?? 0)).fontColor(this.palette.muted).fontSize(12)
      }
      Text($r('app.string.actor_tag_boundary')).fontColor(this.palette.muted).fontSize(11)
      if (this.message) { Text(this.message).fontColor(this.palette.danger).fontSize(12) }
      if (this.busy && !this.biographyLoading) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      }.width('100%').alignItems(HorizontalAlign.Start).padding(16).borderRadius(20).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised))
  }
  @Builder
  credits() {
    List({ space: 14 }) {
      ListItem() { this.filtersPanel() }

      if (!this.busy && !this.shown().length) { ListItem() { BrandState({ label: $r('app.string.no_items'), icon: $r('app.media.nav_library_active') }) } }
      ForEach(this.shown(), (item: MediaItem) => {
        ListItem() {
          Column({ space: 8 }) {
            MediaCard({ item: item, wide: true, onSelect: (selected: MediaItem) => router.pushUrl({ url: 'pages/Detail', params: { item: selected } }) })
            if (this.role(item)) { Text($r('app.string.credit_role', this.role(item))).fontColor(this.palette.muted).fontSize(13) }
          }
        }
      }, (item: MediaItem) => `${item.Id}|${JSON.stringify(item)}`)
    }.layoutWeight(1).width('100%')
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column({ space: 10 }) {
      BrandHeader({ label: this.person.Name, onBack: () => router.back() })
      this.credits()
    }.padding(16).width('100%').height('100%').backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.background))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
