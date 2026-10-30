import { SubtitleDocumentLimits, CaptionRenderLimits } from './SubtitleLimits';
import { MediaItem, MediaStream } from '../model/Models';
import { inlineSubtitle, SubtitleContent, SubtitleRun, PositionedSubtitle, EMPTY_SUBTITLE_RUNS } from './InlineSubtitle';
import { SubtitleParagraphSpan, SubtitleParagraphLimits, shiftSubtitleParagraphs, EMPTY_SUBTITLE_PARAGRAPHS } from './SubtitleParagraph';

export interface SubtitleCue { start: number; end: number; text: string; maxEnd: number; runs?: SubtitleRun[]; paragraphs?: SubtitleParagraphSpan[]; placement?: PositionedSubtitle }
interface SubtitleBudgetEvent { time: number; weight: number; styled: number; positioned: number; paragraphs: number }
interface SubripLine { text: string; alignment: number }
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
  if (!source || source.length > SubtitleDocumentLimits.maxCodeUnits || source.includes('\u0000')) { return false; }
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

function trimSubripLine(line: string): string {
  // Java String.trim uses this code-unit range, not Unicode WhiteSpace.
  // Scan once rather than retrying an end-anchored regex over long inner spaces.
  let first = 0; let last = line.length;
  while (first < last && line.charCodeAt(first) <= 0x20) { ++first; }
  while (last > first && line.charCodeAt(last - 1) <= 0x20) { --last; }
  return line.slice(first, last);
}

function processSubripLine(raw: string): SubripLine {
  const line = trimSubripLine(raw);
  const parts: string[] = [];
  let plainStart = 0; let overrideStart = -1; let alignment = 0;
  // Java Pattern's dot cannot cross these line separators. CR/LF have already
  // been consumed by the physical-line reader. Match the first closing brace,
  // including nested openings, without retrying an unterminated tag suffix.
  const patternLineEnd = /[\u0085\u2028\u2029]/;
  for (let i = 0; i < line.length; ++i) {
    const character = line[i];
    if (overrideStart < 0) {
      if (character === '{' && line[i + 1] === '\\') { overrideStart = i; }
      continue;
    }
    if (patternLineEnd.test(character)) { overrideStart = -1; continue; }
    if (character !== '}') { continue; }
    if (plainStart < overrideStart) { parts.push(line.slice(plainStart, overrideStart)); }
    if (!alignment) {
      const match = /^\{\\an([1-9])\}$/.exec(line.slice(overrideStart, i + 1));
      if (match) { alignment = Number(match[1]); }
    }
    plainStart = i + 1; overrideStart = -1;
  }
  if (plainStart < line.length) { parts.push(line.slice(plainStart)); }
  return { text: parts.join(''), alignment: alignment };
}

