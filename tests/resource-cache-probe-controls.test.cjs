const assert = require('node:assert/strict'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { runCase, classify } = require('./resource-cache-result.cjs');
const name = 'resource classifier control';
if (process.argv[2]) {
  const mode = process.argv[2], assertion = () => assert.equal(1, 2);
  runCase(name, check => mode === 'boundary' ? check(assertion) : mode === 'plain-assertion' ? assertion() : mode === 'unrelated' ? Promise.reject(Error('fixture operation failed')) : undefined,
    () => {}, () => { if (mode === 'cleanup') assertion(); }).catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const tests = [], test = (name, fn) => tests.push([name, fn]);
  const child = mode => spawnSync(process.execPath, [__filename, mode], { encoding: 'utf8', timeout: 10000 });
  test('only the selected typed boundary assertion counts', () => assert.equal(classify(child('boundary'), name).status, 'detected'));
  for (const mode of ['plain-assertion', 'unrelated', 'cleanup']) test(mode + ' is invalid evidence', () => assert.equal(classify(child(mode), name).status, 'invalid'));
  test('bad, duplicated and wrong-case records do not count', () => {
    const r = child('boundary');
    for (const changed of [{ ...r, stderr: '' }, { ...r, stderr: 'RESOURCE_CASE_RESULT {' }, { ...r, stderr: r.stderr + r.stderr }]) assert.equal(classify(changed, name).status, 'invalid');
    assert.equal(classify(r, 'another case').status, 'invalid');
  });
  test('compiler text, process timeout and crash do not count', () => {
    const r = child('boundary');
    for (const changed of [{ status: 1, stderr: 'AssertionError: compile failed' }, { ...r, error: { code: 'ETIMEDOUT' } }, { ...r, status: null, signal: 'SIGABRT' }]) assert.equal(classify(changed, name).status, 'invalid');
  });
  const selected = 'poster HTTP primary width 160', run = fault => spawnSync(process.execPath, [path.join(__dirname, 'resource-cache-boundaries.test.cjs'), selected, ...(fault ? ['--fixture-failure'] : [])], { encoding: 'utf8', timeout: 15000 });
  test('intact product source with a valid real-file fixture survives', () => assert.equal(classify(run(false), selected).status, 'survived'));
  test('intact source with a real filesystem setup failure is invalid', () => {
    const r = classify(run(true), selected); assert.equal(r.status, 'invalid'); assert.equal(r.record.phase, 'fixture'); assert.equal(r.record.fixturePhase, 'setup'); assert.equal(r.record.error.cause.code, 'ENOTDIR');
  });
  test('an actual product cache initialization failure cannot kill a mutation', () => {
    const name = 'poster image bytes 2097152';
    const raw = spawnSync(process.execPath, [path.join(__dirname, 'resource-cache-boundaries.test.cjs'), name, '--cache-open-failure'], { encoding: 'utf8', timeout: 15000 });
    const r = classify(raw, name); assert.equal(r.status, 'invalid'); assert.equal(r.record.fixturePhase, 'cache-open'); assert.equal(r.record.error.cause.code, 'ERR_ASSERTION'); assert.match(r.record.error.cause.message, /poster_cache_unavailable/);
  });
  for (const [name, flag, phase, pattern] of [
    ['bif actual cache file quota 17', '--bif-io-failure', 'bif-io', /EISDIR|EPERM/],
    ['intro actual repository insert 513', '--intro-io-failure', 'intro-io', /EISDIR|EPERM/],
    ['bif cached read bytes 76', '--bif-read-io-failure', 'bif-io', /read:EBADF/]
  ]) test(flag + ' real filesystem failure is invalid evidence', () => {
    const raw = spawnSync(process.execPath, [path.join(__dirname, 'resource-cache-boundaries.test.cjs'), name, flag], { encoding: 'utf8', timeout: 15000 });
    const r = classify(raw, name); assert.equal(r.status, 'invalid'); assert.equal(r.record.fixturePhase, phase); assert.match(r.record.error.cause.message, pattern);
  });
  for (const [name, flag, attempt] of [
    ['poster HTTP primary width 480', '--http-open-failure', 1],
    ['bif actual HTTP stage byte budgets', '--http-open-failure', 1],
    ['bif actual HTTP stage byte budgets', '--http-binary-open-failure', 2],
    ['intro actual HTTP byte budget', '--http-open-failure', 1]
  ]) test(name + ' create #' + attempt + ' platform failure is invalid evidence', () => {
    const run = fault => spawnSync(process.execPath, [path.join(__dirname, 'resource-cache-boundaries.test.cjs'), name, ...(fault ? [flag] : [])], { encoding: 'utf8', timeout: 15000 });
    assert.equal(classify(run(false), name).status, 'survived');
    const failed = classify(run(true), name); assert.equal(failed.status, 'invalid'); assert.equal(failed.record.phase, 'fixture');
    assert.equal(failed.record.fixturePhase, 'http-platform'); assert.equal(failed.record.error.cause.code, 'EIO');
    assert.equal(failed.record.error.cause.message, 'injected HTTP initialization failure at create #' + attempt);
  });
  for (const [name, fn] of tests) { fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} resource probe control tests passed.`);
}
