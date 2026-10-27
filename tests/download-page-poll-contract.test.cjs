const f = require('./download-page-poll-fixture.cjs'), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
const number = (state, key) => state.calls[key] || 0;
const checked = (check, result, action) => check(() => { assert.ifError(result.unexpected); action(result.value); });
for (const layer of ['lower', 'sdk']) for (const backend of ['legacy', 'agent']) {
  const prefix = layer + ' ' + backend, query = backend === 'agent' ? 'agent-query' : 'task-query';
  test(prefix + ' first interval 999 1000 1001', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); const initial = r.snapshot(); await f.clock().advance(999); const before = r.snapshot(); await f.clock().advance(1); const at = r.snapshot(); await f.clock().advance(1); return { initial, before, at, after: r.snapshot() }; });
    checked(check, result, ({ initial, before, at, after }) => { assert.deepEqual(initial.periods, [1000]); assert.equal(initial.timer, 0); assert.equal(number(initial, 'poll'), 0); assert.equal(initial.changes, 1); assert.equal(number(before, query), 0); assert.equal(number(before, 'poll'), 0); for (const state of [at, after]) { assert.equal(number(state, 'poll'), 1); assert.equal(number(state, query), 1); assert.equal(state.progress, .5); assert.equal(state.cold[0].progress, .5); assert.equal(state.changes, 2); assert.equal(state.message, ''); } });
  });
  test(prefix + ' repeat cadence keeps production queries', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); await f.clock().advance(3000); return r.snapshot(); });
    checked(check, result, state => { assert.equal(number(state, 'poll'), 3); assert.equal(number(state, query), 3); assert.equal(state.changes, 4); assert.equal(state.cold[0].received, 50); });
  });
  test(prefix + ' repeated show replaces zero timer and resets deadline', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); await f.clock().advance(500); r.show(); await f.clock().advance(999); const before = r.snapshot(); await f.clock().advance(1); return { before, at: r.snapshot() }; });
    checked(check, result, ({ before, at }) => { assert.deepEqual(before.periods, [1000, 1000]); assert.deepEqual(before.timers, [1]); assert.equal(number(before, 'poll'), 0); assert.equal(number(at, 'poll'), 1); assert.equal(number(at, query), 1); assert.equal(at.changes, 3); });
  });
  for (const action of ['hide', 'disappear']) test(prefix + ' ' + action + ' stops scheduled queries', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); r[action](); await f.clock().advance(2000); return r.snapshot(); });
    checked(check, result, state => { assert.equal(state.timer, -1); assert.deepEqual(state.timers, []); assert.equal(state.listenerAbsent, true); assert.equal(number(state, 'poll'), 0); assert.equal(number(state, query), 0); assert.equal(state.cold[0].progress, 0); });
  });
  test(prefix + ' show after hide restarts once and restores listener', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); await f.clock().advance(500); r.hide(); await f.clock().advance(1500); const hidden = r.snapshot(); r.show(); await f.clock().advance(999); const before = r.snapshot(); await f.clock().advance(1); return { hidden, before, at: r.snapshot() }; });
    checked(check, result, ({ hidden, before, at }) => { assert.equal(number(hidden, query), 0); assert.equal(hidden.listenerAbsent, true); assert.equal(hidden.timer, -1); assert.deepEqual(before.timers, [1]); assert.equal(before.listener, true); assert.equal(number(before, query), 0); assert.equal(number(at, query), 1); assert.equal(at.changes, 3); assert.equal(at.cold[0].progress, .5); });
  });
  test(prefix + ' unsubscribe independently blocks core poll notifications', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); r.hide(); await f.A.pollDownloads(); return r.snapshot(); });
    checked(check, result, state => { assert.deepEqual(state.timers, []); assert.equal(number(state, query), 1); assert.equal(state.cold[0].progress, .5); assert.equal(state.listenerAbsent, true); assert.equal(state.changes, 1); });
  });
  test(prefix + ' hide during query permits core save without page notification', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); const gate = f.defer(); await f.clock().advance(1000); r.hide(); gate.resolve(); await f.clock().advance(1000); return r.snapshot(); });
    checked(check, result, state => { assert.equal(number(state, 'poll'), 1); assert.equal(number(state, query), 1); assert.equal(state.cold[0].progress, .5); assert.equal(state.changes, 1); assert.equal(state.listenerAbsent, true); });
  });
  test(prefix + ' already queued callback retains original post-hide behavior', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); const callback = f.clock().jobs.get(r.p.timer).callback; r.hide(); callback(); await f.clock().advance(0); return r.snapshot(); });
    checked(check, result, state => { assert.deepEqual(state.timers, []); assert.equal(number(state, query), 1); assert.equal(state.cold[0].progress, .5); assert.equal(state.changes, 1); });
  });
  test(prefix + ' unavailable query preserves silent event-stream authority', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.p.message = 'existing feedback'; r.show(); f.env().unavailable = true; await f.clock().advance(1000); return r.snapshot(); });
    checked(check, result, state => { assert.equal(number(state, query), 1); assert.equal(state.progress, 0); assert.equal(state.cold[0].progress, 0); assert.equal(state.message, 'existing feedback'); assert.equal(state.changes, 1); });
  });
  test(prefix + ' old page hide preserves newer listener and interval', async check => {
    const result = await f.invoke(async () => { const first = await f.page(layer, backend); first.show(); const second = await f.page(layer, backend, false); second.show(); first.hide(); await f.clock().advance(1000); return { old: first.snapshot(), next: second.snapshot() }; });
    checked(check, result, ({ old, next }) => { assert.deepEqual(next.timers, [1]); assert.equal(old.changes, 1); assert.equal(next.changes, 2); assert.equal(next.listener, true); assert.equal(number(next, query), 1); });
  });
  test(prefix + ' account mismatch leaves without starting a timer', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); f.h.activate('other'); r.show(); await f.clock().advance(1000); return r.snapshot(); });
    checked(check, result, state => { assert.equal(state.records, 0); assert.equal(state.backs, 1); assert.deepEqual(state.timers, []); assert.equal(number(state, 'poll'), 0); assert.equal(number(state, 'subscribe'), 0); });
  });
  test(prefix + ' late old-account query cannot persist into either account', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); const gate = f.defer(); await f.clock().advance(1000); f.h.activate('other'); gate.resolve(); await f.clock().advance(0); return { old: r.snapshot(), next: f.A.local.downloads() }; });
    checked(check, result, ({ old, next }) => { assert.equal(number(old, query), 1); assert.equal(old.progress, 0); assert.equal(old.cold[0].progress, 0); assert.equal(next.length, 0); });
  });
  test(prefix + ' overlapping ticks coalesce native query work', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); const gate = f.defer(); await f.clock().advance(2000); const waiting = r.snapshot(); gate.resolve(); await f.clock().advance(0); return { waiting, done: r.snapshot() }; });
    checked(check, result, ({ waiting, done }) => { assert.equal(number(waiting, 'poll'), 2); assert.equal(number(waiting, query), 1); assert.equal(waiting.progress, 0); assert.equal(done.cold[0].progress, .5); assert.equal(done.changes, 2); });
  });
  test(prefix + ' native completion and existing path persist complete state', async check => {
    const result = await f.invoke(async () => { const r = await f.page(layer, backend); r.show(); f.env().bytes = 100; f.env().status = 8; f.env().state = 64; await f.clock().advance(1000); return r.snapshot(); });
    checked(check, result, state => { assert.equal(state.state, 'complete'); assert.equal(state.progress, 1); assert.equal(state.cold[0].state, 'complete'); assert.equal(state.cold[0].progress, 1); assert.equal(state.changes, 2); });
  });
}
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
