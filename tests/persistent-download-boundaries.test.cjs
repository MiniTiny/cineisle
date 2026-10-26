const f = require('./download-contract-fixture.cjs');
const { assert, fs, h, A, P, backend, record, observe, settle } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
async function binding(extra = {}, hooks = {}) {
  const b = backend(true, hooks), r = record(extra); let owned = true;
  A.downloads = [r];
  const save = () => b.local.saveDownloads([r]);
  const outcome = await observe(P.create(h.context, r, 'https://example.invalid/video', () => owned, save));
  return { ...b, r, outcome, save, owned: value => { owned = value; } };
}
for (const elapsed of [999, 1000, 1001]) test(`persistent interval ${elapsed}`, async check => {
  let now = 10000; Date.now = () => now; const b = await binding();
  if (!b.outcome.error) {
    await b.emit(b.made[0], 'progress', 10); now += elapsed; await b.emit(b.made[0], 'progress', 20);
  }
  const durable = b.local.downloads()[0];
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(b.saves.length, elapsed < 1000 ? 2 : 3); assert.equal(durable.received, elapsed < 1000 ? 10 : 20); });
});
for (const now of [0, 999, 1000, 1001, 1700000000000]) test(`persistent first event ${now}`, async check => {
  Date.now = () => now; const b = await binding();
  if (!b.outcome.error) await b.emit(b.made[0], 'progress', 25);
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(b.saves.length, now < 1000 ? 1 : 2); });
});
test('persistent unsaved events do not postpone next save', async check => {
  let now = 10000; Date.now = () => now; const b = await binding();
  if (!b.outcome.error) { await b.emit(b.made[0], 'progress', 10); now += 999; await b.emit(b.made[0], 'progress', 20); now++; await b.emit(b.made[0], 'progress', 30); }
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(b.saves.length, 3); assert.equal(b.local.downloads()[0].received, 30); });
});
test('persistent failed event save retains the original last-attempt clock', async check => {
  let now = 10000; Date.now = () => now; const b = await binding();
  const rename = f.io.renameSync; let first = true;
  f.io.renameSync = (...args) => { if (first) { first = false; throw Error('event rename failed'); } return rename(...args); };
  const failed = await observe(b.emit(b.made[0], 'progress', 10));
  now += 999; const early = await observe(b.emit(b.made[0], 'progress', 20)); const before = b.saves.length;
  now++; const due = await observe(b.emit(b.made[0], 'progress', 30));
  check(() => { assert.equal(failed.error?.message, 'event rename failed'); assert.equal(early.error, undefined); assert.equal(due.error, undefined); assert.equal(before, 1); assert.equal(b.saves.length, 2); assert.equal(b.local.downloads()[0].received, 30); });
});
for (const delay of [0, 999]) for (const state of [64, 65, 49, 80]) test(`persistent terminal ${state} at ${delay}`, async check => {
  let now = 10000; Date.now = () => now; const b = await binding();
  if (!b.outcome.error) {
    await b.emit(b.made[0], 'progress', 10); now += delay;
    if (state === 64) fs.writeFileSync(b.r.path, 'video');
    b.made[0].handlers[state === 64 ? 'completed' : 'failed']({ state, processed: 100, sizes: [100] });
  }
  const terminalSaves = b.saves.length, final = JSON.stringify(b.r);
  if (!b.outcome.error) { await b.emit(b.made[0], 'failed', 0); await b.emit(b.made[0], 'progress', 1); }
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(terminalSaves, 3); assert.equal(b.saves.length, terminalSaves); assert.equal(JSON.stringify(b.r), final); assert.equal(b.r.state, state === 64 ? 'complete' : 'failed'); assert.equal(b.local.downloads()[0].state, b.r.state); if (state !== 64) assert.equal(b.r.failure, 'download_failure_reason:' + state); });
});
test('persistent completed missing file remains missing', async check => {
  const b = await binding(); if (!b.outcome.error) b.made[0].handlers.completed({ state: 64, processed: 100, sizes: [100] });
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(b.r.state, 'missing'); assert.equal(b.r.progress, 0); assert.equal(b.local.downloads()[0].state, 'missing'); });
});
for (const count of [255, 256, 257]) for (const character of ['x', '中']) test(`persistent title ${character} ${count}`, async check => {
  const b = await binding({ item: f.item('movie', { Name: character.repeat(count) }) });
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(b.made[0].options.title, character.repeat(Math.min(count, 256))); });
});
test('persistent title truncates inside a UTF16 surrogate pair', async check => {
  const b = await binding({ item: f.item('movie', { Name: 'x'.repeat(255) + '😀Z' }) });
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(b.made[0].options.title, 'x'.repeat(255) + '\ud83d'); assert.equal(b.made[0].options.title.length, 256); });
});
for (const network of [undefined, { mobile: false, roaming: false }, { mobile: false, roaming: true }, { mobile: true, roaming: false }, { mobile: true, roaming: true }]) test(`persistent SDK options ${JSON.stringify(network)}`, async check => {
  const b = await binding({ network });
  check(() => {
    assert.equal(b.outcome.error, undefined);
    assert.deepEqual(b.made[0].options, { action: 17, url: 'https://example.invalid/video', title: 'movie', mode: 23, saveas: b.r.path, overwrite: true, network: network?.mobile ? 37 : 41, metered: !!network?.mobile, roaming: !!network?.mobile && !!network?.roaming, retry: true, redirect: false });
  });
});
test('persistent create binds after durable ID and before start', async check => {
  const b = backend(true), r = record(); A.downloads = [r];
  const result = await observe(P.create(h.context, r, 'https://example.invalid/video', () => true, () => { b.events.push('save:' + r.agentId); b.local.saveDownloads([r]); }));
  check(() => { assert.equal(result.error, undefined); assert.deepEqual(b.events, ['create', 'save:1', 'bind:progress', 'bind:completed', 'bind:failed', 'start']); assert.equal(b.local.downloads()[0].agentId, '1'); });
});
for (const entry of ['restore', 'poll']) test(`persistent ${entry} saves without event throttle`, async check => {
  Date.now = () => 100; const b = await binding();
  const result = b.outcome.error ? b.outcome : await observe(entry === 'restore' ? P.restore(h.context, b.r, () => true, b.save) : P.poll(b.r, () => true, b.save));
  check(() => { assert.equal(result.error, undefined); assert.equal(b.saves.length, 2); assert.equal(b.local.downloads()[0].received, 50); });
});
test('persistent restore binds progress path but terminal restore does not bind', async check => {
  const b = await binding(); for (const key of Object.keys(b.made[0].handlers)) delete b.made[0].handlers[key];
  const restored = await observe(P.restore(h.context, b.r, () => true, b.save));
  const binds = Object.keys(b.made[0].handlers); for (const key of binds) delete b.made[0].handlers[key];
  fs.writeFileSync(b.r.path, 'video'); f.api.agent.show = async () => ({ progress: { state: 64, processed: 100, sizes: [100] } });
  const complete = await observe(P.restore(h.context, b.r, () => true, b.save));
  check(() => { assert.equal(restored.error, undefined); assert.equal(complete.error, undefined); assert.deepEqual(binds, ['progress', 'completed', 'failed']); assert.deepEqual(Object.keys(b.made[0].handlers), []); assert.equal(b.r.state, 'complete'); });
});
test('persistent lost owner event cannot mutate or save', async check => {
  const b = await binding(); const before = JSON.stringify(b.r), saves = b.saves.length; b.owned(false);
  if (!b.outcome.error) await b.emit(b.made[0], 'progress', 75);
  check(() => { assert.equal(b.outcome.error, undefined); assert.equal(JSON.stringify(b.r), before); assert.equal(b.saves.length, saves); });
});
test('persistent lost owner while creating removes the task before ID save', async check => {
  const gate = h.deferred(), b = backend(true, { create: () => gate.promise }), r = record(); let owned = true, saves = 0;
  const pending = observe(P.create(h.context, r, 'https://example.invalid/video', () => owned, () => saves++)); await settle(); owned = false; gate.resolve(); const result = await pending;
  check(() => { assert.equal(result.error?.message, 'login_required'); assert.deepEqual(b.removed, ['1']); assert.equal(r.agentId, undefined); assert.equal(saves, 0); });
});
for (const entry of ['restore', 'poll']) test(`persistent ${entry} owner lost during show`, async check => {
  const gate = h.deferred(), b = backend(true, { show: () => gate.promise }), r = record({ agentId: '1' }); let owned = true, saves = 0;
  const pending = observe(entry === 'restore' ? P.restore(h.context, r, () => owned, () => saves++) : P.poll(r, () => owned, () => saves++));
  await settle(); owned = false; gate.resolve({ progress: { state: 32, processed: 50, sizes: [100] } }); await pending;
  check(() => { assert.equal(saves, 0); assert.equal(r.received, undefined); assert.equal(b.made.length, 0); });
});
test('persistent owner lost during getTask does not bind after initial restore save', async check => {
  const gate = h.deferred(), b = backend(true, { getTask: () => gate.promise }), r = record({ agentId: '1' }); let owned = true, saves = 0, binds = 0;
  const pending = observe(P.restore(h.context, r, () => owned, () => saves++)); await settle(); owned = false; gate.resolve({ on() { binds++; } }); const result = await pending;
  check(() => { assert.equal(result.error, undefined); assert.equal(saves, 1); assert.equal(r.received, 50); assert.equal(binds, 0); });
});
for (const phase of ['create', 'start', 'save', 'remove', 'show', 'getTask']) test(`persistent original ${phase} failure identity`, async check => {
  const error = Error('native or disk unavailable'), hooks = {};
  if (phase !== 'save') hooks[phase] = async () => { throw error; };
  if (['create', 'start', 'show', 'getTask'].includes(phase)) f.expectFailure('agent-' + phase);
  const b = backend(true, hooks), r = record({ agentId: phase === 'show' || phase === 'getTask' ? '1' : undefined });
  let result;
  if (phase === 'show' || phase === 'getTask') result = await observe(P.restore(h.context, r, () => true, () => {}));
  else result = await observe(P.create(h.context, r, 'https://example.invalid/video', () => phase !== 'remove', () => { if (phase === 'save') throw error; }));
  check(() => { assert.equal(result.error?.message, phase === 'save' || phase === 'start' ? 'download_create_failed' : error.message); if (phase === 'save' || phase === 'start' || phase === 'remove') assert.equal(b.removed.length, 1); });
});
if (require.main === module) f.run(tests, 'persistent download boundary').catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
