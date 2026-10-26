import { librarySortFields } from './Browse';
import { actorOrders, ActorOrderChoice, defaultActorOrder } from './ActorOrder';
import { DiscoveryRules } from './DiscoveryRules';
import { ActorProfileRules } from './ActorProfileRules';
import { MediaItem, Person, UserData } from '../model/Models';
import { PlayerOptions, validPlayerOptions } from './PlayerOptions';
export { connectionFailure, authorizationFailure } from './Failures';
import { SyncRetryPolicy } from './SyncPolicy';

export interface PendingEdit { id: string; field: string; value: boolean; revision: number; item?: MediaItem; localOnly?: boolean }
export interface PendingPosition { id: string; ticks: number; revision: number; item: MediaItem }
export interface Follow { id: string; acknowledged: string[] }
export class ExperienceState {
  playerUi?: PlayerOptions;
  syncAttempts?: number;
  syncNextAt?: number;
  syncBlocked?: boolean;
  downloadMobile?: boolean = false;
  downloadRoaming?: boolean = false;
  librarySort?: string = 'SortName';
  libraryDescending?: boolean = false;
  autoNextMode?: string = 'server';
  serverAutoNext?: boolean;
  version: number = 1;
  searches: string[] = [];
  tab: number = 1;
  offline: boolean = false;
  actorOrder: string = defaultActorOrder;
  showTags: boolean = true;
  followedOnly: boolean = false;
  follows: Follow[] = [];
  pending: PendingEdit[] = [];
  positions: PendingPosition[] = [];
  sourcePreference: string = '';
  rememberDownloadSource: boolean = true;
  favoriteCategory: string = '';
  favoriteGenre: string = '';
  favoriteQuery: string = '';
  favoriteUnwatched: boolean = false;
  favoriteOrder: string = 'name';
}
export interface ActorTag { key: string; title: string; theme: boolean; works: MediaItem[] }
export interface ActorProfile {
  person: Person; works: MediaItem[]; watched: number; unplayed: number; favorite: number;
  playCount: number; lastViewed: number; tags: ActorTag[]; followed: boolean; newCount: number;
}
export interface FavoriteFilter { category: string; genre: string; query: string; unwatched: boolean; order: string }
export interface Discovery { item: MediaItem; actors: string[]; genres: string[]; score: number }

