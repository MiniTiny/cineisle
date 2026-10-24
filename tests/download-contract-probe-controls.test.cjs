const assert = require('node:assert/strict'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { runCase, classify } = require('./resource-cache-result.cjs');
const name = 'download classifier target';
if (process.argv[2] === '--worker') {
  const mode = process.argv[3];
  runCase(name, check => { if (mode === 'boundary') check(() => assert.fail('target')); else if (mode === 'assertion') assert.fail('unrelated assertion'); else if (mode === 'error') throw Error('unrelated initialization'); }, () => {}, () => { if (mode === 'cleanup') assert.fail('cleanup'); }).catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const tests = [], test = (name, fn) => tests.push({ name, fn });
  const child = mode => spawnSync(process.execPath, [__filename, '--worker', mode], { encoding: 'utf8', timeout: 10000 });
  test('download classifier requires the selected typed boundary', () => {
    assert.equal(classify(child('boundary'), name).status, 'detected');
    for (const mode of ['assertion', 'error', 'cleanup']) assert.equal(classify(child(mode), name).status, 'invalid');
    assert.equal(classify(child('healthy'), name).status, 'survived');
  });
  test('download classifier rejects malformed ambiguous and process failures', () => {
    const raw = child('boundary');
    for (const changed of [{ status: 1, stderr: 'AssertionError compiler failed' }, { ...raw, error: { code: 'ETIMEDOUT' } }, { ...raw, status: null, signal: 'SIGABRT' }, { ...raw, stderr: '' }, { ...raw, stderr: raw.stderr + raw.stderr }, { ...raw, stderr: 'RESOURCE_CASE_RESULT {' }]) assert.equal(classify(changed, name).status, 'invalid');
    assert.equal(classify(raw, 'wrong case').status, 'invalid');
  });
  test('download classifier guards are independently necessary', () => {
    const raw = child('boundary'), record = JSON.parse(raw.stderr.split('\n').find(s => s.startsWith('RESOURCE_CASE_RESULT ')).slice(21));
    for (const changed of [{ ...record, name: 'another case' }, { ...record, phase: 'fixture' }, { ...record, boundary: 'another boundary' }, { ...record, error: { code: 'ERR_ASSERTION' } }, { ...record, version: 2 }, { ...record, status: 'passed' }]) {
      assert.equal(classify({ ...raw, stderr: 'RESOURCE_CASE_RESULT ' + JSON.stringify(changed) }, name).status, 'invalid');
    }
    assert.equal(classify({ ...raw, status: 2 }, name).status, 'invalid');
  });
  for (const kind of ['space', 'queue', 'persistent', 'metadata']) for (const c of require('./download-' + kind + '-fault-cases.cjs').controls) test(`download ${kind} actual ${c.phase} failure is invalid for ${c.name}`, () => {
    const run = fault => spawnSync(process.execPath, [path.join(__dirname, c.suite), c.name, ...(fault ? ['--fault=' + c.phase] : [])], { encoding: 'utf8', timeout: 20000 });
    const positive = classify(run(false), c.name), negative = classify(run(true), c.name);
    assert.equal(positive.status, 'survived'); assert.equal(negative.status, 'invalid');
    assert.equal(negative.record.fixturePhase, 'download-platform'); assert.equal(negative.record.error.cause.code, 'EIO');
    assert.equal(negative.record.error.cause.message, 'injected download platform failure: ' + c.phase);
  });
  const selected = process.argv[2] === '--classifier-only' ? tests.filter(t => t.name.includes('classifier')) : tests;
  for (const t of selected) { t.fn(); console.log('PASS ' + t.name); }
  console.log(`${selected.length} download probe control tests passed.`);
}
