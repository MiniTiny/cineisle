// Native Preferences failures are observed at actual operations, without contractInjected tags.
// Mutation copies remain separate from the checkout and retain complete SDK resource inputs.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs');
const { replaceLiteral } = require('./literal-mutation.cjs');
const root = path.resolve(__dirname, '..');
const name = 'language editor native failures are invalid with and without rule drift';
const tests = [[name, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-language-editor-'));
  const source = 'entry/src/main/ets/utils/PlaybackPreferences.ts', page = 'entry/src/main/ets/pages/Player.ets';
  const suite = 'language editor save audioLanguage 63';
  try {
    for (const scope of ['entry/src/main/ets', 'entry/src/main/resources', 'tests', 'config']) fs.cpSync(path.join(root, scope), path.join(directory, scope), { recursive: true });
    const original = fs.readFileSync(path.join(directory, source), 'utf8'), originalPage = fs.readFileSync(path.join(directory, page), 'utf8');
    const run = args => spawnSync(process.execPath, ['tests/language-match-contract.test.cjs', suite, ...args], { cwd: directory, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(classify(run([]), suite).status, 'survived');
    for (const mutated of [false, true]) {
      fs.writeFileSync(path.join(directory, source), mutated ? replaceLiteral(original, 'maximumRawCodeUnits: number = 63', 'maximumRawCodeUnits: number = 62') : original);
      const healthy = classify(run([]), suite);
      assert.equal(healthy.status, mutated ? 'detected' : 'survived');
      console.log('LANGUAGE_EDITOR_CONTROL_BASELINE ' + JSON.stringify({ mutated, ...healthy }));
      for (const [flag, phase, requiredCalls] of [
        ['--native-preferences-open-failure', 'preferences-open', { 'ui-compile': 1, 'native-player-create': 1 }],
        ['--native-preferences-read-failure', 'preferences-get', { 'preferences-open': 1, 'ui-compile': 1 }],
        ['--native-preferences-flush-failure', 'preferences-flush', { 'preferences-put': 1, 'ui-compile': 1 }]
      ]) {
        const result = run([flag]);
        assert.equal(classify(result, suite).status, 'invalid', phase + ' drift=' + mutated);
        const checkpoint = verifyExternalFailure(result, { scope: 'language-match', phase, requiredCalls }, false);
        console.log('LANGUAGE_EDITOR_CONTROL ' + JSON.stringify({ mutated, result: classify(result, suite), checkpoint }));
      }
      fs.writeFileSync(path.join(directory, page), originalPage + '\ninvalid {');
      try {
        const result = run([]);
        assert.equal(classify(result, suite).status, 'invalid');
        const checkpoint = verifyExternalFailure(result, { scope: 'language-match', phase: 'ui-compile' }, false);
        console.log('LANGUAGE_EDITOR_CONTROL ' + JSON.stringify({ mutated, result: classify(result, suite), checkpoint }));
      } finally { fs.writeFileSync(path.join(directory, page), originalPage); }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}]];
module.exports = tests;
if (require.main === module) {
  const selected = process.argv[2], cases = selected ? tests.filter(([n]) => n === selected) : tests;
  assert.ok(cases.length);
  for (const [n, run] of cases) { run(); console.log('PASS ' + n); }
  console.log(`${cases.length} language editor probe control tests passed.`);
}
