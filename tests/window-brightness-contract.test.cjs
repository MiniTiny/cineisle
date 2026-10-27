const f = require('./window-brightness-fixture.cjs'), { assert, h, windowState } = f, tests = [], test = (name, action) => tests.push({ name, action });
for (const [label, value, expected] of [['negative sentinel', -1, .5], ['other negative', -.1, .5], ['negative infinity', -Infinity, .5], ['zero', 0, 0], ['positive', .7, .7], ['one', 1, 1], ['NaN', NaN, .5], ['infinity', Infinity, Infinity], ['missing', undefined, .5], ['null', null, .5]]) test('window original brightness ' + label, async check => {
  const r = await f.lower(value, (w, errors) => ({ value: w.brightness, errors: [...errors] }));
  check(() => { assert.equal(r.value, expected); assert.deepEqual(r.errors, []); assert.ok(f.trace().calls['window-read'] >= 1); });
});
test('window initial brightness fallback precedes any platform read', async check => {
  const { PlaybackWindow } = h.load('service/PlaybackWindow.ets'), w = new PlaybackWindow(h.systemPlatform.context, () => {}), value = w.brightness, reads = f.trace().calls['window-read'] || 0; await w.dispose();
  check(() => { assert.equal(value, .5); assert.equal(reads, 0); });
});
test('window applied brightness takes precedence and restores original negative mode', async check => {
  const r = await f.lower(-1, async (w, errors) => { const before = w.brightness, changed = await w.setBrightness(.7), after = w.brightness; windowState.main.props.brightness = .2; const retained = w.brightness; await w.dispose(); return { before, changed, after, retained, closed: w.brightness, restored: windowState.main.props.brightness, errors: [...errors] }; });
  check(() => { assert.deepEqual(r, { before: .5, changed: true, after: .7, retained: .7, closed: .5, restored: -1, errors: [] }); assert.deepEqual(windowState.calls.filter(c => c[0] === 'brightness'), [['brightness', .7], ['brightness', -1]]); });
});
test('Player brightness gesture reads actual window fallback', async check => {
  const r = await f.page(); r.p.surfaceWidth = 400; r.p.surfaceHeight = 300; r.p.beginPan(60, 100); r.p.updatePan(0, -30); await h.settle(); const start = r.p.displayAnchor; r.p.endPan(); await h.settle();
  check(() => { assert.equal(start, .5); assert.equal(r.p.windowBrightness, .6); assert.ok(windowState.calls.some(c => c[0] === 'brightness' && c[1] === .6)); assert.equal(r.p.message, ''); assert.ok(f.trace().calls['window-read'] >= 1); });
});
test('Player rejected brightness write retains original feedback and fallback', async check => {
  const r = await f.page(); windowState.failures.add('brightness'); await r.p.changeBrightness(.7, true);
  check(() => { assert.equal(r.p.windowBrightness, .5); assert.equal(r.p.message, 'brightness_failed:'); assert.equal(r.store.snapshot().playerUi.brightness, -1); assert.ok(f.trace().calls['window-read'] >= 1); assert.ok(f.trace().calls['brightness-write'] >= 1); });
});
test('Player gesture reads the applied window rather than stale view brightness', async check => {
  const r = await f.page(); await r.p.window.setBrightness(.7); const published = r.p.windowBrightness;
  r.p.surfaceWidth = 400; r.p.surfaceHeight = 300; r.p.beginPan(60, 100); r.p.updatePan(0, -30); await h.settle();
  const anchor = r.p.displayAnchor; r.p.endPan(); await h.settle();
  check(() => { assert.equal(published, .5); assert.equal(anchor, .7); assert.ok(Math.abs(r.p.windowBrightness - .8) < 1e-12); assert.equal(r.p.message, ''); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
