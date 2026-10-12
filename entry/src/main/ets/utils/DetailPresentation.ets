import { MediaItem, MediaLink, MediaSource, MediaStream, Person } from '../model/Models';
import { text } from './Strings';

export interface DetailRow { key: string; label: string; value: string }
export interface DetailMetadata { original: string; summary: string; chips: string[]; rows: DetailRow[]; actors: Person[] }

function year(value: string | undefined): string {
  return value && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) ? value.slice(0, 4) : '';
}
export function dateRange(item: MediaItem): string {
  const start = Number.isSafeInteger(item.ProductionYear) && item.ProductionYear! > 0 ? item.ProductionYear!.toString() : year(item.PremiereDate);
  if (item.Status === 'Continuing') { return start ? start + ' – ' + text('present_year') : text('present_year'); }
  const end = item.Status === 'Ended' ? year(item.EndDate) : '';
  return start && end && end !== start ? start + ' – ' + end : start || end;
}
function codec(stream: MediaStream): string { return stream.Codec?.trim().toUpperCase() ?? ''; }
function channels(stream: MediaStream): string {
  if (stream.ChannelLayout?.trim()) { return stream.ChannelLayout.trim(); }
  return stream.Channels && Number.isSafeInteger(stream.Channels) && stream.Channels > 0 ? text('channel_count', stream.Channels) : '';
}
function profile(stream: MediaStream): string {
  const range = stream.VideoRangeType ?? stream.VideoRange ?? '';
  if (stream.VideoDoViTitle || (stream.DvProfile ?? 0) > 0 || /^DOVI/.test(range)) { return 'Dolby Vision'; }
  return ['HDR', 'HDR10', 'HDR10Plus', 'HLG'].includes(range) ? range === 'HDR10Plus' ? 'HDR10+' : range : '';
}
function size(bytes: number | undefined): string {
  if (!Number.isSafeInteger(bytes) || bytes! <= 0) { return ''; }
  if (bytes! >= 1073741824) { return (bytes! / 1073741824).toFixed(2) + ' GiB'; }
  if (bytes! >= 1048576) { return (bytes! / 1048576).toFixed(1) + ' MiB'; }
  return bytes!.toString() + ' B';
}
function description(stream: MediaStream): string {
  return stream.DisplayTitle?.trim() || [codec(stream), stream.Language?.trim(), stream.Type === 'Audio' ? channels(stream) : ''].filter((value: string | undefined) => !!value).join(' · ');
}
export function detailMetadata(item: MediaItem, sourceId: string = ''): DetailMetadata {
  const source: MediaSource | undefined = sourceId ? item.MediaSources?.find((value: MediaSource) => value.Id === sourceId) : item.MediaSources?.[0];
  const streams = source?.MediaStreams ?? (sourceId ? [] : item.MediaStreams ?? []);
  const video = streams.find((value: MediaStream) => value.Type === 'Video');
  const audio = streams.filter((value: MediaStream) => value.Type === 'Audio');
  const subtitles = streams.filter((value: MediaStream) => value.Type === 'Subtitle');
  const chips: string[] = [];
  if (video) {
    if ((video.Width ?? 0) > 0 && (video.Height ?? 0) > 0) {
      chips.push(video.Width! >= 7680 || video.Height! >= 4320 ? '8K' : video.Width! >= 3840 || video.Height! >= 2160 ? '4K' : `${video.Width}×${video.Height}`);
    }
    if (codec(video)) { chips.push(codec(video)); }
    if (profile(video)) { chips.push(profile(video)); }
  }
  if (audio[0]) {
    if (codec(audio[0])) { chips.push(codec(audio[0])); }
    if (channels(audio[0])) { chips.push(channels(audio[0])); }
    if (audio[0].AudioSpatialFormat === 'DolbyAtmos' || /atmos/i.test(audio[0].DisplayTitle ?? '')) { chips.push('Atmos'); }
    else if (audio[0].AudioSpatialFormat === 'DTSX') { chips.push('DTS:X'); }
  }
  if (subtitles.length) { chips.push(text('subtitle_chip')); }
  const rows: DetailRow[] = [];
  const add = (key: string, value: string): void => { if (value) { rows.push({ key: key, label: text('detail_' + key), value: value }); } };
  add('size', size(source?.Size));
  add('video', video ? [description(video), video.Width && video.Height ? `${video.Width}×${video.Height}` : '', profile(video),
    video.BitDepth ? text('bit_depth', video.BitDepth) : ''].filter((value: string) => !!value).join(' · ') : '');
  add('audio', audio.map(description).filter((value: string) => !!value).join('\n'));
  add('subtitles', subtitles.map(description).filter((value: string) => !!value).join('\n'));
  add('genres', (item.Genres ?? []).filter((value: string) => !!value.trim()).join('、'));
  const people = item.People ?? [];
  add('directors', people.filter((person: Person) => person.Type === 'Director').map((person: Person) => person.Name).join('、'));
  add('writers', people.filter((person: Person) => person.Type === 'Writer').map((person: Person) => person.Name).join('、'));
  const minutes = Number.isFinite(item.RunTimeTicks) && item.RunTimeTicks! > 0 ? text('runtime_minutes', Math.floor(item.RunTimeTicks! / 600000000)) : '';
  const rating = Number.isFinite(item.CommunityRating) ? text('community_score', item.CommunityRating!.toFixed(1)) : '';
  return { original: item.OriginalTitle?.trim() && item.OriginalTitle !== item.Name ? item.OriginalTitle : '',
    summary: [dateRange(item), minutes, item.OfficialRating?.trim(), rating].filter((value: string | undefined) => !!value).join(' · '),
    chips: Array.from(new Set(chips)), rows: rows, actors: people.filter((person: Person) => person.Type === 'Actor') };
}

export function trailerUrl(item: MediaItem): string {
  // External navigation accepts web URLs only. Never forward embedded credentials or API tokens.
  return item.RemoteTrailers?.map((value: MediaLink) => value.Url ?? '').find((value: string) => /^https?:\/\/[^\s/?#@]+(?:[/?#]|$)/i.test(value) &&
    !/[\s\u0000-\u001f]/.test(value) && !/[?&](api_key|access_token|token)=/i.test(value)) ?? '';
}
export function orderedChildren(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a: MediaItem, b: MediaItem) => (a.IndexNumber ?? Number.MAX_SAFE_INTEGER) - (b.IndexNumber ?? Number.MAX_SAFE_INTEGER) || a.Name.localeCompare(b.Name));
}
export function firstEpisode(items: MediaItem[], seriesId: string, seasonId: string = ''): MediaItem | undefined {
  const episodes = items.filter((item: MediaItem) => item.Type === 'Episode' && item.SeriesId === seriesId && (!seasonId || item.SeasonId === seasonId));
  if (!episodes.length) { return undefined; }
  if (!episodes.every((item: MediaItem) => Number.isSafeInteger(item.IndexNumber) && (item.IndexNumber ?? -1) >= 0 &&
    (seasonId || (Number.isSafeInteger(item.ParentIndexNumber) && (item.ParentIndexNumber ?? -1) >= 0)))) { throw new Error('episode_order_unknown'); }
  return episodes.sort((a: MediaItem, b: MediaItem) => (seasonId ? 0 : a.ParentIndexNumber! - b.ParentIndexNumber!) || a.IndexNumber! - b.IndexNumber! || a.Id.localeCompare(b.Id))[0];
}
