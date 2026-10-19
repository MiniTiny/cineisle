// Product Preferences, API deadlines and read fallbacks. Native storage/network are explicit fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const { NetworkOptions, NetworkPolicy, validNetworkOptions } = h.load('utils/NetworkOptions.ts');
const { NetworkPreferences: Store } = h.load('service/NetworkPreferences.ets');
const { AppService } = h.load('service/AppService.ets');
const { SessionStore } = h.load('service/SessionStore.ets');
const { JellyfinClient } = h.load('service/JellyfinClient.ets');
const { NativeHttpTransport } = h.load('api/NativeHttpTransport.ets');
const { loadDetail } = h.load('service/DetailData.ets');
const { ProgressiveHome } = h.load('service/ProgressiveHome.ets');
const originalPreferences = h.platform.get('@ohos.data.preferences');
const fixture = require('./preferences-platform.cjs').install(h.platform, h.directory);
originalPreferences.getPreferences = fixture.api.getPreferences; h.platform.set('@ohos.data.preferences', originalPreferences);
global.Scroller = class { scrollTo() {} };
const { Settings } = h.load('pages/Settings.ets'), { Favorites } = h.load('pages/Favorites.ets'), { Actor } = h.load('pages/Actor.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const options = changes => ({ ...new NetworkOptions(), ...changes });
const settle = async () => { for (let n = 0; n < 5; n++) await new Promise(setImmediate); };
const error = () => Object.assign(Error('native offline'), { code: 2300006 });
function reset() { h.reset(); fixture.reset(); Store.context = undefined; Store.store = undefined; Store.loading = undefined; Store.writes = Promise.resolve(); Store.persisted = ''; Store.issue = ''; NetworkPolicy.publish(new NetworkOptions()); NetworkPolicy.networkAvailable = undefined; }
function page(overrides = {}) { h.activate(); const p = new Settings(); p.aboutToAppear(); p.deviceVisible = true; p.locked = false; return Object.assign(p, overrides); }
const film = () => ({ ...h.film('cached', [{ Id: 'actor', Name: 'Actor', Type: 'Actor' }]), UserData: { IsFavorite: true } });
test('matches fixed defaults, bounds integer seconds and snapshots do not mutate policy', () => {
 assert.deepEqual(NetworkPolicy.snapshot(), { requestMs: 30000, connectMs: 6000, readMs: 10000, autoCache: true });
 for (const value of [0, -1, 999, 1001, 121000, Infinity, NaN, '6000']) assert.equal(validNetworkOptions(options({ connectMs: value })), false);
 for (const value of [1000, 120000]) assert.equal(validNetworkOptions(options({ requestMs: value })), true);
 assert.equal(validNetworkOptions(options({ autoCache: 1 })), false); const snapshot = NetworkPolicy.snapshot(); snapshot.connectMs = 1000; assert.equal(NetworkPolicy.snapshot().connectMs, 6000);
});
test('durable app settings reload independently of accounts and restore exact values', async () => {
 await Store.load(h.context); await Store.save(options({ requestMs: 8000, connectMs: 2000, readMs: 3000, autoCache: false }), () => true);
 Store.store = undefined; NetworkPolicy.publish(new NetworkOptions()); await Store.load(h.context); assert.equal(NetworkPolicy.snapshot().autoCache, false); assert.equal(NetworkPolicy.snapshot().requestMs, 8000);
 h.activate('another'); assert.equal(NetworkPolicy.snapshot().connectMs, 2000); assert.ok(fs.existsSync(path.join(h.directory, 'network_options.fixture.json')));
});
test('policy publishes only after native flush; queued writes remain serialized', async () => {
 await Store.load(h.context); const gate = h.deferred(); fixture.state.flushWait = gate.promise;
 const first = Store.save(options({ connectMs: 2000 }), () => true); const second = Store.save(options({ connectMs: 4000 }), () => true); await settle();
 assert.equal(NetworkPolicy.snapshot().connectMs, 6000); assert.equal(fixture.state.calls.filter(v => v[0] === 'put').length, 1);
 fixture.state.flushWait = undefined; gate.resolve(); await Promise.all([first, second]); assert.equal(NetworkPolicy.snapshot().connectMs, 4000);
});
test('failed put/flush restores old preferences and runtime; explicit retry can recover', async () => {
 await Store.load(h.context); await Store.save(options({ connectMs: 4000 }), () => true); fixture.state.failFlush = 1;
 await assert.rejects(Store.save(options({ connectMs: 1000 }), () => true), /network_options_save_failed/); assert.equal(NetworkPolicy.snapshot().connectMs, 4000);
 Store.store = undefined; await Store.load(h.context); assert.equal(NetworkPolicy.snapshot().connectMs, 4000);
 fixture.state.failPut = 1; await assert.rejects(Store.save(options({ connectMs: 1000 }), () => true), /network_options_save_failed/);
 await Store.save(options({ connectMs: 2000 }), () => true); assert.equal(NetworkPolicy.snapshot().connectMs, 2000);
});
test('rollback failure is distinct and does not publish unconfirmed policy', async () => {
 await Store.load(h.context); fixture.state.failFlush = 2; await assert.rejects(Store.save(options({ autoCache: false }), () => true), /network_options_restore_failed/);
 assert.equal(NetworkPolicy.snapshot().autoCache, true); assert.equal(Store.store, undefined);
});
test('bad stored data shows an issue and requires an explicit valid repair', async () => {
 const store = await originalPreferences.getPreferences(h.context, { name: 'network_options' }); await store.put('settings_v1', '{broken'); await store.flush();
 await assert.rejects(Store.load(h.context), /network_options_invalid/); assert.equal(NetworkPolicy.snapshot().requestMs, 30000); assert.equal(Store.issue, 'network_options_invalid');
 await Store.save(options({ autoCache: false }), () => true); Store.store = undefined; await Store.load(h.context); assert.equal(NetworkPolicy.snapshot().autoCache, false);
});
test('native load failure is reported and invalid inputs cannot overwrite the old policy', async () => {
 fixture.state.failOpen = true; await assert.rejects(Store.load(h.context), /network_options_load_failed/); fixture.state.failOpen = false;
 await assert.rejects(Store.save(options({ readMs: 0 }), () => true), /network_options_invalid/); assert.equal(NetworkPolicy.snapshot().readMs, 10000);
});
test('queued settings cancelled by a hidden page never reach put or flush', async () => {
 await Store.load(h.context); const gate = h.deferred(); fixture.state.flushWait = gate.promise; const first = Store.save(options({ connectMs: 3000 }), () => true); let allowed = true;
 const second = Store.save(options({ connectMs: 2000 }), () => allowed), rejected = assert.rejects(second, /network_options_cancelled/); await settle(); allowed = false; fixture.state.flushWait = undefined; gate.resolve(); await first; await rejected; assert.equal(fixture.state.calls.filter(v => v[0] === 'put').length, 1);
});
test('locking then unlocking invalidates a queued settings write', async () => {
 await Store.load(h.context); const p = page({ requestSeconds: '8', connectSeconds: '2', readSeconds: '3' }); const gate = h.deferred(); fixture.state.flushWait = gate.promise;
 const first = Store.save(options({ connectMs: 4000 }), () => true); const queued = p.saveApiNetwork(); await settle(); p.locked = true; p.deviceLockChanged(); p.locked = false; fixture.state.flushWait = undefined; gate.resolve(); await first; await queued;
 assert.equal(NetworkPolicy.snapshot().connectMs, 4000); assert.equal(fixture.state.calls.filter(c => c[0] === 'put').length, 1);
});
test('GET uses current connect/read limits and disables opaque native response caching', async () => {
 NetworkPolicy.publish(options({ requestMs: 5000, connectMs: 2000, readMs: 3000 })); h.queue.push(h.response({})); const client = h.activate(); await new NativeHttpTransport(client.session).request('/test', 'GET', [], '');
 const o = h.requests[0].options; assert.equal(o.connectTimeout, 2000); assert.equal(o.readTimeout, 3000); assert.equal(o.usingCache, false);
});
test('no-default-network reads fail fast only when automatic cache is enabled', async () => {
 NetworkPolicy.networkAvailable = () => false; const client = h.activate(); await assert.rejects(new NativeHttpTransport(client.session).request('/test', 'GET', [], ''), /network_failed/); assert.equal(h.requests.length, 0);
 NetworkPolicy.publish(options({ autoCache: false })); h.queue.push(h.response({})); await new NativeHttpTransport(client.session).request('/test', 'GET', [], ''); assert.equal(h.requests.length, 1);
 NetworkPolicy.networkAvailable = () => { throw Error('platform info unavailable'); }; h.queue.push(h.response({})); await new NativeHttpTransport(client.session).request('/test', 'GET', [], ''); assert.equal(h.requests.length, 2);
});
test('one HTTP total deadline releases once and ignores late success without replaying a POST', async () => {
 const http = h.platform.get('@ohos.net.http'), create = http.createHttp, timers = new Map(), nativeSet = global.setTimeout, nativeClear = global.clearTimeout, gate = h.deferred(); let destroyed = 0, calls = 0;
 global.setTimeout = (fn, ms) => { timers.set(1, { fn, ms }); return 1; }; global.clearTimeout = id => timers.delete(id);
 http.createHttp = () => ({ request: () => { calls++; return gate.promise; }, destroy: () => destroyed++ });
 try { NetworkPolicy.publish(options({ requestMs: 2000 })); const request = new NativeHttpTransport(h.activate().session).request('/write', 'POST', [], '{}'), rejected = assert.rejects(request, /network_failed/); await settle(); assert.equal(timers.get(1).ms, 2000); timers.get(1).fn(); await rejected; gate.resolve(h.response({})); await settle(); assert.equal(calls, 1); assert.equal(destroyed, 1); }
 finally { http.createHttp = create; global.setTimeout = nativeSet; global.clearTimeout = nativeClear; }
});
test('a pending request retains its timeout snapshot while later requests use new settings', async () => {
 const gate = h.deferred(), client = h.activate(); h.queue.push(gate.promise); NetworkPolicy.publish(options({ readMs: 2000 })); const pending = new NativeHttpTransport(client.session).request('/one', 'GET', [], ''); await settle(); NetworkPolicy.publish(options({ readMs: 5000 })); gate.resolve(h.response({})); await pending;
 h.queue.push(h.response({})); await new NativeHttpTransport(client.session).request('/two', 'GET', [], ''); assert.deepEqual(h.requests.map(r => r.options.readTimeout), [2000, 5000]);
});
test('automatic cache switch controls search/list fallback and manual offline still wins', async () => {
 h.activate(); AppService.snapshot = h.snapshot([film()]); let p = h.page({ mode: 'search', searchQuery: 'cached' }); h.queue.push(error()); await p.load(); assert.equal(p.items[0].Id, 'cached');
 NetworkPolicy.publish(options({ autoCache: false })); p = h.page({ mode: 'search', searchQuery: 'cached' }); h.queue.push(error()); await p.load(); assert.equal(p.items.length, 0); assert.equal(p.usingCache, false); assert.ok(p.message);
 AppService.experience.update(s => s.offline = true); p = h.page({ mode: 'search', searchQuery: 'cached' }); await p.load(); assert.equal(p.items[0].Id, 'cached');
});
test('progressive home drops cached preview when disabled but preserves successful online shelves', async () => {
 NetworkPolicy.publish(options({ autoCache: false })); const updates = [], cached = { id: 'resume', kind: 'resume', name: '', libraryId: '', items: [film()] };
 const client = h.activate(); client.resume = async () => { throw Error('network_failed'); }; client.nextUp = async () => [h.film('online')]; client.libraries = async () => [];
 await new ProgressiveHome(client, v => updates.push(v)).start([cached]); const final = updates.at(-1); assert.equal(final.cached, false); assert.deepEqual(final.sections.flatMap(s => s.items.map(i => i.Id)), ['online']); assert.ok(final.failures.length);
});
test('detail and cached child fallback obey the switch while manual offline still works', async () => {
 const client = h.activate(), cached = film(); AppService.snapshot = h.snapshot([cached]); client.detail = async () => { throw Error('network_failed'); };
 assert.equal((await loadDetail(client, cached.Id)).offline, true); NetworkPolicy.publish(options({ autoCache: false })); await assert.rejects(loadDetail(client, cached.Id), /network_failed/);
 AppService.experience.update(s => s.offline = true); assert.equal((await loadDetail(client, cached.Id)).offline, true);
});
test('favorites and actor works do not seed cache when disabled', async () => {
 h.activate(); AppService.snapshot = h.snapshot([film()]); NetworkPolicy.publish(options({ autoCache: false })); const prior = AppService.allItems; AppService.allItems = async () => { throw Error('network_failed'); };
 try { const f = Object.assign(new Favorites(), { client: AppService.client }); await f.refresh(); assert.equal(f.all.length, 0); const a = Object.assign(new Actor(), { client: AppService.client, person: { Id: 'actor', Name: 'Actor' } }); AppService.client.detail = async () => { throw Error('network_failed'); }; await a.refresh(); assert.equal(a.works.length, 0); } finally { AppService.allItems = prior; }
});
test('account switch cannot silently use an unvalidated cached account when fallback is disabled', async () => {
 const client = h.activate(); await SessionStore.save({ ...client.session, userId: 'target', userName: 'Target' }); NetworkPolicy.publish(options({ autoCache: false })); h.queue.push(error());
 await assert.rejects(AppService.switchAccount('server_target'), /network_failed/); assert.equal(AppService.client, client);
});
test('auto-next server configuration read does not silently use cache when disabled', async () => {
 const client = h.activate(); client.autoNextEnabled = async () => { throw Error('network_failed'); }; NetworkPolicy.publish(options({ autoCache: false })); await assert.rejects(AppService.loadAutoNext(), /network_failed/); assert.equal(await AppService.loadAutoNext(true), true);
});
test('settings save validates a complete draft and preserves entered values on failure', async () => {
 await Store.load(h.context); const p = page({ requestSeconds: '8', connectSeconds: '2', readSeconds: '3', autoCache: false }); await p.saveApiNetwork(); assert.equal(NetworkPolicy.snapshot().connectMs, 2000); assert.match(p.networkMessage, /network_options_saved/);
 p.connectSeconds = '0'; await p.saveApiNetwork(); assert.match(p.networkMessage, /network_options_invalid/); assert.equal(NetworkPolicy.snapshot().connectMs, 2000);
 p.connectSeconds = '4'; fixture.state.failFlush = 1; await p.saveApiNetwork(); assert.equal(p.connectSeconds, '4'); assert.equal(NetworkPolicy.snapshot().connectMs, 2000); assert.equal(p.networkBusy, false);
});
for (const condition of ['hidden', 'locked', 'replaced']) test('settings rejects ' + condition + ' page without persisting', async () => {
 await Store.load(h.context); const p = page({ requestSeconds: '8', connectSeconds: '2', readSeconds: '3' }); if (condition === 'hidden') p.onPageHide(); if (condition === 'locked') p.locked = true; if (condition === 'replaced') h.activate('replaced'); await p.saveApiNetwork(); assert.equal(NetworkPolicy.snapshot().requestMs, 30000); assert.ok(!fixture.state.calls.some(c => c[0] === 'put'));
});
test('explicit reset restores all defaults including cache fallback', async () => {
 await Store.load(h.context); await Store.save(options({ requestMs: 1000, autoCache: false }), () => true); const p = page(); await p.saveApiNetwork(true); assert.deepEqual(NetworkPolicy.snapshot(), { ...new NetworkOptions() });
});
(async () => { for (const [name, fn] of tests) { reset(); await fn(); console.log('PASS ' + name); } console.log(`${tests.length} network preference regressions passed. Native HTTP/Preferences fixtures do not prove real network timing or storage durability.`); })().catch(e => { console.error(e); process.exitCode = 1; });
