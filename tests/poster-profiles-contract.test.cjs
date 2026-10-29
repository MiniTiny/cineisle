const f = require('./poster-profiles-fixture.cjs'), { assert, A, h, p } = f;
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const tests = [], test = (name, action) => tests.push({ name, action });
// Independent fixed expectations, never read from PosterImagePolicy.
const producers = [
  ['default', 480, 'one', 'primary-tag', false], ['card', 480, 'one', 'primary-tag', false],
  ['wide', 1280, 'one', 'backdrop-tag', true], ['cast', 160, 'person', 'person-tag', false],
  ['actor', 160, 'person', 'person-tag', false], ['detail', 1280, 'one', 'backdrop-tag', true]
];
const keyFor = (client, id, tag, backdrop, width) => crypto.createHash('sha256').update(JSON.stringify([client.session.serverId + '\0' + client.session.userId, id, tag, backdrop, width, 'jpeg-v1'])).digest('hex');
for (const [name, width, id, tag, backdrop] of producers) test('poster profile actual producer ' + name, async check => {
  const client = f.client(); A.posters = f.cache(); f.provider(() => ({ responseCode: 200, result: f.jpeg() }));
  const entry = f.producer(name), before = f.requests().length, descriptor = entry.descriptor();
  await f.load(entry);
  const calls = f.requests().slice(), decoded = p.imageState.decoded.map(value => JSON.parse(JSON.stringify(value)));
  const expectedKey = keyFor(client, id, tag, backdrop, width), usage = await A.posters.usage();
  const indexPath = path.join(p.root, 'index.json'), index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : undefined;
  const raw = fs.existsSync(path.join(p.root, expectedKey + '.img')) ? fs.readFileSync(path.join(p.root, expectedKey + '.img')) : undefined;
  const bitmap = entry.view.bitmap;
  check(() => {
    assert.equal(before, 0); assert.deepEqual(descriptor, { id, tag, backdrop, width });
    assert.equal(calls.length, 1); const { url, options } = calls[0];
    assert.equal(url.pathname, backdrop ? '/jellyfin/Items/one/Images/Backdrop/0' : '/jellyfin/Items/' + id + '/Images/Primary');
    assert.equal(url.searchParams.get('maxWidth'), String(width)); assert.equal(url.searchParams.get('quality'), '85'); assert.equal(url.searchParams.get('format'), 'Jpg'); assert.equal(url.searchParams.get('tag'), tag);
    assert.equal(url.searchParams.has('api_key'), false); assert.equal(options.maxLimit, 2097152); assert.equal(options.usingCache, false);
    assert.deepEqual(decoded, [{ desiredSize: { width, height: width * 3 / 2 }, editable: false }]);
    assert.ok(bitmap); assert.equal(bitmap.width, width); assert.equal(usage.issue, ''); assert.equal(usage.files, 1);
    assert.deepEqual(Object.keys(index), ['entries']); assert.deepEqual(Object.keys(index.entries[0]), ['key', 'size', 'touched', 'saved']); assert.equal(index.entries[0].key, expectedKey);
    assert.deepEqual(raw, Buffer.from(f.jpeg()));
  });
});
for (const [name, width, id, tag, backdrop] of producers) test('poster profile old offline cache ' + name, async check => {
  const client = f.client(), key = keyFor(client, id, tag, backdrop, width), bytes = Buffer.from(f.jpeg());
  fs.mkdirSync(p.root, { recursive: true }); fs.writeFileSync(path.join(p.root, key + '.img'), bytes);
  fs.writeFileSync(path.join(p.root, 'index.json'), JSON.stringify({ entries: [{ key, size: bytes.length, touched: 1, saved: 1 }] }));
  A.posters = f.cache(); A.experience.update(state => { state.offline = true; });
  f.provider(() => { throw Error('offline image cannot request HTTP'); });
  const entry = f.producer(name); await f.load(entry);
  const descriptor = entry.descriptor(), requestCount = f.requests().length, bitmap = entry.view.bitmap, usage = await A.posters.usage();
  check(() => { assert.deepEqual(descriptor, { id, tag, backdrop, width }); assert.equal(requestCount, 0); assert.ok(bitmap); assert.equal(bitmap.width, width); assert.equal(usage.issue, ''); assert.equal(usage.files, 1); assert.deepEqual(fs.readFileSync(path.join(p.root, key + '.img')), bytes); });
});
for (const width of [159, 161, 479, 481, 1279, 1281]) for (const mode of ['http', 'cache']) test(`poster profile independent ${mode} width ${width}`, async check => {
  const client = f.client(); let fetched = 0; f.provider(() => ({ responseCode: 200, result: f.jpeg() }));
  const target = { id: 'one', tag: 'primary-tag', backdrop: false, width };
  const cache = f.cache(); await cache.initialize();
  const result = await f.observed(mode === 'http' ? client.poster(target, () => true).result : cache.request('server\0user', target, () => { fetched++; return { result: Promise.resolve(f.jpeg()), cancel() {} }; }, () => true, () => true).result);
  check(() => { assert.equal(cache.issue, ''); assert.equal(result.error?.message, 'poster_cancelled'); assert.equal(f.requests().length, 0); assert.equal(fetched, 0); });
});
for (const status of [401, 403, 404, 500]) test('poster profile error placeholder ' + status, async check => {
  f.client(); A.posters = f.cache(); f.provider(() => ({ responseCode: status, result: f.jpeg() }));
  const entry = f.producer('card'); await f.load(entry);
  check(() => { assert.equal(f.requests().length, 1); assert.equal(entry.view.bitmap, undefined); assert.equal(entry.view.source, entry.view.placeholder); assert.equal(p.imageState.decoded.length, 0); });
});
if (require.main === module) f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
