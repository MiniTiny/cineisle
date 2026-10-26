const f = require('./download-contract-fixture.cjs');
const { assert, fs, h, A, api, backend, item, observe, settle } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
for (const agent of [false, true]) {
  const label = agent ? 'agent' : 'legacy';
  for (const count of [3, 4, 5]) test(`queue ${label} count ${count}`, async check => {
    const b = backend(agent), result = await observe(A.batchDownload(Array.from({ length: count }, (_, n) => item('m' + n))));
    const durable = b.local.downloads();
    check(() => { assert.equal(result.error, undefined); assert.equal(b.made.length, Math.min(count, 4)); assert.equal(A.downloads.filter(r => r.state === 'downloading').length, Math.min(count, 4)); assert.equal(A.downloads.filter(r => r.state === 'queued').length, Math.max(0, count - 4)); assert.equal(durable.length, count); });
  });
  test(`queue ${label} direct fifth remains allowed`, async check => {
    const b = backend(agent), direct = []; for (let n = 0; n < 5; n++) direct.push(await observe(A.download(item('m' + n))));
    const queued = await observe(A.batchDownload([item('sixth')]));
    check(() => { assert.equal(direct.some(r => r.error), false); assert.equal(queued.error, undefined); assert.equal(b.made.length, 5); assert.equal(A.downloads.filter(r => r.state === 'queued').length, 1); assert.equal(b.local.downloads().length, 6); });
  });
  for (const outcome of ['complete', 'fail']) test(`queue ${label} ${outcome} releases slot`, async check => {
    const b = backend(agent); await A.batchDownload(Array.from({ length: 5 }, (_, n) => item('m' + n)));
    await b.emit(b.made[0], agent ? outcome === 'complete' ? 'completed' : 'failed' : outcome, 50);
    check(() => { assert.equal(b.made.length, 5); assert.equal(A.downloads.find(r => r.id === 'm4').state, 'downloading'); assert.equal(A.downloads.find(r => r.id === 'm0').state, outcome === 'complete' ? 'complete' : 'failed'); assert.equal(A.pumping, false); assert.equal(b.local.downloads().find(r => r.id === 'm4').state, 'downloading'); });
  });
  for (const reason of ['detail', 'source', 'platform', 'space']) test(`queue ${label} ${reason} failure continues`, async check => {
    const error = Error('unavailable fixture'), b = backend(agent, {
      detail: async id => { if (id === 'bad' && reason === 'detail') throw error; return item(id); },
      playbackInfo: async id => ({ MediaSources: id === 'bad' && reason === 'source' ? [] : [{ Id: 'source', Container: 'mp4', Size: id === 'bad' && reason === 'space' ? 2 ** 40 : 100 }] }),
      create: async options => { if (options.url.includes('/bad/') && reason === 'platform') throw error; }
    });
    if (reason === 'platform') f.expectFailure(agent ? 'agent-create' : 'legacy-create');
    const result = await observe(A.batchDownload([item('bad'), item('good')]));
    const expected = reason === 'detail' || reason === 'platform' ? 'unavailable fixture' : reason === 'source' ? 'no_download_source' : 'download_space_insufficient';
    check(() => { assert.equal(result.error, undefined); assert.deepEqual(result.value, ['bad']); assert.equal(A.downloads.find(r => r.id === 'good').state, 'downloading'); assert.equal(A.downloads.find(r => r.id === 'bad').state, 'failed'); assert.ok(A.downloads.find(r => r.id === 'bad').failure.includes(expected)); assert.equal(A.pumping, false); });
  });
  test(`queue ${label} overlap and repeated clicks remain serialized`, async check => {
    const gate = h.deferred(); let details = 0;
    const b = backend(agent, { detail: async id => { if (++details === 1) await gate.promise; return item(id); } });
    const first = observe(A.batchDownload([item('a'), item('b'), item('c')])); await settle();
    const second = observe(A.batchDownload([item('a'), item('d'), item('e')])); await settle();
    gate.resolve(); const results = await Promise.all([first, second]);
    check(() => { assert.equal(results.some(r => r.error), false); assert.equal(b.made.length, 4); assert.equal(A.downloads.length, 5); assert.equal(new Set(A.downloads.map(r => r.id)).size, 5); assert.equal(A.pumping, false); });
  });
  test(`queue ${label} duplicate direct starts share admission`, async check => {
    const gate = h.deferred(); let info = 0;
    const b = backend(agent, { playbackInfo: async () => { if (++info === 1) await gate.promise; return { MediaSources: [{ Id: 'source', Container: 'mp4' }] }; } });
    const first = observe(A.download(item())), second = observe(A.download(item())); await settle(); gate.resolve();
    const results = await Promise.all([first, second]);
    check(() => { assert.equal(results[0].error, undefined); assert.equal(results[1].error?.message, 'download_exists'); assert.equal(b.made.length, 1); assert.equal(A.downloads.length, 1); });
  });
  test(`queue ${label} queue save failure creates no task`, async check => {
    const b = backend(agent); f.io.openSync = () => { throw Error('disk full'); };
    const result = await observe(A.batchDownload([item()]));
    check(() => { assert.equal(result.error?.message, 'disk full'); assert.equal(b.made.length, 0); assert.equal(A.downloads.length, 0); });
  });
  test(`queue ${label} real metadata rename failure removes created task`, async check => {
    const b = backend(agent), rename = f.io.renameSync; let failed = false;
    f.io.renameSync = (...args) => { if (!failed && args[1].endsWith('/downloads.json')) { failed = true; throw Error('disk rename failed'); } return rename(...args); };
    const result = await observe(A.download(item()));
    check(() => { assert.equal(failed, true); assert.equal(result.error?.message, 'download_create_failed'); assert.equal(b.removed.length, 1); assert.equal(A.tasks.size, 0); assert.equal(A.downloads.length, 0); assert.equal(b.local.downloads().length, 0); });
  });
  test(`queue ${label} account change during detail cannot start another account task`, async check => {
    const gate = h.deferred(), b = backend(agent, { detail: async id => { await gate.promise; return item(id); } });
    const pending = observe(A.batchDownload([item()])); await settle(); const next = h.activate('other'); gate.resolve(); await pending;
    check(() => { assert.equal(b.made.length, 0); assert.strictEqual(A.client, next); assert.equal(A.downloads.length, 0); assert.equal(A.pumping, false); assert.equal(b.local.downloads()[0].state, 'queued'); });
  });
  test(`queue ${label} late old account event cannot save or pump`, async check => {
    const b = backend(agent); await A.download(item()); const saves = b.saves.length, old = A.downloads[0];
    const next = h.activate('other'); await b.emit(b.made[0], agent ? 'completed' : 'complete');
    check(() => { assert.equal(old.state, 'downloading'); assert.equal(b.saves.length, saves); assert.strictEqual(A.client, next); assert.equal(A.downloads.length, 0); });
  });
  test(`queue ${label} removal ignores late events and retains original pump timing`, async check => {
    const b = backend(agent); await A.batchDownload(Array.from({ length: 5 }, (_, n) => item('m' + n)));
    const r = A.downloads.find(r => r.id === 'm0'), task = b.made[0]; await A.removeDownload(r);
    if (agent) task.handlers.completed({ state: 64, processed: 100, sizes: [100] }); else task.handlers.complete();
    await settle(); const beforePump = b.made.length, queued = A.downloads.filter(r => r.state === 'queued').length;
    await A.pumpDownloads();
    check(() => { assert.equal(beforePump, 4); assert.equal(queued, 1); assert.equal(b.removed.length, 1); assert.equal(b.made.length, 5); assert.equal(A.downloads.some(value => value === r), false); assert.equal(b.local.downloads().some(value => value.id === 'm0'), false); });
  });
  test(`queue ${label} cold active records retain backend recovery semantics`, async check => {
    const b = backend(agent, { show: async id => ({ progress: { state: id === '1' ? 64 : 32, processed: 50, sizes: [100] } }) });
    await A.batchDownload(Array.from({ length: 5 }, (_, n) => item('m' + n)));
    const firstPath = A.downloads.find(r => r.id === 'm0').path; fs.writeFileSync(firstPath, 'video');
    h.activate(); A.client.detail = b.client.detail; A.client.playbackInfo = b.client.playbackInfo; A.client.stream = b.client.stream;
    await A.restoreDownloads(); await A.pumpDownloads();
    check(() => { assert.equal(b.made.length, 5); assert.equal(A.downloads.find(r => r.id === 'm0').state, agent ? 'complete' : 'interrupted'); assert.equal(A.downloads.find(r => r.id === 'm4').state, 'downloading'); assert.equal(A.downloads.filter(r => r.state === 'downloading').length, agent ? 4 : 1); });
  });
  test(`queue ${label} cold queued records execute real pump`, async check => {
    const b = backend(agent); A.pumping = true;
    await A.batchDownload([item('a'), item('b'), item('c'), item('d'), item('e')]); h.activate(); A.pumping = false;
    // h.activate constructs a fresh real LocalStore; keep deterministic Jellyfin methods on its new client.
    A.client.detail = b.client.detail; A.client.playbackInfo = b.client.playbackInfo; A.client.stream = b.client.stream;
    await A.pumpDownloads();
    check(() => { assert.equal(b.made.length, 4); assert.equal(A.downloads.filter(r => r.state === 'queued').length, 1); assert.equal(A.local.downloads().length, 5); });
  });
}
test('queue legacy progress keeps memory-only behavior while poll saves', async check => {
  const b = backend(false); await A.download(item()); const before = b.saves.length;
  await b.emit(b.made[0], 'progress', 25); const progressSaves = b.saves.length, durable = b.local.downloads()[0];
  await A.pollDownloads();
  check(() => { assert.equal(progressSaves, before); assert.equal(durable.received, undefined); assert.equal(b.saves.length, before + 1); assert.equal(A.downloads[0].taskId, 1); });
});
if (require.main === module) f.run(tests, 'download queue boundary').catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
