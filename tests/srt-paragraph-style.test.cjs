// Expected UTF-16 ranges come from independent real Android framework/Media3 captures.
const assert = require('node:assert/strict'), fs = require('node:fs');
const p = require('./player-regression.test.cjs');
const { inlineSubtitle } = p.load('utils/InlineSubtitle.ts');
const { parseSubtitles, subtitleContentAt } = p.load('utils/Playback.ts');
const reference = JSON.parse(fs.readFileSync('tests/fixtures/srt-paragraph-style-android.json'));
const tests = [], test = (name, run) => tests.push([name, run]);
const plain = value => JSON.parse(JSON.stringify(value));
const doc = (body, start = '00:00', end = '00:10') => `1\n${start} --> ${end}\n${body}\n\n`;
for (const fixture of reference.cases) test(`Android paragraph span ${fixture.id}`, () => {
  const cue = fixture.mode === 'html' ? inlineSubtitle(fixture.source) : parseSubtitles(doc(fixture.source))[0];
  assert.equal(cue?.text || '', fixture.text);
  assert.deepEqual(plain(cue?.paragraphs || []), fixture.paragraphs);
  if (fixture.alignment) {
    assert.equal(cue.placement.alignment, fixture.alignment);
    assert.deepEqual(plain(cue.placement.paragraphs), fixture.paragraphs);
    const value = subtitleContentAt([cue], 1000);
    assert.equal(value.flowText, '');
    assert.deepEqual(plain(value.flowParagraphs), []);
    assert.deepEqual(plain(value.positioned[0].paragraphs), fixture.paragraphs);
  }
});
test('overlap offsets count surrogate pairs and separators without mutating source ranges', () => {
  const cues = parseSubtitles(doc('<blockquote>😀</blockquote>', '00:00', '00:03') + doc('<li>A</li>', '00:01', '00:04'));
  const original = plain(cues.map(c => c.paragraphs));
  assert.deepEqual(plain(subtitleContentAt(cues, 1500).paragraphs), [
    { start: 0, end: 3, kind: 'quote' }, { start: 5, end: 7, kind: 'bullet' }
  ]);
  assert.deepEqual(plain(subtitleContentAt(cues, 3500).paragraphs), [{ start: 0, end: 2, kind: 'bullet' }]);
  assert.deepEqual(plain(subtitleContentAt(cues, 4000).paragraphs), []);
  assert.deepEqual(plain(cues.map(c => c.paragraphs)), original);
});
test('per-cue span budget admits4096 and rejects4097 independently of merged inline runs', () => {
  const nested = '<blockquote>'.repeat(64) + 'x' + '</blockquote>'.repeat(64);
  assert.equal(inlineSubtitle(nested.repeat(64)).paragraphs.length, 4096);
  assert.throws(() => inlineSubtitle(nested.repeat(64) + '<blockquote>x</blockquote>'), /subtitle_failed/);
});
test('active span budget is temporal and independent of inline run weight', () => {
  const nested = '<blockquote>'.repeat(8) + 'x' + '</blockquote>'.repeat(8);
  assert.equal(parseSubtitles(doc(nested).repeat(512)).length, 512);
  assert.throws(() => parseSubtitles(doc(nested).repeat(513)), /subtitle_failed/);
  const serial = Array.from({ length: 513 }, (_, i) => doc(nested, `${Math.floor(i / 60)}:${i % 60}`, `${Math.floor((i + 1) / 60)}:${(i + 1) % 60}`)).join('');
  assert.equal(parseSubtitles(serial).length, 513);
});
test('online clock publishes alignment-only changes with identical text and inline styling', async () => {
  p.reset();
  const { c } = p.rig({ subtitle: async () => doc('<p style="text-align:start">A</p>', '00:00', '00:02') + doc('<p style="text-align:end">A</p>', '00:02', '00:04') });
  const values = []; c.view.caption = value => values.push(value);
  try {
    await c.open(p.route(), 'surface'); await p.settle(); await c.selectSubtitle('server:20');
    p.nativePlayers[0].emit('timeUpdate', 1000);
    assert.deepEqual(plain(values.at(-1).flowParagraphs), [{ start: 0, end: 2, kind: 'start' }]);
    p.nativePlayers[0].emit('timeUpdate', 2500);
    assert.deepEqual(plain(values.at(-1).flowParagraphs), [{ start: 0, end: 2, kind: 'end' }]);
    await c.selectSubtitle(''); assert.deepEqual(plain(values.at(-1).paragraphs), []);
  } finally { await c.close(); }
});
(async () => {
  for (const [name, run] of tests) { await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} SRT paragraph style regressions passed. Native drawing,PiP and real playback acceptance remain separate.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
