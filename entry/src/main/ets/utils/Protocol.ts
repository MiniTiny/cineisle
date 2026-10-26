import { ActorSummary, MediaItem, QueryParam } from '../model/Models';
import { RewatchRules } from './RewatchRules';

export function normalizeServer(input: string): string {
  const value = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/?#@]+(?:\/[^\s?#]*)?$/i.test(value)) {
    throw new Error('invalid_server');
  }
  return value;
}

export function queryString(params: QueryParam[]): string {
  return params.map((p: QueryParam) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
}

export function secondsToTicks(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 10000000) : 0;
}

export function accountKey(serverId: string, userId: string): string {
  // Jellyfin IDs are UUIDs. Reject unexpected path characters rather than silently sharing a cache.
  if (!/^[a-zA-Z0-9-]+$/.test(serverId) || !/^[a-zA-Z0-9-]+$/.test(userId)) {
    throw new Error('invalid_account');
  }
  return `${serverId}_${userId}`;
}

export function safeItemId(id: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) { throw new Error('invalid_item'); }
  return id;
}

export function uniqueItems(items: MediaItem[]): MediaItem[] {
  const ids = new Set<string>();
  return items.filter((item: MediaItem) => {
    if (ids.has(item.Id)) { return false; }
    ids.add(item.Id);
    return true;
  });
}

export function playedRecommendations(groups: MediaItem[], fallback: MediaItem[]): MediaItem[] {
  return RewatchRules.select(groups, fallback);
}

export function rankActors(items: MediaItem[]): ActorSummary[] {
  const actors = new Map<string, ActorSummary>();
  uniqueItems(items).filter((item: MediaItem) => item.Type === 'Movie' || item.Type === 'Series')
    .forEach((item: MediaItem) => {
      const seen = new Set<string>();
      (item.People ?? []).filter((person) => person.Type === 'Actor').forEach((person) => {
        if (seen.has(person.Id)) { return; }
        seen.add(person.Id);
        let actor = actors.get(person.Id);
        if (!actor) { actor = new ActorSummary(); actor.person = person; actors.set(person.Id, actor); }
        actor.playCount += item.UserData?.PlayCount ?? 0;
        actor.itemCount++;
      });
    });
  return Array.from(actors.values()).sort((a: ActorSummary, b: ActorSummary) =>
    b.playCount - a.playCount || a.person.Name.localeCompare(b.person.Name));
}
