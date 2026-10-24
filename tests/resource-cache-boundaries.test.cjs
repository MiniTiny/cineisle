// Actual services/transports/parsers and isolated real files; Harmony APIs are fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { fixture, runCase } = require('./resource-cache-result.cjs');
const h = require('./feature-regression.test.cjs'), platform = require('./poster-platform.cjs').install(h);
const { AppService: A } = h.load('service/AppService.ets');
const { PosterCache } = h.load('service/PosterCache.ets');
const { NetworkPolicy, NetworkOptions } = h.load('utils/NetworkOptions.ts');
const http = h.platform.get('@ohos.net.http'), originalHttp = http.createHttp, originalNow = Date.now;
const fileApi = h.platform.get('@ohos.file.fs'), originalWrite = fileApi.write, originalRename = fileApi.rename;
const tests = [], test = (name, action) => tests.push({ name, action });
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
const observe = promise => promise.then(value => ({ value }), error => ({ error }));
const jpeg = (size = 128, value = 1) => { const bytes = new Uint8Array(size).fill(value); bytes.set([255, 216, 255]); return bytes.buffer; };
const target = (id = 'one', tag = 'tag') => ({ id, tag, backdrop: false, width: 480 });
const ticket = value => ({ result: Promise.resolve(value), cancel() {} });
const getPoster = (cache, item = target(), bytes = jpeg(), online = true, account = 'server\0user') =>
  cache.request(account, item, () => ticket(bytes), () => online, () => true).result;
async function cache() {
  return fixture('cache-open', async () => { const value = new PosterCache(h.context); await value.initialize(); assert.equal(value.issue, ''); return value; });
}
async function healthy(cache) { await fixture('cache-io', () => assert.equal(cache.issue, '')); }
async function before() {
  A.posters?.cancelAll(false); h.reset(); platform.reset(); http.createHttp = originalHttp;
  Date.now = originalNow; fileApi.write = originalWrite; fileApi.rename = originalRename;
  NetworkPolicy.publish(new NetworkOptions()); NetworkPolicy.networkAvailable = undefined;
  if (process.argv[3] === '--fixture-failure') { const blocked = path.join(h.directory, 'blocked'); fs.writeFileSync(blocked, 'file'); fs.writeFileSync(path.join(blocked, 'child'), 'unreachable'); }
  if (process.argv[3] === '--cache-open-failure') { fs.mkdirSync(path.dirname(platform.root), { recursive: true }); fs.writeFileSync(platform.root, 'not a cache directory'); }
}
async function after() { http.createHttp = originalHttp; Date.now = originalNow; fileApi.write = originalWrite; fileApi.rename = originalRename; }

