import { SubtitleContent, SubtitleRun, PositionedSubtitle } from './InlineSubtitle';

// Android draws isolated UTF-16 surrogates as replacement glyphs. Keep parsed
// legacy units/cache data intact and adapt only values crossing into UI/Drawing.
export function subtitleDisplayText(value: string): string {
  const parts: string[] = []; let plain = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0xD800 || code > 0xDFFF) { continue; }
    if (code <= 0xDBFF && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) { i++; continue; }
    }
    parts.push(value.slice(plain, i), '\uFFFD'); plain = i + 1;
  }
  if (!parts.length) { return value; }
  parts.push(value.slice(plain)); return parts.join('');
}
function displayRuns(runs: SubtitleRun[]): SubtitleRun[] {
  let changed = false;
  const displayed = runs.map((run: SubtitleRun): SubtitleRun => {
    const text = subtitleDisplayText(run.text);
    if (text === run.text) { return run; }
    changed = true; return new SubtitleRun(text, run);
  });
  return changed ? displayed : runs;
}
export function displaySubtitleContent(value: SubtitleContent): SubtitleContent {
  const text = subtitleDisplayText(value.text); const flowText = subtitleDisplayText(value.flowText);
  const runs = displayRuns(value.runs); const flowRuns = value.flowRuns === value.runs ? runs : displayRuns(value.flowRuns);
  let positionedChanged = false;
  const positioned = value.positioned.map((cue: PositionedSubtitle): PositionedSubtitle => {
    const text = subtitleDisplayText(cue.text); const runs = displayRuns(cue.runs);
    if (text === cue.text && runs === cue.runs) { return cue; }
    positionedChanged = true;
    const displayed = new PositionedSubtitle(cue.id, text, runs, cue.alignment, cue.paragraphs);
    displayed.revision = cue.revision; return displayed;
  });
  if (text === value.text && flowText === value.flowText && runs === value.runs &&
    flowRuns === value.flowRuns && !positionedChanged) { return value; }
  const displayed = new SubtitleContent(text, runs, value.paragraphs);
  displayed.flowText = flowText; displayed.flowRuns = flowRuns; displayed.flowParagraphs = value.flowParagraphs;
  displayed.positioned = positionedChanged ? positioned : value.positioned; displayed.revision = value.revision;
  return displayed;
}
