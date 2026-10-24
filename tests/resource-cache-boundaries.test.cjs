// Actual services/transports/parsers and isolated real files; Harmony APIs are fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { fixture, runCase } = require('./resource-cache-result.cjs');
const h = require('./feature-regression.test.cjs'), platform = require('./poster-platform.cjs').install(h);
const { AppService: A } = h.load('service/AppService.ets');
const { PosterCache } = h.load('service/PosterCache.ets');
const { bif } = require('./bif-fixture.cjs');
const { parseBif, bifWidth } = h.load('utils/Bif.ts');
const { TrickplayRepository } = h.load('service/TrickplayRepository.ets');
const { IntroRepository } = h.load('service/IntroRepository.ets');
const { introFromJson, validIntroEntries } = h.load('utils/Intro.ts');
const { NetworkPolicy, NetworkOptions } = h.load('utils/NetworkOptions.ts');
const http = h.platform.get('@ohos.net.http'), originalHttp = http.createHttp, originalNow = Date.now;
const fileApi = h.platform.get('@ohos.file.fs'), originalRename = fileApi.rename, originalRenameSync = fileApi.renameSync;
const asyncIO = Object.fromEntries(['mkdir', 'listFile', 'stat', 'readText', 'open', 'close', 'fsync', 'rename', 'unlink', 'write', 'read'].map(name => [name, fileApi[name]]));
const syncIO = Object.fromEntries(['openSync', 'closeSync', 'writeSync', 'fsyncSync', 'renameSync', 'readTextSync'].map(name => [name, fileApi[name]]));
const ioErrors = [];
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
  Date.now = originalNow; ioErrors.length = 0;
  // Missing index/stat/cleanup targets are cache misses. Failed writes or directory IO are not.
  for (const [name, fn] of Object.entries(asyncIO)) fileApi[name] = async (...args) => { try { return await fn(...args); } catch (error) { if (error.code !== 'ENOENT' || !['stat', 'readText', 'unlink'].includes(name)) ioErrors.push(name + ':' + (error.code || error.message)); throw error; } };
  for (const [name, fn] of Object.entries(syncIO)) fileApi[name] = (...args) => { try { return fn(...args); } catch (error) { ioErrors.push(name + ':' + (error.code || error.message)); throw error; } };
  NetworkPolicy.publish(new NetworkOptions()); NetworkPolicy.networkAvailable = undefined;
  if (process.argv[3] === '--fixture-failure') { const blocked = path.join(h.directory, 'blocked'); fs.writeFileSync(blocked, 'file'); fs.writeFileSync(path.join(blocked, 'child'), 'unreachable'); }
  if (process.argv[3] === '--cache-open-failure') { fs.mkdirSync(path.dirname(platform.root), { recursive: true }); fs.writeFileSync(platform.root, 'not a cache directory'); }
  if (process.argv[3] === '--bif-io-failure') { h.activate(); fs.mkdirSync(path.join(A.local.directory, 'trickplay-v1/interrupted.part'), { recursive: true }); }
  if (process.argv[3] === '--intro-io-failure') { h.activate(); fs.mkdirSync(path.join(A.local.directory, 'intros.json.tmp'), { recursive: true }); }
}
async function after() { http.createHttp = originalHttp; Date.now = originalNow; Object.assign(fileApi, asyncIO, syncIO); }

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