for (const backdrop of [false, true]) for (const width of [160, 480, 1280]) test(`poster HTTP ${backdrop ? 'backdrop' : 'primary'} width ${width}`, async check => {
  const calls = []; let destroyed = 0;
  http.createHttp = () => ({ async request(url, options) { calls.push({ url, options }); return { responseCode: 200, result: jpeg() }; }, destroy() { destroyed++; } });
  const result = await observe(h.activate().poster({ ...target(), backdrop, width }, () => true).result);
  check(() => { assert.ifError(result.error); assert.equal(result.value.byteLength, 128); assert.equal(calls.length, 1); const url = new URL(calls[0].url);
    assert.equal(url.pathname, backdrop ? '/jellyfin/Items/one/Images/Backdrop/0' : '/jellyfin/Items/one/Images/Primary');
    assert.equal(url.searchParams.get('maxWidth'), String(width)); assert.equal(url.searchParams.get('quality'), '85'); assert.equal(url.searchParams.get('format'), 'Jpg');
    assert.equal(url.searchParams.has('api_key'), false); assert.equal(calls[0].options.maxLimit, 2097152); assert.equal(calls[0].options.usingCache, false); assert.equal(destroyed, 1); });
});
for (const width of [159, 161, 479, 481, 1279, 1281]) test(`poster rejects unsupported width ${width}`, async check => {
  let calls = 0; http.createHttp = () => { calls++; throw Error('unexpected HTTP'); };
  const result = await observe(h.activate().poster({ ...target(), width }, () => true).result);
  check(() => { assert.equal(result.error?.message, 'poster_cancelled'); assert.equal(calls, 0); });
});
for (const length of [299, 300, 301]) test(`poster account code units ${length}`, async check => {
  const c = await cache(), result = await observe(getPoster(c, target(), jpeg(), true, 'a'.repeat(length))); await healthy(c);
  check(() => { if (length > 300) assert.equal(result.error?.message, 'poster_cancelled'); else { assert.ifError(result.error); assert.equal(result.value.bytes.byteLength, 128); } });
});
for (const age of [86399999, 86400000, 86400001]) test(`poster untagged freshness ${age}`, async check => {
  let now = 1000000000, fetched = 0; Date.now = () => now; const c = await cache(), item = { ...target(), tag: undefined };
  const request = () => c.request('server\0user', item, () => { fetched++; return ticket(jpeg(128, fetched)); }, () => true, () => true).result;
  await request(); now += age; const data = await request(); await healthy(c);
  check(() => { assert.equal(fetched, age < 86400000 ? 1 : 2); assert.equal(new Uint8Array(data.bytes)[3], fetched); });
});
for (const mode of ['tagged', 'offline', 'unavailable']) test(`poster stale ${mode} compatibility`, async check => {
  let now = 1000000000, fetched = 0; Date.now = () => now; const c = await cache(), item = { ...target(), tag: mode === 'tagged' ? 'v1' : undefined };
  await c.request('server\0user', item, () => { fetched++; return ticket(jpeg()); }, () => true, () => true).result;
  now += 172800000;
  const result = await c.request('server\0user', item, () => { fetched++; return { result: Promise.reject(Error('poster_unavailable')), cancel() {} }; }, () => mode !== 'offline', () => true).result;
  await healthy(c); check(() => { assert.equal(result.bytes.byteLength, 128); assert.equal(fetched, mode === 'unavailable' ? 2 : 1); });
});
for (const size of [2097151, 2097152, 2097153]) test(`poster image bytes ${size}`, async check => {
  const c = await cache(), result = await observe(getPoster(c, target(), jpeg(size))); await healthy(c); const usage = await c.usage();
  check(() => { if (size > 2097152) { assert.equal(result.error?.message, 'poster_invalid'); assert.equal(usage.files, 0); } else { assert.ifError(result.error); assert.equal(result.value.bytes.byteLength, size); assert.equal(usage.bytes, size); } });
});
for (const delta of [-1, 0, 1]) test(`poster actual cache byte quota ${1048576 + delta}`, async check => {
  const c = await cache(); await c.save({ enabled: true, maxMb: 1 }, () => true);
  const first = await getPoster(c, target('old'), jpeg(524288)); const second = await getPoster(c, target('new'), jpeg(524288 + delta)); await healthy(c);
  const usage = await c.usage(), index = await fixture('read-index', () => JSON.parse(fs.readFileSync(path.join(platform.root, 'index.json'), 'utf8')));
  check(() => { assert.equal(usage.files, delta > 0 ? 1 : 2); assert.equal(usage.bytes, delta > 0 ? 524289 : 1048576 + delta);
    assert.equal(fs.existsSync(path.join(platform.root, first.key + '.img')), delta <= 0); assert.ok(fs.existsSync(path.join(platform.root, second.key + '.img')));
    assert.deepEqual(Object.keys(index), ['entries']); assert.deepEqual(Object.keys(index.entries[0]), ['key', 'size', 'touched', 'saved']); });
});
for (const count of [511, 512, 513]) test(`poster reconstruct entries ${count}`, async check => {
  await fixture('seed-cache', () => { fs.mkdirSync(platform.root, { recursive: true }); const entries = [];
    for (let i = 0; i < count; i++) { const key = i.toString(16).padStart(64, '0'); fs.writeFileSync(path.join(platform.root, key + '.img'), Buffer.from(jpeg())); entries.push({ key, size: 128, touched: i + 10, saved: 42 }); }
    fs.writeFileSync(path.join(platform.root, 'index.json'), JSON.stringify({ entries })); });
  const c = await cache(), usage = await c.usage(); await healthy(c);
  check(() => { assert.equal(usage.files, Math.min(count, 512)); assert.equal(fs.readdirSync(platform.root).filter(n => n.endsWith('.img')).length, Math.min(count, 512));
    if (count === 513) { assert.equal(fs.existsSync(path.join(platform.root, (512).toString(16).padStart(64, '0') + '.img')), false); assert.ok(fs.existsSync(path.join(platform.root, '0'.repeat(64) + '.img'))); } });
});
for (const total of [66, 67, 68]) test(`poster overlapping admission ${total}`, async check => {
  const c = await cache(), gates = [], promises = [], outcomes = [];
  const fetch = () => { const gate = h.deferred(); gates.push(gate); return { result: gate.promise, cancel() {} }; };
  try {
    for (let i = 0; i < total; i++) promises.push(observe(c.request('server\0user', target('queued-' + i), fetch, () => true, () => true).result).then(result => { outcomes.push(result); return result; }));
    await fixture('admission', async () => { await settle(); assert.equal(c.jobs.size + outcomes.length, total); });
    check(() => { assert.equal(gates.length, 3); assert.equal(c.queue.length, Math.min(total - 3, 64)); assert.equal(outcomes.filter(o => o.error?.message === 'poster_busy').length, Math.max(0, total - 67)); });
  } finally { await fixture('release-poster', async () => { c.cancelAll(false); gates.forEach(g => g.resolve(jpeg())); await Promise.all(promises); await settle(); assert.equal(c.active, 0); assert.equal(c.jobs.size, 0); }); }
});
for (const failure of ['zero-write', 'rename']) test(`poster atomic ${failure} optional failure`, async check => {
  const c = await cache();
  if (failure === 'zero-write') fileApi.write = async () => 0;
  else fileApi.rename = async (from, to) => { if (to.endsWith('.img')) throw Error('injected rename'); return originalRename(from, to); };
  const result = await getPoster(c); const usage = await c.usage();
  check(() => { assert.equal(result.bytes.byteLength, 128); assert.equal(c.issue, 'poster_cache_unavailable'); assert.equal(usage.files, 0); assert.deepEqual(fs.readdirSync(platform.root), ['index.json']); });
});

(async () => {
  const selected = process.argv[2] ? tests.filter(t => t.name === process.argv[2]) : tests;
  assert.ok(selected.length, 'No resource boundary selected');
  for (const { name, action } of selected) { await runCase(name, action, before, after); console.log('PASS ' + name); }
  console.log(`${selected.length} resource cache boundary cases passed. Real product services and temp files; no native durability, network or UI claim.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
