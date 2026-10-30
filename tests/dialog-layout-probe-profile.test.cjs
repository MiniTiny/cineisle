// Exercise the real probe CLI; a generic child failure cannot stand in for profile rejection.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { replaceLiteral } = require('./literal-mutation.cjs');
const root = path.resolve(__dirname, '..');
const tests = [], test = (name, action) => tests.push({ name, action });
function cli(base, name, change) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-dialog-profile-'));
  try {
    const output = path.join(temp, 'result'), preload = path.join(temp, 'profile.cjs');
    fs.writeFileSync(preload, `const data = require(${JSON.stringify(path.join(base, 'tests/dialog-layout-fault-cases.cjs'))});\n${change}\n`);
    const raw = spawnSync(process.execPath, ['-r', preload, 'tests/dialog-layout-fault-probes.cjs', output],
      { cwd: base, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    const file = path.join(output, 'evidence.json'), evidence = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
    console.log('DIALOG_PROFILE_CONTROL ' + JSON.stringify({ name, exitCode: raw.status, signal: raw.signal,
      processError: raw.error?.code, complete: evidence?.complete, allDetected: evidence?.allDetected,
      errorCode: evidence?.errorCode, probes: evidence?.probes.length, baselines: evidence?.baselines.length }));
    return { raw, evidence };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function rejected({ raw, evidence }, reason) {
  assert.equal(raw.error, undefined); assert.equal(raw.signal, null); assert.equal(raw.status, 1);
  assert.ok(evidence, 'Missing explicit profile rejection evidence');
  assert.equal(evidence.errorCode, 'ERR_DIALOG_PROBE_PROFILE');
  assert.ok(evidence.error.includes('Invalid dialog probe profile: ' + reason));
  assert.equal(evidence.complete, false); assert.notEqual(evidence.allDetected, true);
  for (const key of ['probes', 'baselines', 'controls', 'selfFaults']) assert.deepEqual(evidence[key], []);
  assert.doesNotMatch(raw.stdout, /fault probes passed/);
}
test('healthy complete profile accepted', () => {
  assert.equal(require('./dialog-layout-fault-probes.cjs').validateRecipes(require('./dialog-layout-fault-cases.cjs').recipes), true);
});
for (const [name, change, reason] of [
  ['empty', 'data.recipes.splice(0);', 'expected a non-empty recipe array'],
  ['missing', 'data.recipes.pop();', 'required recipe ids do not match'],
  ['duplicate', 'data.recipes[1] = {...data.recipes[0]};', 'missing or duplicate recipe id'],
  ['renamed', "data.recipes[0] = {...data.recipes[0], id:'unexpected-recipe'};", 'required recipe ids do not match'],
  ['malformed', "data.recipes[0] = {...data.recipes[0], name:''};", 'malformed recipe'],
  ['non-array', 'data.recipes = null;', 'expected a non-empty recipe array']
]) test(name + ' profile rejected by actual CLI', () => rejected(cli(root, name, change), reason));
test('unrelated child failure cannot satisfy rejection control', () => {
  const result = cli(root, 'unrelated-EIO', "throw Object.assign(new Error('Unrelated profile fixture failed'), {code:'EIO'});");
  assert.equal(result.raw.status, 1); assert.match(result.raw.stderr, /Unrelated profile fixture failed/);
  assert.match(result.raw.stderr, /EIO/);
  assert.throws(() => rejected(result, 'expected a non-empty recipe array'), /Missing explicit profile rejection evidence/);
});
test('removing profile admission is detected by empty-list control', () => {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-dialog-profile-mutant-')));
  try {
    for (const scope of ['entry/src/main/ets', 'entry/src/main/resources/base', 'tests', 'config'])
      fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    const file = path.join(temp, 'tests/dialog-layout-fault-probes.cjs');
    fs.writeFileSync(file, replaceLiteral(fs.readFileSync(file, 'utf8'), '  validateRecipes(recipes);', '', 'profile-admission-removed'));
    const result = cli(temp, 'profile-admission-removed', 'data.recipes.splice(0);');
    assert.equal(result.raw.error, undefined); assert.equal(result.raw.signal, null); assert.equal(result.raw.status, 0, result.raw.stderr);
    assert.equal(result.evidence.complete, true); assert.equal(result.evidence.allDetected, true);
    assert.equal(result.evidence.probes.length, 0); assert.equal(result.evidence.baselines.length, 0);
    assert.equal(result.evidence.controls.length, 2); assert.equal(result.evidence.selfFaults.length, 1);
    assert.throws(() => rejected(result, 'expected a non-empty recipe array'));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
if (require.main === module) {
  try {
    for (const { name, action } of tests) { action(); console.log('PASS ' + name); }
    console.log(`${tests.length} dialog probe profile tests passed. CLI checks do not prove device behavior.`);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { tests };
