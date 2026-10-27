const f = require('./palette-rule-fixture.cjs'), { assert } = f, vectors = require('./dynamic-palette-golden.json');
const tests = [], test = (name, action) => tests.push({ name, action });
const rgba = rgb => ({ red: rgb[0], green: rgb[1], blue: rgb[2], alpha: 255 });
async function attached(colors) { f.response(async () => colors); const work = f.attach(); await f.settle(); await f.A.writes; return { state: work(), stats: f.stats() }; }
for (const mode of ['pure', 'attach']) for (const vector of vectors) test(`${mode} palette golden ${vector.rgb.join(',')}`, async check => {
  const input = [rgba(vector.rgb)];
  if (mode === 'pure') { const value = f.palette(input); check(() => assert.deepEqual(value, vector.expected)); return; }
  const { state, stats } = await attached(input);
  check(() => { assert.ifError(state.error); assert.equal(state.settled, true); assert.equal(stats.reads, 1); assert.equal(stats.status, 'dynamic_colors_active'); assert.equal(stats.palette.dynamic, true);
    for (const [key, value] of Object.entries(vector.expected)) if (key !== 'seed') assert.equal(stats.palette[key], value, key);
    assert.equal(stats.events[0][0], 'background'); assert.equal(stats.events[0][1], vector.expected.raised); assert.equal(stats.events[1][0], 'bars'); assert.equal(stats.events[1][1].statusBarColor, vector.expected.background); assert.equal(stats.events[1][1].navigationBarColor, vector.expected.raised); assert.equal(stats.events[2][0], 'publish');
    assert.equal(stats.issue, ''); assert.equal(f.prefs.state.calls.filter(c => c[0] === 'put' || c[0] === 'flush').length, 0);
  });
});
for (const mode of ['pure', 'attach']) for (const n of [15, 16, 17]) test(`${mode} palette swatches ${n}`, async check => {
  const colors = Array.from({ length: n }, () => ({ red: 0, green: 0, blue: 0, alpha: 0 })); colors[n - 1] = rgba([30, 120, 200]);
  if (mode === 'pure') { const value = f.palette(colors); check(() => assert.equal(value?.seed, n <= 16 ? '#1E78C8' : undefined)); }
  else { const { state, stats } = await attached(colors); check(() => { assert.ifError(state.error); assert.equal(stats.reads, 1); assert.equal(stats.status, n <= 16 ? 'dynamic_colors_active' : 'dynamic_colors_fallback'); assert.equal(stats.palette.dynamic, n <= 16); assert.equal(stats.issue, ''); }); }
});
test('private readable adjustment budget is exactly 32 with a bounded oracle', async check => {
  const result = f.readable('#FFFFFF', true);
  check(() => { assert.equal(result.value, '#FFFFFF'); assert.equal(result.blends.length, 32); assert.equal(result.comparisons, 32); assert.ok(result.blends.every(b => b.target === '#FFFFFF' && b.weight === 0.12)); });
});
test('private action adjustment budget is independently 32 with a bounded oracle', async check => {
  const result = f.actionCap();
  check(() => { assert.equal(result.blends.length, 32); assert.equal(result.comparisons, 32); assert.ok(result.blends.every(b => b.weight === 0.12)); });
});
for (const [input, expected, count] of [['#737373', '#848484', 1], ['#777777', '#777777', 0]]) test('private readable actual contrast ' + input, async check => {
  const result = f.readable(input);
  check(() => { assert.equal(result.value, expected); assert.equal(result.blends.length, count); assert.ok(result.blends.every(b => b.weight === 0.12)); });
});
test('published palette reaches actual SDK Settings semantic color bindings', async check => {
  const vector = vectors.find(v => v.rgb.join(',') === '30,120,200'), { state, stats } = await attached([rgba(vector.rgb)]), u = f.ui();
  const view = f.trace().call('ui-render', () => u.render('Settings', { palette: stats.palette, locked: false })); const nodes = u.flat(view.roots);
  const backgrounds = nodes.filter(n => n.attrs.backgroundColor).map(n => n.attrs.backgroundColor[0]);
  check(() => { assert.ifError(state.error); assert.ok(backgrounds.includes(vector.expected.background)); assert.ok(backgrounds.includes(vector.expected.raised)); assert.ok(nodes.some(n => n.attrs.fontColor?.[0] === vector.expected.muted)); assert.equal(stats.status, 'dynamic_colors_active'); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
