const assert = require('node:assert/strict'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { fixture, runCase, classify } = require('./mpv-probe-result.cjs');
const name = 'probe classification control', expected = { name, error: { code: 'ERR_ASSERTION' } };
const mode = process.argv[2];
if (mode) {
  const failure = () => { throw Error('intentional external fixture failure'); };
  const action = mode === 'guard' ? () => assert.equal(1, 2) : mode === 'unrelated' ? failure : () => {};
  runCase(name, action, { before: mode === 'setup' ? failure : undefined, after: mode === 'cleanup' ? failure : undefined })
    .catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const tests = [], test = (name, fn) => tests.push([name, fn]);
  const child = mode => spawnSync(process.execPath, [__filename, mode], { encoding: 'utf8', timeout: 8000 });
  test('only a selected expectation failure with the agreed signature counts', () => {
    const result = child('guard'); assert.equal(classify(result, expected).status, 'detected');
    assert.equal(classify(result, { ...expected, error: { message: 'mpv_argument_invalid' } }).status, 'invalid');
  });
  for (const phase of ['setup', 'cleanup']) test('unmodified fixture ' + phase + ' failure is invalid evidence', () => {
    const result = classify(child(phase), expected);
    assert.equal(result.status, 'invalid'); assert.equal(result.caseResult.phase, 'fixture'); assert.equal(result.caseResult.fixturePhase, phase);
  });
  test('an unrelated exception is invalid even inside the selected case', () => assert.equal(classify(child('unrelated'), expected).status, 'invalid'));
  test('successful negative control survives', () => assert.equal(classify(child('pass'), expected).status, 'survived'));
  test('process timeout and signal cannot kill a mutation', () => {
    const r = child('guard');
    assert.equal(classify({ ...r, error: { code: 'ETIMEDOUT' } }, expected).status, 'invalid');
    assert.equal(classify({ ...r, status: null, signal: 'SIGABRT' }, expected).status, 'invalid');
  });
  test('compiler text and old FAIL/AssertionError markers are not evidence', () => {
    assert.equal(classify({ status: 1, stderr: 'FAIL ' + name + '\nAssertionError: compiler failed' }, expected).status, 'invalid');
  });
  test('missing, malformed, duplicate and wrong-case records are invalid', () => {
    const r = child('guard');
    for (const changed of [{ ...r, stderr: '' }, { ...r, stderr: 'MPV_CASE_RESULT {' }, { ...r, stderr: r.stderr + r.stderr }]) {
      assert.equal(classify(changed, expected).status, 'invalid');
    }
    assert.equal(classify(r, { ...expected, name: 'another case' }).status, 'invalid');
  });
  const built = require('./native-mpv-build.cjs').build(), native = require('./native-mpv-run.cjs');
  const active = { name: 'native execute admits four overlapping opens and rejects the fifth without leaking reservation', error: { code: 'ERR_ASSERTION' } };
  test('intact production guard passes with the valid native fixture', () => {
    assert.equal(classify(native.run(built, { name: active.name }), active).status, 'survived');
  });
  test('intact production guard plus a four-worker barrier failure is invalid, not detected', () => {
    const result = classify(native.run(built, { name: active.name, pool: '4' }), active);
    assert.equal(result.status, 'invalid'); assert.equal(result.caseResult.phase, 'fixture'); assert.equal(result.caseResult.fixturePhase, 'barrier');
  });
  (async () => {
    try { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); } console.log(`${tests.length} MPV probe control tests passed. No production mutation or device claim.`); }
    finally { built.cleanup(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
