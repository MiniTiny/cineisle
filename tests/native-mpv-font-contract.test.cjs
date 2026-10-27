const fixture = require('./native-mpv-font-fixture.cjs');
if (!process.argv.includes('--child')) fixture.host(__filename);
else {
  const f = fixture.make(), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
  const checked = (check, result, verify) => check(() => { assert.ifError(result.error); verify(result.value); });
  for (const layer of ['core', 'N-API']) {
    for (const value of [54, 55, 56, 110, 0, -1, NaN, Infinity, -Infinity]) test(`${layer} actual font property ${value}`, async check => {
      const result = await f.scenario(layer, { subtitleFontSize: value }, async r => ({ state: await r.snapshot(), inspection: r.inspect() }));
      checked(check, result, ({ state, inspection }) => { assert.equal(state.subtitleFontSize, Number.isFinite(value) ? value : 55); assert.equal(state.error, 0); assert.equal(inspection.unavailableFontReads, 0); assert.ok(inspection.propertyReads.includes('sub-font-size')); });
    });
    for (const poison of [0, 110, NaN]) test(`${layer} unavailable font ignores output ${poison}`, async check => {
      const result = await f.scenario(layer, { subtitleFontAvailable: false, subtitleFontSize: poison }, async r => ({ state: await r.snapshot(), inspection: r.inspect() }));
      checked(check, result, ({ state, inspection }) => { assert.equal(state.subtitleFontSize, 55); assert.equal(state.error, 0); assert.ok(inspection.unavailableFontReads >= 1); assert.ok(inspection.propertyReads.includes('sub-font-size')); });
    });
  }
  test('native initial state retains font 55 independently of property reads', async check => { const state = f.n.initialState(), reads = f.n.inspect().propertyReads; check(() => { assert.equal(state.subtitleFontSize, 55); assert.deepEqual(reads, []); }); });
  test('ArkTS initial snapshot retains font 55 before native polling', async check => { const p = await f.initialEngine(); check(() => { assert.equal(p.value.subtitleFontSize, 55); assert.equal(p.state, 'idle'); assert.deepEqual(f.n.inspect().propertyReads, []); }); });
  for (const [label, options, scale] of [['unavailable', { subtitleFontAvailable: false, subtitleFontSize: 110 }, 2], ['nonfinite', { subtitleFontSize: NaN }, 2], ['available', { subtitleFontSize: 110 }, 1]]) test(`actual native to ArkTS font ${label}`, async check => {
    const result = await f.engine(options, async ({ r, p, snapshots, inspect }) => ({ info: r.events.filter(e => e[0] === 'subtitle').at(-1)?.[1], native: p.nativeSubtitles, errors: r.events.filter(e => e[0] === 'error'), state: snapshots.at(-1), inspection: inspect() }));
    checked(check, result, r => { assert.equal(r.state.subtitleFontSize, scale === 1 ? 110 : 55); assert.equal(r.native, false); assert.deepEqual(r.errors, []); assert.equal(r.info.text, 'Font'); assert.equal(r.info.content.runs[0].sizeScale, scale); assert.equal(r.info.startTime, 500); assert.equal(r.info.duration, 3000); assert.equal(r.inspection.unavailableFontReads > 0, label === 'unavailable'); });
  });
  test('unchanged native events recompute and republish after font property changes', async check => {
    const result = await f.engine({ subtitleFontAvailable: false, subtitleFontSize: 110 }, async ({ r, p, configure }) => {
      const before = r.events.filter(e => e[0] === 'subtitle').at(-1)?.[1]; r.events.length = 0;
      configure({ subtitleFontSize: 110 }); await p.refresh(); const after = r.events.filter(e => e[0] === 'subtitle').at(-1)?.[1];
      return { before, after, native: p.nativeSubtitles, errorCount: r.events.filter(e => e[0] === 'error').length };
    });
    checked(check, result, r => { assert.equal(r.before?.text, 'Font'); assert.equal(r.after?.text, 'Font'); assert.equal(r.before.content.runs[0].sizeScale, 2); assert.equal(r.after.content.runs[0].sizeScale, 1); assert.equal(r.before.content.revision, r.after.content.revision); assert.equal(r.native, false); assert.equal(r.errorCount, 0); });
  });
  for (const value of [0, -1]) test(`actual native to ArkTS nonpositive font ${value} retains renderer`, async check => {
    const result = await f.engine({ subtitleFontSize: value }, async ({ r, p, snapshots }) => ({ state: snapshots.at(-1), native: p.nativeSubtitles, info: r.events.filter(e => e[0] === 'subtitle').at(-1)?.[1] }));
    checked(check, result, r => { assert.equal(r.state.subtitleFontSize, value); assert.equal(r.native, true); assert.equal(r.info.content, undefined); });
  });
  f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
}
