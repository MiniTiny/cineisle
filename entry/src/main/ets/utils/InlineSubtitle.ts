import { CaptionRenderLimits } from './SubtitleLimits';
import { subtitleEntities } from './SubtitleEntities';

export class SubtitleBaseline {
  constructor(public direction: number, public sizeScale: number, public family: string,
    public bold: boolean, public italic: boolean) {}
}
export class SubtitleRun {
  text: string = '';
  bold: boolean = false;
  italic: boolean = false;
  underline: boolean = false;
  color: string = '';
  background: string = '';
  paragraph: boolean = false;
  family: string = '';
  sizeScale: number = 1;
  strike: boolean = false;
  baselines: SubtitleBaseline[] = [];
  constructor(text: string = '', style?: SubtitleRun) {
    this.text = text;
    if (style) { this.bold = style.bold; this.italic = style.italic; this.underline = style.underline; this.color = style.color; this.background = style.background ?? ''; this.paragraph = style.paragraph ?? false; this.family = style.family; this.sizeScale = style.sizeScale ?? 1; this.strike = style.strike ?? false; this.baselines = style.baselines ?? []; }
  }
}
export const EMPTY_SUBTITLE_RUNS: SubtitleRun[] = [];
export class PositionedSubtitle {
  revision: string = '';
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
  revision: string = '';
  text: string;
  runs: SubtitleRun[];
  flowText: string;
  flowRuns: SubtitleRun[];
  positioned: PositionedSubtitle[] = EMPTY_POSITIONED_SUBTITLES;
  constructor(text: string = '', runs: SubtitleRun[] = EMPTY_SUBTITLE_RUNS) {
    this.text = text; this.runs = runs; this.flowText = text; this.flowRuns = runs;
  }
}
interface FormatFrame { tag: string; style: SubtitleRun; metricFamily?: string }
interface FontAttributes { color?: string; face?: string; style?: string }
interface StyleMark { start: number; property: string; value: string }
interface StyleSpan extends StyleMark { end: number }
// Html.fromHtml's default (legacy) named-color values, including green = 00FF00.
const colors: Map<string, string> = new Map<string, string>();
for (const item of ('black=000000 darkgray=444444 gray=888888 lightgray=CCCCCC white=FFFFFF red=FF0000 green=00FF00 blue=0000FF yellow=FFFF00 cyan=00FFFF magenta=FF00FF aqua=00FFFF fuchsia=FF00FF darkgrey=444444 grey=888888 lightgrey=CCCCCC lime=00FF00 maroon=800000 navy=000080 olive=808000 purple=800080 silver=C0C0C0 teal=008080').split(' ')) {
  const pair = item.split('='); colors.set(pair[0], '#FF' + pair[1]);
}
function fontColor(value: string): string { return htmlColor(subtitleEntities(value)); }
function fontFamily(value: string): string {
  const family = subtitleEntities(value).trim();
  return family && family.length <= 128 && !/["'<>\\/\u0000-\u001f]/.test(family) ? family : '';
}
// Html's legacy CSS colors use signed integer decoding, not browser #RGB expansion.
function htmlColor(value: string): string {
  if (/^[a-z]/i.test(value)) { return colors.get(value.toLowerCase()) ?? ''; }
  let digits = value; let sign = 1; let radix = 10;
  if (digits.startsWith('-')) { sign = -1; digits = digits.slice(1); }
  if (digits.startsWith('#')) { radix = 16; digits = digits.slice(1); }
  else if (digits.startsWith('0x') || digits.startsWith('0X')) { radix = 16; digits = digits.slice(2); }
  else if (digits.length > 1 && digits.startsWith('0')) { radix = 8; digits = digits.slice(1); }
  const valid = radix === 16 ? /^[+-]?[0-9a-f]+$/i : radix === 8 ? /^[+-]?[0-7]+$/ : /^[+-]?[0-9]+$/;
  if (!valid.test(digits)) { return ''; }
  const number = sign * Number.parseInt(digits, radix);
  if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647 || number === -1) { return ''; }
  return '#FF' + ((number >>> 0) & 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase();
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
    if (name === 'color') { result.color = value; }
    if (name === 'face' && result.face === undefined) { result.face = value; }
    if (name === 'style') { result.style = value; }
  }
  return result;
}
function sameStyle(a: SubtitleRun, b: SubtitleRun): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.color === b.color && (a.background ?? '') === (b.background ?? '') && !!a.paragraph === !!b.paragraph && a.family === b.family && (a.sizeScale ?? 1) === (b.sizeScale ?? 1) && !!a.strike === !!b.strike && JSON.stringify(a.baselines ?? []) === JSON.stringify(b.baselines ?? []);
}
function hasStyle(run: SubtitleRun): boolean { return run.bold || run.italic || run.underline || !!run.color || !!run.background || !!run.paragraph || !!run.family || (run.sizeScale ?? 1) !== 1 || !!run.strike || !!run.baselines?.length; }

