// Golden unit styles were captured independently from Android framework and fixed Media3 binaries.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const p = require('./player-regression.test.cjs');
const h = require('./feature-regression.test.cjs');
const { inlineSubtitle } = p.load('utils/InlineSubtitle.ts');
const { parseSubtitles, subtitleContentAt } = p.load('utils/Playback.ts');
const reference = JSON.parse(fs.readFileSync('tests/fixtures/srt-link-style-android.json'));
const tests = [], test = (name, run) => tests.push([name, run]);
const doc = (body, start = '00:00', end = '00:10') => `1\n${start} --> ${end}\n${body}\n\n`;
function units(content) {
  const result = [], runs = content.runs?.length ? content.runs : [{ text: content.text }];
  for (const run of runs) {
    for (let i = 0; i < run.text.length; ++i) {
      result.push({ color: run.color || '#FFFFFFFF', underline: !!run.underline,
        bold: !!run.bold, italic: !!run.italic });
    }
  }
  return result;
}
for (const fixture of reference.cases) test(`Android link style ${fixture.id}`, () => {
  const actual = fixture.mode === 'html' ? inlineSubtitle(fixture.source) : parseSubtitles(doc(fixture.source))[0];
  assert.equal(actual.text, fixture.text);
  assert.deepEqual(units(actual), fixture.units);
});
test('overlap,positioning and end boundaries retain transparent and colored anchor runs', () => {
  const cues = parseSubtitles(doc('{\\an7}<a href="x">😀</a>', '00:00', '00:03') +
    doc('<font color="red"><a href="y">B</a></font>', '00:01', '00:04'));
  const value = subtitleContentAt(cues, 1500);
  assert.equal(value.positioned[0].runs[0].color, '#00000000');
  assert.equal(value.positioned[0].runs[0].underline, true);
  assert.equal(value.flowRuns[0].color, '#FFFF0000');
  assert.equal(value.flowRuns[0].underline, true);
  assert.equal(subtitleContentAt(cues, 3000).positioned.length, 0);
  assert.equal(subtitleContentAt(cues, 4000).text, '');
});
test('href values never survive into the rendered caption model', () => {
  for (const href of ['javascript:unused()', 'file:///unused', 'https://example.invalid/private?secret=fixture']) {
    const value = parseSubtitles(doc(`<a href="${href}" onclick="unused()">A</a>`))[0];
    assert.equal(value.text, 'A'); assert.equal(value.runs[0].underline, true);
    assert.equal(JSON.stringify(value).includes(href), false);
  }
});
test('anchor styling preserves the existing4096 run limit and64-frame depth budget', () => {
  const source = '<a href="x">A</a>B'.repeat(2048);
  assert.equal(inlineSubtitle(source).runs.length, 4096);
  assert.throws(() => inlineSubtitle(source + '<a href="x">C</a>D'), /subtitle_failed/);
  assert.throws(() => inlineSubtitle('<b>'.repeat(64) + '<a href="x">A</a>'), /subtitle_failed/);
});
test('online same-text transitions publish anchor-only changes and off clears them', async () => {
  p.reset(); const { c } = p.rig({ subtitle: async () => doc('<a href="x">same</a>', '00:00', '00:02') + doc('same', '00:02', '00:04') });
  const values = []; c.view.caption = value => values.push(value);
  try {
    await c.open(p.route(), 'surface'); await p.settle(); await c.selectSubtitle('server:20');
    p.nativePlayers[0].emit('timeUpdate', 1000);
    assert.equal(values.at(-1).text, 'same'); assert.equal(values.at(-1).runs[0].color, '#00000000');
    assert.equal(values.at(-1).runs[0].underline, true);
    p.nativePlayers[0].emit('timeUpdate', 2500);
    assert.equal(values.at(-1).text, 'same'); assert.equal(values.at(-1).runs.length, 0);
    await c.selectSubtitle(''); assert.equal(values.at(-1).text, '');
  } finally { await c.close(); }
});
test('offline raw SRT reloads anchor styling without a format change or HTTP', async () => {
  h.reset(); const { OfflineSubtitles } = h.load('service/OfflineSubtitles.ets');
  const client = h.activate(), record = { id: 'movie', item: h.film('movie'), mediaSourceId: 'source',
    state: 'complete', progress: 1, path: path.join(h.directory, 'links.mp4'), subtitles: [] };
  fs.writeFileSync(record.path, 'video');
  const source = { Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 8, Codec: 'subrip' }] };
  const raw = doc('<a href="x">A</a><font color="red"><a href="y">B</a></font>');
  client.subtitle = async () => raw;
  await OfflineSubtitles.fetch(record, client, () => true, () => {}, h.context, OfflineSubtitles.plan(record, source, h.directory));
  assert.equal(record.subtitles[0].state, 'ready'); assert.equal(fs.readFileSync(record.subtitles[0].path, 'utf8'), raw);
  client.subtitle = async () => { throw Error('unexpected network'); };
  const value = OfflineSubtitles.read(JSON.parse(JSON.stringify(record.subtitles[0])))[0];
  assert.deepEqual(Array.from(value.runs, r => [r.text, r.color, r.underline]), [['A', '#00000000', true], ['B', '#FFFF0000', true]]);
});
(async () => {
  for (const [name, run] of tests) { await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} SRT link style regressions passed. Native rendering and Player/PiP remain separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
