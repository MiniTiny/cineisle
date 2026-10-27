const f = require('./player-interaction-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
const verify = (check, result, action) => check(() => { assert.ifError(result.unexpected); action(result.value); });
for (const layer of ['lower', 'sdk']) {
  for (const [label, width, anchor, offset, expected] of [['forward', 400, 10000, 400, 100000], ['backward', 400, 110000, -400, 20000], ['half', 400, 10000, 200, 55000], ['wide', 800, 10000, 400, 55000], ['low-clamp', 400, 10000, -400, 0], ['high-clamp', 400, 110000, 400, 120000], ['recognition-edge', 400, 10000, 12, 12700]]) test(`${layer} pan ${label}`, async check => {
    const result = await f.invoke(layer, r => { r.beginPan(); r.preview(offset); const preview = r.snapshot(); r.endPan(); return { preview, end: r.snapshot() }; }, { width, anchor });
    verify(check, result, ({ preview, end }) => { assert.equal(preview.preview, expected); assert.deepEqual(preview.attempts, []); assert.deepEqual(end.attempts, [expected]); assert.deepEqual(end.seeks, [expected]); assert.equal(end.preview, -1); assert.deepEqual(end.errors, []); });
  });
  for (const width of [0, -1, 1]) test(`${layer} active pan resized width ${width}`, async check => {
    const result = await f.invoke(layer, r => { r.beginPan(); r.preview(12); r.p.surfaceWidth = width; r.preview(1); const preview = r.snapshot(); r.endPan(); return { preview, end: r.snapshot() }; });
    verify(check, result, ({ preview, end }) => { assert.equal(preview.preview, 100000); assert.deepEqual(end.attempts, [100000]); assert.deepEqual(end.seeks, [100000]); assert.deepEqual(end.errors, []); });
  });
  for (const reason of ['PIN', 'hidden', 'controls', 'cancel']) test(`${layer} pending pan cancelled by ${reason}`, async check => {
    const result = await f.invoke(layer, r => { r.beginPan(); r.preview(200); if (reason === 'PIN') f.AppLock.locked = true; else if (reason === 'hidden') r.p.visible = false; else if (reason === 'controls') r.p.controlsLocked = true; else r.p.cancelGesture(); r.endPan(); return r.snapshot(); });
    verify(check, result, value => { assert.deepEqual(value.attempts, []); assert.deepEqual(value.seeks, []); assert.equal(value.preview, -1); assert.deepEqual(value.errors, []); });
  });
  test(`${layer} repeated hold restores original speed`, async check => {
    const result = await f.invoke(layer, r => { r.hold(); r.hold(); const held = r.snapshot(); r.cancelHold(); return { held, end: r.snapshot(), configuration: r.gesture('LongPressGesture')?.args[0] }; }, { speed: 1.5 });
    verify(check, result, ({ held, end, configuration }) => { assert.equal(held.speed, 2); assert.equal(held.held, 1.5); assert.deepEqual(held.speeds, [4]); assert.equal(end.speed, 1.5); assert.equal(end.held, 0); assert.deepEqual(end.speeds, [4, 3]); assert.deepEqual(end.errors, []); if (layer === 'sdk') { assert.equal(configuration.fingers, 1); assert.equal(configuration.duration, 500); } });
  });
  for (const reason of ['PIN', 'hidden', 'paused']) test(`${layer} late hold blocked by ${reason}`, async check => {
    const result = await f.invoke(layer, r => { if (reason === 'PIN') f.AppLock.locked = true; else if (reason === 'hidden') r.p.visible = false; else r.p.state = 'paused'; r.hold(); return r.snapshot(); });
    verify(check, result, value => { assert.deepEqual(value.speeds, []); assert.equal(value.speed, 1); assert.equal(value.held, 0); assert.deepEqual(value.errors, []); });
  });
  for (const value of [0, 999, 1000, 1001, 120000]) test(`${layer} slider actual seek ${value}`, async check => {
    const result = await f.invoke(layer, r => { r.sliderChange(value, 0); r.sliderChange(value, 1); const moving = r.snapshot(); r.sliderChange(value, 2); return { moving, end: r.snapshot(), step: r.slider?.args[0].step }; });
    verify(check, result, ({ moving, end, step }) => { assert.equal(moving.sliderPreview, value); assert.deepEqual(moving.attempts, []); assert.deepEqual(end.attempts, [value]); assert.deepEqual(end.seeks, [value]); assert.equal(end.sliderPreview, -1); assert.deepEqual(end.errors, []); if (layer === 'sdk') assert.equal(step, 1000); });
  });
  for (const [label, value] of [['negative', -1], ['above', 120001], ['NaN', NaN], ['Infinity', Infinity]]) test(`${layer} slider rejects ${label}`, async check => {
    const result = await f.invoke(layer, r => { r.sliderChange(value, 3); return r.snapshot(); });
    verify(check, result, value => { assert.deepEqual(value.attempts, []); assert.deepEqual(value.seeks, []); assert.equal(value.sliderPreview, -1); assert.deepEqual(value.errors, []); });
  });
  test(`${layer} slider click keeps callback value unquantized`, async check => {
    const result = await f.invoke(layer, r => { r.sliderChange(1001, 3); return r.snapshot(); });
    verify(check, result, value => { assert.deepEqual(value.attempts, [1001]); assert.deepEqual(value.seeks, [1001]); assert.deepEqual(value.errors, []); });
  });
  test(`${layer} slider PIN during drag blocks commit`, async check => {
    const result = await f.invoke(layer, r => { r.sliderChange(1000, 0); f.AppLock.locked = true; r.sliderChange(1000, 2); return r.snapshot(); });
    verify(check, result, value => { assert.deepEqual(value.attempts, []); assert.deepEqual(value.seeks, []); assert.equal(value.sliderPreview, -1); assert.deepEqual(value.errors, []); });
  });
}
test('sdk hold end restores original speed', async check => {
  const result = await f.invoke('sdk', r => { r.hold(); r.gesture('LongPressGesture').callbacks.onActionEnd(); return r.snapshot(); }, { speed: 1.25 });
  verify(check, result, value => { assert.deepEqual(value.speeds, [4, 2]); assert.equal(value.speed, 1.25); assert.equal(value.held, 0); assert.deepEqual(value.errors, []); });
});
test('sdk hold without a finger does not start a boost', async check => {
  const result = await f.invoke('sdk', r => { r.gesture('LongPressGesture').callbacks.onAction({ fingerList: [] }); return r.snapshot(); });
  verify(check, result, value => { assert.deepEqual(value.speeds, []); assert.equal(value.held, 0); assert.deepEqual(value.errors, []); });
});
test('lower preview rejects nonfinite offsets without replacing the anchor', async check => {
  const result = await f.invoke('lower', r => { r.beginPan(); r.preview(NaN); r.preview(Infinity); const preview = r.snapshot(); r.endPan(); return { preview, end: r.snapshot() }; });
  verify(check, result, ({ preview, end }) => { assert.equal(preview.preview, 10000); assert.deepEqual(end.attempts, [10000]); assert.deepEqual(end.seeks, [10000]); assert.deepEqual(end.errors, []); });
});
for (const dx of [-11, 0, 11]) test('sdk pan below recognition distance ' + dx, async check => {
  const result = await f.invoke('sdk', r => { r.beginPan(); r.preview(dx); r.endPan(); return { state: r.snapshot(), configuration: r.gesture('PanGesture').args[0] }; });
  verify(check, result, ({ state, configuration }) => { assert.deepEqual(state.attempts, []); assert.deepEqual(state.seeks, []); assert.equal(configuration.distance, 12); assert.deepEqual(state.errors, []); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
