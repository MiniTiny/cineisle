// Mutations are limited to isolated copies; every failure needs a named production assertion.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs'), { replaceLiteral } = require('./literal-mutation.cjs');
const { verifyNativeEntry } = require('./poster-profiles-native-controls.test.cjs');
const recipes = require('./poster-profiles-fault-cases.cjs'), root = path.resolve(__dirname, '..');
const scopes = ['entry/src/main/ets', 'entry/src/main/resources', 'tests', 'config'];
function fingerprint() {
  const out = {};
  const visit = file => { for (const e of fs.readdirSync(path.join(root, file), { withFileTypes: true })) { const relative = path.join(file, e.name); if (e.isDirectory()) visit(relative); else if (e.isFile()) out[relative] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex'); } };
  scopes.forEach(visit); return out;
}
function run(output = path.join(root, '.local/test-results/poster-profiles-probes')) {
  const frozen = fingerprint(), temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-poster-profile-probes-')));
  const evidence = { complete: false, allDetected: false, source: frozen, baselines: [], probes: [], controls: [] };
  fs.mkdirSync(output, { recursive: true });
  const save = () => fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const child = (name, flag = '') => spawnSync(process.execPath, [path.join(temp, 'tests/poster-profiles-contract.test.cjs'), name, ...(flag ? [flag] : [])], { cwd: temp, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
  const persist = (id, raw) => fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(raw, null, 2));
  const mutate = (recipe, action) => { const file = path.join(temp, recipe.file), original = fs.readFileSync(file, 'utf8'); try { fs.writeFileSync(file, replaceLiteral(original, recipe.old, recipe.replacement, 'Stale or ambiguous mutation: ' + recipe.id)); return action(); } finally { fs.writeFileSync(file, original); } };
  try {
    for (const scope of scopes) fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    const selected = 'poster profile actual producer default', legal = recipes.find(recipe => recipe.id === 'default-other-legal');
    for (const [label, flag, phase, injected, requiredCalls] of [
      ['http', '--profiles-http-init-failure', 'http-create', false, { 'ui-visibility': 1 }],
      ['image', '--native-image-init-failure', 'image-source', false, { 'http-create': 1, request: 1 }],
      ['disk', '--native-disk-init-failure', 'cache-mkdir', false, { 'ui-visibility': 1 }]
    ]) for (const variant of ['normal', 'mutant']) {
      const invoke = () => { const raw = child(selected, flag), result = classify(raw, selected); persist('control-' + label + '-' + variant, raw);
        const checkpoint = verifyExternalFailure(raw, { scope: 'poster-profiles', phase, requiredCalls }, injected);
        const nativeEntry = label === 'disk' ? undefined : verifyNativeEntry(raw, label, true);
        evidence.controls.push({ label, variant, result, checkpoint, nativeEntry }); save(); assert.equal(result.status, 'invalid'); assert.equal(result.record.fixturePhase, 'poster-profiles-external'); };
      if (variant === 'mutant') mutate(legal, invoke); else invoke();
    }
    const known = new Set();
    for (const recipe of recipes) {
      if (!known.has(recipe.name)) { const raw = child(recipe.name), result = classify(raw, recipe.name); persist(recipe.id + '-baseline', raw); evidence.baselines.push({ name: recipe.name, ...result }); assert.equal(result.status, 'survived', recipe.id + ' invalid baseline'); known.add(recipe.name); }
      mutate(recipe, () => { const raw = child(recipe.name), result = classify(raw, recipe.name); persist(recipe.id, raw); evidence.probes.push({ id: recipe.id, file: recipe.file, ...result }); save(); assert.equal(result.status, 'detected', recipe.id + ' survived or invalid'); console.log('DETECTED ' + recipe.id); });
    }
    assert.deepEqual(fingerprint(), frozen); evidence.complete = true; evidence.allDetected = evidence.probes.length === recipes.length && evidence.probes.every(result => result.detected); save(); return evidence;
  } catch (error) { evidence.error = error.stack; save(); throw error; }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
module.exports = { run };
if (require.main === module) { const evidence = run(process.argv[2] ? path.resolve(process.argv[2]) : undefined); console.log(`${evidence.probes.length} poster profile fault probes passed; controls=${evidence.controls.length}`); }
