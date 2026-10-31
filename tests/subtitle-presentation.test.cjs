const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs'), p = require('./player-regression.test.cjs');
const { SubtitleContent, SubtitleRun, PositionedSubtitle } = h.load('utils/InlineSubtitle.ts');
const { SubtitleParagraphSpan } = h.load('utils/SubtitleParagraph.ts');
const { subtitleDisplayText, displaySubtitleContent } = h.load('utils/SubtitlePresentation.ts');
const { parseSubtitles } = h.load('utils/Playback.ts');
const { PiPSubtitleController } = p.load('components/PiPSubtitle.ets');
const tests = [], test = (n, f) => tests.push([n, f]);
for (const [raw, expected] of [
  ['A\uDC00\uDC00B', 'A\uFFFD\uFFFDB'], ['A\uD7BF\uDFFFB', 'A\uD7BF\uFFFDB'],
  ['\uD800A\uDFFF', '\uFFFDA\uFFFD'], ['\uD800\uD800\uDC00', '\uFFFD\uD800\uDC00'],
  ['A\uDBFF\uDFFFB', 'A\uDBFF\uDFFFB'], ['中文😀é', '中文😀é'], ['', '']
]) test('presentation preserves UTF16 length ' + JSON.stringify(raw), () => {
  assert.equal(subtitleDisplayText(raw), expected); assert.equal(subtitleDisplayText(raw).length, raw.length);
});
test('valid captions retain object/run/positioned identity and formatting', () => {
  const run = new SubtitleRun('🎬中'); run.bold = true; const value = new SubtitleContent(run.text, [run]);
  value.positioned = [new PositionedSubtitle(1, run.text, [run], 8)];
  assert.equal(displaySubtitleContent(value), value);
});
test('flow and positioned replacement preserves styles, IDs, revisions and paragraph offsets without mutating cues', () => {
  const raw = 'A\uDC00\uDC00B\n'; const run = new SubtitleRun(raw); run.bold = true; run.color = '#FF00FF00';
  const spans = [new SubtitleParagraphSpan(0, raw.length, 'quote')];
  const value = new SubtitleContent(raw, [run], spans); value.revision = 'old';
  value.flowText = 'C\uD800'; value.flowRuns = [new SubtitleRun(value.flowText, run)];
  value.positioned = [new PositionedSubtitle(7, raw, [run], 8, spans)]; value.positioned[0].revision = 'positioned';
  const actual = displaySubtitleContent(value);
  assert.notEqual(actual, value); assert.equal(actual.text, 'A\uFFFD\uFFFDB\n');
  assert.equal(actual.flowText, 'C\uFFFD'); assert.equal(actual.flowRuns[0].text, actual.flowText);
  assert.equal(actual.runs[0].bold, true); assert.equal(actual.runs[0].color, '#FF00FF00');
  assert.equal(actual.paragraphs, spans); assert.equal(actual.positioned[0].paragraphs, spans);
  assert.equal(actual.positioned[0].id, 7); assert.equal(actual.positioned[0].alignment, 8);
  assert.equal(actual.positioned[0].revision, 'positioned'); assert.equal(actual.revision, 'old');
  assert.equal(value.text, raw); assert.equal(value.runs[0].text, raw); assert.equal(value.positioned[0].text, raw);
});
test('online controller publishes replacement glyphs and PiP retains them after reconstruction and clears selection', async () => {
  p.reset(); const raw = '1\n00:00 --> 00:04\n<b>A&#x110000;B</b>\n\n';
  assert.equal(parseSubtitles(raw)[0].text, 'A\uDC00\uDC00B');
  const { c } = p.rig({ subtitle: async () => raw }), values = [];
  const pip = new PiPSubtitleController(() => assert.fail()); c.view.caption = value => values.push(value);
  try {
    await c.open(p.route(), 'surface'); await p.settle(); await c.selectSubtitle('server:20');
    p.nativePlayers[0].emit('timeUpdate', 1000); const shown = values.at(-1);
    assert.equal(shown.text, 'A\uFFFD\uFFFDB'); assert.equal(shown.runs[0].text, shown.text); assert.equal(shown.runs[0].bold, true);
    pip.setText(shown.text, shown.runs, shown.paragraphs, shown.revision);
    pip.makeNode(p.systemPlatform.uiContext()); pip.aboutToDisappear();
    const node = pip.makeNode(p.systemPlatform.uiContext()).builderNode;
    assert.equal(node.params.text, shown.text); assert.equal(node.params.runs[0].bold, true);
    await c.selectSubtitle(''); assert.equal(values.at(-1).text, '');
  } finally { pip.dispose(); await c.close(); }
});
test('offline document stays unchanged while published text is adapted without HTTP', async () => {
  p.reset(); const file = path.join(p.directory, 'unicode.mp4'), sub = path.join(p.directory, 'unicode.srt');
  const raw = '1\n00:00 --> 00:04\nA&#2147483647;B\n\n'; fs.writeFileSync(file, 'video'); fs.writeFileSync(sub, raw);
  const route = Object.assign(p.route(), { offline: true, filePath: file, subtitles: [{ index: 20, path: sub, state: 'ready', format: 'srt' }] });
  const { c, values } = p.rig({ subtitle: async () => assert.fail('unexpected HTTP') });
  try {
    await c.open(route, 'surface'); await p.settle(); await c.selectSubtitle('local:20');
    p.nativePlayers[0].emit('timeUpdate', 1000); assert.equal(values.subtitle, 'A\uD7BF\uFFFDB');
    assert.equal(fs.readFileSync(sub, 'utf8'), raw); assert.equal(parseSubtitles(raw)[0].text, 'A\uD7BF\uDFFFB');
  } finally { await c.close(); }
});
(async () => { for (const [n, f] of tests) { await f(); console.log('PASS ' + n); }
  console.log(`${tests.length} subtitle presentation regressions passed. Physical Player/PiP drawing remains separate acceptance.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