const aliases: Map<string, string> = new Map([
  ['crime', 'crime'], ['犯罪', 'crime'], ['mystery', 'mystery'], ['悬疑', 'mystery'],
  ['thriller', 'thriller'], ['惊悚', 'thriller'], ['comedy', 'comedy'], ['喜剧', 'comedy'],
  ['action', 'action'], ['动作', 'action'], ['romance', 'romance'], ['爱情', 'romance'],
  ['science fiction', 'scifi'], ['sci-fi', 'scifi'], ['科幻', 'scifi'], ['fantasy', 'fantasy'], ['奇幻', 'fantasy'],
  ['family', 'family'], ['家庭', 'family'], ['horror', 'horror'], ['恐怖', 'horror']
]);
export function genreKey(value: string): string { const key = value.trim().toLowerCase(); return aliases.get(key) ?? key; }
interface ThemeRule { key: string; expression: RegExp }
const themes: ThemeRule[] = [
  { key: 'investigation', expression: /侦探|探案|刑侦|破案|\bdetective\b|\binvestigation\b/i },
  { key: 'revenge', expression: /复仇|报仇|\brevenge\b/i },
  { key: 'time_travel', expression: /时间旅行|时空穿越|\btime travel\b/i },
  { key: 'growth', expression: /成长|青春|\bcoming.of.age\b/i }
];
export function uniqueWorks(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return items.filter((item: MediaItem) => { if (seen.has(item.Id)) { return false; } seen.add(item.Id); return true; });
}
export function applyPending(items: MediaItem[], pending: PendingEdit[], positions: PendingPosition[] = []): MediaItem[] {
  const edits = new Map<string, PendingEdit[]>();
  pending.forEach((edit: PendingEdit) => { const values = edits.get(edit.id) ?? []; values.push(edit); edits.set(edit.id, values); });
  return items.map((item: MediaItem) => {
    const position = positions.find((p: PendingPosition) => p.id === item.Id);
    if (!edits.has(item.Id) && !position) { return item; }
    const copy = JSON.parse(JSON.stringify(item)) as MediaItem; copy.UserData = copy.UserData ?? {};
    if (position) { copy.UserData.PlaybackPositionTicks = position.ticks; copy.UserData.LastPlayedDate = position.item.UserData?.LastPlayedDate; }
    (edits.get(item.Id) ?? []).forEach((edit: PendingEdit) => {
      if (edit.field === 'favorite') { copy.UserData!.IsFavorite = edit.value; } else { copy.UserData!.Played = edit.value; }
    });
    return copy;
  });
}
export function actorProfiles(items: MediaItem[], follows: Follow[] = []): ActorProfile[] {
  const actors = new Map<string, ActorProfile>();
  uniqueWorks(items).filter((item: MediaItem) => ['Movie', 'Series'].includes(item.Type)).forEach((work: MediaItem) => {
    const seen = new Set<string>();
    (work.People ?? []).filter((p: Person) => p.Type === 'Actor').forEach((p: Person) => {
      if (seen.has(p.Id)) { return; } seen.add(p.Id);
      let actor = actors.get(p.Id);
      if (!actor) { actor = { person: p, works: [], watched: 0, unplayed: 0, favorite: 0, playCount: 0, lastViewed: 0, tags: [], followed: false, newCount: 0 }; actors.set(p.Id, actor); }
      actor.works.push(work);
    });
  });
  actors.forEach((actor: ActorProfile) => {
    actor.watched = actor.works.filter((work: MediaItem) => work.UserData?.Played === true).length;
    actor.unplayed = actor.works.length - actor.watched;
    actor.favorite = actor.works.filter((work: MediaItem) => work.UserData?.IsFavorite === true).length;
    actor.playCount = actor.works.reduce((sum: number, work: MediaItem) => sum + Math.max(0, work.UserData?.PlayCount ?? 0), 0);
    actor.lastViewed = actor.works.reduce((last: number, work: MediaItem) => Math.max(last, Date.parse(work.UserData?.LastPlayedDate ?? '') || 0), 0);
    const supporting = new Map<string, ActorTag>();
    actor.works.forEach((work: MediaItem) => {
      const keys = new Set<string>();
      const add = (key: string, title: string, theme: boolean): void => {
        if (keys.has(key)) { return; } keys.add(key);
        const tag = supporting.get(key) ?? { key: key, title: title, theme: theme, works: [] };
        tag.works.push(work); supporting.set(key, tag);
      };
      (work.Genres ?? []).forEach((genre: string) => {
        const key = genreKey(genre); if (key && key !== 'drama' && key !== '剧情') { add('genre:' + key, genre.trim(), false); }
      });
      themes.forEach((rule: ThemeRule) => { if (rule.expression.test(work.Overview ?? '')) { add('theme:' + rule.key, rule.key, true); } });
    });
    const minimum = ActorProfileRules.minimumSupport(actor.works.length);
    actor.tags = Array.from(supporting.values()).filter((tag: ActorTag) => tag.works.length >= minimum)
      .sort((a: ActorTag, b: ActorTag) => b.works.length - a.works.length || a.key.localeCompare(b.key)).slice(0, ActorProfileRules.maximumTags);
    const follow = follows.find((f: Follow) => f.id === actor.person.Id); actor.followed = !!follow;
    actor.newCount = follow ? actor.works.filter((w: MediaItem) => !follow.acknowledged.includes(w.Id)).length : 0;
  });
  return Array.from(actors.values());
}
export function sortActors(actors: ActorProfile[], order: string, query: string, tag: string, followed: boolean): ActorProfile[] {
  const score = (actor: ActorProfile): number => {
    switch (order) {
      case 'watched': return actor.watched;
      case 'unplayed': return actor.unplayed;
      case 'works': return actor.works.length;
      case 'recent': return actor.lastViewed;
      case 'recommended': return ActorProfileRules.recommendationScore(actor.favorite, actor.watched, actor.unplayed);
      default: return actor.playCount;
    }
  };
  return actors.filter((a: ActorProfile) => (!followed || a.followed) && a.person.Name.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!tag || a.tags.some((t: ActorTag) => t.key === tag)))
    .sort((a: ActorProfile, b: ActorProfile) => (order === 'name' ? 0 : score(b) - score(a)) ||
      (order === 'recommended' ? b.unplayed - a.unplayed : 0) || a.person.Name.toLowerCase().localeCompare(b.person.Name.toLowerCase()) || a.person.Id.localeCompare(b.person.Id));
}
export function favoriteGenres(items: MediaItem[], category: string): string[] {
  const genres = new Map<string, string>();
  items.filter((i: MediaItem) => (!category || i.Type === category) && i.Type !== 'Episode').forEach((i: MediaItem) => {
    (i.Genres ?? []).forEach((g: string) => { if (g.trim()) { genres.set(g.trim().toLowerCase(), g.trim()); } });
  });
  return Array.from(genres.values()).sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase()));
}
export function filterFavorites(items: MediaItem[], filter: FavoriteFilter): MediaItem[] {
  const result = uniqueWorks(items).filter((i: MediaItem) => (!filter.category || i.Type === filter.category) &&
    (!filter.unwatched || i.UserData?.Played !== true) && (!filter.genre || (i.Type !== 'Episode' && (i.Genres ?? []).some((g: string) => g.trim().toLowerCase() === filter.genre.toLowerCase()))) &&
    [i.Name, i.OriginalTitle ?? '', i.SeriesName ?? ''].join('\n').toLowerCase().includes(filter.query.trim().toLowerCase()));
  const name = (a: MediaItem, b: MediaItem): number => a.Name.toLowerCase().localeCompare(b.Name.toLowerCase()) || a.Id.localeCompare(b.Id);
  return result.sort((a: MediaItem, b: MediaItem) => {
    if (filter.order === 'continue') {
      const continuing = (i: MediaItem): number => i.UserData?.Played ? 0 : (i.UserData?.PlaybackPositionTicks ?? 0) > 0 ? 2 : 1;
      return continuing(b) - continuing(a) || name(a, b);
    }
    return filter.order === 'nameDesc' ? -name(a, b) : name(a, b);
  });
}
export function discovery(items: MediaItem[], signals: MediaItem[], follows: Follow[]): Discovery[] {
  const followed = new Set(follows.map((f: Follow) => f.id));
  const genres = new Set(signals.filter((i: MediaItem) => i.UserData?.IsFavorite).flatMap((i: MediaItem) => (i.Genres ?? []).map(genreKey)));
  return uniqueWorks(items).filter((i: MediaItem) => i.UserData?.Played !== true && ['Movie', 'Series'].includes(i.Type)).map((i: MediaItem): Discovery => {
    const people = (i.People ?? []).filter((p: Person) => p.Type === 'Actor' && followed.has(p.Id));
    const matching = Array.from(new Set((i.Genres ?? []).filter((g: string) => genres.has(genreKey(g)))));
    const names = Array.from(new Set(people.map((p: Person) => p.Name)));
    return { item: i, actors: names, genres: matching, score: DiscoveryRules.score(names.length, matching.length) };
  }).sort((a: Discovery, b: Discovery) => b.score - a.score || (Date.parse(b.item.DateCreated ?? '') || 0) - (Date.parse(a.item.DateCreated ?? '') || 0) || a.item.Id.localeCompare(b.item.Id)).slice(0, DiscoveryRules.maximumResults);
}
export function validExperience(value: ExperienceState): boolean {
  if (value?.playerUi !== undefined && !validPlayerOptions(value.playerUi)) { return false; }
  if ((value?.syncAttempts !== undefined && (!Number.isSafeInteger(value.syncAttempts) || value.syncAttempts < 0 || value.syncAttempts > SyncRetryPolicy.maxAttempts)) ||
    (value?.syncNextAt !== undefined && (!Number.isSafeInteger(value.syncNextAt) || value.syncNextAt < 0)) ||
    (value?.syncBlocked !== undefined && typeof value.syncBlocked !== 'boolean')) { return false; }
  if ((value?.downloadMobile !== undefined && typeof value.downloadMobile !== 'boolean') ||
    (value?.downloadRoaming !== undefined && typeof value.downloadRoaming !== 'boolean')) { return false; }
  return !!value && value.version === 1 && Array.isArray(value.searches) && value.searches.length <= 20 && value.searches.every((s: string) => typeof s === 'string') &&
    (value.librarySort === undefined || librarySortFields.includes(value.librarySort)) &&
    (value.libraryDescending === undefined || typeof value.libraryDescending === 'boolean') &&
    (value.autoNextMode === undefined || ['server', 'on', 'off'].includes(value.autoNextMode)) &&
    (value.serverAutoNext === undefined || typeof value.serverAutoNext === 'boolean') &&
    [0, 1, 3, 4].includes(value.tab) && actorOrders.some((choice: ActorOrderChoice) => choice.value === value.actorOrder) &&
    typeof value.offline === 'boolean' && typeof value.showTags === 'boolean' && typeof value.followedOnly === 'boolean' && typeof value.sourcePreference === 'string' && typeof value.rememberDownloadSource === 'boolean' &&
    typeof value.favoriteQuery === 'string' && typeof value.favoriteGenre === 'string' && typeof value.favoriteUnwatched === 'boolean' && ['', 'Movie', 'Series', 'Episode'].includes(value.favoriteCategory) && ['name', 'nameDesc', 'continue'].includes(value.favoriteOrder) &&
    Array.isArray(value.follows) && value.follows.every((f: Follow) => !!f && typeof f.id === 'string' && Array.isArray(f.acknowledged) && f.acknowledged.every((id: string) => typeof id === 'string')) &&
    Array.isArray(value.positions) && value.positions.every((p: PendingPosition) => !!p && typeof p.id === 'string' && Number.isSafeInteger(p.ticks) && p.ticks >= 0 && Number.isSafeInteger(p.revision) && !!p.item && p.item.Id === p.id) &&
    Array.isArray(value.pending) && value.pending.every((e: PendingEdit) => !!e && typeof e.id === 'string' && ['favorite', 'played'].includes(e.field) && typeof e.value === 'boolean' && (e.localOnly === undefined || typeof e.localOnly === 'boolean') && Number.isSafeInteger(e.revision) && (e.item === undefined || (!!e.item && e.item.Id === e.id && typeof e.item.Name === 'string' && typeof e.item.Type === 'string')));
}