// Jellyfin converts non-ASS text tracks to SRT. Decode text; never execute HTML.
export function parseSubtitles(source: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  // SubRip ends a cue at an empty physical line, not a line containing whitespace.
  for (const block of source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n\n')) {
    const lines = block.split('\n');
    // readLine consumes the final terminator without inventing another empty line.
    if (lines[lines.length - 1] === '') { lines.pop(); }
    const timing = lines.findIndex((line: string) => line.includes('-->'));
    if (timing < 0) { continue; }
    const times = lines[timing].split('-->');
    const start = cueTime(times[0]); const end = cueTime(times[1]?.trim().split(/\s/)[0] ?? '');
    if (start < 0 || end <= start) { continue; }
    const body: string[] = [];
    let hasText = false; let alignment = 0;
    for (const line of lines.slice(timing + 1)) {
      const processed = processSubripLine(line);
      if (!alignment) { alignment = processed.alignment; }
      if (hasText) { body.push('<br>'); }
      if (processed.text) { body.push(processed.text); hasText = true; }
    }
    const content = inlineSubtitle(body.join(''));
    if (start >= 0 && end > start && /[^\u0000-\u0020]/.test(content.text)) {
      const cue: SubtitleCue = { start: start, end: end, text: content.text, maxEnd: end };
      if (content.runs.length) { cue.runs = content.runs; }
        if (content.paragraphs.length) { cue.paragraphs = content.paragraphs; }
        if (alignment) { cue.placement = new PositionedSubtitle(cues.length, content.text, content.runs, alignment, content.paragraphs); }
      cues.push(cue);
    }
  }
  cues.sort((a: SubtitleCue, b: SubtitleCue) => a.start - b.start);
  let maxEnd = 0;
  cues.forEach((cue: SubtitleCue) => { maxEnd = Math.max(maxEnd, cue.end); cue.maxEnd = maxEnd; });
  // Reject only excessive simultaneous rich text, not a long movie with many non-overlapping cues.
  if (cues.some((cue: SubtitleCue) => !!cue.runs?.length || !!cue.placement)) {
    const events: SubtitleBudgetEvent[] = [];
    cues.forEach((cue: SubtitleCue) => {
      const weight = (cue.runs?.length ?? 1) + 1; const styled = cue.runs?.length || cue.placement ? 1 : 0;
      const positioned = cue.placement ? 1 : 0;
        const paragraphs = cue.paragraphs?.length ?? 0;
        events.push({ time: cue.start, weight: weight, styled: styled, positioned: positioned, paragraphs: paragraphs },
          { time: cue.end, weight: -weight, styled: -styled, positioned: -positioned, paragraphs: -paragraphs });
    });
    events.sort((a: SubtitleBudgetEvent, b: SubtitleBudgetEvent) => a.time - b.time || a.weight - b.weight);
      let weight = 0; let styled = 0; let positioned = 0; let paragraphs = 0;
    for (const event of events) {
      weight += event.weight; styled += event.styled; positioned += event.positioned;
        paragraphs += event.paragraphs;
      if ((styled > 0 && weight > CaptionRenderLimits.maxSimultaneousRunWeight) || positioned > CaptionRenderLimits.maxPositionedCues) { throw new Error('subtitle_failed'); }
        if (paragraphs > SubtitleParagraphLimits.maximumActiveSpans) { throw new Error('subtitle_failed'); }
    }
  }
  return cues;
}

export function subtitleAt(cues: SubtitleCue[], position: number): string { return subtitleContentAt(cues, position).text; }

export function subtitleContentAt(cues: SubtitleCue[], position: number): SubtitleContent {
  let low = 0; let high = cues.length;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (cues[mid].start <= position) { low = mid + 1; } else { high = mid; } }
  const active: SubtitleCue[] = [];
  for (let i = low - 1; i >= 0 && cues[i].maxEnd > position; i--) { if (position < cues[i].end) { active.unshift(cues[i]); } }
  const result = cueContent(active);
  if (active.some((cue: SubtitleCue) => !!cue.placement)) {
    const flow = cueContent(active.filter((cue: SubtitleCue) => !cue.placement));
    result.flowText = flow.text; result.flowRuns = flow.runs; result.flowParagraphs = flow.paragraphs;
    result.positioned = active.filter((cue: SubtitleCue) => !!cue.placement).map((cue: SubtitleCue) => cue.placement!);
  }
  return result;
}

function cueContent(active: SubtitleCue[]): SubtitleContent {
  const value = active.map((cue: SubtitleCue) => cue.text).join('\n');
  if (!active.length) { return new SubtitleContent(); }
  if (active.length === 1) { return new SubtitleContent(value, active[0].runs, active[0].paragraphs ?? EMPTY_SUBTITLE_PARAGRAPHS); }
  const paragraphs: SubtitleParagraphSpan[] = [];
  let offset = 0;
  active.forEach((cue: SubtitleCue): void => {
    paragraphs.push(...shiftSubtitleParagraphs(cue.paragraphs ?? [], offset));
    offset += cue.text.length + 1;
  });
  if (!active.some((cue: SubtitleCue) => !!cue.runs?.length)) {
    return new SubtitleContent(value, EMPTY_SUBTITLE_RUNS, paragraphs.length ? paragraphs : EMPTY_SUBTITLE_PARAGRAPHS);
  }
  const runs: SubtitleRun[] = [];
  active.forEach((cue: SubtitleCue, index: number) => {
    if (index > 0) { runs.push(new SubtitleRun('\n')); }
    runs.push(...(cue.runs ?? [new SubtitleRun(cue.text)]));
  });
  return new SubtitleContent(value, runs, paragraphs);
}
