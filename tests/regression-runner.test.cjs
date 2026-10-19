const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { discoverInventory, discoverSuites, caseCount, runRegression } = require('./run-regression.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-gate-'));
const tests = [], test = (name, fn) => tests.push([name, fn]);
function fixtures(files) {
  fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, 'tests', name), body);
}
const run = () => runRegression({ root, audit: path.join(root, 'evidence'), report: () => {} });
test('discovery includes new Node and Python suites in deterministic order, excluding helpers and directories', () => {
  fixtures({ 'z-new.test.cjs': '', 'a.test.py': '', 'fixture.cjs': '', 'run-regression.cjs': '', 'screen-emulator.test.py': '', 'emulator-visual.test.py': '' });
  fs.mkdirSync(path.join(root, 'tests', 'directory.test.cjs'));
  assert.deepEqual(discoverSuites(root).map(s => s.file), ['tests/a.test.py', 'tests/z-new.test.cjs']);
  assert.deepEqual(discoverInventory(root).separateAcceptance.map(s => s.file), ['tests/emulator-visual.test.py', 'tests/screen-emulator.test.py']);
});
test('the real repository inventory includes all supported files including this gate test', () => {
  const actualRoot = path.resolve(__dirname, '..');
  const expected = fs.readdirSync(path.join(actualRoot, 'tests')).filter(name => /\.test\.(cjs|py)$/.test(name)).sort();
  const inventory = discoverInventory(actualRoot);
  assert.deepEqual([...inventory.suites, ...inventory.separateAcceptance].map(s => path.basename(s.file)).sort(), expected);
  assert.ok(inventory.suites.some(s => s.file === 'tests/original-icons.test.py'));
  assert.ok(inventory.separateAcceptance.some(s => s.file === 'tests/accounts-emulator.test.py'));
  for (const name of ['server-discovery', 'network-preferences', 'poster-cache', 'regression-runner']) assert.ok(expected.includes(name + '.test.cjs'));
});
test('both Node summaries and Python unittest counts are recognized', () => {
  assert.equal(caseCount('PASS first\n2 fixtures passed.\n'), 2);
  assert.equal(caseCount('Ran 7 tests in 0.005s\n\nOK'), 7);
  assert.equal(caseCount('Ran 1 test in 0.005s\n\nOK'), 1);
  assert.equal(caseCount('nothing ran'), 0); assert.equal(caseCount('Ran 0 tests\nOK'), 0);
});
test('successful suites leave complete inventory, counts, source hashes and logs', () => {
  fixtures({ 'first.test.cjs': 'console.log("2 fixtures passed.")', 'second.test.cjs': 'console.log("3 fixtures passed.")' });
  const e = run(); assert.equal(e.allPassed, true); assert.equal(e.count, 5); assert.deepEqual(e.skipped, []); assert.equal(e.discovered.length, 2);
  for (const row of e.suites) { assert.equal(row.passed, true); assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(fs.readFileSync(path.join(root, 'evidence', row.log), 'utf8').includes('fixtures passed')); }
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'evidence/evidence-actor-tests.json'))).allPassed, true);
});
test('an exit failure cannot be hidden by a passing summary and later work is explicitly skipped', () => {
  fixtures({ 'a.test.cjs': 'console.log("1 fixtures passed.");process.exitCode=1', 'b.test.cjs': 'throw new Error("must not run")' });
  const e = run(); assert.equal(e.allPassed, false); assert.equal(e.suites.length, 1); assert.equal(e.suites[0].passed, false); assert.equal(e.suites[0].exitCode, 1); assert.deepEqual(e.skipped, ['tests/b.test.cjs']);
});
for (const output of ['not a test run', '0 fixtures passed.']) test('zero executed cases fail even with exit zero: ' + output, () => {
  fixtures({ 'a.test.cjs': 'console.log(' + JSON.stringify(output) + ')' }); const e = run(); assert.equal(e.allPassed, false); assert.equal(e.suites[0].exitCode, 0); assert.equal(e.suites[0].count, 0); assert.equal(e.suites[0].passed, false);
});
test('empty inventory is a failed gate with a persisted result', () => {
  fixtures({ 'helper.cjs': '' }); const e = run(); assert.equal(e.allPassed, false); assert.deepEqual(e.discovered, []); assert.equal(e.count, 0);
});
test('a missing runtime is a failure with the process error recorded', () => {
  fixtures({ 'a.test.py': 'pass' }); const previous = process.env.PYTHON; process.env.PYTHON = path.join(root, 'missing-python');
  try { const e = run(); assert.equal(e.allPassed, false); assert.equal(e.suites[0].exitCode, null); assert.equal(e.suites[0].errorCode, 'ENOENT'); }
  finally { if (previous === undefined) delete process.env.PYTHON; else process.env.PYTHON = previous; }
});
try { for (const [name, fn] of tests) { fn(); console.log('PASS ' + name); } console.log(tests.length + ' regression runner tests passed. Child processes are synthetic gate fixtures, not product or device acceptance.'); }
finally { fs.rmSync(root, { recursive: true, force: true }); }
