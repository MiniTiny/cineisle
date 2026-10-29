// Physical native stand-in failures are observed independently of --fault metadata.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs');
const { replaceLiteral } = require('./literal-mutation.cjs');
const root = path.resolve(__dirname, '..');
const domains = [{ scope: 'poster-options', suite: 'poster-draft-contract.test.cjs', name: 'poster draft actual input "123"',
  file: 'entry/src/main/ets/pages/Settings.ets', old: '!PosterOptionRules.validCapacityDraft(this.posterCapacity)', replacement: 'false',
  modes: [['prefs-open', {}], ['prefs-get', { 'prefs-open': 1 }], ['prefs-flush', { 'prefs-put': 1 }]] }];
function run() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-draft-controls-'));
  const output = path.join(root, '.local/test-results/settings-draft-controls'); fs.mkdirSync(output, { recursive: true });
  const evidence = []; let count = 0;
  try {
    for (const scope of ['entry/src/main', 'tests', 'config']) fs.cpSync(path.join(root, scope), path.join(temp, scope), { recursive: true });
    for (const domain of domains) {
      const location = path.join(temp, domain.file), original = fs.readFileSync(location, 'utf8');
      for (const [phase, requiredCalls] of domain.modes) {
        const records = [];
        for (const changed of [false, true]) {
          fs.writeFileSync(location, changed ? replaceLiteral(original, domain.old, domain.replacement) : original);
          const child = flag => spawnSync(process.execPath, [path.join(temp, 'tests', domain.suite), domain.name, ...(flag ? ['--unannounced-' + phase] : [])], { cwd: temp, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
          const baselineRaw = child(false), baseline = classify(baselineRaw, domain.name); assert.equal(baseline.status, 'survived');
          const raw = child(true), result = classify(raw, domain.name); assert.equal(result.status, 'invalid');
          assert.equal(result.record.fixturePhase, domain.scope + '-external');
          const checkpoint = verifyExternalFailure(raw, { scope: domain.scope, phase, requiredCalls }, false);
          records.push({ changed, baseline, baselineRaw, result, checkpoint, raw });
        }
        fs.writeFileSync(location, original); evidence.push({ scope: domain.scope, phase, records });
        console.log('PASS ' + domain.scope + ' unannounced ' + phase + ' remains invalid before and after guard removal'); count++;
        fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
      }
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  console.log(count + ' settings draft unannounced controls passed. Native stand-ins do not prove device persistence.');
}
module.exports = { run };
if (require.main === module) { try { run(); } catch (error) { console.error(error); process.exitCode = 1; } }
