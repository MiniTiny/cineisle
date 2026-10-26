const f = require('./offline-stop-contract-fixture.cjs'), { assert } = f, vectors = require('./fixtures/offline-stop-float-boundaries.json'), oracle = require('./fixtures/offline-stop-kotlin.json');
const tests = [], test = (name, action) => tests.push({ name, action });
function verify(check, mode, result, position, saved, played) {
  check(() => {
    if (mode === 'lower') { assert.deepEqual(result.result, { position: saved, played }); return; }
    assert.ifError(result.error); assert.deepEqual(result.ticks, [saved * 10000, saved * 10000, saved * 10000]); assert.equal(result.libraryPlayed, played); assert.equal(result.played, played); assert.equal(result.pairedRevision, true);
    if (mode === 'page') { assert.equal(result.checkpoint, position); assert.equal(result.report, ''); }
  });
}
for (const mode of ['lower', 'facade', 'page']) {
  for (const [position, saved, played] of [[9999, 0, false], [10000, 10000, false], [10001, 10001, false], [89999, 89999, false], [90000, 90000, false], [90001, 90001, false], [90999, 90999, false], [91000, 0, true], [91001, 0, true]]) test(`${mode} offline stop at ${position}`, async check => verify(check, mode, await f.invoke(mode, position, 100000), position, saved, played));
  for (const [index, [position, duration, percentage, saved, played]] of vectors.cases.entries()) test(`${mode} Kotlin float vector ${index}`, async check => verify(check, mode, await f.invoke(mode, position, duration), position, saved, played));
}
test('lower fixed Kotlin349 oracle and supplemental source provenance remain independent', async check => {
  const results = oracle.cases.map(([p, d]) => f.offlineStopState(p, d));
  check(() => { assert.equal(oracle.cases.length, 349); assert.equal(vectors.cases.length, 3); assert.equal(vectors.baseline, '225fba7cb5ad68865986a96e4b62d883c1d987a0'); assert.equal(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('tests/fixtures/' + vectors.oracleSource)).digest('hex'), vectors.oracleSourceSha256); for (const [i, [, , , saved, played]] of oracle.cases.entries()) assert.deepEqual(results[i], { position: saved, played }); });
});
test('facade unknown duration preserves the older played intent and trusted raw position', async check => {
  const { route } = f.helpers.setup(); await f.A.edit(route.item, false, true, true); const old = f.snapshot(); f.A.recordOfflineStop(route.item, 45000, 0); const current = f.snapshot();
  check(() => { assert.deepEqual(current.ticks, [450000000, 450000000, 450000000]); assert.equal(current.played, true); assert.equal(current.playedRevision, old.playedRevision); assert.ok(current.positionRevision > old.positionRevision); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
