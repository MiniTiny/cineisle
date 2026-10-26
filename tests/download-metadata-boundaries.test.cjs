const f = require('./download-contract-fixture.cjs');
const { assert, fs, path, h, A, backend, item, record, observe } = f;
const { validDownloads } = h.load('utils/Cache.ts');
const tests = [], test = (name, action) => tests.push({ name, action });
for (const agent of [false, true]) for (const character of ['x', '中']) for (const count of [255, 256, 257]) test(`metadata write ${agent ? 'agent' : 'legacy'} ${character} ${count}`, async check => {
  const b = backend(agent, { playbackInfo: async () => ({ MediaSources: [{ Id: 'source', Name: character.repeat(count), Container: 'mp4' }] }) });
  const result = await observe(A.download(item())); const raw = fs.existsSync(path.join(b.local.directory, 'downloads.json')) ? fs.readFileSync(path.join(b.local.directory, 'downloads.json'), 'utf8') : '[]';
  const durable = b.local.downloads(); h.activate();
  check(() => { assert.equal(result.error, undefined); assert.ok(durable[0]); assert.ok(A.downloads[0]); assert.equal(durable[0].sourceName, character.repeat(Math.min(count, 256))); assert.equal(A.downloads[0].sourceName, durable[0].sourceName); assert.equal(raw.includes('https://example.invalid/'), false); });
});
for (const [name, container, expected] of [['preferred', 'mkv', 'preferred'], ['', 'mkv', 'mkv'], [undefined, undefined, '']]) test(`metadata fallback ${String(name)} ${String(container)}`, async check => {
  const b = backend(false, { playbackInfo: async () => ({ MediaSources: [{ Id: 'source', Name: name, Container: container }] }) });
  const result = await observe(A.download(item())); const durable = b.local.downloads();
  check(() => { assert.equal(result.error, undefined); assert.equal(durable[0].sourceName, expected); });
});
for (const agent of [false, true]) test(`metadata UTF16 split ${agent ? 'agent' : 'legacy'}`, async check => {
  const b = backend(agent, { playbackInfo: async () => ({ MediaSources: [{ Id: 'source', Name: 'x'.repeat(255) + '😀Z', Container: 'mp4' }] }) });
  const result = await observe(A.download(item())); const durable = b.local.downloads(); h.activate();
  check(() => { assert.equal(result.error, undefined); assert.equal(durable[0].sourceName, 'x'.repeat(255) + '\ud83d'); assert.equal(durable[0].sourceName.length, 256); assert.equal(A.downloads[0].sourceName, durable[0].sourceName); if (agent) assert.equal(b.made[0].options.title, 'movie'); });
});
for (const count of [255, 256, 257]) test(`metadata independent reader ${count}`, async check => {
  const b = backend(false), r = record({ state: 'complete', progress: 1, sourceName: 'x'.repeat(count) });
  fs.writeFileSync(r.path, 'existing video');
  const filename = path.join(b.local.directory, 'downloads.json'); fs.writeFileSync(filename, JSON.stringify([r]));
  const validation = validDownloads([r], b.local.directory), read = b.local.downloads();
  const names = fs.readdirSync(b.local.directory);
  check(() => { assert.equal(validation, count <= 256); assert.equal(read.length, count <= 256 ? 1 : 0); assert.equal(b.local.recovered, count > 256); assert.equal(names.some(s => s.startsWith('downloads.json.corrupt-')), count > 256); assert.equal(fs.readFileSync(r.path, 'utf8'), 'existing video'); if (count <= 256) assert.equal(read[0].sourceName.length, count); });
});
test('metadata old absent source name keeps exact fields and file on roundtrip', async check => {
  const b = backend(false), r = record({ state: 'complete', progress: 1, mediaSourceId: 'legacy' });
  fs.writeFileSync(r.path, 'old video'); fs.writeFileSync(path.join(b.local.directory, 'downloads.json'), JSON.stringify([r]));
  const read = b.local.downloads(); b.local.saveDownloads(read); h.activate();
  check(() => { assert.equal(A.downloads.length, 1); assert.equal(Object.hasOwn(A.downloads[0], 'sourceName'), false); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(b.local.directory, 'downloads.json'), 'utf8')), [r]); assert.equal(fs.readFileSync(r.path, 'utf8'), 'old video'); });
});
for (const value of [null, 256, {}, []]) test(`metadata invalid sourceName ${JSON.stringify(value)}`, async check => {
  const b = backend(false), r = record({ sourceName: value });
  check(() => assert.equal(validDownloads([r], b.local.directory), false));
});
test('metadata source name and platform title use independent inputs', async check => {
  const b = backend(true, { playbackInfo: async () => ({ MediaSources: [{ Id: 'source', Name: 's'.repeat(257), Container: 'mp4' }] }) });
  const result = await observe(A.download(item('movie', { Name: 't'.repeat(257) })));
  check(() => { assert.equal(result.error, undefined); assert.equal(b.local.downloads()[0].sourceName, 's'.repeat(256)); assert.equal(b.made[0].options.title, 't'.repeat(256)); });
});
if (require.main === module) f.run(tests, 'download metadata boundary').catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
