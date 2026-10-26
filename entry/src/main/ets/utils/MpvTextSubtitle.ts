import { SubtitleContent, SubtitleRun, PositionedSubtitle } from './InlineSubtitle';

// These limits protect the ArkTS conversion stage, independently of native UTF-8 packet limits.
class MpvTextSubtitleLimits {
  static readonly maximumEventCodeUnits: number = 65536;
  static readonly maximumDialogueLines: number = 64;
  // Closing brace offset minus opening brace offset, including the opening brace.
  static readonly maximumOverrideDistanceCodeUnits: number = 2048;
  static readonly maximumRuns: number = 4096;
  static readonly maximumFamilyCodeUnits: number = 128;
  static readonly minimumSizeScale: number = 0.125;
  static readonly maximumSizeScale: number = 8;
}

interface ParsedText { runs: SubtitleRun[]; alignment: number }
// Only converted plain-text tracks use ArkUI. Unrepresentable ASS effects retain
// the native renderer; never discard authoring merely to force a shared overlay.
export function mpvTextSubtitle(codec: string, events: string, fontSize: number, overflow: boolean): SubtitleContent | undefined {
  if (!['subrip', 'srt'].includes(codec) || overflow || events.length > MpvTextSubtitleLimits.maximumEventCodeUnits ||
    !Number.isFinite(fontSize) || fontSize <= 0) { return undefined; }
  const all: SubtitleRun[][] = []; const flow: SubtitleRun[][] = []; const positioned: PositionedSubtitle[] = [];
  if (events.trim()) {
    const lines = events.split(/\r?\n/).filter((line: string) => !!line.trim());
    if (lines.length > MpvTextSubtitleLimits.maximumDialogueLines) { return undefined; }
    for (const line of lines) {
      if (!line.startsWith('Dialogue:')) { return undefined; }
      let begin = line.indexOf(':') + 1;
      const fields: string[] = [];
      for (let field = 0; field < 9; ++field) { const comma = line.indexOf(',', begin); if (comma < 0) { return undefined; } fields.push(line.slice(begin, comma).trim()); begin = comma + 1; }
      if (fields[0] !== '0' || fields[3] !== 'Default' || fields.slice(5, 8).some((value: string) => !/^0+$/.test(value)) || fields[8]) { return undefined; }
      const content = parseText(line.slice(begin), fontSize); if (!content) { return undefined; }
      all.push(content.runs);
      if (content.alignment) {
        const cue = new PositionedSubtitle(positioned.length, content.runs.map((run: SubtitleRun) => run.text).join(''), content.runs, content.alignment);
        cue.revision = line; positioned.push(cue);
      } else { flow.push(content.runs); }
    }
  }
  const result = joined(all); const normal = joined(flow);
  result.flowText = normal.text; result.flowRuns = normal.runs; result.positioned = positioned; result.revision = events;
  return result;
}
function joined(groups: SubtitleRun[][]): SubtitleContent {
  const runs: SubtitleRun[] = [];
  groups.forEach((group: SubtitleRun[], index: number) => { if (index) { runs.push(new SubtitleRun('\n')); } runs.push(...group); });
  return new SubtitleContent(runs.map((run: SubtitleRun) => run.text).join(''), runs);
}
function parseText(source: string, baseSize: number): ParsedText | undefined {
  const runs: SubtitleRun[] = []; let style = new SubtitleRun(); let alignment = 0; let text = '';
  const flush = (): void => { if (text) { runs.push(new SubtitleRun(text, style)); text = ''; } };
  for (let i = 0; i < source.length;) {
    const c = source[i];
    if (c === '\\' && i + 1 < source.length) {
      const next = source[i + 1];
      if (next === 'N' || next === 'n' || next === 'h' || next === '{' || next === '}' || next === '\\') {
        text += next === 'N' || next === 'n' ? '\n' : next === 'h' ? '\u00a0' : next; i += 2; continue;
      }
    }
    if (c !== '{') { text += c; ++i; continue; }
    const end = source.indexOf('}', i + 1); if (end < 0 || end - i > MpvTextSubtitleLimits.maximumOverrideDistanceCodeUnits) { return undefined; }
    const block = source.slice(i + 1, end); i = end + 1;
    if (!block.includes('\\')) { continue; } // ASS comments are not visible text.
    flush(); if (runs.length > MpvTextSubtitleLimits.maximumRuns) { return undefined; }
    for (const command of block.split('\\').slice(1)) {
      let match: RegExpExecArray | null;
      if ((match = /^([bius])(-?1|0)$/.exec(command))) {
        style = new SubtitleRun('', style); const value = match[2] !== '0';
        if (match[1] === 'b') { style.bold = value; } else if (match[1] === 'i') { style.italic = value; }
        else if (match[1] === 'u') { style.underline = value; } else { style.strike = value; }
      } else if ((match = /^(?:1?c)(?:&H([0-9a-f]{1,6})&?)?$/i.exec(command))) {
        style = new SubtitleRun('', style);
        const bgr = match[1]?.padStart(6, '0').toUpperCase();
        style.color = bgr ? '#FF' + bgr.slice(4, 6) + bgr.slice(2, 4) + bgr.slice(0, 2) : '';
      } else if (command.startsWith('fn')) {
        const family = command.slice(2).trim();
        if (family.length > MpvTextSubtitleLimits.maximumFamilyCodeUnits || /["'<>\\/\u0000-\u001f]/.test(family)) { return undefined; }
        style = new SubtitleRun('', style); style.family = family;
      } else if ((match = /^fs(\d+(?:\.\d+)?)?$/.exec(command))) {
        const scale = match[1] ? Number(match[1]) / baseSize : 1;
        if (!Number.isFinite(scale) || scale < MpvTextSubtitleLimits.minimumSizeScale || scale > MpvTextSubtitleLimits.maximumSizeScale) { return undefined; }
        style = new SubtitleRun('', style); style.sizeScale = scale;
      } else if ((match = /^an([1-9])$/.exec(command))) {
        const next = Number(match[1]); if (alignment && alignment !== next) { return undefined; } alignment = next;
      } else if (command === 'r' || command === 'rDefault') { if (alignment) { return undefined; } style = new SubtitleRun(); }
      else { return undefined; }
    }
  }
  flush(); if (runs.length > MpvTextSubtitleLimits.maximumRuns) { return undefined; } return { runs: runs, alignment: alignment };
}
