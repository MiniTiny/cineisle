import { MediaItem, MediaStream } from '../model/Models';

export interface SubtitleCue { start: number; end: number; text: string; maxEnd: number }
export interface TrackChoice { key: string; index: number; type: number; label: string; remote: boolean; language?: string }

// Unknown season numbers in old caches only allow continuation within the known season.
export function followingEpisode(current: MediaItem, items: MediaItem[]): MediaItem | undefined {
  if (current.Type !== 'Episode' || !current.SeriesId) { return undefined; }
  const episodes = items.filter((item: MediaItem) => item.Type === 'Episode' && item.SeriesId === current.SeriesId);
  const anchor = episodes.find((item: MediaItem) => item.Id === current.Id) ?? current;
  if (!Number.isSafeInteger(anchor.IndexNumber) || anchor.IndexNumber! < 0) { throw new Error('episode_order_unknown'); }
  const numbered = Number.isSafeInteger(anchor.ParentIndexNumber) && anchor.ParentIndexNumber! >= 0;
  const candidates = episodes.filter((item: MediaItem) => item.Id !== current.Id && Number.isSafeInteger(item.IndexNumber) && item.IndexNumber! >= 0 &&
    (numbered ? Number.isSafeInteger(item.ParentIndexNumber) && item.ParentIndexNumber! >= 0 : !!anchor.SeasonId && item.SeasonId === anchor.SeasonId));
  const ordered = candidates.filter((item: MediaItem) => numbered ?
    item.ParentIndexNumber! > anchor.ParentIndexNumber! || (item.ParentIndexNumber === anchor.ParentIndexNumber && item.IndexNumber! > anchor.IndexNumber!) :
    item.IndexNumber! > anchor.IndexNumber!).sort((a: MediaItem, b: MediaItem) =>
    (numbered ? a.ParentIndexNumber! - b.ParentIndexNumber! : 0) || a.IndexNumber! - b.IndexNumber! || a.Id.localeCompare(b.Id));
  return ordered[0];
}

export function textSubtitle(stream: MediaStream): boolean {
  return stream.Type === 'Subtitle' && Number.isSafeInteger(stream.Index) && stream.Index >= 0 &&
    (stream.IsTextSubtitle === true || ['subrip', 'srt', 'webvtt', 'vtt', 'ass', 'ssa', 'mov_text', 'text'].includes((stream.Codec ?? '').toLowerCase()));
}

function cueTime(value: string): number {
  const match = /^(\d+):(\d{2}):(\d{2})[,.](\d{3})$/.exec(value.trim());
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) { return -1; }
  return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(match[4]);
}

// Jellyfin converts text tracks to SRT. Render plain text, not HTML or ASS styling.
export function parseSubtitles(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const block of source.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const timing = lines.findIndex((line: string) => line.includes('-->'));
    if (timing < 0) { continue; }
    const times = lines[timing].split('-->');
    const start = cueTime(times[0]); const end = cueTime(times[1]?.trim().split(/\s/)[0] ?? '');
    const content = lines.slice(timing + 1).join('\n').replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
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
