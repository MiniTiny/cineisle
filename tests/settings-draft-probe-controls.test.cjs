// Physical native stand-in failures must override an independently detected consumer mutation.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs');
const { replaceLiteral } = require('./literal-mutation.cjs');
const root = path.resolve(__dirname, '..');
const domains = [{ scope: 'poster-options', suite: 'poster-draft-contract.test.cjs', name: 'poster draft actual input "123"',
  file: 'entry/src/main/ets/pages/Settings.ets', old: '.maxLength(PosterOptionRules.maximumCapacityDraftDigits)', replacement: '.maxLength(2)',
  modes: [['prefs-open', {}], ['prefs-get', { 'prefs-open': 1 }], ['prefs-flush', { 'prefs-put': 1 }]] }];
function run(selectedScope) {
  const selected = selectedScope ? domains.filter(domain => domain.scope === selectedScope) : domains; assert.ok(selected.length, 'No selected draft controls');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-draft-controls-'));
  const output = path.join(root, '.local/test-results/settings-draft-controls'); fs.mkdirSync(output, { recursive: true });
  const evidence = []; let count = 0;
  try {
    for (const scope of ['entry/src/main', 'tests', 'config']) fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    for (const domain of selected) {
      const location = path.join(temp, domain.file), original = fs.readFileSync(location, 'utf8'), records = new Map(domain.modes.map(([phase]) => [phase, []]));
      const child = phase => spawnSync(process.execPath, [path.join(temp, 'tests', domain.suite), domain.name, ...(phase ? ['--unannounced-' + phase] : [])], { cwd: temp, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
      for (const changed of [false, true]) {
        fs.writeFileSync(location, changed ? replaceLiteral(original, domain.old, domain.replacement) : original);
        const baselineRaw = child(), baseline = classify(baselineRaw, domain.name); assert.equal(baseline.status, changed ? 'detected' : 'survived');
        for (const [phase, requiredCalls] of domain.modes) {
          const raw = child(phase), result = classify(raw, domain.name); assert.equal(result.status, 'invalid');
          assert.equal(result.record.fixturePhase, domain.scope + '-external');
          const checkpoint = verifyExternalFailure(raw, { scope: domain.scope, phase, requiredCalls }, false);
          records.get(phase).push({ changed, baseline, baselineRaw, result, checkpoint, raw });
        }
      }
      fs.writeFileSync(location, original);
      for (const [phase, values] of records) { evidence.push({ scope: domain.scope, name: domain.name, phase, records: values }); count++; console.log('PASS ' + domain.scope + ' ' + domain.name + ' unannounced ' + phase + ' overrides healthy detected consumer mutation'); }
      fs.writeFileSync(path.join(output, (selectedScope || 'all') + '-evidence.json'), JSON.stringify(evidence, null, 2));
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  console.log(count + ' settings draft unannounced controls passed. Native stand-ins do not prove device persistence.');
}
module.exports = { run };
if (require.main === module) { try { run(process.argv[2]); } catch (error) { console.error(error); process.exitCode = 1; } }
