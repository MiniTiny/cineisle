const f = require('./subtitle-metadata-contract-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
const stream = extra => ({ Type: 'Subtitle', Index: 20, Codec: 'srt', DisplayTitle: 'Title', Language: 'en', ...extra });
async function verify(mode, streams, expected, check) {
  let values, restored, task, requests;
  if (mode === 'plan') values = f.plan(streams);
  else { const result = await f.retry(streams); ({ task, requests } = result); values = result.record.subtitles; restored = result.restored; check(() => { assert.ifError(result.error); assert.equal(result.record.subtitleState, 'ready'); }); }
  check(() => {
    assert.equal(values.length, expected.length);
    for (const [i, item] of expected.entries()) {
      assert.equal(values[i].title, item.title); assert.equal(values[i].language, item.language); assert.equal(values[i].index, item.index ?? 20);
      assert.equal(values[i].format, item.format ?? 'srt'); assert.equal(values[i].state, mode === 'plan' ? 'pending' : 'ready');
    }
    if (mode === 'retry') {
      assert.equal(restored.length, 1); assert.deepEqual(restored[0].subtitles, values);
      assert.equal(require('node:fs').readFileSync(restored[0].path, 'utf8'), 'unchanged video');
      assert.ok(task.filename.endsWith('.srt.fetch')); assert.deepEqual(requests.map(r => r.method), ['GET', 'GET']);
      assert.ok(requests[0].path.endsWith('/System/Info/Public')); assert.ok(requests[1].path.endsWith('/Items/movie/PlaybackInfo'));
    }
  });
}
for (const mode of ['plan', 'retry']) {
  for (const n of [255, 256, 257]) test(`${mode} subtitle title ${n}`, async check => verify(mode, [stream({ DisplayTitle: 't'.repeat(n) })], [{ title: 't'.repeat(n <= 256 ? n : 256), language: 'en' }], check));
  for (const n of [62, 63, 64]) test(`${mode} subtitle language ${n}`, async check => verify(mode, [stream({ Language: 'l'.repeat(n) })], [{ title: 'Title', language: 'l'.repeat(n <= 63 ? n : 63) }], check));
  test(`${mode} subtitle title splits UTF16 surrogate pair`, async check => verify(mode, [stream({ DisplayTitle: 'a'.repeat(255) + '😀' })], [{ title: 'a'.repeat(255) + '\ud83d', language: 'en' }], check));
  test(`${mode} subtitle language splits UTF16 surrogate pair`, async check => verify(mode, [stream({ Language: 'a'.repeat(62) + '😀' })], [{ title: 'Title', language: 'a'.repeat(62) + '\ud83d' }], check));
  for (const [label, extra, title, language] of [
    ['language fallback', { DisplayTitle: '', Language: 'ENG_us' }, 'ENG_us', 'ENG_us'],
    ['codec fallback', { DisplayTitle: '', Language: '' }, 'srt', ''],
    ['null language', { Language: null }, 'Title', ''],
    ['raw metadata', { DisplayTitle: ' title\n ', Language: ' ENG_us ' }, ' title\n ', ' ENG_us ']
  ]) test(`${mode} subtitle ${label}`, async check => verify(mode, [stream(extra)], [{ title, language }], check));
  test(`${mode} subtitle filters nontext and retains first duplicate index`, async check => verify(mode, [stream({ Type: 'Audio', Index: 1 }), stream({ Codec: 'hdmv_pgs_subtitle', Index: 2 }), stream({ DisplayTitle: 'First' }), stream({ DisplayTitle: 'Second' })], [{ title: 'First', language: 'en' }], check));
}
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
