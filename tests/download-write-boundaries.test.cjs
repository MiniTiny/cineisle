// The actual public video entry creates the task before any targeted storage fault is armed.
const f = require('./download-contract-fixture.cjs');
const { assert, A, backend, item, observe } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
for (const agent of [false, true]) test(`write ${agent ? 'agent' : 'legacy'} initial`, async check => {
  const b = backend(agent); f.stage(`${agent ? 'agent' : 'legacy'}-initial`);
  const result = await observe(A.download(item())); const durable = b.local.downloads();
  check(() => { assert.equal(result.error, undefined); assert.equal(b.made.length, 1); assert.equal(durable.length, 1); assert.equal(durable[0].state, 'downloading'); });
});
for (const stage of ['progress', 'restore', 'poll']) test(`write agent ${stage}`, async check => {
  Date.now = () => 10000; const b = backend(true); await A.download(item());
  const initial = b.local.downloads(), savesBefore = b.saves.length; f.stage('agent-' + stage);
  const result = await observe(stage === 'progress' ? b.emit(b.made[0], 'progress', 25) : stage === 'restore' ? A.restoreDownloads() : A.pollDownloads());
  const durable = b.local.downloads();
  check(() => { assert.equal(result.error, undefined); assert.equal(b.made.length, 1); assert.equal(initial[0].received, undefined); assert.equal(durable[0].received, stage === 'progress' ? 25 : 50); assert.equal(b.saves.length, savesBefore + 1); });
});
test('write legacy poll', async check => {
  const b = backend(false); await A.download(item()); const savesBefore = b.saves.length; f.stage('legacy-poll');
  const result = await observe(A.pollDownloads()), durable = b.local.downloads();
  check(() => { assert.equal(result.error, undefined); assert.equal(b.made.length, 1); assert.equal(durable[0].received, 0); assert.equal(durable[0].taskId, 1); assert.equal(b.saves.length, savesBefore + 1); });
});
if (require.main === module) f.run(tests, 'download write boundary').catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