// Html inserts metric spans on closing tags: inner spans affect the paint before outer spans.
// Keep the font state at each script operation, rather than using the final glyph size for every shift.
function scriptBaselines(stack: FormatFrame[]): SubtitleBaseline[] {
  const result: SubtitleBaseline[] = [];
  let scale = 1; let family = ''; let bold = false; let italic = false;
  for (let i = stack.length - 1; i > 0; i--) {
    const frame = stack[i];
    if (frame.tag === 'big') { scale *= 1.25; }
    else if (frame.tag === 'small') { scale *= 0.8; }
    else if (frame.tag === 'b' || frame.tag === 'strong') { bold = true; }
    else if (frame.tag === 'i' || frame.tag === 'em') { italic = true; }
    else if (frame.tag === 'font' && frame.metricFamily) { family = frame.metricFamily; }
    else if (frame.tag === 'sup' || frame.tag === 'sub') {
      result.push(new SubtitleBaseline(frame.tag === 'sup' ? 1 : -1, scale, family, bold, italic));
    }
  }
  return result;
}

// Keep the existing plain-text result while retaining common SubRip emphasis/font spans.
export function inlineSubtitle(value: string): SubtitleContent {
  const pieces: SubtitleRun[] = []; const root = new SubtitleRun();
  const stack: FormatFrame[] = [{ tag: '', style: root }];
  const colorMarks: StyleMark[] = []; const backgroundMarks: StyleMark[] = []; const strikeMarks: StyleMark[] = [];
  const spans: StyleSpan[] = []; let styleRevision = 0; let appendedRevision = -1;
  const endMark = (marks: StyleMark[]): void => {
    const mark = marks.pop();
    if (mark && mark.start < pieces.length) { spans.push({ start: mark.start, end: pieces.length, property: mark.property, value: mark.value }); }
  };
  const endStyle = (name: string): void => {
    // Html closes the last property mark, even when a nested span did not open it.
    if (name === 'span' || name === 'p') { endMark(strikeMarks); endMark(backgroundMarks); endMark(colorMarks); }
    else if (name === 'font') { endMark(colorMarks); }
    else if (['s', 'del', 'strike'].includes(name)) { endMark(strikeMarks); }
  };
  let plainStart = 0; let tagStart = -1; let quote = ''; let trailingBreaks = 0; let paragraph = false;
  const append = (raw: string): void => {
    if (!raw) { return; }
    const style = stack[stack.length - 1].style; const previous = pieces[pieces.length - 1];
    if (previous && appendedRevision === styleRevision && sameStyle(previous, style)) { previous.text += raw; }
    else { if (pieces.length >= CaptionRenderLimits.maxRunsPerCue) { throw new Error('subtitle_failed'); } pieces.push(new SubtitleRun(raw, style)); appendedRevision = styleRevision; }
    trailingBreaks = raw === '\n' || raw === '\n\n' ? Math.min(2, trailingBreaks + raw.length) : 0;
  };
  const appendText = (raw: string): void => {
    // Decode before folding, as Html.characters does. Encoded tags remain literal text.
    // The legacy HTML scanner drops nonzero numeric controls, rather than turning them into breaks.
    const readable = raw.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity: string, digits: string): string => {
      const code = digits[0].toLowerCase() === 'x' ? Number.parseInt(digits.slice(1), 16) : Number.parseInt(digits, 10);
      return code > 0 && code < 32 ? '' : entity;
    });
    let text = subtitleEntities(readable).replace(/[ \n]+/g, ' ');
    const previous = pieces[pieces.length - 1]?.text;
    const last = previous ? previous[previous.length - 1] : '\n';
    if ((last === ' ' || last === '\n') && text.startsWith(' ')) { text = text.slice(1); }
    append(text);
  };
  const blockBreak = (): void => {
    if (pieces.length && trailingBreaks < 2) { append('\n'.repeat(2 - trailingBreaks)); }
  };
  const closeTo = (index: number): void => {
    while (stack.length > index) {
      const frame = stack.pop()!; ++styleRevision; endStyle(frame.tag);
      if (frame.tag === 'p' || frame.tag === 'div') { blockBreak(); }
    }
  };
  const openFrame = (name: string, tag: string = '', start: number = 0): void => {
    ++styleRevision;
    if (stack.length > 64) { throw new Error('subtitle_failed'); }
    const style = new SubtitleRun('', stack[stack.length - 1].style);
    let metricFamily = '';
    if (name === 'b' || name === 'strong') { style.bold = true; }
    else if (['i', 'em', 'cite', 'dfn'].includes(name)) { style.italic = true; }
    else if (name === 'tt') { metricFamily = 'monospace'; style.family = metricFamily; }
    else if (name === 'u') { style.underline = true; }
    else if (name === 's' || name === 'del' || name === 'strike') { strikeMarks.push({ start: pieces.length, property: 'strike', value: 'true' }); }
    else if (name === 'big' || name === 'small') {
      style.sizeScale *= name === 'big' ? 1.25 : 0.8;
      // Reject an excessive candidate instead of silently changing its authored size.
      if (!Number.isFinite(style.sizeScale) || style.sizeScale < 0.125 || style.sizeScale > 8) { throw new Error('subtitle_failed'); }
    }
    else if (name === 'font') {
      const attributes = fontAttributes(tag, start);
      const color = fontColor(attributes.color ?? '');
      if (color) { colorMarks.push({ start: pieces.length, property: 'color', value: color }); }
      metricFamily = fontFamily(attributes.face ?? '');
      style.family = metricFamily || style.family;
    }
    else if (name === 'span' || name === 'p') {
      const css = subtitleEntities(fontAttributes(tag, start).style ?? '');
      // One preceding whitespace gives the same capture without quadratic retries over long blank styles.
      const foreground = /(?:\s|^)color\s*:\s*(\S*)\b/.exec(css);
      const background = /(?:\s|^)background(?:-color)?\s*:\s*(\S*)\b/.exec(css);
      const decoration = /(?:\s|^)text-decoration\s*:\s*(\S*)\b/.exec(css);
      const foregroundColor = foreground ? htmlColor(foreground[1]) : '';
      const backgroundColor = background ? htmlColor(background[1]) : '';
      if (foregroundColor) { colorMarks.push({ start: pieces.length, property: 'color', value: foregroundColor }); }
      if (backgroundColor) { backgroundMarks.push({ start: pieces.length, property: 'background', value: backgroundColor }); }
      if (decoration?.[1].toLowerCase() === 'line-through') { strikeMarks.push({ start: pieces.length, property: 'strike', value: 'true' }); }
    }
    stack.push({ tag: name, style: style, metricFamily: metricFamily });
    style.baselines = scriptBaselines(stack);
  };
  // Restart phrasing styles around blocks; span/font attributes end at that boundary.
  const restartable = ['b', 'strong', 'i', 'em', 'cite', 'dfn', 'tt', 'u', 'big', 'small', 's', 'del', 'strike', 'sup', 'sub'];
  const suspendInline = (): string[] => {
    const restart: string[] = [];
    while (stack.length > 1 && !['p', 'div'].includes(stack[stack.length - 1].tag)) {
      const name = stack[stack.length - 1].tag;
      if (restartable.includes(name)) { restart.unshift(name); }
      closeTo(stack.length - 1);
    }
    return restart;
  };
  const restartInline = (names: string[]): void => { names.forEach((name: string): void => openFrame(name)); };
  for (let i = 0; i < value.length; i++) {
    const character = value[i];
    if (tagStart < 0) { if (character === '<') { tagStart = i; } continue; }
    if (quote) { if (character === quote) { quote = ''; } continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '<') { tagStart = i; continue; }
    if (character !== '>') { continue; }
    appendText(value.slice(plainStart, tagStart));
    const tag = value.slice(tagStart, i + 1); const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b/i.exec(tag);
    if (match) {
      const name = match[2].toLowerCase(); const closing = !!match[1];
      if (name === 'br' && !closing) { append('\n'); }
      else if (['b', 'strong', 'i', 'em', 'cite', 'dfn', 'tt', 'u', 'font', 'span', 'p', 'div', 'big', 'small', 's', 'del', 'strike', 'sup', 'sub'].includes(name)) {
        const block = name === 'p' || name === 'div';
        if (closing) {
          for (let j = stack.length - 1; j > 0; j--) {
            if (stack[j].tag === name) {
              const restart = block ? suspendInline() : [];
              closeTo(j); restartInline(restart); break;
            }
          }
        } else {
          const restart = block ? suspendInline() : [];
          if (block) {
            paragraph = true;
            // Paragraphs close implicitly at a new block; div nesting remains valid.
            for (let j = stack.length - 1; j > 0; j--) { if (stack[j].tag === 'p') { closeTo(j); break; } }
            blockBreak();
          }
          if (!/\/\s*>$/.test(tag)) { openFrame(name, tag, match[0].length); }
          restartInline(restart);
        }
      }
    }
    plainStart = i + 1; tagStart = -1;
  }
  appendText(value.slice(plainStart));
  suspendInline(); closeTo(1);
  while (strikeMarks.length) { endMark(strikeMarks); }
  while (backgroundMarks.length) { endMark(backgroundMarks); }
  while (colorMarks.length) { endMark(colorMarks); }
  // Span insertion order is observable: an outer color closes later and overrides an inner color.
  for (const span of spans) {
    for (let i = span.start; i < span.end; i++) {
      if (span.property === 'color') { pieces[i].color = span.value; }
      else if (span.property === 'background') { pieces[i].background = span.value; }
      else { pieces[i].strike = true; }
    }
  }
  if (paragraph) { pieces.forEach((run: SubtitleRun): void => { run.paragraph = true; }); }
  const text = pieces.map((run: SubtitleRun) => run.text).join('');
  if (!pieces.some((run: SubtitleRun) => hasStyle(run))) { return new SubtitleContent(text); }
  const runs: SubtitleRun[] = [];
  for (const run of pieces) {
    if (run.text) {
      const previous = runs[runs.length - 1];
      if (previous && sameStyle(previous, run)) { previous.text += run.text; }
      else { runs.push(new SubtitleRun(run.text, run)); }
    }
  }
  return new SubtitleContent(text, runs.some((run: SubtitleRun) => hasStyle(run)) ? runs : EMPTY_SUBTITLE_RUNS);
}
