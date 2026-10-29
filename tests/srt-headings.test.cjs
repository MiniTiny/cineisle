// Expected character styles are captured from actual Android Html/TextPaint, independently of this parser.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const p = require('./player-regression.test.cjs'), h = require('./feature-regression.test.cjs');
const { inlineSubtitle, SubtitleRun } = p.load('utils/InlineSubtitle.ts');
const { parseSubtitles, subtitleContentAt } = p.load('utils/Playback.ts');
const reference = JSON.parse(fs.readFileSync('tests/fixtures/srt-headings-android.json'));
const tests = [], test = (name, run) => tests.push([name, run]);
const doc = (body, start = '00:00', end = '00:10') => `1\n${start} --> ${end}\n${body}\n`;
function units(content) {
  const out = [];
  for (const r of content.runs?.length ? content.runs : [{ text: content.text }]) {
    for (let i = 0; i < r.text.length; i++) out.push({ unit: r.text.charCodeAt(i), color: r.color || '#FFFFFFFF', background: r.background || '#00000000',
      strike: !!r.strike, underline: !!r.underline, bold: !!r.bold, italic: !!r.italic, family: r.family || '', sizeScale: r.sizeScale ?? 1,
      baselines: Array.from(r.baselines || [], b => ({ direction: b.direction, sizeScale: b.sizeScale, family: b.family, bold: b.bold, italic: b.italic })) });
  }
  return out;
}
function equal(actual, expected, at) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    // Android TextPaint multiplies float32 values; only its numerical rounding is tolerated.
    assert.ok(Math.abs(actual - expected) < 1e-5, `${at}: ${actual} != ${expected}`); return;
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    assert.equal(Array.isArray(actual), Array.isArray(expected), at);
    assert.deepEqual(Object.keys(actual), Object.keys(expected), at);
    for (const key of Object.keys(expected)) equal(actual[key], expected[key], `${at}.${key}`);
    return;
  }
  assert.equal(actual, expected, at);
}
for (const c of reference.cases) test(`Android heading ${c.id}`, () => {
  const actual = c.mode === 'html' ? inlineSubtitle(c.source) : parseSubtitles(doc(c.source))[0] || { text: '', runs: [] };
  const invisible = c.mode === 'srt' && !/[^\u0000-\u0020]/.test(c.text);
  assert.equal(actual.text, invisible ? '' : c.text);
  equal(units(actual), invisible ? [] : units({ text: c.text, runs: c.runs }), c.id);
});
test('all six levels are bold blocks with independently specified legacy proportions', () => {
  for (const [i, ratio] of [1.5, 1.4, 1.3, 1.2, 1.1, 1].entries()) {
    const c = inlineSubtitle(`<h${i + 1}>TITLE</h${i + 1}>body`);
    assert.equal(c.text, 'TITLE\n\nbody'); assert.equal(c.runs[0].sizeScale, ratio); assert.equal(c.runs[0].bold, true);
    assert.ok(c.runs.every(r => r.paragraph)); assert.equal(c.runs.at(-1).bold, false); assert.equal(c.runs.at(-1).sizeScale, 1);
  }
});
test('headings compose with existing color,font,underline and script fields without leaking into margins', () => {
  const c = inlineSubtitle('<h2><font color="red" face="serif"><u><sup>A</sup></u></font></h2>B');
  assert.equal(c.text, 'A\n\nB'); const r = c.runs[0];
  assert.equal(r.color, '#FFFF0000'); assert.equal(r.family, 'serif'); assert.equal(r.underline, true); assert.equal(r.bold, true); assert.equal(r.sizeScale, 1.4);
  assert.equal(r.baselines[0].direction, 1); const tail = c.runs.at(-1);
  assert.equal(tail.color, ''); assert.equal(tail.family, ''); assert.equal(tail.underline, false); assert.equal(tail.bold, false); assert.equal(tail.sizeScale, 1);
});
test('heading structure and authored style survive copying,including same-size h6', () => {
  const r = inlineSubtitle('<h6>six</h6>').runs[0], copy = new SubtitleRun('copy', r);
  assert.equal(copy.bold, true); assert.equal(copy.sizeScale, 1); assert.equal(copy.paragraph, true);
  assert.equal(new SubtitleRun('legacy').paragraph, false); assert.equal(inlineSubtitle('ordinary').runs.length, 0);
});
test('implicit heading closure remains shallow while existing depth and authored-size budgets reject excess', () => {
  assert.equal(inlineSubtitle('<h1>x'.repeat(70)).text, 'x\n\n'.repeat(70));
  assert.throws(() => inlineSubtitle('<div>'.repeat(65) + '<h1>x</h1>'), /subtitle_failed/);
  assert.doesNotThrow(() => inlineSubtitle('<h1>' + '<big>'.repeat(7) + 'x'));
  assert.throws(() => inlineSubtitle('<h1>' + '<big>'.repeat(8) + 'x'), /subtitle_failed/);
  assert.doesNotThrow(() => inlineSubtitle('<h1>' + '<small>'.repeat(11) + 'x'));
  assert.throws(() => inlineSubtitle('<h1>' + '<small>'.repeat(12) + 'x'), /subtitle_failed/);
});
test('run and simultaneous budgets apply to headings without rejecting a long sequential film', () => {
  assert.throws(() => inlineSubtitle('<h1>x</h1>'.repeat(2500)), /subtitle_failed/);
  assert.throws(() => parseSubtitles(Array.from({ length: 2100 }, () => doc('<h1>x</h1>')).join('\n')), /subtitle_failed/);
  const serial = Array.from({ length: 2100 }, (_, i) => doc('<h6>x</h6>', `0:${Math.floor(i / 60)}:${i % 60}`, `0:${Math.floor((i + 1) / 60)}:${(i + 1) % 60}`)).join('\n');
  assert.equal(parseSubtitles(serial).length, 2100);
});
test('positioned heading cues retain separate identities,styles and seek/end boundaries', () => {
  const cues = parseSubtitles(doc('{\\an7}<h1>same</h1>') + '\n' + doc('{\\an9}<h6>same</h6>'));
  const c = subtitleContentAt(cues, 1000); assert.equal(c.positioned.length, 2);
  assert.deepEqual(c.positioned.map(x => x.alignment), [7, 9]); assert.deepEqual(c.positioned.map(x => x.runs[0].sizeScale), [1.5, 1]);
  assert.notEqual(c.positioned[0].id, c.positioned[1].id); assert.equal(subtitleContentAt(cues, 10000).positioned.length, 0);
  assert.equal(subtitleContentAt(cues, 0).positioned[0].runs[0].bold, true);
});
test('empty headings clear a timeline gap rather than publishing a blank styled cue', () => {
  const cues = parseSubtitles(doc('<h1>A</h1>', '00:00', '00:01') + '\n' + doc('<h6><br></h6>', '00:01', '00:02') + '\n' + doc('B', '00:02', '00:03'));
  assert.equal(cues.length, 2); assert.equal(subtitleContentAt(cues, 1500).text, ''); assert.equal(subtitleContentAt(cues, 2500).text, 'B');
});
test('actual online clock publishes same-text heading-size changes and clears style for ordinary/native/off', async () => {
  p.reset(); const { c } = p.rig({ subtitle: async () => doc('<h1>same</h1>', '00:00', '00:02') + '\n' + doc('<h6>same</h6>', '00:02', '00:04') + '\n' + doc('same', '00:04', '00:06') });
  const captions = []; c.view.caption = x => captions.push(x);
  try {
    await c.open(p.route(), 'surface'); await p.settle(); await c.selectSubtitle('server:20'); p.nativePlayers[0].emit('timeUpdate', 1000);
    assert.equal(captions.at(-1).text, 'same\n\n'); assert.equal(captions.at(-1).runs[0].sizeScale, 1.5);
    p.nativePlayers[0].emit('timeUpdate', 2500); assert.equal(captions.at(-1).text, 'same\n\n'); assert.equal(captions.at(-1).runs[0].sizeScale, 1); assert.equal(captions.at(-1).runs[0].bold, true);
    p.nativePlayers[0].emit('timeUpdate', 4500); assert.equal(captions.at(-1).runs.length, 0);
    await c.selectSubtitle('native:12'); p.nativePlayers[0].emit('subtitleUpdate', { text: 'native', startTime: 0, duration: 4000 }); assert.equal(captions.at(-1).runs.length, 0);
    await c.selectSubtitle(''); assert.equal(captions.at(-1).text, '');
  } finally { await c.close(); }
});
test('an oversized heading replacement preserves the selected playable document and visible error', async () => {
  p.reset(); let raw = doc('<h1>old</h1>'); const { c, values } = p.rig({ subtitle: async () => raw }); const captions = []; c.view.caption = x => captions.push(x);
  try {
    await c.open(p.route(), 'surface'); await p.settle(); await c.selectSubtitle('server:20'); raw = doc('<h1>' + '<big>'.repeat(8) + 'bad'); await c.selectSubtitle('server:20');
    p.nativePlayers[0].emit('timeUpdate', 1000); assert.equal(captions.at(-1).text, 'old\n\n'); assert.equal(captions.at(-1).runs[0].sizeScale, 1.5); assert.ok(values.errors.includes('subtitle_failed'));
  } finally { await c.close(); }
});
test('late heading responses cannot restore a caption after off or controller close', async () => {
  for (const closing of [false, true]) {
    p.reset(); const wait = p.deferred(), { c } = p.rig({ subtitle: () => wait.promise }), captions = []; c.view.caption = x => captions.push(x);
    try {
      await c.open(p.route(), 'surface'); await p.settle(); const pending = c.selectSubtitle('server:20');
      if (closing) await c.close(); else await c.selectSubtitle(''); wait.resolve(doc('<h2>late</h2>')); await pending;
      assert.equal(captions.at(-1).text, ''); assert.equal(captions.at(-1).runs.length, 0);
    } finally { await c.close(); }
  }
});
test('atomic offline storage keeps original headings and cold read needs no HTTP', async () => {
  h.reset(); const { OfflineSubtitles } = h.load('service/OfflineSubtitles.ets'), client = h.activate();
  const record = { id: 'movie', item: h.film('movie'), mediaSourceId: 'source', state: 'complete', progress: 1, path: path.join(h.directory, 'heading.mp4'), subtitles: [] };
  fs.writeFileSync(record.path, 'video'); const source = { Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 8, Codec: 'subrip' }] }, raw = doc('<h2>Cached é</h2><b>B</b>');
  client.subtitle = async () => raw; await OfflineSubtitles.fetch(record, client, () => true, () => {}, h.context, OfflineSubtitles.plan(record, source, h.directory));
  assert.equal(record.subtitles[0].state, 'ready'); assert.equal(fs.readFileSync(record.subtitles[0].path, 'utf8'), raw);
  client.subtitle = async () => { throw Error('unexpected HTTP'); }; const c = OfflineSubtitles.read(JSON.parse(JSON.stringify(record.subtitles[0])))[0];
  assert.equal(c.text, 'Cached é\n\nB'); assert.equal(c.runs[0].sizeScale, 1.4); assert.equal(c.runs[0].bold, true); assert.equal(c.runs.at(-1).sizeScale, 1);
});
test('encoded heading tags remain literal and large whitespace stays bounded', () => {
  assert.equal(inlineSubtitle('&lt;h1&gt;literal&lt;/h1&gt;').text, '<h1>literal</h1>');
  assert.equal(inlineSubtitle('&lt;h1&gt;literal&lt;/h1&gt;').runs.length, 0);
  const blank = ' '.repeat(262144), start = performance.now(), c = inlineSubtitle('<h3>' + blank + 'A' + blank + 'B</h3>');
  assert.equal(c.text, 'A B\n\n'); assert.equal(c.runs[0].sizeScale, 1.3); assert.ok(performance.now() - start < 3000);
});
(async () => { for (const [name, run] of tests) { await run(); console.log('PASS ' + name); } console.log(`${tests.length} SRT heading regressions passed. Android character-style references do not replace Harmony glyph,main/PiP or real-service acceptance.`); })().catch(error => { console.error(error); process.exitCode = 1; });
