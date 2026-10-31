import { CaptionRenderLimits } from './SubtitleLimits';
import { subtitleEntities } from './SubtitleEntities';
import { EMPTY_SUBTITLE_PARAGRAPHS, SubtitleParagraphKind, SubtitleParagraphLimits, SubtitleParagraphSpan } from './SubtitleParagraph';

// Both plain-track converters produce the same relative size in SubtitleRun.
// Format-specific callers retain their own error or native-renderer fallback.
export class SubtitleRunScale {
  static readonly minimum: number = 0.125;
  static readonly maximum: number = 8;
  static valid(value: number): boolean {
    return Number.isFinite(value) && value >= SubtitleRunScale.minimum && value <= SubtitleRunScale.maximum;
  }
}

class InlineSubtitleLimits {
  static readonly maximumFamilyCodeUnits: number = 128;
  // The stack includes its root; checking before push admits 64 authored frames.
  static readonly maximumMarkupDepth: number = 64;
  static readonly bigMultiplier: number = 1.25;
  static readonly smallMultiplier: number = 0.8;
  // Fixed Media3 SubtitlePainter leaves TextPaint.linkColor transparent.
  static readonly linkColor: string = '#00000000';
}

// Android Html's legacy h1..h6 spans, independently captured with TextPaint.
const HEADING_SIZE_SCALES: number[] = [1.5, 1.4, 1.3, 1.2, 1.1, 1];
function headingScale(tag: string): number {
  const match = /^h([1-6])$/.exec(tag);
  return match ? HEADING_SIZE_SCALES[Number(match[1]) - 1] : 0;
}
function isSubtitleBlock(tag: string): boolean {
  return ['p', 'div', 'ul', 'li', 'blockquote'].includes(tag) || headingScale(tag) > 0;
}

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
  paragraphs: SubtitleParagraphSpan[];
  constructor(id: number, text: string, runs: SubtitleRun[], alignment: number,
    paragraphs: SubtitleParagraphSpan[] = EMPTY_SUBTITLE_PARAGRAPHS) {
    this.id = id; this.text = text; this.runs = runs; this.alignment = alignment; this.paragraphs = paragraphs;
  }
}
export const EMPTY_POSITIONED_SUBTITLES: PositionedSubtitle[] = [];
export class SubtitleContent {
  revision: string = '';
  text: string;
  runs: SubtitleRun[];
  flowText: string;
  flowRuns: SubtitleRun[];
  paragraphs: SubtitleParagraphSpan[];
  flowParagraphs: SubtitleParagraphSpan[];
  positioned: PositionedSubtitle[] = EMPTY_POSITIONED_SUBTITLES;
  constructor(text: string = '', runs: SubtitleRun[] = EMPTY_SUBTITLE_RUNS,
    paragraphs: SubtitleParagraphSpan[] = EMPTY_SUBTITLE_PARAGRAPHS) {
    this.text = text; this.runs = runs; this.flowText = text; this.flowRuns = runs;
    this.paragraphs = paragraphs; this.flowParagraphs = paragraphs;
  }
}
interface FormatFrame { tag: string; style: SubtitleRun; metricFamily?: string; paragraphStart?: number; linkStart?: number; qualifiedTag?: string }
interface FontAttributes { color?: string; face?: string; style?: string; hasHref?: boolean; selfClosing?: boolean }
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
  return family && family.length <= InlineSubtitleLimits.maximumFamilyCodeUnits && !/["'<>\\/\u0000-\u001f]/.test(family) ? family : '';
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
    while (i < tag.length && !/[a-z]/i.test(tag[i])) {
      if (tag[i] === '/') {
        let end = i + 1;
        while (end < tag.length && /\s/.test(tag[end])) { end++; }
        if (tag[end] === '>') { result.selfClosing = true; }
      }
      i++;
    }
    const begin = i;
    while (i < tag.length && /[a-z0-9_:-]/i.test(tag[i])) { i++; }
    const name = tag.slice(begin, i).toLowerCase();
    // Only the attribute's presence matters to drawing; never retain or open its URL.
    if (name === 'href') { result.hasHref = true; }
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
    const frame = stack[i]; const heading = headingScale(frame.tag);
    if (heading > 0) { scale *= heading; bold = true; }
    else if (frame.tag === 'big') { scale *= InlineSubtitleLimits.bigMultiplier; }
    else if (frame.tag === 'small') { scale *= InlineSubtitleLimits.smallMultiplier; }
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
  // The HTML scanner consumes one document-leading BOM and normalizes line ends.
  value = value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
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
    if (name === 'span' || name === 'p' || name === 'li') { endMark(strikeMarks); endMark(backgroundMarks); endMark(colorMarks); }
    else if (name === 'font') { endMark(colorMarks); }
    else if (['s', 'del', 'strike'].includes(name)) { endMark(strikeMarks); }
  };
  const paragraphs: SubtitleParagraphSpan[] = [];
  const paragraphAlignments: SubtitleParagraphSpan[] = [];
  let textUnits = 0;
  const endParagraph = (start: number, kind: SubtitleParagraphKind): void => {
    if (start >= textUnits) { return; }
    if (paragraphs.length >= SubtitleParagraphLimits.maximumSpansPerCue) { throw new Error('subtitle_failed'); }
    paragraphs.push(new SubtitleParagraphSpan(start, textUnits, kind));
  };
  let plainStart = 0; let tagStart = -1; let tagMarkupStart = -1; let quote = ''; let expectValue = false;
  let rawElement = ''; let rawSelfClosing = false; let rawLess = false; let trailingBreaks = 0; let paragraph = false; let contentStarted = false;
  const append = (raw: string): void => {
    if (!raw) { return; }
    textUnits += raw.length;
    const style = stack[stack.length - 1].style; const previous = pieces[pieces.length - 1];
    if (previous && appendedRevision === styleRevision && sameStyle(previous, style)) { previous.text += raw; }
    else { if (pieces.length >= CaptionRenderLimits.maxRunsPerCue) { throw new Error('subtitle_failed'); } pieces.push(new SubtitleRun(raw, style)); appendedRevision = styleRevision; }
    trailingBreaks = raw === '\n' || raw === '\n\n' ? Math.min(2, trailingBreaks + raw.length) : 0;
  };
  const appendText = (raw: string, decodeReferences: boolean = true): void => {
    // Decode before folding, as Html.characters does. Encoded tags remain literal text.
    // The legacy HTML scanner drops nonzero numeric controls, rather than turning them into breaks.
    let readable = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    if (decodeReferences) { readable = readable.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity: string, digits: string): string => {
      const code = digits[0].toLowerCase() === 'x' ? Number.parseInt(digits.slice(1), 16) : Number.parseInt(digits, 10);
      return code > 0 && code < 32 ? '' : entity;
    }); }
    let text = subtitleEntities(readable, decodeReferences).replace(/[ \n]+/g, ' ');
      // Before the first element/text, TagSoup ignores an all-Java-whitespace
      // chunk. Nonbreaking spaces (NBSP/figure/narrow) are not in that set.
      if (!contentStarted && /^[\u0009-\u000D\u001C-\u0020\u1680\u2000-\u2006\u2008-\u200A\u2028\u2029\u205F\u3000]*$/.test(text)) { return; }
      if (text) { contentStarted = true; }
    // TagSoup closes an ul before direct non-whitespace character content;
    // only list items belong to that container's content model.
    if (stack[stack.length - 1].tag === 'ul' && /[^ \t\n\r\f]/.test(text)) { closeTo(stack.length - 1); }
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
      if (frame.linkStart !== undefined && frame.linkStart < pieces.length) {
        spans.push({ start: frame.linkStart, end: pieces.length, property: 'link', value: InlineSubtitleLimits.linkColor });
      }
      if (isSubtitleBlock(frame.tag)) {
        blockBreak();
        // Html ends the last open alignment mark at any block boundary,
        // including a child li without its own text-align declaration.
        const alignment = paragraphAlignments.pop();
        if (alignment) { endParagraph(alignment.start, alignment.kind); }
        if (frame.tag === 'li') { endParagraph(frame.paragraphStart!, 'bullet'); }
        if (frame.tag === 'blockquote') { endParagraph(frame.paragraphStart!, 'quote'); }
      }
    }
  };
  const openFrame = (name: string, tag: string = '', start: number = 0, qualifiedTag?: string): void => {
    ++styleRevision;
    if (stack.length > InlineSubtitleLimits.maximumMarkupDepth) { throw new Error('subtitle_failed'); }
    const style = new SubtitleRun('', stack[stack.length - 1].style);
    let metricFamily = ''; const heading = headingScale(name);
    if (name === 'b' || name === 'strong') { style.bold = true; }
    else if (['i', 'em', 'cite', 'dfn'].includes(name)) { style.italic = true; }
    else if (name === 'tt') { metricFamily = 'monospace'; style.family = metricFamily; }
    else if (name === 'u') { style.underline = true; }
    else if (name === 's' || name === 'del' || name === 'strike') { strikeMarks.push({ start: pieces.length, property: 'strike', value: 'true' }); }
    else if (name === 'big' || name === 'small' || heading > 0) {
      style.sizeScale *= heading > 0 ? heading : name === 'big' ? InlineSubtitleLimits.bigMultiplier : InlineSubtitleLimits.smallMultiplier;
      if (heading > 0) { style.bold = true; }
      // Reject an excessive candidate instead of silently changing its authored size.
      if (!SubtitleRunScale.valid(style.sizeScale)) { throw new Error('subtitle_failed'); }
    }
    else if (name === 'font') {
      const attributes = fontAttributes(tag, start);
      const color = fontColor(attributes.color ?? '');
      if (color) { colorMarks.push({ start: pieces.length, property: 'color', value: color }); }
      metricFamily = fontFamily(attributes.face ?? '');
      style.family = metricFamily || style.family;
    }
    else if (name === 'span' || name === 'p' || name === 'li') {
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
    let alignment: SubtitleParagraphKind | undefined = undefined;
    if (isSubtitleBlock(name)) {
      const css = subtitleEntities(fontAttributes(tag, start).style ?? '');
      const match = /(?:\s|^)text-align\s*:\s*(\S*)\b/.exec(css);
      const value = match?.[1].toLowerCase();
      if (value === 'start' || value === 'center' || value === 'end') { alignment = value; }
    }
    if (alignment) { paragraphAlignments.push(new SubtitleParagraphSpan(textUnits, textUnits, alignment)); }
    const linkStart = name === 'a' && fontAttributes(tag, start).hasHref ? pieces.length : undefined;
    stack.push({ tag: name, style: style, metricFamily: metricFamily, paragraphStart: textUnits, linkStart: linkStart, qualifiedTag: qualifiedTag });
    style.baselines = scriptBaselines(stack);
  };
  // Restart phrasing styles around blocks; span/font attributes end at that boundary.
  const restartable = ['b', 'strong', 'i', 'em', 'cite', 'dfn', 'tt', 'u', 'big', 'small', 's', 'del', 'strike', 'sup', 'sub'];
  const suspendInline = (floor: number = 1): string[] => {
    const restart: string[] = [];
    while (stack.length > floor && !isSubtitleBlock(stack[stack.length - 1].tag)) {
      const name = stack[stack.length - 1].tag;
      if (!stack[stack.length - 1].qualifiedTag && restartable.includes(name)) { restart.unshift(name); }
      closeTo(stack.length - 1);
    }
    return restart;
  };
  const restartInline = (names: string[]): void => { names.forEach((name: string): void => openFrame(name)); };
  // Lexical behavior follows Android API34 TagSoup HTMLScanner and independent runtime captures.
  // Copyright 2002-2008 John Cowan; Apache-2.0, see rawfile/third_party/srt/notice.txt.
  // States are reimplemented separately from the existing style/paragraph stack; input is consumed once.
  const consumeTag = (tag: string): void => {
    const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*(?::[a-z][a-z0-9]*)*)\b/i.exec(tag);
      if (match && !(match[1] && match[2].includes(':'))) {
        const rawName = match[2].toLowerCase(); const closing = !!match[1];
        const qualifiedTag = rawName.includes(':') ? rawName : undefined;
        // TagSoup emits a qualified opening element's local name, but explicit
        // end tags cannot match that unknown qualified element in its schema.
        const name = qualifiedTag ? rawName.slice(rawName.lastIndexOf(':') + 1) : rawName;
        // The legacy scanner can stop before '-'; headings and anchors require a complete name.
      const heading = headingScale(name) > 0 && /[\t\n\f\r />]/.test(tag.charAt(match[0].length));
        const anchor = name === 'a' && /[\t\n\f\r />]/.test(tag.charAt(match[0].length));
        contentStarted = true;
        if (!closing && !qualifiedTag && (name === 'script' || name === 'style') && /[\t\n />]/.test(tag.charAt(match[0].length))) {
          if (name === 'style') {
            // Unlike script, style is outside an anchor's legacy content model.
            for (let j = stack.length - 1; j > 0; j--) {
              if (stack[j].tag === 'a' && !stack[j].qualifiedTag) {
                const restart = suspendInline(j + 1);
                closeTo(j); restartInline(restart); break;
              }
            }
          }
          rawElement = name;
          // Empty raw elements leave the legacy scanner in raw mode until its first end tag.
          rawSelfClosing = !!fontAttributes(tag, match[0].length).selfClosing && tag.endsWith('/>');
          rawLess = false;
        }
      if (name === 'br' && !closing) { append('\n'); }
        else if (heading || anchor || ['b', 'strong', 'i', 'em', 'cite', 'dfn', 'tt', 'u', 'font', 'span', 'p', 'div', 'ul', 'li', 'blockquote', 'big', 'small', 's', 'del', 'strike', 'sup', 'sub'].includes(name)) {
        const block = isSubtitleBlock(name);
        if (closing) {
          for (let j = stack.length - 1; j > 0; j--) {
              if (stack[j].tag === name && !stack[j].qualifiedTag) {
                const restart = block ? suspendInline() : anchor ? suspendInline(j + 1) : [];
              closeTo(j); restartInline(restart); break;
            }
          }
        } else {
            if (anchor && !qualifiedTag && stack[stack.length - 1].tag === 'a' && !stack[stack.length - 1].qualifiedTag) {
              // A direct child anchor closes its parent; intervening phrasing elements admit nesting.
              closeTo(stack.length - 1);
            }
          const restart = block ? suspendInline() : [];
          if (block) {
            paragraph = true;
            if (name === 'li') {
              // A sibling li closes the previous item; a nested ul owns its own items.
              for (let j = stack.length - 1; j > 0; j--) {
                if (stack[j].tag === 'ul') { break; }
                if (stack[j].tag === 'li') { closeTo(j); break; }
              }
            }
            // Paragraphs and headings close at a new supported block; div nesting remains valid.
            for (let j = stack.length - 1; j > 0; j--) { if (stack[j].tag === 'p' || headingScale(stack[j].tag) > 0) { closeTo(j); break; } }
            blockBreak();
          }
            const selfClosing = anchor ? !!fontAttributes(tag, match[0].length).selfClosing : /\/\s*>$/.test(tag);
            if (!selfClosing) { openFrame(name, tag, match[0].length, qualifiedTag); }
          restartInline(restart);
        }
      }
    }
  };
  for (let i = 0; i < value.length; i++) {
    const character = value[i];
    if (rawElement) {
      if (rawLess) {
        rawLess = false;
        if (character === '/') {
          appendText(value.slice(plainStart, i - 1), false);
          let end = value.indexOf('>', i + 1);
          if (end < 0) { end = value.length; }
          const name = value.slice(i + 1, end).replace(/[ \t\n]/g, '');
          if (rawSelfClosing) {
            rawElement = ''; rawSelfClosing = false;
            consumeTag('</' + name + '>');
          } else if (name.toLowerCase() === rawElement) { rawElement = ''; }
          else { appendText('</' + name + '>', false); }
          i = end; plainStart = Math.min(end + 1, value.length);
        }
      } else if (character === '<') { rawLess = true; }
      continue;
    }
    if (tagStart < 0) {
      if (character !== '<') { continue; }
      let next = i + 1;
      while (value[next] === '<') { next++; }
      // Whitespace after '<' is visible character data, not the start of an element.
      if (next === value.length || /[ \t\n]/.test(value[next])) { i = next - 1; continue; }
      const markup = next - 1;
      if (value.startsWith('<!-', markup)) {
        appendText(value.slice(plainStart, i));
        const end = value.indexOf('-->', markup + 4);
        i = end < 0 ? value.length : end + 2;
        plainStart = Math.min(i + 1, value.length); continue;
      }
      if (value.startsWith('<![CDATA[', markup)) {
        appendText(value.slice(plainStart, i));
        let brackets = 0; let end = -1;
        for (let j = markup + 9; j < value.length; j++) {
          if (value[j] === '>' && brackets === 2) { end = j; break; }
          // A third ']' returns to the content state in the fixed legacy scanner.
          brackets = value[j] === ']' && brackets < 2 ? brackets + 1 : 0;
        }
        if (end >= 0) { appendText(value.slice(markup + 9, end - 2), false); }
        i = end < 0 ? value.length : end;
        plainStart = Math.min(i + 1, value.length); continue;
      }
      if (value[markup + 1] === '!' || value[markup + 1] === '?') {
        appendText(value.slice(plainStart, i));
        const end = value.indexOf('>', markup + 2);
        i = end < 0 ? value.length : end;
        plainStart = Math.min(i + 1, value.length); continue;
      }
      tagStart = i; tagMarkupStart = markup; quote = ''; expectValue = false;
      i = next - 1; continue;
    }
    if (quote) { if (character === quote) { quote = ''; } continue; }
    if (expectValue && (character === '\"' || character === "'")) { quote = character; expectValue = false; continue; }
    if (character === '=') { expectValue = true; }
    else if (!/[ \t\n]/.test(character)) { expectValue = false; }
    // A leading '>' is a name character in the scanner's first-name state.
    if (character !== '>' || i === tagMarkupStart + 1) { continue; }
    appendText(value.slice(plainStart, tagStart));
    let tag = value.slice(tagMarkupStart, i + 1);
    if (tag.startsWith('</')) { tag = '</' + tag.slice(2).replace(/[ \t\n]/g, ''); }
    consumeTag(tag);
    plainStart = i + 1; tagStart = -1;
  }
  if (tagStart >= 0) {
    appendText(value.slice(plainStart, tagStart));
    const tag = value.slice(tagMarkupStart);
    // EOF closes an already emitted name's attributes, while an unfinished name is discarded.
    if (/^<[^ \t\n/>]+[ \t\n]/.test(tag)) { consumeTag(tag); }
  } else {
    const end = rawElement && rawLess ? value.length - 1 : value.length;
    appendText(value.slice(plainStart, end), !rawElement);
  }
  suspendInline(); closeTo(1);
  while (strikeMarks.length) { endMark(strikeMarks); }
  while (backgroundMarks.length) { endMark(backgroundMarks); }
  while (colorMarks.length) { endMark(colorMarks); }
  // Span insertion order is observable: an outer color closes later and overrides an inner color.
  for (const span of spans) {
    for (let i = span.start; i < span.end; i++) {
      if (span.property === 'color') { pieces[i].color = span.value; }
        else if (span.property === 'link') { pieces[i].color = span.value; pieces[i].underline = true; }
      else if (span.property === 'background') { pieces[i].background = span.value; }
      else { pieces[i].strike = true; }
    }
  }
  if (paragraph) { pieces.forEach((run: SubtitleRun): void => { run.paragraph = true; }); }
  const text = pieces.map((run: SubtitleRun) => run.text).join('');
  // Html's legacy ParagraphStyle finalization excludes one trailing blank line.
  for (const span of paragraphs) {
    if (span.end >= 2 && text.slice(span.end - 2, span.end) === '\n\n') { span.end--; }
  }
  const paragraphSpans = paragraphs.filter((span: SubtitleParagraphSpan): boolean => span.start < span.end);
  if (!pieces.some((run: SubtitleRun) => hasStyle(run))) { return new SubtitleContent(text); }
  const runs: SubtitleRun[] = [];
  for (const run of pieces) {
    if (run.text) {
      const previous = runs[runs.length - 1];
      if (previous && sameStyle(previous, run)) { previous.text += run.text; }
      else { runs.push(new SubtitleRun(run.text, run)); }
    }
  }
  return new SubtitleContent(text, runs.some((run: SubtitleRun) => hasStyle(run)) ? runs : EMPTY_SUBTITLE_RUNS, paragraphSpans);
}
