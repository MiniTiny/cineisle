// Actual controller/page behavior with explicit SDK fixtures; native rendering is a separate gate.
const assert = require('node:assert/strict');
const { load, platform, NativePlayer, nativePlayers, nativeQueue, route, deferred, settle, rig, reset, AppService, Player, setRoute } = require('./player-regression.test.cjs');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const Controller = load('service/PlaybackController.ets').PlaybackController;
async function page() { setRoute(route()); const p = new Player(); p.aboutToAppear(); p.surfaceId = 'surface'; await p.controller.open(p.route, p.surfaceId); await settle(); return p; }
test('first-frame readiness resets on source change and rejects events from detached players', async () => {
  const frames = []; const c = new Controller(undefined, { state() {}, time() {}, tracks() {}, subtitle() {}, error() {}, reportError() {}, complete() {}, frame: ready => frames.push(ready) });
  await c.open(route(), 's'); await settle(); const old = nativePlayers[0]; assert.deepEqual(frames, [false]); old.emit('startRenderFrame'); assert.equal(frames.at(-1), true);
  await c.open(route(), 's'); await settle(); old.emit('startRenderFrame'); assert.equal(frames.at(-1), false); nativePlayers[1].emit('startRenderFrame'); assert.equal(frames.at(-1), true); await c.close(); assert.equal(frames.at(-1), false);
});
test('fatal native error stops once, releases once, rejects stale callbacks and exposes logical error', async () => {
  const { c, values } = rig(); await c.open(route(), 's'); await settle(); const n = nativePlayers[0]; n.emit('timeUpdate', 14000); n.emit('error'); n.change('error'); n.change('completed'); n.emit('timeUpdate', 55000); await settle();
  assert.equal(c.snapshot().state, 'error'); assert.equal(c.snapshot().position, 14000); assert.equal(values.state, 'error'); assert.equal(values.complete, 0); assert.equal(values.errors.filter(x => x === 'play_error').length, 1); assert.equal(values.reports.filter(x => x[0] === 'Stopped').length, 1); assert.equal(n.calls.filter(x => x[0] === 'release').length, 1); await c.close();
});
test('retry waits for failed-player release, retains exact route and last progress', async () => {
  const { c } = rig(); await c.open(route(), 's'); await settle(); const n = nativePlayers[0], gate = deferred(); n.releaseWait = gate.promise; n.emit('timeUpdate', 17000); n.change('error'); const retrying = c.retry('s'); await settle(); assert.equal(nativePlayers.length, 1); gate.resolve(); await retrying; await settle();
  assert.equal(nativePlayers.length, 2); assert.equal(nativePlayers[1].source, route().url); assert.ok(nativePlayers[1].calls.some(x => x[0] === 'seek' && x[1] === 17000)); assert.equal(c.snapshot().state, 'playing'); assert.equal(c.snapshot().route.mediaSourceId, 'source-a'); await c.close();
});
test('creation, synchronous initialization and asynchronous preparation failures permit explicit retry', async () => {
  for (const kind of ['create', 'surface', 'prepareSync', 'prepare']) {
    const { c, values } = rig(); if (kind === 'create') nativeQueue.push(Promise.reject(new Error('create'))); else {
      const n = new NativePlayer();
      if (kind === 'surface') Object.defineProperty(n, 'surfaceId', { set() { throw new Error('surface'); } });
      else if (kind === 'prepareSync') n.prepare = () => { throw new Error('prepareSync'); };
      else n.prepare = async () => { throw new Error('prepare'); };
      nativeQueue.push(Promise.resolve(n));
    }
    await c.open(route(), 's', 19000); await settle(); assert.equal(values.state, 'error'); assert.equal(c.snapshot().state, 'error'); await c.retry('s'); await settle(); assert.equal(c.snapshot().state, 'playing'); assert.ok(nativePlayers.at(-1).calls.some(x => x[0] === 'seek' && x[1] === 19000)); await c.close();
  }
});
test('retry invalidated by exit during release never creates a replacement player', async () => {
  const { c } = rig(); await c.open(route(), 's'); await settle(); const n = nativePlayers[0], gate = deferred(); n.releaseWait = gate.promise; n.emit('error'); const retrying = c.retry('s'); await c.close(); gate.resolve(); await retrying; await settle(); assert.equal(nativePlayers.length, 1); assert.equal(c.snapshot().state, 'released');
});
test('recoverable subtitle and audio failures keep video, frame and native player alive', async () => {
  const p = await page(), n = nativePlayers[0]; n.emit('startRenderFrame'); p.controller.client.subtitle = async () => { throw new Error('subtitle HTTP 503'); }; await p.track('server:20', false); assert.equal(p.message, 'subtitle_failed'); assert.equal(p.state, 'playing'); assert.equal(p.frameReady, true);
  n.failSelect = true; await p.track('native:8', true); assert.equal(p.message, 'track_switch_failed'); assert.equal(p.state, 'playing'); assert.equal(p.frameReady, true); assert.ok(!n.calls.some(x => x[0] === 'release')); p.aboutToDisappear();
});
test('actual page hides failed frame, retains error after system stop and reconnects on retry', async () => {
  const p = await page(), n = nativePlayers[0]; n.emit('startRenderFrame'); n.emit('timeUpdate', 16000); n.emit('error'); await settle(); assert.equal(p.frameReady, false); assert.equal(p.state, 'error'); assert.equal(p.options, false); await p.system.stop(); await settle(); assert.equal(p.state, 'error'); await p.toggle(); await settle(); assert.equal(p.state, 'playing'); assert.equal(p.message, ''); assert.equal(nativePlayers.length, 2); assert.ok(nativePlayers[1].calls.some(x => x[0] === 'seek' && x[1] === 16000)); p.aboutToDisappear();
});
test('retry is blocked by visibility, PIN, controls, settings, busy, PiP and account ownership', async () => {
  const p = await page(); nativePlayers[0].emit('error'); await settle(); assert.equal(p.canRetry(), true);
  for (const [key, value] of [['visible', false], ['locked', true], ['controlsLocked', true], ['settingsBusy', true], ['busy', true], ['pipActive', true], ['surfaceId', '']]) { const old = p[key]; p[key] = value; await p.toggle(); assert.equal(nativePlayers.length, 1, key); p[key] = old; }
  const lock = load('service/AppLock.ets').AppLock; lock.locked = true; await p.toggle(); assert.equal(nativePlayers.length, 1); lock.locked = false;
  const client = AppService.client; AppService.client = {}; await p.toggle(); assert.equal(nativePlayers.length, 1); AppService.client = client; p.aboutToDisappear(); await p.toggle(); assert.equal(nativePlayers.length, 1);
});
test('fatal offline playback closes owned FD and retry opens a new FD without server reports', async () => {
  const fs = require('node:fs'), path = require('node:path'), { directory } = require('./player-regression.test.cjs'); const file = path.join(directory, 'retry-offline.mp4'); fs.writeFileSync(file, 'fixture'); const { c, values } = rig(); await c.open(Object.assign(route(), { offline: true, filePath: file }), 's'); await settle(); const old = nativePlayers[0].fd.fd; nativePlayers[0].emit('error'); await settle(); assert.throws(() => fs.fstatSync(old)); await c.retry('s'); await settle(); assert.equal(fs.fstatSync(nativePlayers[1].fd.fd).size, 7); assert.equal(values.reports.length, 0); await c.close();
});
(async () => { for (const [name, fn] of tests) { reset(); await fn(); await settle(); console.log('PASS ' + name); } console.log(`${tests.length} player error regressions passed. SDK fixtures do not prove native rendering or real Jellyfin.`); })().catch(e => { console.error(e); process.exitCode = 1; });
