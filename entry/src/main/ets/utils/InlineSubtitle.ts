import { subtitleEntities } from './SubtitleEntities';

export class SubtitleRun {
  text: string = '';
  bold: boolean = false;
  italic: boolean = false;
  underline: boolean = false;
  color: string = '';
  family: string = '';
  constructor(text: string = '', style?: SubtitleRun) {
    this.text = text;
    if (style) { this.bold = style.bold; this.italic = style.italic; this.underline = style.underline; this.color = style.color; this.family = style.family; }
  }
}
export const EMPTY_SUBTITLE_RUNS: SubtitleRun[] = [];
export class PositionedSubtitle {
  id: number;
  text: string;
  runs: SubtitleRun[];
  alignment: number;
  constructor(id: number, text: string, runs: SubtitleRun[], alignment: number) {
    this.id = id; this.text = text; this.runs = runs; this.alignment = alignment;
  }
}
export const EMPTY_POSITIONED_SUBTITLES: PositionedSubtitle[] = [];
export class SubtitleContent {
  text: string;
  runs: SubtitleRun[];
  flowText: string;
  flowRuns: SubtitleRun[];
  positioned: PositionedSubtitle[] = EMPTY_POSITIONED_SUBTITLES;
  constructor(text: string = '', runs: SubtitleRun[] = EMPTY_SUBTITLE_RUNS) {
    this.text = text; this.runs = runs; this.flowText = text; this.flowRuns = runs;
  }
}
interface FormatFrame { tag: string; style: SubtitleRun }
interface FontAttributes { color?: string; face?: string }
// Html.fromHtml's default (legacy) named-color values, including green = 00FF00.
const colors: Map<string, string> = new Map<string, string>();
for (const item of ('black=000000 darkgray=444444 gray=888888 lightgray=CCCCCC white=FFFFFF red=FF0000 green=00FF00 blue=0000FF yellow=FFFF00 cyan=00FFFF magenta=FF00FF aqua=00FFFF fuchsia=FF00FF darkgrey=444444 grey=888888 lightgrey=CCCCCC lime=00FF00 maroon=800000 navy=000080 olive=808000 purple=800080 silver=C0C0C0 teal=008080').split(' ')) {
  const pair = item.split('='); colors.set(pair[0], '#FF' + pair[1]);
}
function fontColor(value: string): string {
  const normalized = subtitleEntities(value).trim();
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(normalized)) { return '#FF' + normalized.slice(-6).toUpperCase(); }
  return colors.get(normalized.toLowerCase()) ?? '';
}
function fontFamily(value: string): string {
  const family = subtitleEntities(value).trim();
  return family && family.length <= 128 && !/["'<>\\/\u0000-\u001f]/.test(family) ? family : '';
}
// A bounded one-pass attribute reader; untrusted tags never become HTML, links or font registrations.
function fontAttributes(tag: string, start: number): FontAttributes {
  const result: FontAttributes = {}; let i = start;
  while (i < tag.length) {
    while (i < tag.length && !/[a-z]/i.test(tag[i])) { i++; }
    const begin = i;
    while (i < tag.length && /[a-z0-9_:-]/i.test(tag[i])) { i++; }
    const name = tag.slice(begin, i).toLowerCase();
    while (i < tag.length && /\s/.test(tag[i])) { i++; }
    if (tag[i] !== '=') { continue; }
    i++; while (i < tag.length && /\s/.test(tag[i])) { i++; }
    const quote = tag[i] === '"' || tag[i] === "'" ? tag[i++] : '';
    const valueStart = i;
    while (i < tag.length && (quote ? tag[i] !== quote : !/[\s>]/.test(tag[i]))) { i++; }
    const value = tag.slice(valueStart, i); if (quote) { i++; }
    if (name === 'color' && result.color === undefined) { result.color = value; }
    if (name === 'face' && result.face === undefined) { result.face = value; }
  }
  return result;
}
function sameStyle(a: SubtitleRun, b: SubtitleRun): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.color === b.color && a.family === b.family;
}
function hasStyle(run: SubtitleRun): boolean { return run.bold || run.italic || run.underline || !!run.color || !!run.family; }

// Keep the existing plain-text result while retaining common SubRip emphasis/font spans.
export function inlineSubtitle(value: string): SubtitleContent {
  const pieces: SubtitleRun[] = []; const root = new SubtitleRun();
  const stack: FormatFrame[] = [{ tag: '', style: root }];
  let plainStart = 0; let tagStart = -1; let quote = '';
  const append = (raw: string): void => {
    if (!raw) { return; }
    const style = stack[stack.length - 1].style; const previous = pieces[pieces.length - 1];
    if (previous && sameStyle(previous, style)) { previous.text += raw; }
    else { if (pieces.length >= 4096) { throw new Error('subtitle_failed'); } pieces.push(new SubtitleRun(raw, style)); }
  };
  for (let i = 0; i < value.length; i++) {
    const character = value[i];
    if (tagStart < 0) { if (character === '<') { tagStart = i; } continue; }
    if (quote) { if (character === quote) { quote = ''; } continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '<') { tagStart = i; continue; }
    if (character !== '>') { continue; }
    append(value.slice(plainStart, tagStart));
    const tag = value.slice(tagStart, i + 1); const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b/i.exec(tag);
    if (match) {
      const name = match[2].toLowerCase(); const closing = !!match[1];
      if (name === 'br' && !closing) { append('\n'); }
      else if (['b', 'strong', 'i', 'em', 'u', 'font'].includes(name)) {
        if (closing) {
          for (let j = stack.length - 1; j > 0; j--) { if (stack[j].tag === name) { stack.length = j; break; } }
        } else if (!/\/\s*>$/.test(tag)) {
          if (stack.length > 64) { throw new Error('subtitle_failed'); }
          const style = new SubtitleRun('', stack[stack.length - 1].style);
          if (name === 'b' || name === 'strong') { style.bold = true; }
          else if (name === 'i' || name === 'em') { style.italic = true; }
          else if (name === 'u') { style.underline = true; }
          else {
            const attributes = fontAttributes(tag, match[0].length);
            style.color = fontColor(attributes.color ?? '') || style.color;
            style.family = fontFamily(attributes.face ?? '') || style.family;
          }
          stack.push({ tag: name, style: style });
        }
      }
    }
    plainStart = i + 1; tagStart = -1;
  }
  append(value.slice(plainStart));
  const raw = pieces.map((run: SubtitleRun) => run.text).join('');
  const text = subtitleEntities(raw).trim();
  if (!pieces.some((run: SubtitleRun) => hasStyle(run))) { return new SubtitleContent(text); }
  const decoded = pieces.map((run: SubtitleRun) => new SubtitleRun(subtitleEntities(run.text), run));
  const all = decoded.map((run: SubtitleRun) => run.text).join('');
  // Broken entities crossing markup boundaries keep the established readable plain-text fallback.
  if (all.trim() !== text) { return new SubtitleContent(text); }
  let skip = all.length - all.trimStart().length; let remaining = text.length;
  const runs: SubtitleRun[] = [];
  for (const run of decoded) {
    const from = Math.min(skip, run.text.length); skip -= from;
    const kept = run.text.slice(from, from + remaining); remaining -= kept.length;
    if (kept) { runs.push(new SubtitleRun(kept, run)); }
  }
  return new SubtitleContent(text, runs.some((run: SubtitleRun) => hasStyle(run)) ? runs : EMPTY_SUBTITLE_RUNS);
}
