const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs'), { replaceLiteral } = require('./literal-mutation.cjs');
const root = path.resolve(__dirname, '..'), prefix = 'POSTER_PROFILE_NATIVE_ENTRY ';
function verifyNativeEntry(raw, api, failed) {
  const id = api === 'http' ? '@ohos.net.http.createHttp' : '@ohos.multimedia.image.createImageSource';
  const rows = ((raw.stdout || '') + '\n' + (raw.stderr || '')).split('\n').filter(line => line.startsWith(prefix)).map(line => JSON.parse(line.slice(prefix.length)));
  const selected = rows.filter(row => row.api === id);
  assert.equal(selected.length, 1, 'Missing or ambiguous original API entry');
  const entry = selected[0]; assert.equal(entry.version, 1); assert.equal(entry.call, 1); assert.equal(entry.failed, failed);
  if (api === 'http' && failed) assert.equal(rows.filter(row => row.api === '@ohos.multimedia.image.createImageSource').length, 0, 'HTTP failure must precede image initialization');
  return entry;
}
function run(output = path.join(root, '.local/test-results/poster-profiles-native-controls')) {
  const scopes = ['entry/src/main/ets', 'entry/src/main/resources', 'tests', 'config'];
  const fingerprints = base => {
    const rows = {}, visit = relative => { for (const entry of fs.readdirSync(path.join(base, relative), { withFileTypes: true })) { const name = path.join(relative, entry.name); if (entry.isDirectory()) visit(name); else if (entry.isFile()) rows[name] = crypto.createHash('sha256').update(fs.readFileSync(path.join(base, name))).digest('hex'); } }; scopes.forEach(visit); return rows;
  };
  const frozen = fingerprints(root), temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-poster-native-controls-')));
  const evidence = { complete: false, source: frozen, results: [] }, name = 'poster profile actual producer default';
  fs.mkdirSync(output, { recursive: true });
  const save = () => fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const mutation = require('./poster-profiles-fault-cases.cjs').find(recipe => recipe.id === 'default-other-legal');
  try {
    for (const scope of scopes) fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    const file = path.join(temp, mutation.file), original = fs.readFileSync(file, 'utf8');
    for (const scenario of ['healthy', 'http', 'image']) for (const variant of ['normal', 'mutant']) {
      fs.writeFileSync(file, variant === 'normal' ? original : replaceLiteral(original, mutation.old, mutation.replacement));
      const flag = scenario === 'http' ? '--profiles-http-init-failure' : scenario === 'image' ? '--native-image-init-failure' : '';
      const raw = spawnSync(process.execPath, [path.join(temp, 'tests/poster-profiles-contract.test.cjs'), name, ...(flag ? [flag] : [])], { cwd: temp, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
      const id = scenario + '-' + variant, result = classify(raw, name); fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(raw, null, 2));
      const entries = [];
      if (scenario === 'healthy') {
        assert.equal(result.status, variant === 'normal' ? 'survived' : 'detected');
        entries.push(verifyNativeEntry(raw, 'http', false), verifyNativeEntry(raw, 'image', false));
      } else {
        assert.equal(result.status, 'invalid'); assert.equal(result.record.fixturePhase, 'poster-profiles-external'); assert.equal(result.record.error.cause.code, 'EIO');
        const checkpoint = verifyExternalFailure(raw, { scope: 'poster-profiles', phase: scenario === 'http' ? 'http-create' : 'image-source', requiredCalls: scenario === 'http' ? { 'ui-visibility': 1 } : { 'http-create': 1, request: 1 } }, false);
        entries.push(verifyNativeEntry(raw, scenario, true));
        if (scenario === 'image') entries.push(verifyNativeEntry(raw, 'http', false));
        assert.equal(checkpoint.injected, false);
      }
      evidence.results.push({ id, result, entries }); save(); console.log('PASS original native API ' + id);
    }
    assert.deepEqual(fingerprints(root), frozen); evidence.complete = true; save(); return evidence;
  } catch (error) { evidence.error = error.stack; save(); throw error; }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
module.exports = { run, verifyNativeEntry };
if (require.main === module) { const evidence = run(); console.log(`${evidence.results.length} poster profile native API controls passed.`); }
