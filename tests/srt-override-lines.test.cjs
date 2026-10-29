// Android-derived golden data is independent of the shared parser under test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = require('./player-regression.test.cjs');
const h = require('./feature-regression.test.cjs');
const { parseSubtitles, subtitleContentAt } = p.load('utils/Playback.ts');
const { inlineSubtitle } = p.load('utils/InlineSubtitle.ts');
const reference = require('./fixtures/srt-override-android.json');
const tests = [];
const test = (name, run) => tests.push([name, run]);
const doc = (body, start = '00:00:00,000', end = '00:00:05,000') => `1\n${start} --> ${end}\n${body}\n`;

for (const c of reference.cases) {
  test(`Android override text and identity ${c.id}`, () => {
    const expected = c.cues.filter(x => /[^\u0000-\u0020]/.test(x.text)).map(x => ({ text: x.text, alignment: x.alignment }));
    const actual = Array.from(parseSubtitles(c.source), x => ({ text: x.text, alignment: x.placement?.alignment || 0 }));
    assert.deepEqual(actual, expected);
  });
}
for (const c of reference.direct) {
  test(`Android C1 character ${c.id}`, () => assert.equal(inlineSubtitle(c.html).text, c.text));
}

test('leading override lines do not create a blank first line; middle and trailing ones retain authored breaks', () => {
  assert.equal(parseSubtitles(doc('{\\q2}\n{\\an7}\nA'))[0].text, 'A');
  assert.equal(parseSubtitles(doc('A\n{\\q2}\nB'))[0].text, 'A\n\nB');
  assert.equal(parseSubtitles(doc('A\n{\\an7}'))[0].text, 'A\n');
});
test('whole extracted tags determine the first standalone alignment instead of a nested substring', () => {
  const cues = parseSubtitles(doc('{\\outer{\\an7}}A{\\an3}B'));
  assert.equal(cues[0].text, '}AB');
  assert.equal(cues[0].placement.alignment, 3);
  assert.equal(parseSubtitles(doc('{\\AN7}{\\an7\\b1}{\\an0}A'))[0].placement, undefined);
});
test('positioned lines keep rich text and independent seek/timeline identity', () => {
  const cues = parseSubtitles(doc('{\\an7}\n<b>&#128; A</b>') + '\n' + doc('{\\an3}\n<i>B</i>'));
  const content = subtitleContentAt(cues, 1000);
  assert.deepEqual(Array.from(content.positioned, c => c.text), ['€ A', 'B']);
  assert.equal(content.positioned[0].runs[0].bold, true);
  assert.equal(content.positioned[1].runs[0].italic, true);
  assert.equal(new Set(content.positioned.map(c => c.id)).size, 2);
  assert.equal(subtitleContentAt(cues, 5000).positioned.length, 0);
});
test('actual controller changes same-text positioning without retaining the leading blank line', async () => {
  p.reset();
  const raw = doc('{\\an7}\nSame', '00:00', '00:02') + '\n' + doc('{\\an3}\nSame', '00:02', '00:04');
  const { c } = p.rig({ subtitle: async () => raw }); const captions = [];
  c.view.caption = x => captions.push(x);
  try {
    await c.open(p.route(), 'surface'); await p.settle(); await c.selectSubtitle('server:20');
    p.nativePlayers[0].emit('timeUpdate', 1000);
    assert.equal(captions.at(-1).positioned[0].text, 'Same');
    assert.equal(captions.at(-1).positioned[0].alignment, 7);
    p.nativePlayers[0].emit('timeUpdate', 2500);
    assert.equal(captions.at(-1).positioned[0].text, 'Same');
    assert.equal(captions.at(-1).positioned[0].alignment, 3);
    await c.selectSubtitle(''); assert.equal(captions.at(-1).positioned.length, 0);
  } finally { await c.close(); }
});
test('a late response with standalone tags cannot republish after closing the controller', async () => {
  p.reset(); const wait = p.deferred(); const { c } = p.rig({ subtitle: () => wait.promise }); const captions = [];
  c.view.caption = x => captions.push(x);
  await c.open(p.route(), 'surface'); await p.settle(); const selecting = c.selectSubtitle('server:20');
  await c.close(); wait.resolve(doc('{\\an7}\n&#128;')); await selecting;
  assert.equal(captions.at(-1).text, ''); assert.equal(captions.at(-1).positioned.length, 0);
});
test('offline storage keeps the raw document while cold parsing restores C1 text and positioning without HTTP', async () => {
  h.reset(); const { OfflineSubtitles } = h.load('service/OfflineSubtitles.ets'); const client = h.activate();
  const record = { id: 'movie', item: h.film('movie'), mediaSourceId: 'source', state: 'complete', progress: 1,
    path: path.join(h.directory, 'override.mp4'), subtitles: [] };
  fs.writeFileSync(record.path, 'video');
  const source = { Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 8, Codec: 'subrip' }] };
  const raw = doc('{\\an7}\n<b>\u0080 A</b>').replace(/\n/g, '\r\n'); client.subtitle = async () => raw;
  await OfflineSubtitles.fetch(record, client, () => true, () => {}, h.context, OfflineSubtitles.plan(record, source, h.directory));
  assert.equal(record.subtitles[0].state, 'ready'); assert.equal(fs.readFileSync(record.subtitles[0].path, 'utf8'), raw);
  client.subtitle = async () => { throw Error('unexpected HTTP'); };
  const cue = OfflineSubtitles.read(JSON.parse(JSON.stringify(record.subtitles[0])))[0];
  assert.equal(cue.text, '€ A'); assert.equal(cue.placement.alignment, 7); assert.equal(cue.runs[0].bold, true);
});
test('positioning and rich budgets still reject excessive candidates while sequential files remain valid', () => {
  assert.throws(() => parseSubtitles(Array.from({ length: 257 }, () => doc('{\\an7}\nA')).join('\n')), /subtitle_failed/);
  assert.throws(() => parseSubtitles(doc('{\\an7}\n' + '<b>'.repeat(65) + 'A')), /subtitle_failed/);
  const serial = Array.from({ length: 1000 }, (_, i) => doc('{\\an7}\nA', `0:${Math.floor(i / 60)}:${i % 60}`, `0:${Math.floor((i + 1) / 60)}:${(i + 1) % 60}`)).join('\n');
  assert.equal(parseSubtitles(serial).length, 1000);
});
test('unterminated and nested override storms are scanned once without suffix retries', () => {
  const storm = '{\\'.repeat(65536); const start = performance.now();
  assert.equal(parseSubtitles(doc(storm + 'TAIL'))[0].text, storm + 'TAIL');
  const cue = parseSubtitles(doc(storm + 'an7}TAIL'))[0];
  assert.equal(cue.text, 'TAIL'); assert.equal(cue.placement, undefined);
  assert.ok(performance.now() - start < 3000, 'override scanning took over 3 seconds');
});
test('C1 conversion remains single-pass and cannot turn encoded overrides into positioning', () => {
  const cue = parseSubtitles(doc('&#123;\\an7} &amp;#128; &#128; &#x81;'))[0];
  assert.equal(cue.text, '{\\an7} &#128; € �'); assert.equal(cue.placement, undefined);
});
test('existing indexless optional timestamps and empty-cue policy remain compatible', () => {
  assert.equal(parseSubtitles('00:01 --> 00:02\n{\\q2}\nA')[0].text, 'A');
  assert.equal(parseSubtitles(doc('{\\an7}\n{\\q2}')).length, 0);
});

(async () => {
  for (const [name, run] of tests) { await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} SRT override regressions passed. Native Harmony geometry, physical devices and real Jellyfin remain separate.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
