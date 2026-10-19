import { MediaItem } from '../model/Models';
import { AppService } from './AppService';
import { JellyfinClient } from './JellyfinClient';
import { errorText } from '../utils/Strings';
import { applyPending, connectionFailure, authorizationFailure } from '../utils/Experience';
import { orderedChildren } from '../utils/DetailPresentation';
import { NetworkPolicy } from '../utils/NetworkOptions';

export interface DetailContent { item: MediaItem; children: MediaItem[]; nextUp?: MediaItem; offline: boolean; warning: string }
function cachedChildren(item: MediaItem): MediaItem[] {
  return orderedChildren(AppService.snapshot.items.filter((value: MediaItem) => item.Type === 'Series' ?
    value.Type === 'Season' && value.SeriesId === item.Id : item.Type === 'Season' ? value.Type === 'Episode' && value.SeasonId === item.Id : false));
}
function cachedDetail(id: string, warning: string): DetailContent | undefined {
  const cached = applyPending(AppService.snapshot.items, AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []).find((value: MediaItem) => value.Id === id);
  return cached ? { item: cached, children: cachedChildren(cached), offline: true, warning: warning } : undefined;
}
export async function loadDetail(client: JellyfinClient, id: string): Promise<DetailContent> {
  if (client !== AppService.client) { throw new Error('login_required'); }
  if (AppService.experience?.snapshot().offline) {
    const cached = cachedDetail(id, '');
    if (!cached) { throw new Error('offline_detail_missing'); }
    return cached;
  }
  let item: MediaItem;
  try {
    item = await client.detail(id);
    if (item.Id !== id) { throw new Error('api_response_invalid'); }
  } catch (e) {
    if (client !== AppService.client) { throw new Error('login_required'); }
    if (!NetworkPolicy.cacheAllowed(AppService.experience?.snapshot().offline ?? false) || !connectionFailure(e as Error)) { throw e as Error; }
    const cached = cachedDetail(id, errorText(e as Error));
    if (!cached) { throw e as Error; }
    return cached;
  }
  if (client !== AppService.client) { throw new Error('login_required'); }
  item = applyPending([item], AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? [])[0];
  const result: DetailContent = { item: item, children: [], offline: false, warning: '' };
  if (item.Type === 'Series' || item.Type === 'Season') {
    try {
      const children = await client.children(item);
      if (new Set(children.map((value: MediaItem) => value.Id)).size !== children.length) { throw new Error('episode_queue_failed'); }
      if (children.some((value: MediaItem) => item.Type === 'Series' ? value.Type !== 'Season' || value.SeriesId !== item.Id :
        value.Type !== 'Episode' || value.SeasonId !== item.Id || value.SeriesId !== item.SeriesId)) { throw new Error('episode_queue_failed'); }
      result.children = orderedChildren(children);
    }
    catch (e) { if (authorizationFailure(e as Error)) { throw e as Error; } result.warning = errorText(e as Error); if (client === AppService.client && NetworkPolicy.cacheAllowed()) { result.children = cachedChildren(item); } }
  }
  if (client !== AppService.client) { throw new Error('login_required'); }
  if (item.Type === 'Series') {
    try {
      const next = await client.nextUp(item.Id);
      if (next.some((value: MediaItem) => value.Type !== 'Episode' || value.SeriesId !== item.Id)) { throw new Error('episode_queue_failed'); }
      result.nextUp = next[0];
    } catch (e) { if (authorizationFailure(e as Error)) { throw e as Error; } result.warning = [result.warning, errorText(e as Error)].filter((value: string) => !!value).join(' · '); }
  }
  if (client !== AppService.client) { throw new Error('login_required'); }
  return result;
}
