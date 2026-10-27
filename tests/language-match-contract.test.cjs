const f = require('./language-match-contract-fixture.cjs'), { assert, rules } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
const tag = n => 'en' + '-abcdefgh'.repeat(6) + '-' + 'x'.repeat(n - 57);
const pref = language => ({ version: 1, audioLanguage: language, subtitleLanguage: '', subtitlesOff: false });
for (const n of [62, 63, 64]) {
  test(`language normalized admission ${n}`, async check => { const value = tag(n), actual = rules.normalizeLanguage(' ' + value.toUpperCase().replace(/-/g, '_') + ' '); check(() => { assert.equal(value.length, n); assert.equal(actual, n <= 63 ? value : ''); }); });
  test(`language persisted admission ${n}`, async check => {
    const store = await f.store(), result = await f.observed(store.save(pref(tag(n)))), calls = f.pref.state.calls.map(x => [...x]);
    let restored; if (n <= 63) { f.pref.state.instances.clear(); restored = (await f.store()).snapshot(); }
    check(() => { if (n <= 63) { assert.ifError(result.error); assert.equal(result.value.audioLanguage, tag(n)); assert.equal(restored.audioLanguage, tag(n)); const encoded = JSON.parse(calls.find(c => c[0] === 'put')[2]); assert.deepEqual(encoded, pref(tag(n))); } else { assert.equal(result.error?.message, 'playback_language_invalid'); assert.equal(calls.filter(c => c[0] === 'put').length, 0); } });
  });
  test(`language real player metadata admission ${n}`, async check => {
    const result = await f.playing('en', [tag(n)]);
    check(() => { assert.equal(result.state, 'playing'); assert.deepEqual(result.values.errors, []); assert.equal(result.values.audioKey, n <= 63 ? 'native:11' : ''); assert.deepEqual(result.calls.filter(c => c[0] === 'select'), n <= 63 ? [['select', 11]] : []); });
  });
}
for (const [name, wanted, available, score] of [
  ['exact', 'en-us', 'en-us', 100], ['script', 'zh-tw', 'zh-hant', 80], ['regional fallback', 'en-au', 'en-us', 40], ['base fallback', 'en-au', 'en', 50],
  ['wrong language', 'en', 'ja', 0], ['script conflict', 'zh-hans', 'zh-hant', 0], ['absent', 'en', '', 0]
]) test('language private score ' + name, async check => { const actual = f.score(wanted, available); check(() => assert.equal(actual, score)); });
for (const [name, wanted, tracks, selected, expected] of [
  ['exact beats selected base', 'en-us', ['en', 'en-us'], [11], 12],
  ['compatible script beats generic', 'zh-tw', ['zh', 'zh-hant'], [], 12],
  ['generic beats other region', 'en-au', ['en-us', 'en'], [], 12],
  ['first equal remains stable', 'en', ['eng', 'en'], [], 11],
  ['selected equal wins', 'en', ['eng', 'en'], [12], 12],
  ['selected conflict never wins', 'zh-hant', ['zh-hans', 'zh-tw'], [11], 12],
  ['selected mismatch never matches', 'en', ['ja'], [11], 11],
  ['aliases retain metadata matching', ' ZHO ', ['en', 'chi'], [], 12]
]) test('language real player ' + name, async check => { const result = await f.playing(wanted, tracks, selected); check(() => { assert.equal(result.state, 'playing'); assert.equal(result.values.audioKey, 'native:' + expected); assert.deepEqual(result.values.errors, []); }); });
test('language real player conflicting script remains unmatched', async check => {
  const result = await f.playing('zh-hant', ['zh-hans']);
  check(() => { assert.equal(result.state, 'playing'); assert.equal(result.values.audioKey, ''); assert.deepEqual(result.calls.filter(c => c[0] === 'select'), []); });
});
test('language invalid persisted value preserves bytes and default issue', async check => {
  const raw = JSON.stringify(pref(tag(64))), native = await f.pref.api.getPreferences({ filesDir: f.h.directory }, { name: 'playback_languages' });
  await native.put('settings_v1', raw); await native.flush(); f.pref.state.instances.clear(); const store = await f.store();
  const bytes = require('node:fs').readFileSync(native.filename, 'utf8');
  check(() => { assert.deepEqual(store.snapshot(), pref('')); assert.equal(store.issue, 'playback_preferences_invalid'); assert.equal(JSON.parse(bytes).settings_v1, raw); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
