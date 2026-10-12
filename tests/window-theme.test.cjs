// Execute the real UIAbility lifecycle with explicit window SDK fixtures.
const assert = require('node:assert/strict');
const h = require('./player-regression.test.cjs');
const EntryAbility = h.load('entryability/EntryAbility.ets').default;
const tests = [], test = (name, fn) => tests.push([name, fn]);
const theme = JSON.parse(require('node:fs').readFileSync('entry/src/main/resources/base/element/color.json')).color;
const color = name => theme.find(x => x.name === name).value;
function stage(options = {}) {
  const calls = []; let complete;
  const value = {
    loadContent(path, callback) { calls.push(['load', path]); complete = callback; },
    async getMainWindow() { calls.push(['window']); if (options.failWindow) throw new Error('window unavailable'); return {
      setWindowBackgroundColor(value) { calls.push(['background', value]); },
      async setWindowSystemBarProperties(value) { calls.push(['bars', value]); if (options.failBars) throw new Error('bars unavailable'); }
    }; }
  };
  const ability = new EntryAbility();
  ability.context = { getApplicationContext: () => ({ setColorMode: value => calls.push(['mode', value]) }) };
  return { ability, value, calls, complete: error => complete(error) };
}
test('theme waits for content completion and paints gesture background before system bars', async () => {
  const s = stage(); s.ability.onWindowStageCreate(s.value);
  assert.deepEqual(s.calls, [['load', 'pages/Index']]);
  s.complete({ code: 0 }); await h.settle();
  assert.deepEqual(s.calls.map(c => c[0]), ['load', 'window', 'mode', 'background', 'bars']);
  assert.equal(s.calls[2][1], h.platform.get('@ohos.app.ability.ConfigurationConstant').ColorMode.COLOR_MODE_DARK);
  assert.equal(s.calls[3][1], color('brand_surface_raised'));
  const props = s.calls[4][1];
  assert.equal(props.statusBarColor, color('brand_background'));
  assert.equal(props.navigationBarColor, color('brand_surface_raised'));
  assert.equal(props.statusBarContentColor, '#F2F3FA');
  assert.equal(props.navigationBarContentColor, '#F2F3FA');
});
test('failed content does not access an unready window', async () => {
  const s = stage(); s.ability.onWindowStageCreate(s.value); s.complete({ code: 1300002 }); await h.settle();
  assert.equal(s.calls.length, 1);
});
test('destroyed or unavailable main window leaves lifecycle completion safe', async () => {
  const s = stage({ failWindow: true }); s.ability.onWindowStageCreate(s.value); s.complete({ code: 0 }); await h.settle();
  assert.deepEqual(s.calls.map(c => c[0]), ['load', 'window']);
});
test('unsupported system bar capability preserves the already-painted window background', async () => {
  const s = stage({ failBars: true }); s.ability.onWindowStageCreate(s.value); s.complete({ code: 0 }); await h.settle();
  assert.equal(s.calls[3][1], color('brand_surface_raised'));
});
(async () => { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} window theme regression tests passed. SDK fixtures do not prove device pixels.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
