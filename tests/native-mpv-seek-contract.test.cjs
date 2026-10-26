const fixture = require('./native-mpv-seek-fixture.cjs');
if (!process.argv.includes('--child')) fixture.host(__filename);
else {
  const f = fixture.make(), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
  const checked = (check, result, verify) => check(() => { assert.ifError(result.error); verify(result.value); });
  for (const layer of ['N-API', 'core']) {
    for (const delta of [-1001, -1000, -999, 0, 999, 1000, 1001]) test(`${layer} seek distance ${delta}`, async check => {
      const result = await f.scenario(layer, async r => {
        r.configure({ positionSeconds: (5000 + delta) / 1000, eventIds: [20, 21] });
        const first = await r.snapshot(), second = await r.snapshot(); return { first, second, inspection: r.inspect() };
      });
      checked(check, result, ({ first, second, inspection }) => {
        const done = Math.abs(delta) <= 1000;
        // time-pos crosses a seconds/double boundary; only the measured clock
        // allows roundoff. The integer confirmation boundary remains exact.
        for (const state of [first, second]) { assert.ok(Math.abs(state.position - (5000 + delta)) < 1e-9); assert.equal(state.seekRevision, 1); assert.equal(state.seekDone, done ? 1 : 0); assert.equal(state.seeking, !done); assert.equal(state.error, 0); }
        assert.deepEqual(inspection.commands.filter(c => c.name === 'seek'), [{ name: 'seek', value: '5.000000' }]);
        assert.equal(inspection.propertyReads.filter(p => p === 'time-pos').length, 3);
        assert.deepEqual(inspection.deliveredEvents.slice(-4), [20, 21, 0, 0]);
      });
    });
    for (const [label, events, done] of [['none', [], false], ['seek-only', [20], false], ['restart-only', [21], false], ['reversed', [21, 20], false], ['ordered', [20, 21], true]]) test(`${layer} seek events ${label}`, async check => {
      const result = await f.scenario(layer, async r => { r.configure({ positionSeconds: 5, eventIds: events }); const state = await r.snapshot(); return { state, inspection: r.inspect() }; });
      checked(check, result, ({ state, inspection }) => { assert.equal(state.seekDone, done ? 1 : 0); assert.equal(state.seeking, !done); assert.equal(state.seekRevision, 1); assert.equal(state.error, 0); assert.deepEqual(inspection.deliveredEvents.slice(-(events.length + 1)), [...events, 0]); });
    });
    test(`${layer} seek and restart can arrive in separate snapshots`, async check => {
      const result = await f.scenario(layer, async r => {
        r.configure({ positionSeconds: 5, eventIds: [20] }); const pending = await r.snapshot();
        r.configure({ positionSeconds: 5, eventIds: [21] }); const confirmed = await r.snapshot(); return { pending, confirmed };
      });
      checked(check, result, ({ pending, confirmed }) => { assert.equal(pending.seekDone, 0); assert.equal(pending.seeking, true); assert.equal(confirmed.seekDone, 1); assert.equal(confirmed.seeking, false); });
    });
    test(`${layer} pending restart confirms later without a second event pair`, async check => {
      const result = await f.scenario(layer, async r => {
        r.configure({ positionSeconds: 6.001, eventIds: [20, 21] }); const outside = await r.snapshot();
        r.configure({ positionSeconds: 5.999 }); const inside = await r.snapshot(); return { outside, inside };
      });
      checked(check, result, ({ outside, inside }) => { assert.equal(outside.seekDone, 0); assert.equal(outside.seeking, true); assert.equal(inside.seekDone, 1); assert.equal(inside.seeking, false); });
    });
    test(`${layer} newer seek clears an older pending event pair`, async check => {
      const result = await f.scenario(layer, async r => {
        r.configure({ positionSeconds: 6.001, eventIds: [20, 21] }); const old = await r.snapshot(); await r.seek(7000);
        r.configure({ positionSeconds: 7, eventIds: [21] }); const restartOnly = await r.snapshot();
        r.configure({ positionSeconds: 7, eventIds: [20, 21] }); const fresh = await r.snapshot(); return { old, restartOnly, fresh };
      });
      checked(check, result, ({ old, restartOnly, fresh }) => { assert.equal(old.seekDone, 0); assert.equal(restartOnly.seekRevision, 2); assert.equal(restartOnly.seekDone, 0); assert.equal(restartOnly.seeking, true); assert.equal(fresh.seekDone, 2); assert.equal(fresh.seeking, false); });
    });
  }
  f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
}
