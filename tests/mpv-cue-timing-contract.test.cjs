const f = require('./mpv-cue-timing-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
function verify(check, result, snapshot, start, duration) {
  check(() => { assert.ifError(result.error); assert.equal(snapshot.packet?.text, 'cue'); assert.equal(snapshot.packet.startTime, start); assert.equal(snapshot.packet.duration, duration); assert.equal(result.state, 'prepared'); assert.equal(snapshot.creates, 1); assert.ok(snapshot.reads >= 1); assert.deepEqual(snapshot.errors, []); });
}
for (const [label, end, duration] of [['missing', undefined, 1000], ['null', null, 1000], ['NaN', NaN, 1000], ['Infinity', Infinity, 1000], ['negative', -1, 1000], ['below start', 499, 1000], ['equal start', 500, 1000], ['fraction rounds zero', 500.49, 0], ['fraction rounds one', 500.5, 1], ['duration999', 1499, 999], ['duration1000', 1500, 1000], ['duration1001', 1501, 1001]]) {
  test('MPV first-open cue end ' + label, async check => { const result = await f.open(500, end); verify(check, result, f.snapshot(), 500, duration); });
}
for (const [label, start, expected] of [['missing', undefined, 2500], ['null', null, 2500], ['NaN', NaN, 2500], ['Infinity', Infinity, 2500], ['negative', -1, 2500], ['zero', 0, 0], ['below half', 0.49, 0], ['half', 0.5, 1], ['499.49', 499.49, 499], ['499.5', 499.5, 500], ['500.5', 500.5, 501]]) {
  test('MPV first-open cue start ' + label, async check => { const result = await f.open(start, undefined); verify(check, result, f.snapshot(), expected, 1000); });
}
test('MPV compares the end against the rounded start before rounding the end', async check => {
  const result = await f.open(500.5, 500.6); verify(check, result, f.snapshot(), 501, 1000);
});
test('MPV timer polling uses the fallback and formatted identity deduplication', async check => {
  const result = await f.open(500, undefined); if (result.error) { check(() => assert.ifError(result.error)); return; }
  const r = f.rig(), first = f.snapshot(); await r.tick(); const same = f.snapshot();
  r.value.subtitleEnd = 1500; await r.tick(); const equivalent = f.snapshot();
  r.value.subtitleEnd = 1499; await r.tick(); const different = f.snapshot();
  check(() => { assert.equal(first.packet.duration, 1000); assert.equal(same.count, first.count); assert.equal(equivalent.count, first.count); assert.equal(different.count, first.count + 1); assert.equal(different.packet.duration, 999); assert.ok(different.reads >= first.reads + 3); assert.deepEqual(different.errors, []); });
});
test('MPV seeking hides a cue then restores its original fallback on the next snapshot', async check => {
  const result = await f.open(500, undefined); if (result.error) { check(() => assert.ifError(result.error)); return; }
  const r = f.rig(); result.value.seek(3000, 3); await r.tick(); await r.tick(); const hidden = f.snapshot();
  Object.assign(r.value, { seeking: false, seekDone: r.value.seekRevision }); await r.tick(); const restored = f.snapshot();
  check(() => { assert.equal(hidden.packet.text, ''); assert.equal(hidden.packet.content, undefined); assert.equal(restored.packet.text, 'cue'); assert.equal(restored.packet.duration, 1000); assert.deepEqual(restored.errors, []); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
