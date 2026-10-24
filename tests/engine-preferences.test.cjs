// Real global store, factory, controller and Player paths with explicit native/Preferences fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./player-regression.test.cjs');
const { EnginePreferences: store } = h.load('service/EnginePreferences.ets');
const { PlaybackEngines } = h.load('service/PlaybackEngines.ets');
const { MpvPlaybackEngine } = h.load('service/MpvPlaybackEngine.ets');
const fixture = h.preferencesPlatform, context = { filesDir: h.directory };
const filename = path.join(h.directory, 'playback_engine.fixture.json');
function fresh() {
  store.context = undefined; store.store = undefined; store.loading = undefined; store.writes = Promise.resolve();
  store.raw = ''; store.value = 'native'; store.ready = false; store.issue = '';
  fixture.state.instances.clear(); fixture.state.calls.length = 0; fixture.state.failOpen = fixture.state.failGet = false;
  fixture.state.failPut = fixture.state.failFlush = 0; fixture.state.flushWait = undefined;
}
const tests = [], test = (name, fn) => tests.push([name, fn]);
test('new install defaults to the native engine without a preferences write or MPV probe', async () => {
  fresh(); fs.rmSync(filename, { force: true }); let probes = 0; const available = MpvPlaybackEngine.available;
  MpvPlaybackEngine.available = async () => { ++probes; return true; };
  try { await store.load(context); assert.equal(store.requireChoice(), 'native'); const p = await PlaybackEngines.create(store.requireChoice());
    assert.ok(h.nativePlayers.includes(p.player)); assert.equal(probes, 0); assert.equal(fixture.state.calls.filter(c => c[0] === 'put').length, 0); await p.release();
  } finally { MpvPlaybackEngine.available = available; }
});
test('one durable global choice survives cold reconstruction and contains no account or source data', async () => {
  fresh(); await store.load(context); await store.save('mpv', () => true); const raw = JSON.parse(fs.readFileSync(filename));
  assert.deepEqual(raw, { choice_v1: 'mpv' }); fresh(); await store.load(context); assert.equal(store.requireChoice(), 'mpv');
  const session = h.load('service/SessionStore.ets').SessionStore, clear = session.clear; session.clear = async () => {};
  try { await h.AppService.logout(); assert.equal(store.requireChoice(), 'mpv'); } finally { session.clear = clear; }
});
test('concurrent loads share a single platform read', async () => {
  fresh(); await Promise.all([store.load(context), store.load(context)]); assert.equal(fixture.state.calls.filter(c => c[0] === 'open').length, 1);
});
test('unreadable preferences block playback choice and recover on a later read', async () => {
  fresh(); fixture.state.failGet = true; await assert.rejects(store.load(context), /engine_load_failed/); assert.throws(() => store.requireChoice(), /engine_load_failed/);
  fixture.state.failGet = false; await store.load(context); assert.equal(store.known(), true);
});
for (const raw of [3, false, 'unsupported', '{broken']) test('invalid persisted choice is retained until explicit repair: ' + raw, async () => {
  fresh(); fs.writeFileSync(filename, JSON.stringify({ choice_v1: raw })); await assert.rejects(store.load(context), /engine_invalid/);
  assert.equal(store.known(), false); assert.throws(() => store.requireChoice(), /engine_invalid/); assert.deepEqual(JSON.parse(fs.readFileSync(filename)).choice_v1, raw);
  await store.save('native', () => true); assert.equal(store.requireChoice(), 'native');
});
for (const flag of ['failPut', 'failFlush']) test(flag + ' retains the previous engine in memory and after cold read', async () => {
  fresh(); await store.load(context); await store.save('native', () => true); fixture.state[flag] = 1;
  await assert.rejects(store.save('mpv', () => true), /engine_save_failed/); assert.equal(store.requireChoice(), 'native'); fresh(); await store.load(context); assert.equal(store.requireChoice(), 'native');
});
test('late cancellation rolls back a flushed choice without publishing success', async () => {
  fresh(); await store.load(context); await store.save('native', () => true); const gate = h.deferred(); fixture.state.flushWait = gate.promise; let allowed = true;
  const saving = store.save('mpv', () => allowed); await h.settle(); assert.equal(store.requireChoice(), 'native'); allowed = false; gate.resolve();
  await assert.rejects(saving, /engine_cancelled/); fixture.state.flushWait = undefined; assert.equal(store.requireChoice(), 'native'); fresh(); await store.load(context); assert.equal(store.requireChoice(), 'native');
});
test('rollback failure blocks use of an uncertain disk choice until an explicit save repairs it', async () => {
  fresh(); await store.load(context); fixture.state.failFlush = 2; await assert.rejects(store.save('mpv', () => true), /engine_restore_failed/);
  assert.equal(store.known(), false); assert.throws(() => store.requireChoice(), /engine_restore_failed/); await store.save('native', () => true); assert.equal(store.requireChoice(), 'native');
});
test('serialized writes preserve each invocation result and the final persisted choice', async () => {
  fresh(); await store.load(context); const gate = h.deferred(); fixture.state.flushWait = gate.promise;
  const a = store.save('mpv', () => true), b = store.save('native', () => true); await h.settle(); gate.resolve();
  assert.equal(await a, 'mpv'); assert.equal(await b, 'native'); fixture.state.flushWait = undefined; fresh(); await store.load(context); assert.equal(store.requireChoice(), 'native');
});
test('validation and factory dispatch never replace a requested MPV failure with a native player', async () => {
  h.reset(); let calls = 0; const create = MpvPlaybackEngine.create, available = MpvPlaybackEngine.available;
  MpvPlaybackEngine.available = async () => false; MpvPlaybackEngine.create = async () => { ++calls; throw Error('internal fixture'); };
  try { await assert.rejects(PlaybackEngines.validate('mpv'), /engine_mpv_unavailable/); await assert.rejects(PlaybackEngines.create('mpv'), /engine_mpv_unavailable/); assert.equal(calls, 0); assert.equal(h.nativePlayers.length, 0);
    await assert.rejects(PlaybackEngines.create('unknown'), /engine_invalid/);
  } finally { MpvPlaybackEngine.create = create; MpvPlaybackEngine.available = available; }
});
test('API12 disables MPV eligibility without a native capability probe', async () => {
  const info = h.platform.get('@ohos.deviceInfo'), level = info.sdkApiVersion; info.sdkApiVersion = 12;
  try { assert.equal(PlaybackEngines.canOfferMpv(), false); await assert.rejects(PlaybackEngines.validate('mpv'), /engine_mpv_unavailable/); } finally { info.sdkApiVersion = level; }
});
for (const api of [14, 15, 16]) test('factory eligibility preserves API15 independently at ' + api, () => {
  const info = h.platform.get('@ohos.deviceInfo'), level = info.sdkApiVersion, available = MpvPlaybackEngine.available;
  let probes = 0; info.sdkApiVersion = api; MpvPlaybackEngine.available = async () => { ++probes; return true; };
  try { assert.equal(PlaybackEngines.canOfferMpv(), api >= 15); assert.equal(probes, 0); }
  finally { info.sdkApiVersion = level; MpvPlaybackEngine.available = available; }
});
test('actual Player factory reads the global choice at open and reports an unavailable backend', async () => {
  h.reset(); fresh(); await store.load(context); await store.save('mpv', () => true); h.setRoute(h.route()); const p = new h.Player(); p.aboutToAppear();
  const create = MpvPlaybackEngine.create, available = MpvPlaybackEngine.available; let calls = 0; MpvPlaybackEngine.available = async () => true; MpvPlaybackEngine.create = async () => { calls++; throw Error('fixture'); };
  try { await p.controller.open(p.route, 'surface'); await h.settle(); assert.equal(calls, 1); assert.equal(p.state, 'error'); assert.equal(p.message, 'engine_mpv_unavailable'); assert.equal(h.nativePlayers.length, 0); }
  finally { p.aboutToDisappear(); MpvPlaybackEngine.create = create; MpvPlaybackEngine.available = available; }
});
test('actual Player uses a saved native choice for the next opened video', async () => {
  h.reset(); fresh(); await store.load(context); await store.save('native', () => true); h.setRoute(h.route()); const p = new h.Player(); p.aboutToAppear();
  try { await p.controller.open(p.route, 'surface'); await h.settle(); assert.equal(p.state, 'playing'); assert.equal(h.nativePlayers.length, 1); }
  finally { await p.controller.close(); p.aboutToDisappear(); }
});
const watchdog = setTimeout(() => { console.error('FAIL engine preference fixture did not settle'); process.exitCode = 1; }, 15000);
(async () => { for (const [name, fn] of tests) { h.reset(); await fn(); console.log('PASS', name); } console.log(`${tests.length} engine preference tests passed. Explicit native/Preferences fixtures; no OS storage or decoding claim.`); })().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
