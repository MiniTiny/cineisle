// Reusable MPV mutation verification. Only the temporary copy is edited; evidence
// belongs in .local. This is separate from the normal regression gate.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process'), { classify } = require('./mpv-probe-result.cjs');
const recipes = require('./mpv-fault-cases.cjs'), root = path.resolve(__dirname, '..');
function fingerprint() {
  const values = {};
  function visit(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) values[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    }
  }
  for (const scope of ['entry/src/main/cpp/mpv', 'entry/src/main/ets', 'tests']) visit(scope);
  return values;
}
function run({ output = path.join(root, '.local/test-results/mpv-probes'), select = '' } = {}) {
  const selected = recipes.filter(r => !select || r.id.includes(select)); assert.ok(selected.length, 'No MPV mutations selected');
  const frozen = fingerprint(), isolated = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-mpv-probes-')));
  fs.mkdirSync(output, { recursive: true });
  const evidence = { complete: false, allDetected: false, source: frozen, negativeControls: {}, baselines: [], probes: [] };
  const save = () => fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  const persist = (id, raw) => fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(raw, null, 2) + '\n');
  let baseline;
  try {
    for (const scope of ['entry/src/main/cpp/mpv', 'entry/src/main/ets', 'tests']) fs.cpSync(path.join(root, scope), path.join(isolated, scope), { recursive: true });
    baseline = require(path.join(isolated, 'tests/native-mpv-build.cjs')).build();
    const native = require(path.join(isolated, 'tests/native-mpv-run.cjs'));
    const active = { name: 'native execute admits four overlapping opens and rejects the fifth without leaking reservation', error: { code: 'ERR_ASSERTION' } };
    for (const pool of ['32', '4']) {
      const raw = native.run(baseline, { name: active.name, pool }); persist('control-pool-' + pool, raw);
      evidence.negativeControls[pool] = classify(raw, active);
    }
    assert.equal(evidence.negativeControls['32'].status, 'survived', 'Intact source must pass the valid fixture');
    assert.equal(evidence.negativeControls['4'].status, 'invalid');
    assert.equal(evidence.negativeControls['4'].caseResult.fixturePhase, 'barrier'); save();
    const cache = new Map();
    function worker(recipe, id) {
      const resultFile = path.join(output, id + '-raw.json'); fs.rmSync(resultFile, { force: true });
      const r = spawnSync(process.execPath, [path.join(isolated, 'tests/mpv-probe-worker.cjs'), JSON.stringify(recipe), resultFile], {
        cwd: isolated, encoding: 'utf8', timeout: 65000, maxBuffer: 4 * 1024 * 1024
      });
      if (r.error || r.signal || r.status !== 0 || !fs.existsSync(resultFile)) return { status: r.status, signal: r.signal,
        error: { message: r.error?.message || 'Probe worker failed' }, stdout: r.stdout, stderr: r.stderr };
      return JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    }
    for (const recipe of selected) {
      const key = JSON.stringify([recipe.kind, recipe.mode, recipe.name]);
      if (!cache.has(key)) {
        const raw = recipe.kind === 'native' ? native.run(baseline, recipe) : worker(recipe, recipe.id + '-baseline');
        persist(recipe.id + '-baseline', raw);
        const result = classify(raw, recipe); evidence.baselines.push({ id: recipe.id, ...result });
        assert.equal(result.status, 'survived', 'Invalid intact-source baseline: ' + recipe.id); cache.set(key, result);
      }
      const target = path.join(isolated, recipe.path);
      assert.ok(fs.realpathSync(target).startsWith(isolated + path.sep), 'Mutation must stay in the isolated tree');
      const original = fs.readFileSync(target, 'utf8'); assert.equal(original.split(recipe.old).length, 2, 'Stale or ambiguous mutation: ' + recipe.id);
      try {
        fs.writeFileSync(target, original.replace(recipe.old, recipe.new));
        const raw = worker(recipe, recipe.id), result = classify(raw, recipe);
        persist(recipe.id, raw); evidence.probes.push({ id: recipe.id, path: recipe.path, name: recipe.name, expectedError: recipe.error, ...result });
        console.log(result.status.toUpperCase() + ' ' + recipe.id); save();
      } finally { fs.writeFileSync(target, original); }
    }
    assert.deepEqual(fingerprint(), frozen, 'Source changed during mutation verification');
    evidence.complete = true; evidence.allDetected = evidence.probes.length === selected.length && evidence.probes.every(r => r.detected);
    save(); return evidence;
  } catch (error) { evidence.runnerError = error.stack; save(); throw error; }
  finally { baseline?.cleanup(); fs.rmSync(isolated, { recursive: true, force: true }); }
}
module.exports = { run };
if (require.main === module) {
  const result = run({ output: process.argv[2] ? path.resolve(process.argv[2]) : undefined, select: process.argv[3] || '' });
  console.log(`${result.probes.length} MPV fault probes verified; allDetected=${result.allDetected}`);
  if (!result.allDetected) process.exitCode = 1;
}
