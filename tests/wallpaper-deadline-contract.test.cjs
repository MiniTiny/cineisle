const f = require('./wallpaper-contract-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
async function begin(mode) { const source = mode === 'lower' ? f.source() : undefined; const work = mode === 'lower' ? f.read(source).state : f.attach(); await f.settle(); return { source, work }; }
for (const mode of ['lower', 'attach']) {
  for (const at of [1499, 1500, 1501]) test(`${mode} wallpaper deadline ${at}`, async check => {
    f.response(() => new Promise(() => {})); const { work } = await begin(mode); await f.time().advance(at); const state = work(), stats = f.stats();
    check(() => { assert.ifError(state.error); assert.equal(state.settled, at >= 1500); assert.equal(stats.reads, 1); assert.deepEqual(stats.scheduled, [1500]); assert.equal(stats.timers, at < 1500 ? 1 : 0); if (mode === 'attach') { assert.equal(stats.status, at < 1500 ? undefined : 'dynamic_colors_fallback'); assert.equal(stats.issue, ''); } });
  });
  for (const at of [1499, 1500, 1501]) test(`${mode} wallpaper completion first at ${at}`, async check => {
    f.response(() => new Promise(resolve => setTimeout(() => resolve(f.colors()), at)));
    const { work } = await begin(mode); await f.time().advance(at); const state = work(), stats = f.stats();
    check(() => { assert.ifError(state.error); assert.equal(state.settled, true); assert.equal(stats.reads, 1); if (mode === 'lower') assert.equal(state.value?.seed, at <= 1500 ? '#1E78C8' : undefined); else assert.equal(stats.status, at <= 1500 ? 'dynamic_colors_active' : 'dynamic_colors_fallback'); assert.equal(stats.timers, 0); });
  });
  test(`${mode} wallpaper deadline wins an equal-time later callback`, async check => {
    const gate = f.h.deferred(); f.response(() => gate.promise); const { work } = await begin(mode);
    setTimeout(() => gate.resolve(f.colors()), 1500); await f.time().advance(1500); const state = work(), stats = f.stats();
    check(() => { assert.ifError(state.error); assert.equal(state.settled, true); if (mode === 'lower') assert.equal(state.value, undefined); else assert.equal(stats.status, 'dynamic_colors_fallback'); assert.equal(stats.timers, 0); });
  });
}
test('lower wallpaper cancellation preserves the shared native RPC and other ticket', async check => {
  const gate = f.h.deferred(); f.response(() => gate.promise); const source = f.source(), a = f.read(source), b = f.read(source); await f.settle(); a.ticket.cancel(); await f.settle(); const cancelled = a.state(), pending = b.state(), before = f.stats(); gate.resolve(f.colors()); await f.settle(); const done = b.state(), after = f.stats();
  check(() => { assert.equal(cancelled.settled, true); assert.equal(cancelled.value, undefined); assert.equal(pending.settled, false); assert.equal(before.reads, 1); assert.equal(before.timers, 1); assert.equal(done.value?.seed, '#1E78C8'); assert.equal(after.reads, 1); assert.equal(after.timers, 0); });
});
test('lower wallpaper ownership change rejects a response without changing revision', async check => {
  const gate = f.h.deferred(); f.response(() => gate.promise); let allowed = true; const r = f.read(f.source(), () => allowed); allowed = false; gate.resolve(f.colors()); await f.settle(); const state = r.state();
  check(() => { assert.equal(state.settled, true); assert.equal(state.value, undefined); assert.equal(f.stats().reads, 1); });
});
test('lower wallpaper stop rejects the pending reply', async check => {
  const gate = f.h.deferred(); f.response(() => gate.promise); const source = f.source(), r = f.read(source); source.stop(); gate.resolve(f.colors()); await f.settle(); const state = r.state(), stats = f.stats();
  check(() => { assert.equal(state.settled, true); assert.equal(state.value, undefined); assert.equal(stats.timers, 0); });
});
test('lower wallpaper event supersedes pending native data without a second RPC', async check => {
  const gate = f.h.deferred(); f.response(() => gate.promise); const source = f.source(), events = []; source.start(value => events.push(value)); const old = f.read(source); f.emit([{ red: 255, green: 0, blue: 0, alpha: 255 }]); const latest = f.read(source); gate.resolve(f.colors()); await f.settle(); const a = old.state(), b = latest.state(), stats = f.stats();
  check(() => { assert.equal(a.value, undefined); assert.equal(b.value?.seed, '#FF0000'); assert.equal(events[0]?.seed, '#FF0000'); assert.equal(stats.reads, 1); assert.equal(stats.timers, 0); });
});
test('attach wallpaper background cancels publication and foreground retries after the old reply', async check => {
  const gate = f.h.deferred(); f.response(() => gate.promise); const initial = f.attach(); await f.settle(); f.A.background(); await f.settle(); gate.resolve(f.colors()); await f.settle(); const cancelled = initial(), before = f.stats(); f.response(async () => f.colors()); f.A.foreground(); await f.settle(); await f.A.writes; const after = f.stats();
  check(() => { assert.equal(cancelled.error?.message, 'appearance_cancelled'); assert.equal(before.status, undefined); assert.equal(after.status, 'dynamic_colors_active'); assert.equal(after.reads, 2); assert.equal(after.issue, ''); assert.equal(after.timers, 0); });
});
for (const mode of ['lower', 'attach']) test(`${mode} wallpaper unavailable capability avoids native reads and timers`, async check => {
  f.h.capabilities.delete('SystemCapability.MiscServices.Wallpaper'); const { work } = await begin(mode); const state = work(), stats = f.stats();
  check(() => { assert.ifError(state.error); assert.equal(state.settled, true); assert.equal(stats.reads, 0); assert.equal(stats.timers, 0); if (mode === 'attach') assert.equal(stats.status, 'dynamic_colors_fallback'); else assert.equal(state.value, undefined); });
});
test('lower wallpaper denied ownership avoids native reads', async check => {
  const r = f.read(f.source(), () => false); await f.settle(); const state = r.state(), stats = f.stats();
  check(() => { assert.equal(state.settled, true); assert.equal(state.value, undefined); assert.equal(stats.reads, 0); assert.equal(stats.timers, 0); });
});
test('lower wallpaper stop and reattach reject callbacks from the old listener epoch', async check => {
  const source = f.source(), values = []; source.start(p => values.push(p)); source.stop(); source.start(p => values.push(p));
  f.emit(f.colors(), 0, 0); const oldCount = values.length; f.emit([{ red: 255, green: 0, blue: 0, alpha: 255 }]);
  check(() => { assert.equal(oldCount, 0); assert.equal(values.length, 1); assert.equal(values[0].seed, '#FF0000'); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
