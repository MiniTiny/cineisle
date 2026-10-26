// Real parser, UDP worker, cancellation controller and anonymous probe with native API fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const h = require('./feature-regression.test.cjs');
const ts = require(require('./deveco-runtime.cjs').typescript);
h.platform.set('@ohos.url', { URL });
const util = h.platform.get('@ohos.util');
util.TextDecoder = class { constructor(encoding, options) { this.decoder = new TextDecoder(encoding, options); } decodeToString(bytes) { return this.decoder.decode(bytes); } };
const threads = [];
class Thread { constructor(path) { this.path = path; this.sent = []; this.terminated = 0; threads.push(this); } postMessage(v) { this.sent.push(v); } terminate() { this.terminated++; } emit(data) { this.onmessage?.({ data }); } }
h.platform.set('@ohos.worker', { ThreadWorker: Thread });
const { discoveryPacket, discoveryAddress } = h.load('utils/ServerDiscovery.ts');
const { ServerDiscovery } = h.load('service/ServerDiscovery.ets');
const { DiscoveryProbe } = h.load('service/DiscoveryProbe.ets');
const { JellyfinClient } = h.load('service/JellyfinClient.ets');
const { AppService } = h.load('service/AppService.ets');
const { SessionStore } = h.load('service/SessionStore.ets');
const candidate = { id: 'island', name: 'Island', address: 'http://192.168.1.20:8096' };
const packet = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).buffer;
const announcement = (changes = {}) => ({ Id: candidate.id, Name: candidate.name, Address: candidate.address, ...changes });
const settle = async () => { for (let n = 0; n < 5; n++) await new Promise(setImmediate); };
const info = id => h.response({ Id: id, ServerName: 'Verified island', Version: '10.10.0' });
const tests = [], test = (name, fn) => tests.push([name, fn]);
function clock() { const timers = new Map(); let sequence = 0; return { timers, setTimeout(fn, ms) { const id = ++sequence; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); }, async fire(ms) { const selected = [...timers].filter(([, t]) => t.ms === ms); assert.ok(selected.length, 'expected timer ' + ms); for (const [id, t] of selected) { timers.delete(id); t.fn(); } await settle(); } }; }
async function timed(fn) { const native = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout }, time = clock(); Object.assign(global, { setTimeout: time.setTimeout, clearTimeout: time.clearTimeout }); try { await fn(time); } finally { Object.assign(global, native); } }
function workerFixture(options = {}) {
 const time = clock(), messages = [], calls = [], handlers = {};
 const udp = { on: (event, fn) => handlers[event] = fn, off: event => delete handlers[event],
   async bind(value) { calls.push(['bind', value]); if (options.bind) await options.bind; }, async setExtraOptions(value) { calls.push(['options', value]); },
   async send(value) { calls.push(['send', value]); if (options.error) throw Error('fixture'); }, async close() { calls.push(['close']); } };
 const port = { postMessage: value => messages.push(value) };
 const source = fs.readFileSync('entry/src/main/ets/workers/ServerDiscoveryWorker.ets', 'utf8');
 const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
 const context = { exports: {}, setTimeout: time.setTimeout, clearTimeout: time.clearTimeout, require: id => {
  if (id === '@ohos.worker') return { workerPort: port }; if (id === '@ohos.net.socket') return { constructUDPSocketInstance: () => udp };
  if (id.endsWith('/ServerDiscovery')) return h.load('utils/ServerDiscovery.ts'); throw Error('Unexpected dependency ' + id);
 } };
 vm.runInNewContext(js, context); return { time, messages, calls, start: async () => { port.onmessage({ data: { type: 'start' } }); await settle(); }, cancel: async () => { port.onmessage({ data: { type: 'cancel' } }); await settle(); }, receive: async value => { handlers.message?.({ message: packet(value), remoteInfo: { address: '192.168.1.20', port: 7359 } }); await settle(); }, error: async () => { handlers.error?.({}); await settle(); } };
}
test('parses canonical base paths, sanitizes names and never probes announcements', () => {
 assert.deepEqual(discoveryPacket(packet(announcement({ Name: ' Room\nOne ', Address: 'HTTP://Example.COM:80/jellyfin/' }))), { id: 'island', name: 'Room One', address: 'http://example.com/jellyfin' });
 assert.equal(discoveryAddress('https://[::1]:8096/jellyfin/'), 'https://[::1]:8096/jellyfin'); assert.equal(h.requests.length, 0);
});
test('malformed announcements, unsafe URLs and invalid UTF-8 are discarded', () => {
 for (const value of [null, [], {}, 'garbage', announcement({ Id: 'bad/id' }), announcement({ Id: '' }), announcement({ Name: 1 }), announcement({ Address: 1 }), ...['file:///a', 'http://user:pw@host', 'http://host/?api_key=secret', 'http://host/#secret', 'http://host/a b', 'http://host/\\path'].map(Address => announcement({ Address }))]) assert.equal(discoveryPacket(packet(value)), undefined, JSON.stringify(value));
 assert.equal(discoveryPacket(new Uint8Array([0xff]).buffer), undefined); assert.equal(discoveryPacket(new ArrayBuffer(8193)), undefined);
});
test('worker sends pinned SDK broadcast, streams unique endpoints and closes at total deadline', async () => {
 const f = workerFixture(); await f.start(); assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [['bind', { address: '0.0.0.0', family: 1, port: 0 }], ['options', { broadcast: true }], ['send', { data: 'who is JellyfinServer?', address: { address: '255.255.255.255', family: 1, port: 7359 } }]]);
 await f.receive(announcement()); await f.receive(announcement()); await f.receive(announcement({ Address: 'https://island.invalid' })); assert.equal(f.messages.length, 2);
 await f.time.fire(8000); assert.equal(f.messages.at(-1).type, 'complete'); assert.equal(f.messages.at(-1).servers.length, 2); assert.equal(f.messages.at(-1).limited, false); assert.equal(f.calls.filter(c => c[0] === 'close').length, 1); assert.equal(f.time.timers.size, 0);
});
test('empty discovery completes, whereas socket/send failure reports error', async () => {
 const empty = workerFixture(); await empty.start(); await empty.time.fire(8000); assert.equal(empty.messages.at(-1).servers.length, 0); assert.equal(empty.messages.at(-1).type, 'complete');
 const failed = workerFixture({ error: true }); await failed.start(); assert.equal(failed.messages.at(-1).type, 'error'); assert.equal(failed.calls.at(-1)[0], 'close');
 const socket = workerFixture(); await socket.start(); await socket.error(); assert.equal(socket.messages.at(-1).type, 'error');
});
for (const kind of ['candidate', 'packet']) test('worker bounds ' + kind + ' floods without an unbounded receive loop', async () => {
 const f = workerFixture(); await f.start(); for (let n = 0; n < (kind === 'candidate' ? 20 : 80); n++) await f.receive(kind === 'candidate' ? announcement({ Id: 'server-' + n }) : 'invalid');
 assert.equal(f.messages.at(-1).type, 'complete'); assert.equal(f.messages.at(-1).limited, true); assert.equal(f.messages.at(-1).servers.length, kind === 'candidate' ? 16 : 0); assert.equal(f.calls.filter(c => c[0] === 'close').length, 1);
});
test('worker cancellation during bind prevents late options or broadcast', async () => {
 const bind = h.deferred(), f = workerFixture({ bind: bind.promise }); await f.start(); await f.cancel(); bind.resolve(); await settle();
 assert.equal(f.messages.at(-1).type, 'cancelled'); assert.ok(!f.calls.some(c => c[0] === 'send' || c[0] === 'options')); assert.equal(f.calls.filter(c => c[0] === 'close').length, 1);
});
test('controller waits for old worker release, ignores stale results and preserves new scan', async () => {
 const finder = new ServerDiscovery(), updates = []; const first = finder.start(v => updates.push(v)); const firstRejected = assert.rejects(first, /discovery_cancelled/); await settle(); const old = threads.at(-1);
 finder.cancel(); const second = finder.start(v => updates.push(v)); await settle(); assert.equal(threads.length, 1); old.emit({ type: 'progress', servers: [candidate] }); assert.equal(updates.length, 0);
 old.emit({ type: 'cancelled' }); await settle(); const current = threads.at(-1); assert.notEqual(current, old); current.emit({ type: 'progress', servers: [candidate] }); current.emit({ type: 'complete', servers: [candidate], limited: false });
 await firstRejected; assert.deepEqual(await second, { servers: [candidate], limited: false }); assert.equal(updates.length, 1); assert.equal(old.terminated, 1); assert.equal(current.terminated, 1);
});
test('watchdog terminates a stalled worker after a bounded cancel grace', async () => timed(async time => {
 const finder = new ServerDiscovery(), pending = finder.start(() => {}), rejected = assert.rejects(pending, /discovery_failed/); await settle(); const thread = threads.at(-1);
 await time.fire(10000); await rejected; assert.equal(thread.sent.at(-1).type, 'cancel'); await time.fire(1000); assert.equal(thread.terminated, 1); assert.equal(time.timers.size, 0);
}));
test('anonymous verification accepts only matching public identity and does not persist/login', async () => {
 h.activate(); const prior = AppService.client; h.queue.push(info('island')); const found = await new ServerDiscovery().verify(candidate);
 assert.equal(found.name, 'Verified island'); assert.equal(AppService.client, prior); assert.equal(h.assets.size, 0); assert.equal(h.requests.length, 1);
 const r = h.requests[0]; assert.equal(r.url, candidate.address + '/System/Info/Public'); assert.deepEqual(r.options.header, { Accept: 'application/json' }); assert.equal(r.options.maxLimit, 65536); assert.equal(r.options.method, 'GET');
});
for (const response of [info('other'), h.response({ Id: 'island', Version: 42 }), { responseCode: 503, result: '' }, h.response('x'.repeat(65537))]) test('failed public verification never selects or saves a candidate: ' + response.responseCode + '/' + response.result.length, async () => {
 h.queue.push(response); await assert.rejects(new ServerDiscovery().verify(candidate), /server_identity_mismatch|discovery_verify_failed/); assert.equal(h.requests.length, 1); assert.equal(h.assets.size, 0);
});
test('probe cancellation destroys request once and late HTTP success cannot revive it', async () => {
 const http = h.platform.get('@ohos.net.http'), original = http.createHttp, gate = h.deferred(); let destroyed = 0;
 http.createHttp = () => ({ request: () => gate.promise, destroy: () => destroyed++ }); try {
 const finder = new ServerDiscovery(), pending = finder.verify(candidate), rejected = assert.rejects(pending, /discovery_cancelled/); await settle(); finder.cancel(); await rejected; gate.resolve(info('island')); await settle(); assert.equal(destroyed, 1); assert.equal(h.assets.size, 0);
 } finally { http.createHttp = original; }
});
test('probe total timeout destroys a stalled request and admits only one public GET', async () => timed(async time => {
 const http = h.platform.get('@ohos.net.http'), original = http.createHttp; let destroyed = 0; http.createHttp = () => ({ request: () => new Promise(() => {}), destroy: () => destroyed++ });
 try { const probe = new DiscoveryProbe(candidate.address), pending = probe.request('/System/Info/Public', 'GET', [], ''), rejected = assert.rejects(pending, /discovery_verify_timeout/); await time.fire(6000); await rejected; assert.equal(destroyed, 1); await assert.rejects(probe.request('/System/Info/Public', 'GET', [], ''), /api_parameter_invalid/); } finally { http.createHttp = original; }
}));
test('identity change before password login prevents credential POST and persistence', async () => {
 h.queue.push(info('other')); await assert.rejects(AppService.login(candidate.address, 'fixture', 'fixture-password', () => true, 'island'), /server_identity_mismatch/); assert.equal(h.requests.length, 1); assert.equal(h.assets.size, 0); assert.equal(AppService.client, undefined);
});
test('leaving during public negotiation prevents a password POST even with matching identity', async () => {
 const gate = h.deferred(); let allowed = true; h.queue.push(gate.promise); const pending = AppService.login(candidate.address, 'fixture', 'fixture-password', () => allowed, 'island'); const rejected = assert.rejects(pending, /account_cancelled/); await settle(); allowed = false; gate.resolve(info('island')); await rejected; assert.equal(h.requests.length, 1); assert.equal(h.assets.size, 0);
});
test('saved profile conflict prevents negotiation against a newly discovered different server', async () => {
 await SessionStore.updateServer({ id: 'saved', name: 'Saved', preferred: candidate.address, addresses: [candidate.address] });
 await assert.rejects(AppService.login(candidate.address, 'fixture', 'fixture-password', () => true, 'island'), /server_identity_mismatch/); assert.equal(h.requests.length, 0);
});
global.Scroller = class { scrollTo() {} };
const { Accounts } = h.load('pages/Accounts.ets');
test('Quick Connect uses selected ID and never initializes against a changed server', async () => {
 const page = Object.assign(new Accounts(), { visible: true, locked: false, server: candidate.address, discoveredId: 'island' });
 h.queue.push(info('other')); await page.startQuick(); assert.equal(page.quickCode, ''); assert.equal(page.message, 'server_identity_mismatch'); assert.equal(h.requests.length, 1); assert.equal(h.assets.size, 0);
});
test('saving a discovered server rechecks ID and refuses a changed target', async () => {
 const page = Object.assign(new Accounts(), { visible: true, locked: false, server: candidate.address, discoveredId: 'island' });
 h.queue.push(info('other')); await page.saveServer(); assert.equal(page.message, 'server_identity_mismatch'); assert.equal((await SessionStore.servers()).length, 0);
});
test('password login accepts matching rediscovery only after public identity negotiation', async () => {
 h.queue.push(info('island'), h.response({ User: { Id: 'fixture-user', Name: 'Fixture' }, AccessToken: 'fixture-token' }));
 const client = await JellyfinClient.login(candidate.address, 'Fixture', 'fixture-password', 'island'); assert.equal(client.session.serverId, 'island'); assert.equal(h.requests.length, 2); assert.equal(h.requests[0].options.method, 'GET'); assert.equal(h.requests[1].options.method, 'POST');
});
(async () => { for (const [name, fn] of tests) { h.reset(); threads.length = 0; await fn(); console.log('PASS ' + name); } console.log(`${tests.length} server discovery regressions passed. Native API fixtures do not prove Wi-Fi routing or real Jellyfin discovery.`); })().catch(e => { console.error(e); process.exitCode = 1; });
