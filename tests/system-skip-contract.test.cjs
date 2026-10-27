const f = require('./system-skip-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
function verify(check, result, target, invoked = true) {
  check(() => { assert.equal(result.position, target); assert.equal(result.published, target); assert.equal(result.attempts.length, invoked ? 1 : 0); assert.deepEqual(result.seeks, invoked ? [target] : []); assert.deepEqual(result.errors, []); });
}
for (const kind of ['session', 'pip']) for (const direction of ['forward', 'backward']) {
  for (const [position, forward, backward] of [[30000, 45000, 15000], [14999, 29999, 0], [15000, 30000, 0], [15001, 30001, 1], [44999, 59999, 29999], [45000, 60000, 30000], [45001, 60000, 30001]]) {
    test(`${kind} default skip ${direction} at ${position}`, async check => {
      const r = await f.rig(kind, position); await r.command(direction === 'forward' ? 'fastForward' : kind === 'session' ? 'rewind' : 'fastBackward');
      verify(check, r.snapshot(), direction === 'forward' ? forward : backward);
    });
  }
}
for (const direction of ['forward', 'backward']) for (const [label, amount, forward, backward, invoked] of [
  ['missing', undefined, 45000, 15000, true], ['null', null, 45000, 15000, true], ['zero', 0, 30000, 30000, true],
  ['14999', 14999, 44999, 15001, true], ['15000', 15000, 45000, 15000, true], ['15001', 15001, 45001, 14999, true],
  ['negative', -500, 29500, 30500, true], ['NaN', NaN, 30000, 30000, false], ['Infinity', Infinity, 30000, 30000, false], ['string', '15000', 30000, 15000, false]
]) test(`session explicit skip ${direction} ${label}`, async check => {
  const r = await f.rig('session'); await r.command(direction === 'forward' ? 'fastForward' : 'rewind', amount);
  // The original rewind callback applies unary minus before the finite check, coercing this malformed value.
  verify(check, r.snapshot(), direction === 'forward' ? forward : backward, invoked || (direction === 'backward' && label === 'string'));
});
test('session late default skip callback cannot reach the controller after disposal', async check => {
  const r = await f.rig('session'), callback = r.session.handlers.fastForward;
  await r.s.dispose(); const before = r.snapshot(); callback(); await f.h.settle(); const after = r.snapshot();
  check(() => { assert.deepEqual(after.attempts, []); assert.deepEqual(after.seeks, []); assert.equal(after.position, before.position); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
