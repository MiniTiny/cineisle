const f = require('./poster-options-fixture.cjs'), { assert } = f;
const { PosterOptionRules } = f.h.load('utils/PosterOptions.ts');
const tests = [], test = (name, action) => tests.push({ name, action });
const samples = [['1', 1], ['12', 12], ['123', 123], ['001', 1], ['0001', undefined], ['', undefined], [' 5', undefined],
  ['1.5', undefined], ['1e2', undefined], ['0x5', undefined], ['123\n', undefined], ['1\r\n', undefined], ['1\u2028', undefined]];
for (const [draft, expected] of samples) {
  test('poster draft grammar ' + JSON.stringify(draft), async check => check(() => assert.equal(PosterOptionRules.validCapacityDraft(draft), expected !== undefined)));
  test('poster draft actual input ' + JSON.stringify(draft), async check => {
    const state = f.p.preferences.state;
    // Fail inside the native stand-in itself; classification must rely on observed errors, not an injection tag.
    if (process.argv.includes('--unannounced-prefs-open')) state.failOpen = true;
    if (process.argv.includes('--unannounced-prefs-get')) state.failGet = true;
    const cache = await f.cache(), { render, flat, button } = f.ui();
    const r = render('Settings', { deviceVisible: true, posterCache: cache }); r.view.ownerClient = r.AppService.client;
    const input = flat(r.roots).find(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.poster_cache_capacity');
    input.attrs.onChange[0](draft);
    if (process.argv.includes('--unannounced-prefs-flush')) state.failFlush = 1;
    await button(r, 'poster_options_save').attrs.onClick[0]();
    const calls = state.calls.slice(), snapshot = cache.snapshot();
    check(() => {
      assert.equal(input.attrs.maxLength[0], 3); assert.equal(r.view.posterCapacity, expected === undefined ? draft : String(expected));
      assert.equal(r.view.posterBusy, false);
      if (expected === undefined) { assert.equal(snapshot.maxMb, 20); assert.equal(r.view.posterMessage, 'poster_options_invalid'); assert.equal(calls.filter(c => c[0] === 'put').length, 0); }
      else { assert.equal(snapshot.maxMb, expected); assert.equal(r.view.posterMessage, 'poster_options_saved');
        const file = JSON.parse(require('node:fs').readFileSync(require('node:path').join(f.h.directory, 'poster_options.fixture.json'), 'utf8'));
        assert.equal(file.settings_v1, JSON.stringify({ enabled: true, maxMb: expected })); }
    });
  });
}
test('poster draft disabled ignores malformed input in production button', async check => {
  const cache = await f.cache(), { render, flat, button } = f.ui(); const r = render('Settings', { deviceVisible: true, posterCache: cache, posterEnabled: false }); r.view.ownerClient = r.AppService.client;
  const input = flat(r.roots).find(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.poster_cache_capacity'); input.attrs.onChange[0]('0001');
  await button(r, 'poster_options_save').attrs.onClick[0](); check(() => { assert.equal(cache.snapshot().maxMb, 20); assert.equal(cache.snapshot().enabled, false); assert.equal(r.view.posterMessage, 'poster_options_saved'); });
});
if (require.main === module) f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
