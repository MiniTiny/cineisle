// Mutations only touch an isolated copy; named controls must reject unrelated failures.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./rewatch-external-evidence.cjs');
const { recipes, controls } = require('./rewatch-fault-cases.cjs');
const root = path.resolve(__dirname, '..');
function fingerprint(base) {
  const out = {}, walk = relative => { for (const e of fs.readdirSync(path.join(base, relative), { withFileTypes: true })) {
    const name = path.join(relative, e.name); if (e.isDirectory()) walk(name); else if (e.isFile()) out[name] = crypto.createHash('sha256').update(fs.readFileSync(path.join(base, name))).digest('hex');
  } };
  for (const scope of ['entry/src/main/ets', 'tests', 'config']) walk(scope); return out;
}
function run(output = path.join(root, '.local/test-results/rewatch-probes')) {
  const frozen = fingerprint(root), temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-rewatch-probes-')));
  const evidence = { source: frozen, complete: false, allDetected: false, baselines: [], probes: [], controls: [], selfBaselines: [], selfControls: [], selfFaults: [] };
  fs.mkdirSync(output, { recursive: true });
  const save = () => fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const persist = (id, raw) => fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(raw, null, 2));
  const child = (suite, name, phase, nativeInit = false) => spawnSync(process.execPath, [path.join(temp, 'tests', suite), name, ...(phase ? nativeInit ? ['--native-init-failure'] : ['--fault=' + phase] : [])], { cwd: temp, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
  const selfChild = (name, flag) => spawnSync(process.execPath, [path.join(temp, 'tests/download-contract-probe-controls.test.cjs'), '--classifier-only', name, ...(flag ? [flag] : [])], { cwd: temp, encoding: 'utf8', timeout: 10000 });
  const mutate = (file, old, replacement, action) => {
    const location = path.join(temp, file), original = fs.readFileSync(location, 'utf8'); assert.equal(original.split(old).length, 2, 'Stale or ambiguous mutation: ' + file);
    try { fs.writeFileSync(location, original.replace(old, replacement)); return action(); } finally { fs.writeFileSync(location, original); }
  };
  try {
    for (const scope of ['entry/src/main/ets', 'tests', 'config']) fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    for (const c of controls) {
      const positive = child(c.suite, c.name), negative = child(c.suite, c.name, c.phase, c.nativeInit), id = 'control-' + c.phase + '-' + c.name.replace(/[^a-z0-9]+/gi, '-');
      persist(id + '-positive', positive); persist(id + '-negative', negative);
      const normal = classify(positive, c.name), failed = classify(negative, c.name);
      evidence.controls.push({ ...c, normal, failed }); save();
      assert.equal(normal.status, 'survived'); assert.equal(failed.status, 'invalid');
      assert.equal(failed.record.fixturePhase, c.phase === 'setup' ? 'setup' : 'rewatch-external');
      assert.equal(failed.record.error.cause.code, c.phase === 'setup' ? 'ERR_ASSERTION' : 'EIO');
      if (c.phase !== 'setup') evidence.controls.at(-1).checkpoint = verifyExternalFailure(negative, c); save();
    }
    const selected = controls.find(c => c.phase === 'plugin');
    mutate('tests/rewatch-fixture.cjs', '    errors.push({ phase, error }); throw error;\n  }', '    throw error;\n  }', () => {
      const raw = child(selected.suite, selected.name, selected.phase), result = classify(raw, selected.name); persist('self-fault-capture', raw);
      assert.equal(result.status, 'detected'); assert.throws(() => verifyExternalFailure(raw, selected), { code: 'ERR_ASSERTION' });
      evidence.selfFaults.push({ id: 'external-capture', rejected: true, result });
    });
    const later = controls.find(c => c.phase === 'random' && c.requiredCalls);
    const native = controls.find(c => c.nativeInit);
    mutate('tests/rewatch-fixture.cjs', "external('http-create', () => {", "((phase, operation) => operation())('http-create', () => {", () => {
      const raw = child(native.suite, native.name, native.phase, true), result = classify(raw, native.name); persist('self-fault-native-init-capture', raw);
      assert.equal(result.status, 'detected'); assert.throws(() => verifyExternalFailure(raw, native), { code: 'ERR_ASSERTION' });
      evidence.selfFaults.push({ id: 'native-init-capture', rejected: true, result });
    });
    mutate('tests/rewatch-fixture.cjs', 'const active = h.activate();', 'Math.random(); const active = h.activate();', () => {
      const raw = child(later.suite, later.name, later.phase), result = classify(raw, later.name); persist('self-fault-before-requests', raw);
      assert.equal(result.status, 'invalid');
      assert.throws(() => verifyExternalFailure(raw, later), error => error.code === 'ERR_ASSERTION' && error.message.includes('before required plugin'));
      evidence.selfFaults.push({ id: 'fault-before-business-requests', rejected: true });
    });
    const checkpointName = 'rewatch checkpoint requires the actual operation and preceding requests';
    const intact = child('rewatch-probe-controls.test.cjs', checkpointName); persist('self-baseline-checkpoint', intact);
    assert.equal(classify(intact, checkpointName).status, 'survived'); evidence.selfBaselines.push({ name: checkpointName, ...classify(intact, checkpointName) });
    for (const [id, old, replacement] of [
      ['operation-check', 'assert.ok(state.calls[control.phase] >= 1,', 'assert.ok(true,'],
      ['sequence-check', 'assert.ok(state.calls[phase] >= min,', 'assert.ok(true,']
    ]) mutate('tests/rewatch-external-evidence.cjs', old, replacement, () => {
      const raw = child('rewatch-probe-controls.test.cjs', checkpointName), result = classify(raw, checkpointName); persist('self-fault-' + id, raw);
      assert.equal(result.status, 'detected'); evidence.selfFaults.push({ id, rejected: true, result });
    });
    const resultFile = path.join(temp, 'tests/resource-cache-result.cjs'), originalResult = fs.readFileSync(resultFile, 'utf8');
    const selectedSelfCases = new Set();
    for (const [id, old, replacement] of [
      ['process-health', 'result.error || result.signal || result.status === null', 'false'],
      ['unique-result', 'rows.length !== 1', 'rows.length < 1'],
      ['selected-case', 'rows[0].name !== name', 'false'],
      ['fixture-phase', "record.phase !== 'expectation'", 'false'],
      ['boundary-type', "record.error?.code !== 'ERR_RESOURCE_BOUNDARY'", 'false'],
      ['boundary-name', 'record.boundary !== name', 'false'],
      ['exit-code', 'result.status !== 1', 'false']
    ]) {
      const name = ['process-health', 'unique-result'].includes(id) ? 'download classifier rejects malformed ambiguous and process failures' : 'download classifier guards are independently necessary';
      if (!selectedSelfCases.has(name)) {
        const raw = selfChild(name), baseline = classify(raw, name); persist('self-baseline-' + id, raw);
        evidence.selfBaselines.push({ name, ...baseline }); save(); assert.equal(baseline.status, 'survived', 'Invalid self-check baseline: ' + id);
        for (const [flag, phase] of [['--classifier-unrelated-failure', 'setup'], ['--classifier-worker-failure', 'classifier-worker']]) {
          const raw = selfChild(name, flag), result = classify(raw, name); persist('self-control-' + id + flag, raw);
          evidence.selfControls.push({ name, flag, ...result }); save();
          assert.equal(result.status, 'invalid'); assert.equal(result.record.fixturePhase, phase); assert.equal(result.record.error.cause.code, 'ERR_ASSERTION');
        }
        selectedSelfCases.add(name);
      }
      assert.equal(originalResult.split(old).length, 2);
      try {
        fs.writeFileSync(resultFile, originalResult.replace(old, replacement));
        const raw = selfChild(name), result = classify(raw, name); persist('self-fault-' + id, raw);
        assert.equal(result.status, 'detected', 'Control did not reach its own selected assertion: ' + id);
        evidence.selfFaults.push({ id, name, rejected: true, result });
      } finally { fs.writeFileSync(resultFile, originalResult); }
    }

    const baselines = new Set();
    for (const r of recipes) {
      if (!baselines.has(r.name)) {
        const raw = child(r.suite, r.name), baseline = classify(raw, r.name); persist(r.id + '-baseline', raw);
        assert.equal(baseline.status, 'survived', 'Invalid baseline: ' + r.id); evidence.baselines.push({ name: r.name, ...baseline }); baselines.add(r.name);
      }
      mutate(r.file, r.old, r.replacement, () => {
        const raw = child(r.suite, r.name), result = classify(raw, r.name); persist(r.id, raw);
        evidence.probes.push({ id: r.id, name: r.name, file: r.file, ...result }); save(); console.log(result.status.toUpperCase() + ' ' + r.id);
      });
    }
    assert.deepEqual(fingerprint(root), frozen); assert.deepEqual(fingerprint(temp), frozen);
    evidence.complete = true; evidence.allDetected = evidence.probes.length === recipes.length && evidence.probes.every(p => p.detected); save(); return evidence;
  } catch (error) { evidence.runnerError = error.stack; save(); throw error; }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
module.exports = { run };
if (require.main === module) {
  const evidence = run(process.argv[2] && path.resolve(process.argv[2]));
  console.log(`${evidence.probes.length} rewatch fault probes passed; allDetected=${evidence.allDetected}`);
  if (!evidence.allDetected) process.exitCode = 1;
}
