// Expectations come from separately built Android/Media3 observers, never the candidate scanner.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const p = require('./player-regression.test.cjs');
const { inlineSubtitle } = h.load('utils/InlineSubtitle.ts');
const { parseSubtitles } = h.load('utils/Playback.ts');
const reference = JSON.parse(fs.readFileSync('tests/fixtures/srt-scanner-android.json'));
const tests = [], test = (name, run) => tests.push([name, run]);
const doc = body => `1\n00:00:00,000 --> 00:00:10,000\n${body}\n\n`;
function units(content, html) {
  const result = [];
  for (const run of content.runs?.length ? content.runs : [{ text: content.text }]) {
    for (let i = 0; i < run.text.length; ++i) {
      const unit = { underline: !!run.underline, color: run.color || '#FFFFFFFF' };
      if (html) Object.assign(unit, { bold: !!run.bold, italic: !!run.italic,
        strike: !!run.strike, sizePx: 100 * (run.sizeScale ?? 1) });
      result.push(unit);
    }
  }
  return result;
}
for (const row of reference.cases) {
  test('Android scanner HTML ' + row.id, () => {
    const actual = inlineSubtitle(row.source);
    assert.equal(actual.text, row.htmlText);
    assert.deepEqual(units(actual, true), row.htmlUnits);
  });
  test('Media3 scanner SRT ' + row.id, () => {
    const actual = parseSubtitles(doc(row.source))[0];
    assert.ok(actual); assert.equal(actual.text, row.srtText);
    assert.deepEqual(units(actual, false), row.srtUnits);
  });
}
test('comment contents never create style frames or decode hidden entities', () => {
  const value = inlineSubtitle('<b>A<!--' + '<small>&copy;'.repeat(128) + '-->B</b>');
  assert.equal(value.text, 'AB'); assert.equal(value.runs.length, 1); assert.equal(value.runs[0].bold, true);
});
test('unterminated comments and literal trailing less-than runs consume bounded input once', () => {
  assert.equal(inlineSubtitle('A<!--' + '<'.repeat(65536)).text, 'A');
  const text = 'A' + '<'.repeat(65536); assert.equal(inlineSubtitle(text).text, text);
});
test('lexical states preserve the4096 run and64 frame limits', () => {
  const source = '<b>A</b>B'.repeat(2048);
  assert.equal(inlineSubtitle(source).runs.length, 4096);
  assert.throws(() => inlineSubtitle(source + '<b>C</b>D'), /subtitle_failed/);
  assert.throws(() => inlineSubtitle('<b>'.repeat(65) + '<![CDATA[x]]>'), /subtitle_failed/);
});
test('online same-text raw transitions clear emphasis through the playback controller', async () => {
  p.reset();
  const raw = '1\n00:00 --> 00:02\n<b>same</b>\n\n2\n00:02 --> 00:04\n<script>same</script>\n\n';
  const { c } = p.rig({ subtitle: async () => raw }), values = [];
  c.view.caption = value => values.push(value);
  try {
    await c.open(p.route(), 'surface'); await p.settle(); await c.selectSubtitle('server:20');
    p.nativePlayers[0].emit('timeUpdate', 1000);
    assert.equal(values.at(-1).text, 'same'); assert.equal(values.at(-1).runs[0].bold, true);
    p.nativePlayers[0].emit('timeUpdate', 2500);
    assert.equal(values.at(-1).text, 'same'); assert.equal(values.at(-1).runs.length, 0);
    await c.selectSubtitle(''); assert.equal(values.at(-1).text, '');
  } finally { await c.close(); }
});
test('offline raw SRT round-trip preserves scanner syntax and reads without HTTP', async () => {
  h.reset(); const { OfflineSubtitles } = h.load('service/OfflineSubtitles.ets');
  const client = h.activate(), record = { id: 'movie', item: h.film('movie'), mediaSourceId: 'source',
    state: 'complete', progress: 1, path: path.join(h.directory, 'scanner.mp4'), subtitles: [] };
  fs.writeFileSync(record.path, 'video');
  const source = { Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 8, Codec: 'subrip' }] };
  const raw = doc('A<!-- > <b>hidden</b> -->B<![CDATA[<i>literal</i>&copy;]]>');
  client.subtitle = async () => raw;
  await OfflineSubtitles.fetch(record, client, () => true, () => {}, h.context, OfflineSubtitles.plan(record, source, h.directory));
  assert.equal(record.subtitles[0].state, 'ready'); assert.equal(fs.readFileSync(record.subtitles[0].path, 'utf8'), raw);
  client.subtitle = async () => { throw Error('unexpected network'); };
  const value = OfflineSubtitles.read(JSON.parse(JSON.stringify(record.subtitles[0])))[0];
  assert.equal(value.text, 'AB<i>literal</i>&copy;'); assert.equal(value.runs, undefined);
});
(async () => {
  let failed = 0;
  for (const [name, run] of tests) {
    try { await run(); console.log('PASS ' + name); }
    catch (error) { ++failed; console.error('FAIL ' + name + '\n' + error.stack); }
  }
  if (failed) throw Error(`${failed}/${tests.length} scanner cases failed`);
  console.log(`${tests.length} SRT scanner regressions passed. Native Harmony rendering remains separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
