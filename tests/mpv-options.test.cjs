// Executes the real preference store and factory with explicit SDK storage fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./player-regression.test.cjs');
const { MpvPreferences: store } = h.load('service/MpvPreferences.ets');
const options = h.load('utils/MpvOptions.ts');
const { PlaybackEngines } = h.load('service/PlaybackEngines.ets');
const { MpvPlaybackEngine } = h.load('service/MpvPlaybackEngine.ets');
const fixture = h.preferencesPlatform, context = { filesDir: h.directory, cacheDir: h.directory };
const filename = path.join(h.directory, 'mpv_playback_options.fixture.json');
const normal = { hwdec: 'ohcodec', vo: 'gpu-next' }, software = { hwdec: 'no', vo: 'gpu' };
function fresh(clear = true) {
  store.context = undefined; store.store = undefined; store.loading = undefined; store.writes = Promise.resolve(); store.raw = ''; store.value = options.defaultMpvOptions(); store.ready = false; store.issue = '';
  fixture.state.instances.clear(); fixture.state.calls.length = 0; fixture.state.failOpen = fixture.state.failGet = false;
  fixture.state.failPut = fixture.state.failFlush = 0; fixture.state.flushWait = undefined;
  if (clear) fs.rmSync(filename, { force: true });
}
const cases = [], test = (name, fn) => cases.push([name, fn]);
test('defaults map to platform hardware and gpu-next without writing or probing the native library', async () => {
  fresh(); let probes = 0; const available = MpvPlaybackEngine.available; MpvPlaybackEngine.available = async () => { probes++; return true; };
  try { await store.load(context); assert.equal(JSON.stringify(store.requireOptions()), JSON.stringify(normal)); assert.equal(probes, 0); assert.equal(fixture.state.calls.filter(c => c[0] === 'put').length, 0); }
  finally { MpvPlaybackEngine.available = available; }
});
for (const hwdec of ['no', 'ohcodec', 'ohcodec-copy']) for (const vo of ['gpu', 'gpu-next']) test(`durable cold round trip ${hwdec}/${vo}`, async () => {
  fresh(); await store.load(context); await store.save({ hwdec, vo }, () => true); const raw = JSON.parse(fs.readFileSync(filename));
  assert.deepEqual(raw, { options_v1: JSON.stringify({ hwdec, vo }) }); fresh(false); await store.load(context);
  assert.equal(store.requireOptions().hwdec, hwdec); assert.equal(store.requireOptions().vo, vo);
});
for (const raw of [false, 3, '{bad', 'null', '[]', '{"hwdec":"mediacodec","vo":"gpu"}', '{"hwdec":"no","vo":"null"}', '{"hwdec":"no","vo":"gpu","profile":"fast"}']) test('invalid stored options remain untouched until explicit repair: ' + raw, async () => {
  fresh(); fs.writeFileSync(filename, JSON.stringify({ options_v1: raw })); await assert.rejects(store.load(context), /mpv_options_invalid/);
  assert.equal(store.known(), false); assert.throws(() => store.requireOptions(), /mpv_options_invalid/); assert.deepEqual(JSON.parse(fs.readFileSync(filename)).options_v1, raw);
  await store.save(software, () => true); assert.equal(store.requireOptions().hwdec, 'no');
});
test('unreadable options recover on a later read without writing defaults', async () => {
  fresh(); fixture.state.failGet = true; await assert.rejects(store.load(context), /mpv_options_load_failed/); fixture.state.failGet = false;
  await store.load(context); assert.equal(store.known(), true); assert.equal(fixture.state.calls.filter(c => c[0] === 'put').length, 0);
});
for (const flag of ['failPut', 'failFlush']) test(flag + ' rolls back both memory and durable options', async () => {
  fresh(); await store.load(context); await store.save(normal, () => true); fixture.state[flag] = 1;
  await assert.rejects(store.save(software, () => true), /mpv_options_save_failed/); assert.equal(store.requireOptions().hwdec, normal.hwdec);
  fresh(false); await store.load(context); assert.equal(store.requireOptions().vo, normal.vo);
});
test('late cancellation rolls back a flushed selection without publishing it', async () => {
  fresh(); await store.load(context); await store.save(normal, () => true); const gate = h.deferred(); fixture.state.flushWait = gate.promise; let allowed = true;
  const writing = store.save(software, () => allowed); await h.settle(); assert.equal(store.requireOptions().hwdec, 'ohcodec'); allowed = false; gate.resolve();
  await assert.rejects(writing, /mpv_options_cancelled/); fixture.state.flushWait = undefined; fresh(false); await store.load(context); assert.equal(store.requireOptions().hwdec, 'ohcodec');
});
test('failed rollback blocks MPV options until explicit repair but default AVPlayer remains usable', async () => {
  fresh(); await store.load(context); fixture.state.failFlush = 2; await assert.rejects(store.save(software, () => true), /mpv_options_restore_failed/);
  assert.throws(() => store.requireOptions(), /mpv_options_restore_failed/); const player = await PlaybackEngines.create('native'); await player.release();
  await store.save(software, () => true); assert.equal(store.requireOptions().hwdec, 'no');
});
test('serialized saves retain each invocation result and snapshot caller data at invocation', async () => {
  fresh(); await store.load(context); const gate = h.deferred(); fixture.state.flushWait = gate.promise;
  const requested = { hwdec: 'no', vo: 'gpu' }; const first = store.save(requested, () => true); const second = store.save(normal, () => true); requested.hwdec = 'ohcodec-copy';
  await h.settle(); gate.resolve(); assert.equal((await first).hwdec, 'no'); assert.equal((await second).hwdec, 'ohcodec'); fixture.state.flushWait = undefined;
  const snapshot = store.snapshot(); snapshot.hwdec = 'no'; assert.equal(store.requireOptions().hwdec, 'ohcodec');
});
test('default AVPlayer never reads MPV options, including damaged disk values', async () => {
  fresh(); fs.writeFileSync(filename, JSON.stringify({ options_v1: false })); fixture.state.failOpen = true;
  const player = await PlaybackEngines.create('native', context); await player.release(); assert.equal(fixture.state.calls.filter(c => c[0] === 'open').length, 0);
});
test('MPV factory passes the saved options and cache directory to the actual adapter boundary', async () => {
  fresh(); await store.load(context); await store.save(software, () => true); const available = MpvPlaybackEngine.available, create = MpvPlaybackEngine.create; let received;
  MpvPlaybackEngine.available = async () => true; MpvPlaybackEngine.create = async (directory, value) => { received = [directory, value]; return { tag: 'mpv' }; };
  try { const player = await PlaybackEngines.create('mpv', context); assert.equal(player.tag, 'mpv'); assert.equal(received[0], context.cacheDir); assert.equal(JSON.stringify(received[1]), JSON.stringify(software)); }
  finally { MpvPlaybackEngine.available = available; MpvPlaybackEngine.create = create; }
});
test('corrupt MPV options are a visible configuration failure rather than an engine switch', async () => {
  fresh(); fs.writeFileSync(filename, JSON.stringify({ options_v1: false })); const available = MpvPlaybackEngine.available; MpvPlaybackEngine.available = async () => true;
  try { await assert.rejects(PlaybackEngines.create('mpv', context), /mpv_options_invalid/); assert.equal(store.known(), false); }
  finally { MpvPlaybackEngine.available = available; }
});
test('actual Player preserves a corrupt MPV configuration error without opening another engine', async () => {
  fresh(); fs.writeFileSync(filename, JSON.stringify({ options_v1: false }));
  const { EnginePreferences } = h.load('service/EnginePreferences.ets'); await EnginePreferences.load(context); await EnginePreferences.save('mpv', () => true);
  const available = MpvPlaybackEngine.available; MpvPlaybackEngine.available = async () => true; h.setRoute(h.route()); const p = new h.Player(); p.aboutToAppear();
  try { await p.controller.open(p.route, 'surface'); await h.settle(); assert.equal(p.state, 'error'); assert.equal(p.message, 'mpv_options_invalid'); assert.equal(h.nativePlayers.length, 0); }
  finally { p.aboutToDisappear(); MpvPlaybackEngine.available = available; }
});
(async () => { for (const [name, fn] of cases) { h.reset(); await fn(); console.log('PASS', name); } console.log(`${cases.length} MPV option cases passed. Storage/native fixtures; not OS persistence or hardware decoding.`); })().catch(error => { console.error(error); process.exitCode = 1; });
