// Mutations run only in a source copy; every intact source/test fingerprint is preserved.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), { classify } = require('./resource-cache-result.cjs');
const { verifyPlatformFailure } = require('./download-platform-evidence.cjs');
const root = path.resolve(__dirname, '..');
function fingerprint(base) {
  const out = {}, walk = relative => { for (const e of fs.readdirSync(path.join(base, relative), { withFileTypes: true })) {
    const name = path.join(relative, e.name); if (e.isDirectory()) walk(name); else if (e.isFile()) out[name] = crypto.createHash('sha256').update(fs.readFileSync(path.join(base, name))).digest('hex');
  } };
  for (const scope of ['entry/src/main/ets', 'tests', 'config']) walk(scope); return out;
}
function run(kind, output = path.join(root, '.local/test-results/download-' + kind + '-probes')) {
  assert.ok(['space', 'queue', 'persistent', 'metadata'].includes(kind));
  const { recipes, controls } = require('./download-' + kind + '-fault-cases.cjs'); assert.ok(recipes.length && controls.length);
  const frozen = fingerprint(root), temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-download-probes-')));
  const evidence = { kind, source: frozen, complete: false, allDetected: false, baselines: [], probes: [], controls: [], selfBaselines: [], selfControls: [], selfFaults: [] };
  fs.mkdirSync(output, { recursive: true });
  const save = () => fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const persist = (id, raw) => fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(raw, null, 2));
  const child = (suite, name, phase, ioStage) => spawnSync(process.execPath, [path.join(temp, 'tests', suite), name, ...(phase ? ['--fault=' + phase] : []), ...(ioStage ? ['--io-stage=' + ioStage] : [])], { cwd: temp, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
  const selfChild = (name, flag) => spawnSync(process.execPath, [path.join(temp, 'tests/download-contract-probe-controls.test.cjs'), '--classifier-only', name, ...(flag ? [flag] : [])], { cwd: temp, encoding: 'utf8', timeout: 10000 });
  try {
    for (const scope of ['entry/src/main/ets', 'tests', 'config']) fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    const baselines = new Set();
    for (const c of controls) {
      const positive = child(c.suite, c.name, '', c.ioStage), negative = child(c.suite, c.name, c.phase, c.ioStage);
      const label = 'control-' + c.phase + '-' + (c.ioStage || c.name.replace(/[^a-z0-9]+/gi, '-'));
      persist(label + '-positive', positive); persist(label + '-negative', negative);
      const normal = classify(positive, c.name), failed = classify(negative, c.name);
      evidence.controls.push({ ...c, normal, failed }); save();
      assert.equal(normal.status, 'survived'); assert.equal(failed.status, 'invalid');
      assert.equal(failed.record.fixturePhase, 'download-platform'); assert.equal(failed.record.error.cause.code, 'EIO');
      assert.equal(failed.record.error.cause.message, 'injected download platform failure: ' + c.phase);
      evidence.controls[evidence.controls.length - 1].checkpoint = verifyPlatformFailure(negative, c); save();
    }
    // Without recording the injected platform failure, a selected boundary can falsely count it as detected.
    const fixture = path.join(temp, 'tests/download-contract-fixture.cjs'), originalFixture = fs.readFileSync(fixture, 'utf8');
    const anchor = '    errors.push({ phase, error }); throw error;\n  }'; assert.equal(originalFixture.split(anchor).length, 2);
    try {
      fs.writeFileSync(fixture, originalFixture.replace(anchor, '    throw error;\n  }'));
      const c = controls.find(c => c.phase === 'agent-create' || c.phase === 'legacy-create') || controls[0];
      const raw = child(c.suite, c.name, c.phase), result = classify(raw, c.name); persist('self-fault-platform-capture', raw);
      // Control assertion is expected to reject this broken capture path, regardless of detected/survived.
      assert.throws(() => assert.equal(result.status, 'invalid')); evidence.selfFaults.push({ id: 'platform-capture-removed', rejected: true, result });
    } finally { fs.writeFileSync(fixture, originalFixture); }
    for (const [id, old, replacement, selected, message] of [
      ['file-before-create', "const fileReady = !phase.startsWith('file-') || createdTasks > 0;", 'const fileReady = true;', controls.find(c => c.phase === 'file-open'), 'File fault did not reach a created task'],
      ['file-before-stage', 'const stageReady = !requestedStage || operationStage === requestedStage;', 'const stageReady = true;', controls.find(c => c.phase === 'file-open' && c.ioStage && !c.ioStage.endsWith('-initial')), 'File fault occurred before its selected save stage']
    ]) {
      if (!selected) continue;
      assert.equal(originalFixture.split(old).length, 2);
      try {
        fs.writeFileSync(fixture, originalFixture.replace(old, replacement));
        const raw = child(selected.suite, selected.name, selected.phase, selected.ioStage); persist('self-fault-' + id, raw);
        assert.equal(classify(raw, selected.name).status, 'invalid');
        assert.throws(() => verifyPlatformFailure(raw, selected), error => error.code === 'ERR_ASSERTION' && error.message.includes(message));
        evidence.selfFaults.push({ id, rejected: true });
      } finally { fs.writeFileSync(fixture, originalFixture); }
    }
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
    for (const r of recipes) {
      if (!baselines.has(r.name)) {
        const raw = child(r.suite, r.name), result = classify(raw, r.name); persist(r.id + '-baseline', raw);
        evidence.baselines.push({ name: r.name, ...result }); assert.equal(result.status, 'survived', 'Invalid baseline ' + r.id); baselines.add(r.name);
      }
      const file = path.join(temp, r.file), original = fs.readFileSync(file, 'utf8');
      assert.equal(original.split(r.old).length, 2, 'Stale or ambiguous mutation ' + r.id);
      try {
        fs.writeFileSync(file, original.replace(r.old, r.replacement));
        const raw = child(r.suite, r.name), result = classify(raw, r.name); persist(r.id, raw);
        evidence.probes.push({ id: r.id, name: r.name, file: r.file, ...result }); console.log(result.status.toUpperCase() + ' ' + r.id); save();
      } finally { fs.writeFileSync(file, original); }
    }
    assert.deepEqual(fingerprint(root), frozen); assert.deepEqual(fingerprint(temp), frozen);
    evidence.complete = true; evidence.allDetected = evidence.probes.length === recipes.length && evidence.probes.every(r => r.detected); save(); return evidence;
  } catch (error) { evidence.runnerError = error.stack; save(); throw error; }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
module.exports = { run };
if (require.main === module) {
  const e = run(process.argv[2], process.argv[3] && path.resolve(process.argv[3]));
  console.log(`${e.probes.length} download ${e.kind} fault probes passed; allDetected=${e.allDetected}`); if (!e.allDetected) process.exitCode = 1;
}
