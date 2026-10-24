// Only isolated source copies are mutated. The working tree is fingerprinted.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), { classify } = require('./resource-cache-result.cjs');
const recipes = require('./resource-cache-fault-cases.cjs'), root = path.resolve(__dirname, '..');
function fingerprint() {
  const result = {};
  const visit = dir => { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const file = path.join(dir, e.name); if (e.isDirectory()) visit(file); else if (e.isFile()) result[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); } };
  for (const scope of ['entry/src/main/ets', 'tests']) visit(scope); return result;
}
function run(output = path.join(root, '.local/test-results/resource-probes'), select = '') {
  const selected = recipes.filter(r => !select || r.id.startsWith(select)); assert.ok(selected.length);
  const frozen = fingerprint(), temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-resource-probes-')));
  fs.mkdirSync(output, { recursive: true }); const evidence = { complete: false, allDetected: false, source: frozen, baselines: [], probes: [] };
  const save = () => fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const persist = (id, value) => fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(value, null, 2));
  const child = (name, fault = '') => spawnSync(process.execPath, [path.join(temp, 'tests/resource-cache-boundaries.test.cjs'), name, ...(fault ? [fault] : [])], { cwd: temp, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  try {
    for (const scope of ['entry/src/main/ets', 'tests']) fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    const name = selected[0].name, positive = child(name), negative = child(name, '--fixture-failure'); persist('intact-control', positive); persist('fixture-control', negative);
    evidence.positiveControl = classify(positive, name); evidence.negativeControl = classify(negative, name);
    assert.equal(evidence.positiveControl.status, 'survived'); assert.equal(evidence.negativeControl.status, 'invalid');
    assert.equal(evidence.negativeControl.record.fixturePhase, 'setup'); assert.equal(evidence.negativeControl.record.error.cause.code, 'ENOTDIR'); save();
    const opening = 'poster image bytes 2097152', validCache = child(opening), failedCache = child(opening, '--cache-open-failure');
    persist('cache-open-positive', validCache); persist('cache-open-negative', failedCache);
    evidence.cacheOpenPositive = classify(validCache, opening); evidence.cacheOpenNegative = classify(failedCache, opening);
    assert.equal(evidence.cacheOpenPositive.status, 'survived'); assert.equal(evidence.cacheOpenNegative.status, 'invalid');
    assert.equal(evidence.cacheOpenNegative.record.fixturePhase, 'cache-open'); assert.match(evidence.cacheOpenNegative.record.error.cause.message, /poster_cache_unavailable/); save();
    const cache = new Set();
    for (const r of selected) {
      if (!cache.has(r.name)) { const raw = child(r.name), result = classify(raw, r.name); persist(r.id + '-baseline', raw); evidence.baselines.push({ name: r.name, ...result }); assert.equal(result.status, 'survived', 'Invalid intact baseline: ' + r.id); cache.add(r.name); }
      const file = path.join(temp, r.file); assert.ok(fs.realpathSync(file).startsWith(temp + path.sep)); const original = fs.readFileSync(file, 'utf8'); assert.equal(original.split(r.old).length, 2, 'Stale/ambiguous mutation: ' + r.id);
      try { fs.writeFileSync(file, original.replace(r.old, r.replacement)); const raw = child(r.name), result = classify(raw, r.name); persist(r.id, raw); evidence.probes.push({ id: r.id, name: r.name, file: r.file, ...result }); console.log(result.status.toUpperCase() + ' ' + r.id); save(); }
      finally { fs.writeFileSync(file, original); }
    }
    assert.deepEqual(fingerprint(), frozen); evidence.complete = true; evidence.allDetected = evidence.probes.length === selected.length && evidence.probes.every(r => r.detected); save(); return evidence;
  } catch (error) { evidence.runnerError = error.stack; save(); throw error; }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
module.exports = { run };
if (require.main === module) { const e = run(process.argv[2] ? path.resolve(process.argv[2]) : undefined, process.argv[3] || ''); console.log(`${e.probes.length} resource fault probes verified; allDetected=${e.allDetected}`); if (!e.allDetected) process.exitCode = 1; }
