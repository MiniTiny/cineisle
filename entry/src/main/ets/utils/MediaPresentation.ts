import { MediaItem } from '../model/Models';
export interface PosterTarget { id: string; tag: string; backdrop: boolean }

export function posterTarget(item: MediaItem, wide: boolean = false): PosterTarget {
  const seriesPoster = !wide && !!item.SeriesId && (item.Type === 'Episode' || (item.Type === 'Season' && !item.ImageTags?.Primary));
  return { id: seriesPoster ? item.SeriesId! : item.Id, tag: seriesPoster ? '' :
    (wide && item.Type === 'Movie' ? item.BackdropImageTags?.[0] ?? '' : item.ImageTags?.Primary ?? ''), backdrop: wide && item.Type === 'Movie' };
}

export function playbackPercent(item: MediaItem): number {
  const duration = item.RunTimeTicks ?? 0, position = item.UserData?.PlaybackPositionTicks ?? 0;
  return Number.isFinite(duration) && duration > 0 && Number.isFinite(position) ? Math.max(0, Math.min(100, position / duration * 100)) : 0;
}