// Independent legal v0 files: every frame has both JPEG markers and monotone timestamps.
function legalBif(sizes = [4], times = sizes.map((_, i) => i)) {
  return bif(sizes.map(size => { assert.ok(size >= 4); const frame = Buffer.alloc(size); frame[0] = 255; frame[1] = 216; frame[size - 2] = 255; frame[size - 1] = 217; return frame; }), times, 1, false);
}
function bifWithTotal(total) {
  const count = 32, payload = total - 64 - count * 8, size = Math.floor(payload / count), extra = payload % count;
  assert.ok(size >= 4 && size + 1 <= 524288); return legalBif(Array.from({ length: count }, (_, i) => size + (i < extra ? 1 : 0)));
}
const manifest = (widths = [640], version = '1') => JSON.stringify({ Version: version, WidthResolutions: widths });
for (const length of [16383, 16384, 16385]) test(`bif manifest code units ${length}`, async check => {
  const text = manifest([640], '中文'), source = text + ' '.repeat(length - text.length);
  await fixture('manifest-input', () => { assert.equal(source.length, length); assert.ok(Buffer.byteLength(source) > length); });
  check(() => assert.equal(bifWidth(source), length > 16384 ? undefined : 640));
});
for (const length of [63, 64, 65]) test(`bif manifest version code units ${length}`, check => check(() => assert.equal(bifWidth(manifest([640], '中'.repeat(length))), length > 64 ? undefined : 640)));
for (const count of [31, 32, 33]) test(`bif resolution count ${count}`, check => check(() => assert.equal(bifWidth(manifest(Array(count).fill(640))), count > 32 ? undefined : 640)));
for (const width of [31, 32, 33, 1919, 1920, 1921]) test(`bif resolution width ${width}`, check => check(() => assert.equal(bifWidth(manifest([width])), width < 32 || width > 1920 ? undefined : width)));
test('bif preferred width is a soft selection boundary', check => check(() => { assert.equal(bifWidth(manifest([639, 640, 641])), 640); assert.equal(bifWidth(manifest([641, 1920])), 641); }));
for (const count of [4095, 4096, 4097]) test(`bif legal frame count ${count}`, check => {
  const value = parseBif(legalBif(Array(count).fill(4)));
  check(() => { if (count > 4096) assert.equal(value === undefined, true); else { assert.ok(value); assert.equal(value.frames.length, count); } });
});
for (const size of [524287, 524288, 524289]) test(`bif legal frame bytes ${size}`, check => {
  const value = parseBif(legalBif([size])); check(() => { if (size > 524288) assert.equal(value === undefined, true); else { assert.ok(value); assert.equal(value.frames[0].end - value.frames[0].offset, size); } });
});
for (const time of [172799999, 172800000, 172800001]) test(`bif legal timestamp ${time}`, check => {
  const value = parseBif(legalBif([4], [time])); check(() => { if (time > 172800000) assert.equal(value === undefined, true); else { assert.ok(value); assert.equal(value.frames[0].time, time); } });
});
for (const size of [16777215, 16777216, 16777217]) test(`bif legal file bytes ${size}`, check => {
  const source = bifWithTotal(size); assert.equal(source.byteLength, size); const value = parseBif(source);
  check(() => { if (size > 16777216) assert.equal(value === undefined, true); else { assert.ok(value); assert.equal(value.bytes.byteLength, size); assert.equal(value.frames.length, 32); } });
});
test('bif minimum legal file is 76 bytes', check => { const bytes = legalBif(); assert.equal(bytes.byteLength, 76); check(() => { assert.ok(parseBif(bytes)); assert.equal(parseBif(bytes.slice(0, 75)), undefined); }); });
test('bif actual HTTP stage byte budgets', async check => {
  const calls = []; let destroyed = 0;
  http.createHttp = () => ({ async request(url, options) { calls.push({ url, options }); return calls.length === 1 ? { responseCode: 200, result: manifest([639, 640, 641]) } : { responseCode: 200, result: legalBif() }; }, destroy() { destroyed++; } });
  const result = await h.activate().trickplay('movie', () => true).result;
  check(() => { assert.ok(result); assert.equal(calls.length, 2); assert.equal(calls[0].options.maxLimit, 16384); assert.equal(calls[1].options.maxLimit, 16777216);
    assert.ok(calls[0].url.endsWith('/Trickplay/movie/GetManifest')); assert.ok(calls[1].url.endsWith('/Trickplay/movie/640/GetBIF')); assert.equal(destroyed, 2); });
});
function bifCache() { const client = h.activate(); return { client, local: A.local, root: path.join(A.local.directory, 'trickplay-v1'), repo: new TrickplayRepository() }; }
const loadBif = (env, bytes = legalBif(), id = 'fresh', offline = false) => { env.client.trickplay = () => ticket(bytes); return env.repo.load(env.client, env.local, id, offline, () => true, work => work()).result; };
async function seedBifs(env, entries) {
  await fixture('seed-bif', () => { fs.mkdirSync(env.root, { recursive: true }); for (const entry of entries) { const file = path.join(env.root, entry.name + '.bif'); fs.writeFileSync(file, Buffer.from(entry.bytes)); fs.utimesSync(file, new Date(entry.time || 1000), new Date(entry.time || 1000)); } });
}
async function healthyBif() { await fixture('bif-io', () => assert.deepEqual(ioErrors, [])); }
for (const delta of [-1, 0, 1]) test(`bif actual cache byte quota ${33554432 + delta}`, async check => {
  const env = bifCache(), incoming = legalBif(), total = 33554432 - incoming.byteLength + delta, first = Math.floor(total / 2);
  await seedBifs(env, [{ name: 'a-old', bytes: bifWithTotal(first) }, { name: 'b-old', bytes: bifWithTotal(total - first) }]);
  const result = await loadBif(env, incoming); await healthyBif();
  check(() => { assert.ok(result); assert.equal(fs.existsSync(path.join(env.root, 'a-old.bif')), delta <= 0); assert.ok(fs.existsSync(path.join(env.root, 'b-old.bif')));
    assert.deepEqual(fs.readFileSync(path.join(env.root, 'fresh.bif')), Buffer.from(incoming)); assert.equal(fs.readdirSync(env.root).filter(n => n.endsWith('.bif')).length, delta > 0 ? 2 : 3); });
});
for (const total of [15, 16, 17]) test(`bif actual cache file quota ${total}`, async check => {
  const env = bifCache(); await seedBifs(env, Array.from({ length: total - 1 }, (_, i) => ({ name: 'old-' + String(i).padStart(2, '0'), bytes: legalBif() })));
  const result = await loadBif(env); await healthyBif();
  check(() => { assert.ok(result); assert.equal(fs.readdirSync(env.root).filter(n => n.endsWith('.bif')).length, Math.min(total, 16)); assert.equal(fs.existsSync(path.join(env.root, 'old-00.bif')), total <= 16); });
});
for (const axis of ['bytes', 'files']) test(`bif overwrite counts actual temporary ${axis}`, async check => {
  const env = bifCache(), incoming = legalBif();
  const rows = axis === 'bytes' ? [{ name: 'a-old', bytes: bifWithTotal(16777216) }, { name: 'replace', bytes: bifWithTotal(16777216), time: 2000 }] :
    [...Array.from({ length: 15 }, (_, i) => ({ name: 'a-' + String(i).padStart(2, '0'), bytes: legalBif() })), { name: 'replace', bytes: legalBif(), time: 2000 }];
  await seedBifs(env, rows); let observed;
  fileApi.rename = async (from, to) => { if (to === path.join(env.root, 'replace.bif')) observed = fs.readdirSync(env.root).map(name => ({ name, size: fs.statSync(path.join(env.root, name)).size })); return originalRename(from, to); };
  // The lower save entry is production code; load normally returns a valid cached destination.
  await env.repo.save(env.root, 'replace', incoming, () => true); await healthyBif();
  check(() => { assert.ok(observed); assert.ok(observed.some(r => r.name === 'replace.bif')); assert.ok(observed.some(r => r.name === 'replace.part'));
    assert.equal(observed.filter(r => r.name.endsWith('.bif') || r.name.endsWith('.part')).length, axis === 'bytes' ? 2 : 16);
    assert.ok(observed.reduce((n, r) => n + r.size, 0) <= 33554432); assert.equal(fs.existsSync(path.join(env.root, axis === 'bytes' ? 'a-old.bif' : 'a-00.bif')), false);
    assert.deepEqual(fs.readFileSync(path.join(env.root, 'replace.bif')), Buffer.from(incoming)); assert.equal(fs.existsSync(path.join(env.root, 'replace.part')), false); });
});
test('bif public load partial IO and offline cache preserve bytes', async check => {
  const env = bifCache(), incoming = legalBif([11, 17], [0, 3000]); platform.state.partial = 3;
  const online = await loadBif(env, incoming), offline = await loadBif(env, undefined, 'fresh', true); await healthyBif();
  check(() => { assert.ok(online); assert.ok(offline); assert.deepEqual(Buffer.from(offline.bytes), Buffer.from(incoming)); assert.equal(offline.frames[1].time, 3000); assert.ok(platform.state.writes.length > 2); assert.ok(platform.state.reads > 2); });
});
test('bif cached minimum file uses the real read path', async check => {
  const env = bifCache(), incoming = legalBif(); await seedBifs(env, [{ name: 'fresh', bytes: incoming }]); const result = await loadBif(env, undefined, 'fresh', true); await healthyBif();
  check(() => { assert.ok(result); assert.equal(result.bytes.byteLength, 76); assert.ok(fs.existsSync(path.join(env.root, 'fresh.bif'))); });
});
for (const failure of ['zero-write', 'over-write', 'rename']) test(`bif atomic ${failure} preserves optional preview`, async check => {
  const env = bifCache(), incoming = legalBif();
  if (failure === 'zero-write') fileApi.write = async () => 0;
  if (failure === 'over-write') fileApi.write = async (_fd, bytes) => bytes.byteLength + 1;
  if (failure === 'rename') fileApi.rename = async () => { throw Error('injected rename'); };
  const result = await loadBif(env, incoming);
  check(() => { assert.ok(result); assert.deepEqual(Buffer.from(result.bytes), Buffer.from(incoming)); assert.equal(fs.existsSync(path.join(env.root, 'fresh.bif')), false); assert.equal(fs.existsSync(path.join(env.root, 'fresh.part')), false); });
});
for (const failure of ['zero-read', 'over-read']) test(`bif corrupt ${failure} is disposable offline`, async check => {
  const env = bifCache(); await seedBifs(env, [{ name: 'fresh', bytes: legalBif() }]); fileApi.read = async (_fd, bytes) => failure === 'zero-read' ? 0 : bytes.byteLength + 1;
  const result = await loadBif(env, undefined, 'fresh', true); check(() => { assert.equal(result, undefined); assert.equal(fs.existsSync(path.join(env.root, 'fresh.bif')), false); });
});
for (const total of [9, 10, 11]) test(`bif overlapping admission ${total}`, async check => {
  const env = bifCache(), gates = [], tickets = [], outcomes = [], promises = [];
  env.client.trickplay = () => { const gate = h.deferred(); gates.push(gate); return { result: gate.promise, cancel() { gate.resolve(undefined); } }; };
  try {
    for (let i = 0; i < total; i++) { const t = env.repo.load(env.client, undefined, 'queued-' + i, false, () => true, work => work()); tickets.push(t); promises.push(t.result.then(value => { outcomes.push(value); return value; })); }
    await fixture('bif-admission', async () => { await settle(); assert.equal(env.repo.active + env.repo.waiting.length + outcomes.length, total); });
    check(() => { assert.equal(gates.length, 2); assert.equal(env.repo.waiting.length, Math.min(total - 2, 8)); assert.equal(outcomes.length, Math.max(0, total - 10)); });
  } finally { await fixture('release-bif', async () => { tickets.forEach(t => t.cancel()); gates.forEach(g => g.resolve(undefined)); await Promise.all(promises); await settle(); assert.equal(env.repo.active, 0); assert.equal(env.repo.waiting.length, 0); }); }
});

