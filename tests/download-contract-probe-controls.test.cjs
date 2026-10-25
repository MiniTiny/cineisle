const assert = require('node:assert/strict'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { fixture, runCase, classify } = require('./resource-cache-result.cjs');
const name = 'download classifier target';
if (process.argv[2] === '--worker') {
  const mode = process.argv[3];
  runCase(name, check => { if (mode === 'boundary') check(() => assert.fail('target')); else if (mode === 'assertion') assert.fail('unrelated assertion'); else if (mode === 'error') throw Error('unrelated initialization'); }, () => {
    if (process.argv.includes('--worker-init-failure')) assert.fail('injected classifier worker initialization failure');
  }, () => { if (mode === 'cleanup') assert.fail('cleanup'); }).catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const tests = [], test = (name, fn, classifier = false) => tests.push({ name, fn, classifier });
  const rows = raw => (raw.stdout + '\n' + raw.stderr).split('\n').filter(s => s.startsWith('RESOURCE_CASE_RESULT ')).map(s => JSON.parse(s.slice(21)));
  // Worker health is a fixture precondition, independent of the classifier under mutation.
  const child = async mode => fixture('classifier-worker', () => {
    const raw = spawnSync(process.execPath, [__filename, '--worker', mode, ...(process.argv.includes('--classifier-worker-failure') ? ['--worker-init-failure'] : [])], { encoding: 'utf8', timeout: 10000 });
    assert.equal(raw.error, undefined); assert.equal(raw.signal, null); assert.equal(raw.status, mode === 'healthy' ? 0 : 1);
    const records = rows(raw); assert.equal(records.length, 1); const record = records[0];
    assert.equal(record.version, 1); assert.equal(record.name, name); assert.equal(record.status, mode === 'healthy' ? 'passed' : 'failed');
    if (mode !== 'healthy') {
      assert.equal(record.phase, mode === 'cleanup' ? 'fixture' : 'expectation', 'worker did not reach its selected case: ' + JSON.stringify(record.error));
      assert.equal(record.error.code, mode === 'boundary' ? 'ERR_RESOURCE_BOUNDARY' : mode === 'assertion' ? 'ERR_ASSERTION' : mode === 'cleanup' ? 'ERR_RESOURCE_FIXTURE' : undefined);
      if (mode === 'boundary') assert.equal(record.boundary, name);
      if (mode === 'cleanup') assert.equal(record.fixturePhase, 'cleanup');
    }
    return raw;
  });
  test('download classifier requires the selected typed boundary', async check => {
    const boundary = await child('boundary'); check(() => assert.equal(classify(boundary, name).status, 'detected'));
    for (const mode of ['assertion', 'error', 'cleanup']) { const raw = await child(mode); check(() => assert.equal(classify(raw, name).status, 'invalid')); }
    const healthy = await child('healthy'); check(() => assert.equal(classify(healthy, name).status, 'survived'));
  }, true);
  test('download classifier rejects malformed ambiguous and process failures', async check => {
    const raw = await child('boundary');
    for (const changed of [{ status: 1, stderr: 'AssertionError compiler failed' }, { ...raw, error: { code: 'ETIMEDOUT' } }, { ...raw, status: null, signal: 'SIGABRT' }, { ...raw, stderr: '' }, { ...raw, stderr: raw.stderr + raw.stderr }, { ...raw, stderr: 'RESOURCE_CASE_RESULT {' }]) check(() => assert.equal(classify(changed, name).status, 'invalid'));
    check(() => assert.equal(classify(raw, 'wrong case').status, 'invalid'));
  }, true);
  test('download classifier guards are independently necessary', async check => {
    const raw = await child('boundary'), record = rows(raw)[0];
    for (const changed of [{ ...record, name: 'another case' }, { ...record, phase: 'fixture' }, { ...record, boundary: 'another boundary' }, { ...record, error: { code: 'ERR_ASSERTION' } }, { ...record, version: 2 }, { ...record, status: 'passed' }]) {
      check(() => assert.equal(classify({ ...raw, stderr: 'RESOURCE_CASE_RESULT ' + JSON.stringify(changed) }, name).status, 'invalid'));
    }
    check(() => assert.equal(classify({ ...raw, status: 2 }, name).status, 'invalid'));
  }, true);
  const selfChild = (selected, flag) => spawnSync(process.execPath, [__filename, '--classifier-only', selected, ...(flag ? [flag] : [])], { encoding: 'utf8', timeout: 10000 });
  for (const [flag, phase] of [['--classifier-unrelated-failure', 'setup'], ['--classifier-worker-failure', 'classifier-worker']]) test('download self-check rejects ' + flag, check => {
    const selected = 'download classifier guards are independently necessary';
    const positive = classify(selfChild(selected), selected), negative = classify(selfChild(selected, flag), selected);
    check(() => { assert.equal(positive.status, 'survived'); assert.equal(negative.status, 'invalid'); assert.equal(negative.record.fixturePhase, phase); assert.equal(negative.record.error.cause.code, 'ERR_ASSERTION'); });
  });
  for (const kind of ['space', 'queue', 'persistent', 'metadata']) for (const c of require('./download-' + kind + '-fault-cases.cjs').controls) test(`download ${kind} actual ${c.phase} failure is invalid for ${c.name}`, () => {
    const run = fault => spawnSync(process.execPath, [path.join(__dirname, c.suite), c.name, ...(fault ? ['--fault=' + c.phase] : [])], { encoding: 'utf8', timeout: 20000 });
    const positive = classify(run(false), c.name), negative = classify(run(true), c.name);
    assert.equal(positive.status, 'survived'); assert.equal(negative.status, 'invalid');
    assert.equal(negative.record.fixturePhase, 'download-platform'); assert.equal(negative.record.error.cause.code, 'EIO');
    assert.equal(negative.record.error.cause.message, 'injected download platform failure: ' + c.phase);
  });
  const selected = process.argv[2] === '--classifier-only' ? tests.filter(t => t.classifier && (!process.argv[3] || t.name === process.argv[3])) : tests;
  (async () => {
    assert.ok(selected.length, 'No selected classifier controls');
    for (const t of selected) {
      await runCase(t.name, t.fn, () => { if (process.argv.includes('--classifier-unrelated-failure')) assert.fail('injected classifier fixture initialization failure'); }, () => {});
      console.log('PASS ' + t.name);
    }
    console.log(`${selected.length} download probe control tests passed.`);
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
