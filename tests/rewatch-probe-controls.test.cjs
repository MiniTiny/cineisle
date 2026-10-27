const assert = require('node:assert/strict'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { runCase, classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./rewatch-external-evidence.cjs');
const tests = [], test = (name, fn) => tests.push({ name, fn });
for (const c of require('./rewatch-fault-cases.cjs').controls) test(`rewatch ${c.phase} unrelated failure is invalid for ${c.name}`, check => {
  const child = phase => spawnSync(process.execPath, [path.join(__dirname, c.suite), c.name, ...(phase ? c.nativeInit ? ['--native-init-failure'] : ['--fault=' + phase] : [])], { encoding: 'utf8', timeout: 20000 });
  const positive = classify(child(''), c.name), raw = child(c.phase), negative = classify(raw, c.name);
  check(() => {
    assert.equal(positive.status, 'survived'); assert.equal(negative.status, 'invalid');
    assert.equal(negative.record.fixturePhase, c.phase === 'setup' ? 'setup' : 'rewatch-external');
    assert.equal(negative.record.error.cause.code, c.phase === 'setup' ? 'ERR_ASSERTION' : 'EIO');
    if (c.phase !== 'setup') verifyExternalFailure(raw, c);
  });
});
test('rewatch checkpoint requires the actual operation and preceding requests', check => {
  const c = { phase: 'random', requiredCalls: { plugin: 1, fallback: 1 } };
  const state = { version: 1, phase: 'random', injected: true, calls: { random: 1, plugin: 1, fallback: 1 } };
  const raw = value => ({ stdout: 'REWATCH_EXTERNAL_STATE ' + JSON.stringify(value), stderr: '' });
  check(() => {
    assert.deepEqual(verifyExternalFailure(raw(state), c), state);
    for (const broken of [{ ...state, injected: false }, { ...state, phase: 'plugin' }, { ...state, calls: { plugin: 1, fallback: 1 } }, { ...state, calls: { random: 1 } }]) assert.throws(() => verifyExternalFailure(raw(broken), c), { code: 'ERR_ASSERTION' });
    assert.throws(() => verifyExternalFailure({ stdout: '', stderr: '' }, c), { code: 'ERR_ASSERTION' });
  });
});
(async () => {
  const selected = process.argv[2] ? tests.filter(t => t.name === process.argv[2]) : tests;
  assert.ok(selected.length);
  for (const t of selected) { await runCase(t.name, t.fn, () => {}, () => {}); console.log('PASS ' + t.name); }
  console.log(`${selected.length} rewatch probe control tests passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
