// Execute the existing production-path case with an API-body fault and no CLI fault flag.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs');
const { replaceLiteral } = require('./literal-mutation.cjs');
const root = path.resolve(__dirname, '..');
function fingerprint(base, scopes) {
  const result = {};
  function visit(relative) {
    const file = path.join(base, relative), stat = fs.statSync(file);
    if (stat.isFile()) { result[relative] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); return; }
    for (const entry of fs.readdirSync(file, { withFileTypes: true })) {
      if (entry.name !== '__pycache__' && (entry.isDirectory() || entry.isFile())) visit(path.join(relative, entry.name));
    }
  }
  scopes.forEach(visit); return result;
}
function run(kind, output = path.join(root, process.env.CINEISLE_TEST_OUTPUT_DIR || '.local/test-results', kind + '-unannounced')) {
  const profile = require('./' + kind + '-fault-cases.cjs');
  const controls = profile.unannouncedControls;
  assert.ok(controls?.length, 'No unannounced native controls');
  const scopes = ['entry/src/main/ets', 'tests', 'config', ...(profile.extraScopes || [])];
  const frozen = fingerprint(root, scopes), temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-native-unannounced-')));
  const evidence = { source: frozen, complete: false, controls: [], selfFaults: [], coupled: [] };
  fs.mkdirSync(output, { recursive: true });
  const save = () => fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  const mutate = (recipe, action) => {
    const location = path.join(temp, recipe.file), original = fs.readFileSync(location, 'utf8');
    try { fs.writeFileSync(location, replaceLiteral(original, recipe.old, recipe.replacement)); return action(); }
    finally { fs.writeFileSync(location, original); }
  };
  const child = (control, id) => {
    const args = [path.join(temp, 'tests', control.suite), control.name];
    const raw = spawnSync(process.execPath, args, { cwd: temp, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    const result = classify(raw, control.name);
    fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify({ args: args.slice(1), result, raw }, null, 2) + '\n');
    return { raw, result };
  };
  const invalid = (sample, control, details = control.details) => {
    assert.equal(sample.result.status, 'invalid');
    assert.equal(sample.result.record?.fixturePhase, control.scope + '-external');
    assert.equal(sample.result.record.error.cause.code, 'EIO');
    return verifyExternalFailure(sample.raw, { ...control, details }, false);
  };
  try {
    scopes.forEach(scope => fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true }));
    for (const control of controls) {
      const baseline = child(control, control.id + '-baseline');
      assert.equal(baseline.result.status, 'survived', 'Invalid native control baseline: ' + control.id);
      mutate(control.fault, () => {
        const failure = child(control, control.id + '-failure'), checkpoint = invalid(failure, control);
        evidence.controls.push({ id: control.id, baseline: baseline.result, failure: failure.result, checkpoint }); save();
        for (const [name, recipe] of [['observer', control.observer], ['quarantine', control.quarantine]]) {
          mutate(recipe, () => {
            const sample = child(control, control.id + '-' + name + '-removed');
            assert.equal(sample.result.status, control.selfStatus?.[name] || 'detected');
            assert.throws(() => invalid(sample, control), { code: 'ERR_ASSERTION' });
            evidence.selfFaults.push({ id: control.id, kind: name, rejected: true, result: sample.result }); save();
          });
        }
        if (control.protection) mutate(control.protection, () => {
          const sample = child(control, control.id + '-protection-removed'), checkpoint = invalid(sample, control, control.coupledDetails || control.details);
          evidence.coupled.push({ id: control.id, result: sample.result, checkpoint }); save();
        });
      });
      console.log('PASS unannounced native ' + control.id);
    }
    assert.deepEqual(fingerprint(root, scopes), frozen); assert.deepEqual(fingerprint(temp, scopes), frozen);
    evidence.complete = true; save();
    console.log(`${controls.length} ${kind} unannounced native tests passed. Host API fixtures do not prove device acceptance.`);
    return evidence;
  } catch (error) { evidence.runnerError = error.stack; save(); throw error; }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
module.exports = { run };