const introSegment = { start: 10000, end: 30000, show: 5000, hide: 25000 };
const introWire = (end = 30) => JSON.stringify({ IntroStart: 10, IntroEnd: end, ShowSkipPromptAt: 5, HideSkipPromptAt: 25, Note: '中文' });
const introRows = count => Array.from({ length: count }, (_, i) => ({ id: 'ep-' + i, segment: { ...introSegment }, touched: i + 1 }));
function introCache() { const client = h.activate(); client.intro = () => ticket({ ...introSegment }); return { client, local: A.local, repo: new IntroRepository(), file: path.join(A.local.directory, 'intros.json') }; }
const loadIntro = (env, id = 'new', offline = false) => env.repo.load(env.client, env.local, id, offline, () => true).result;
async function seedIntros(env, rows) { await fixture('seed-intro', () => fs.writeFileSync(env.file, JSON.stringify(rows))); }
async function healthyIntro() { await fixture('intro-io', () => assert.deepEqual(ioErrors, [])); }
for (const length of [16383, 16384, 16385]) test(`intro response code units ${length}`, async check => {
  const wire = introWire(), source = wire + ' '.repeat(length - wire.length);
  await fixture('intro-input', () => { assert.equal(source.length, length); assert.ok(Buffer.byteLength(source) > length); });
  const value = introFromJson(source); check(() => length > 16384 ? assert.equal(value === undefined, true) : assert.deepEqual(value, introSegment));
});
for (const end of [172799999, 172800000, 172800001]) test(`intro duration milliseconds ${end}`, check => {
  const value = introFromJson(introWire(end / 1000)); check(() => { if (end > 172800000) assert.equal(value === undefined, true); else { assert.ok(value); assert.equal(value.end, end); } });
});
for (const count of [511, 512, 513]) test(`intro entries validation ${count}`, check => check(() => assert.equal(validIntroEntries(introRows(count)), count <= 512)));
for (const count of [511, 512, 513]) test(`intro actual stored read ${count}`, async check => {
  const env = introCache(); await seedIntros(env, introRows(count)); const rows = env.local.intros(); await healthyIntro();
  check(() => { assert.equal(rows.length, count > 512 ? 0 : count); assert.equal(fs.existsSync(env.file), count <= 512);
    assert.equal(fs.readdirSync(env.local.directory).filter(n => n.startsWith('intros.json.corrupt-')).length, count > 512 ? 1 : 0); });
});
test('intro LocalStore raw writer retains its legacy unchecked contract', async check => {
  const env = introCache(); let error; try { env.local.saveIntros(introRows(513)); } catch (e) { error = e; } await healthyIntro();
  check(() => { assert.ifError(error); assert.equal(JSON.parse(fs.readFileSync(env.file, 'utf8')).length, 513); });
  const rows = env.local.intros(); check(() => { assert.equal(rows.length, 0); assert.equal(fs.existsSync(env.file), false); });
});
for (const total of [511, 512, 513]) test(`intro actual repository insert ${total}`, async check => {
  Date.now = () => 1000000; const env = introCache(); await seedIntros(env, introRows(total - 1)); const calls = [], save = env.local.saveIntros.bind(env.local);
  env.local.saveIntros = rows => { calls.push(rows.map(row => ({ id: row.id, touched: row.touched }))); return save(rows); };
  const result = await loadIntro(env); await healthyIntro();
  check(() => { assert.deepEqual(result, introSegment); assert.equal(calls.length, 1); assert.equal(calls[0].length, Math.min(total, 512)); assert.equal(calls[0][0].id, 'new'); });
  const encoded = await fixture('read-intro', () => JSON.parse(fs.readFileSync(env.file, 'utf8')));
  check(() => { assert.equal(encoded.length, Math.min(total, 512)); assert.deepEqual(Object.keys(encoded[0]), ['id', 'segment', 'touched']); assert.deepEqual(Object.keys(encoded[0].segment), ['start', 'end', 'show', 'hide']);
    assert.equal(encoded.some(row => row.id === 'ep-0'), total <= 512); assert.ok(encoded.some(row => row.id === 'new')); });
  const client = h.activate(), restarted = await new IntroRepository().load(client, A.local, 'new', true, () => true).result; await healthyIntro();
  check(() => assert.deepEqual(restarted, introSegment));
});
test('intro cached touch preserves recency across a full cache insert', async check => {
  let now = 1000000; Date.now = () => now; const env = introCache(); await seedIntros(env, introRows(512));
  const cached = await loadIntro(env, 'ep-0', true); now++; await loadIntro(env); const rows = env.local.intros(); await healthyIntro();
  check(() => { assert.deepEqual(cached, introSegment); assert.equal(rows.length, 512); assert.ok(rows.some(r => r.id === 'ep-0')); assert.ok(rows.some(r => r.id === 'new')); assert.equal(rows.some(r => r.id === 'ep-1'), false); });
});
test('intro actual HTTP byte budget', async check => {
  const calls = []; let destroyed = 0; http.createHttp = () => ({ async request(url, options) { calls.push({ url, options }); return { responseCode: 200, result: introWire() }; }, destroy() { destroyed++; } });
  const result = await h.activate().intro('episode', () => true).result;
  check(() => { assert.deepEqual(result, introSegment); assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/Episode/episode/IntroTimestamps/v1')); assert.equal(calls[0].options.maxLimit, 16384); assert.equal(destroyed, 1); });
});
for (const failure of ['write', 'rename']) test(`intro optional ${failure} failure preserves playback and old metadata`, async check => {
  const env = introCache(), old = introRows(1); await seedIntros(env, old);
  if (failure === 'write') fileApi.writeSync = () => { throw Error('injected intro write'); };
  else fileApi.renameSync = (from, to) => { if (to === env.file) throw Error('injected intro rename'); return originalRenameSync(from, to); };
  const result = await loadIntro(env);
  check(() => { assert.deepEqual(result, introSegment); assert.deepEqual(JSON.parse(fs.readFileSync(env.file, 'utf8')), old); assert.ok(fs.existsSync(env.file + '.tmp')); });
});

(async () => {
  const selected = process.argv[2] ? tests.filter(t => t.name === process.argv[2]) : tests;
  assert.ok(selected.length, 'No resource boundary selected');
  for (const { name, action } of selected) { await runCase(name, action, before, after); console.log('PASS ' + name); }
  console.log(`${selected.length} resource cache boundary cases passed. Real product services and temp files; no native durability, network or UI claim.`);
})().catch(error => { console.error(error.name + ': ' + String(error.message).slice(0, 240)); process.exitCode = 1; });
