import { MediaItem, MediaStream } from '../model/Models';
import { subtitleEntities } from './SubtitleEntities';

export interface SubtitleCue { start: number; end: number; text: string; maxEnd: number }
export interface TrackChoice { key: string; index: number; type: number; label: string; remote: boolean; language?: string; path?: string; format?: string }

// Unknown season numbers in old caches only allow continuation within the known season.
export function followingEpisode(current: MediaItem, items: MediaItem[]): MediaItem | undefined {
  return adjacentEpisode(current, items, true);
}
export function precedingEpisode(current: MediaItem, items: MediaItem[]): MediaItem | undefined {
  return adjacentEpisode(current, items, false);
}
function adjacentEpisode(current: MediaItem, items: MediaItem[], forward: boolean): MediaItem | undefined {
  if (current.Type !== 'Episode' || !current.SeriesId) { return undefined; }
  const episodes = items.filter((item: MediaItem) => item.Type === 'Episode' && item.SeriesId === current.SeriesId);
  const anchor = episodes.find((item: MediaItem) => item.Id === current.Id) ?? current;
  if (!Number.isSafeInteger(anchor.IndexNumber) || anchor.IndexNumber! < 0) { throw new Error('episode_order_unknown'); }
  const numbered = Number.isSafeInteger(anchor.ParentIndexNumber) && anchor.ParentIndexNumber! >= 0;
  const candidates = episodes.filter((item: MediaItem) => item.Id !== current.Id && Number.isSafeInteger(item.IndexNumber) && item.IndexNumber! >= 0 &&
    (numbered ? Number.isSafeInteger(item.ParentIndexNumber) && item.ParentIndexNumber! >= 0 : !!anchor.SeasonId && item.SeasonId === anchor.SeasonId));
  const direction = forward ? 1 : -1;
  const compare = (a: MediaItem, b: MediaItem): number => (numbered ? a.ParentIndexNumber! - b.ParentIndexNumber! : 0) || a.IndexNumber! - b.IndexNumber!;
  const ordered = candidates.filter((item: MediaItem) => compare(item, anchor) * direction > 0)
    .sort((a: MediaItem, b: MediaItem) => compare(a, b) * direction || a.Id.localeCompare(b.Id));
  return ordered[0];
}

export function textSubtitle(stream: MediaStream): boolean {
  return stream.Type === 'Subtitle' && Number.isSafeInteger(stream.Index) && stream.Index >= 0 &&
    (stream.IsTextSubtitle === true || ['subrip', 'srt', 'webvtt', 'vtt', 'ass', 'ssa', 'mov_text', 'text'].includes((stream.Codec ?? '').toLowerCase()));
}

export function subtitleFormat(stream: MediaStream): string {
  return ['ass', 'ssa'].includes((stream.Codec ?? '').toLowerCase()) ? 'ass' : 'srt';
}

// Check the stored document before committing its cache entry. Full ASS interpretation belongs to libass.
export function validAssDocument(source: string): boolean {
  if (!source || source.length > 1024 * 1024 || source.includes('\u0000')) { return false; }
  let section = ''; let fields: string[] = []; let script = false;
  for (const raw of source.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (/^\[.*\]$/.test(line)) { section = line.toLowerCase(); if (section === '[script info]') { script = true; } continue; }
    if (section !== '[events]') { continue; }
    if (/^format\s*:/i.test(line)) { fields = line.slice(line.indexOf(':') + 1).split(',').map((field: string) => field.trim().toLowerCase()); continue; }
    if (!/^dialogue\s*:/i.test(line) || !script || fields.length < 3 || fields[fields.length - 1] !== 'text') { continue; }
    const values = line.slice(line.indexOf(':') + 1).split(',');
    const start = fields.indexOf('start'); const end = fields.indexOf('end');
    if (start < 0 || end < 0 || values.length < fields.length) { continue; }
    const begin = assTime(values[start]); const finish = assTime(values[end]);
    if (begin >= 0 && finish > begin && values.slice(fields.length - 1).join(',').trim()) { return true; }
  }
  return false;
}

function assTime(value: string): number {
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/.exec(value.trim());
  return match && Number(match[2]) < 60 && Number(match[3]) < 60 ?
    ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(match[4]) * 10 : -1;
}

function cueTime(value: string): number {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:,(\d{1,3})|\.(\d{3}))?$/.exec(value.trim());
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) { return -1; }
  // SubRip's optional comma field is a millisecond count, not a decimal fraction.
  const time = ((Number(match[1] ?? '0') * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(match[4] ?? match[5] ?? '0');
  return Number.isSafeInteger(time) ? time : -1;
}

function subtitleMarkup(value: string): string {
  const result: string[] = [];
  let plainStart = 0; let tagStart = -1; let quote = '';
  // Scan once, including malformed/unclosed attributes. Repeated '<' must not cause regex rescans.
  for (let i = 0; i < value.length; i++) {
    const character = value[i];
    if (tagStart < 0) { if (character === '<') { tagStart = i; } continue; }
    if (quote) { if (character === quote) { quote = ''; } continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '<') { tagStart = i; continue; }
    if (character !== '>') { continue; }
    result.push(value.slice(plainStart, tagStart));
    if (/^<br(?:\s|\/?>)/i.test(value.slice(tagStart, i + 1))) { result.push('\n'); }
    plainStart = i + 1; tagStart = -1;
  }
  result.push(value.slice(plainStart));
  return result.join('');
}

// Jellyfin converts non-ASS text tracks to SRT. Decode text; never execute HTML.
export function parseSubtitles(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const block of source.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const timing = lines.findIndex((line: string) => line.includes('-->'));
    if (timing < 0) { continue; }
    const times = lines[timing].split('-->');
    const start = cueTime(times[0]); const end = cueTime(times[1]?.trim().split(/\s/)[0] ?? '');
    const markup = subtitleMarkup(lines.slice(timing + 1).join('\n').replace(/\{\\[^{}]*\}/g, ''));
    const content = subtitleEntities(markup).trim();
    if (start >= 0 && end > start && content) { cues.push({ start: start, end: end, text: content, maxEnd: end }); }
  }
  cues.sort((a: SubtitleCue, b: SubtitleCue) => a.start - b.start);
  let maxEnd = 0;
  cues.forEach((cue: SubtitleCue) => { maxEnd = Math.max(maxEnd, cue.end); cue.maxEnd = maxEnd; });
  return cues;
}

export function subtitleAt(cues: SubtitleCue[], position: number): string {
  // Binary-search the last start <= position; scan preceding cues for overlapping dialogue.
  let low = 0; let high = cues.length;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (cues[mid].start <= position) { low = mid + 1; } else { high = mid; } }
  const active: string[] = [];
  for (let i = low - 1; i >= 0 && cues[i].maxEnd > position; i--) { if (position < cues[i].end) { active.unshift(cues[i].text); } }
  return active.join('\n');
}
