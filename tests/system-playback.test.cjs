// Exercises real SystemPlayback, PlaybackController, Player and EntryAbility with explicit SDK fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const h = require('./player-regression.test.cjs');
const { load, nativePlayers, route, episode, deferred, settle, AppService, Player, systemPlatform: sdk } = h;
const { SystemPlayback } = load('service/SystemPlayback.ets');
const { PlaybackController } = load('service/PlaybackController.ets');
const EntryAbility = load('entryability/EntryAbility.ets').default;
const all = [], tests = [];
const test = (name, fn) => tests.push([name, fn]);
async function rig(item = route()) {
  let system;
  const values = { states: [], errors: [], next: 0, stopped: 0 };
  const surface = {};
  const controller = new PlaybackController({ report: async () => {} }, {
    state: value => { values.state = value; system?.sync(true); },
    time: () => system?.sync(), tracks() {}, subtitle() {}, error: e => values.errors.push(e), reportError() {}, complete() {},
    beforePlay: () => system.permitPlay(), interrupted: () => system.pause()
  });
  system = new SystemPlayback(sdk.context, controller, surface, item, {
    changed: value => { values.states.push(value); values.flags = value; }, error: e => values.errors.push(e),
    next: async () => { values.next++; }, stopped: () => { values.stopped++; }
  });
  all.push(system); await system.initialize(); if (!system.disposed) await controller.open(item, 'surface-main'); await settle();
  return { s: system, c: controller, v: values, n: nativePlayers.at(-1), session: sdk.sessions.at(-1), surface };
}
async function command(session, event, value) { await session.emit(event, value); await settle(); }
async function page() {
  h.setRoute(route()); AppService.client = { report: async () => {} };
  const p = new Player(); p.aboutToAppear(); await p.system.initialize(); all.push(p.system);
  p.surfaceId = 'surface-page'; await p.controller.open(p.route, p.surfaceId); await settle(); return p;
}
test('module declares audio background mode, permission and singleton launch', () => {
  const module = JSON.parse(fs.readFileSync('entry/src/main/module.json5')).module;
  assert.ok(module.requestPermissions.some(p => p.name === 'ohos.permission.KEEP_BACKGROUND_RUNNING'));
  assert.deepEqual(module.abilities[0].backgroundModes, ['audioPlayback', 'dataTransfer']); assert.equal(module.abilities[0].launchType, 'singleton');
});
test('session publishes real metadata, position in milliseconds and launch target without credentials', async () => {
  const r = route(episode('e1', 1, 1, { Name: '第一集', SeriesName: '剧集' })); r.url += '?api_key=private';
  const { s, c, session } = await rig(r); c.seek(12000); s.sync(true); await settle();
  assert.equal(session.active, true); assert.equal(sdk.calls[0][1], 'audio');
  assert.deepEqual(session.metadata.at(-1), { assetId: 'e1', title: '第一集', artist: '剧集', duration: 60000 });
  assert.equal(session.states.at(-1).position.elapsedTime, 12000); assert.equal(session.states.at(-1).state, 2);
  assert.ok(session.states.at(-1).position.updateTime > 0);
  assert.equal(sdk.want.wants[0].abilityName, 'EntryAbility'); assert.equal(sdk.want.wants[0].parameters, undefined);
  assert.ok(!JSON.stringify(session.metadata).includes('private')); assert.ok(!JSON.stringify(session.metadata).includes('api_key'));
});
test('foreground hide pauses by default and returning does not automatically resume', async () => {
  const { s, n } = await rig(); s.background(); await settle(); assert.equal(n.state, 'paused'); assert.equal(s.canContinue, false);
  s.foreground(); await settle(); assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false);
});
test('native pause failure while going to background closes player and session', async () => {
  const { s, n, session, v } = await rig(); n.failPause = true; await s.background();
  assert.equal(n.state, 'released'); assert.equal(session.destroyed, 1); assert.equal(v.stopped, 1); assert.equal(sdk.taskActive, false);
});
test('background preference obtains one task, continues audio and releases task on pause', async () => {
  const { s, n, session } = await rig(); await s.setBackground(true); s.background(); await settle();
  assert.equal(n.state, 'playing'); assert.equal(s.canContinue, true); assert.equal(sdk.taskActive, true);
  await command(session, 'pause'); assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false);
  assert.equal(sdk.calls.filter(c => c[0] === 'taskStart').length, 1);
});
test('lock-screen resume reapplies background task before playing; duplicate play is idempotent', async () => {
  const { s, n, session } = await rig(); await s.setBackground(true); s.background(); await s.pause();
  const before = n.calls.filter(c => c[0] === 'play').length;
  await command(session, 'play'); await command(session, 'play');
  assert.equal(n.state, 'playing'); assert.equal(sdk.taskActive, true); assert.equal(n.calls.filter(c => c[0] === 'play').length, before + 1);
  assert.equal(sdk.calls.filter(c => c[0] === 'taskStart').length, 2);
});
test('background grant failure never enables toggle or allows hidden playback', async () => {
  const { s, v, n } = await rig(); sdk.failTask = true; await s.setBackground(true);
  assert.equal(v.flags.backgroundEnabled, false); s.background(); await settle(); assert.equal(n.state, 'paused'); assert.equal(s.canContinue, false);
  await s.play(); assert.equal(n.state, 'paused'); assert.ok(v.errors.includes('background_unavailable'));
});
test('unsupported background capability falls back to foreground playback', async () => {
  const { s, n, v } = await rig(); sdk.capabilities['SystemCapability.ResourceSchedule.BackgroundTaskManager.ContinuousTask'] = false;
  await s.setBackground(true); assert.equal(v.flags.backgroundEnabled, false); assert.equal(n.state, 'playing'); assert.equal(sdk.calls.filter(c => c[0] === 'taskStart').length, 0);
});
test('session failure keeps foreground AVPlayer usable and disables system controls', async () => {
  sdk.failSession = true; const { s, n, v, session } = await rig(); assert.equal(n.state, 'playing'); assert.equal(v.flags.ready, false);
  await s.setBackground(true); assert.equal(v.flags.backgroundEnabled, false); assert.equal(session.destroyed, 1); assert.ok(v.errors.includes('session_unavailable'));
});
test('session capability guard prevents creating unavailable session', async () => {
  sdk.capabilities['SystemCapability.Multimedia.AVSession.Core'] = false; const { s, n, v } = await rig();
  assert.equal(v.flags.ready, false); assert.equal(sdk.sessions.length, 0); assert.equal(n.state, 'playing'); await s.startPiP(); assert.equal(sdk.windows.length, 0);
});
test('WantAgent failure destroys session and leaves system controls disabled', async () => {
  sdk.failWant = true; const { v, session } = await rig(); assert.equal(session.destroyed, 1); assert.equal(v.flags.ready, false);
});
test('lock-screen seek and skip clamp positions; nonfinite values are rejected', async () => {
  const { session, c } = await rig(); await command(session, 'seek', 20000); assert.equal(c.snapshot().position, 20000);
  await command(session, 'fastForward', 10000); assert.equal(c.snapshot().position, 30000);
  await command(session, 'rewind', 999999); assert.equal(c.snapshot().position, 0);
  await command(session, 'seek', Infinity); assert.equal(c.snapshot().position, 0);
  await command(session, 'seek', 999999); assert.equal(c.snapshot().position, 60000);
});
test('lock-screen speed sets real native rate and rejects unsupported values', async () => {
  const { session, c, n, v } = await rig(); await command(session, 'setSpeed', 1.25); assert.equal(c.snapshot().speed, 1.25);
  assert.deepEqual(n.calls.at(-1), ['speed', 2]); assert.equal(session.states.at(-1).speed, 1.25);
  await command(session, 'setSpeed', 3); assert.equal(c.snapshot().speed, 1.25); assert.ok(v.errors.includes('speed_failed'));
});
test('lock-screen next only exists for episodes; no fake previous command', async () => {
  const { session, v } = await rig(); await command(session, 'playNext'); assert.equal(v.next, 1); assert.equal(session.handlers.playPrevious, undefined);
  const movie = await rig(route({ Id: 'film', Name: 'film', Type: 'Movie' })); assert.equal(movie.session.handlers.playNext, undefined);
});
test('PiP uses same surface and player, reports native controls and video dimensions', async () => {
  const { s, surface, n, v } = await rig(); await s.startPiP(); const window = sdk.windows[0];
  assert.equal(window.config.componentController, surface); assert.equal(nativePlayers.length, 1); assert.equal(n.state, 'playing');
  assert.equal(window.config.contentWidth, 1920); assert.equal(window.config.contentHeight, 1080);
  assert.equal(window.auto, false); assert.equal(window.enabled[1], false); assert.equal(window.enabled[2], true); assert.equal(v.flags.pipActive, true);
  s.background(); await settle(); assert.equal(n.state, 'playing'); assert.equal(s.canContinue, true);
  assert.ok(window.controls.some(c => c[0] === 0 && c[1] === 1));
});
test('repeated PiP start creates and starts only one window', async () => {
  const { s } = await rig(); await Promise.all([s.startPiP(), s.startPiP()]); assert.equal(sdk.windows.length, 1); assert.equal(sdk.windows[0].started, 1);
});
test('unsupported PiP is rejected without task or native window', async () => {
  sdk.enabled = false; const { s, v } = await rig(); await s.startPiP(); assert.equal(sdk.windows.length, 0); assert.equal(sdk.taskActive, false); assert.ok(v.errors.includes('pip_unavailable'));
});
test('PiP startup failure cancels extra background task', async () => {
  const { s, v, n } = await rig(); sdk.failPiP = true; await s.startPiP(); assert.equal(v.flags.pipActive, false); assert.equal(sdk.taskActive, false); assert.equal(n.state, 'playing'); assert.ok(v.errors.includes('pip_failed'));
});
test('PiP pause and resume buttons share background and native playback control', async () => {
  const { s, n } = await rig(); await s.startPiP(); s.background(); const window = sdk.windows[0];
  await window.emit('controlPanelActionEvent', 'playbackStateChanged', 0); await settle(); assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false);
  await window.emit('controlPanelActionEvent', 'playbackStateChanged', 1); await settle(); assert.equal(n.state, 'playing'); assert.equal(sdk.taskActive, true);
});
test('PiP next and forward/backward call real shared commands', async () => {
  const { s, c, v } = await rig(); await s.startPiP(); const window = sdk.windows[0];
  await window.emit('controlPanelActionEvent', 'fastForward'); assert.equal(c.snapshot().position, 15000);
  await window.emit('controlPanelActionEvent', 'fastBackward'); assert.equal(c.snapshot().position, 0);
  await window.emit('controlPanelActionEvent', 'nextVideo'); await settle(); assert.equal(v.next, 1);
});
test('PiP close in background pauses even when background preference is enabled', async () => {
  const { s, n, v } = await rig(); await s.setBackground(true); await s.startPiP(); s.background(); await sdk.windows[0].emit('stateChange', 4); await settle();
  assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false); assert.equal(v.flags.pipActive, false);
});
test('PiP restore keeps native playback and releases PiP-only background task', async () => {
  const { s, n } = await rig(); await s.startPiP(); s.background(); const window = sdk.windows[0];
  await window.emit('stateChange', 5); await window.emit('stateChange', 4); await settle(); assert.equal(n.state, 'playing'); assert.equal(sdk.taskActive, false);
});
test('turning background off while hidden pauses before releasing task', async () => {
  const { s, n } = await rig(); await s.setBackground(true); s.background(); await s.setBackground(false);
  assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false); assert.equal(s.canContinue, false);
});
test('turning background off while PiP active retains required task', async () => {
  const { s, n } = await rig(); await s.setBackground(true); await s.startPiP(); s.background(); await s.setBackground(false);
  assert.equal(n.state, 'playing'); assert.equal(s.canContinue, true); assert.equal(sdk.taskActive, true);
});
test('audio interruption pauses and cancels task; RESUME hint cannot undo user pause', async () => {
  const { s, n } = await rig(); await s.setBackground(true); s.background(); n.emit('audioInterrupt', { hintType: 2 }); await settle();
  assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false); n.emit('audioInterrupt', { hintType: 1 }); await settle(); assert.equal(n.state, 'paused');
  assert.equal(n.audioRendererInfo.usage, 10);
});
test('STOP interruption also cancels background audio without automatic resume', async () => {
  const { s, n } = await rig(); await s.setBackground(true); s.background(); n.emit('audioInterrupt', { hintType: 3 }); await settle();
  assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false); assert.equal(s.canAutoAdvance, false);
});
test('pause during delayed background resume prevents late playback', async () => {
  const { s, n } = await rig(); await s.setBackground(true); s.background(); await s.pause(); const wait = deferred(); sdk.taskWait = wait.promise;
  const playing = s.play(); await settle(); const pausing = s.pause(); wait.resolve(); await Promise.all([playing, pausing]);
  assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false);
});
test('pause during pending native play overrides late playing event', async () => {
  const { s, n } = await rig(); await s.setBackground(true); s.background(); await s.pause();
  const wait = deferred(); n.playWait = wait.promise; const playing = s.play(); await settle(); await s.pause(); wait.resolve(); await playing; await settle();
  assert.equal(n.state, 'paused'); assert.equal(sdk.taskActive, false); assert.equal(s.canAutoAdvance, false);
});
test('paused time updates while obtaining resume grant do not cancel explicit play', async () => {
  const { s, n } = await rig(); await s.setBackground(true); s.background(); await s.pause();
  const wait = deferred(); sdk.taskWait = wait.promise; const playing = s.play(); await settle(); n.emit('timeUpdate', 12000);
  wait.resolve(); await playing; await settle(); assert.equal(n.state, 'playing'); assert.equal(sdk.taskActive, true);
});
test('disabling background while grant is pending cancels the eventual grant', async () => {
  const { s, v } = await rig(); const wait = deferred(); sdk.taskWait = wait.promise;
  const enabled = s.setBackground(true); await settle(); const disabled = s.setBackground(false); wait.resolve(); await Promise.all([enabled, disabled]);
  assert.equal(v.flags.backgroundEnabled, false); assert.equal(sdk.taskActive, false);
});
test('exit during pending background grant stops task and native player', async () => {
  const { s, n, session } = await rig(); const wait = deferred(); sdk.taskWait = wait.promise;
  const enabled = s.setBackground(true); await settle(); const closing = s.dispose(); wait.resolve(); await Promise.all([enabled, closing]);
  assert.equal(n.state, 'released'); assert.equal(sdk.taskActive, false); assert.equal(session.destroyed, 1);
});
test('exit during session creation destroys late session without activation', async () => {
  const wait = deferred(); sdk.sessionWait = wait.promise; const pending = rig(); await settle(); const closing = all[0].dispose(); wait.resolve();
  const { session } = await pending; await closing; assert.equal(session.destroyed, 1); assert.equal(session.activations, 0); assert.equal(SystemPlayback.current, undefined);
});
test('exit during PiP creation leaves late window inactive and auto-start disabled', async () => {
  const { s } = await rig(); const wait = deferred(); sdk.createPiPWait = wait.promise;
  const starting = s.startPiP(); await settle(); const closing = s.dispose(); assert.equal(s.controller.snapshot().state, 'paused'); wait.resolve(); await Promise.all([starting, closing]);
  assert.equal(sdk.windows[0].started, 0); assert.equal(sdk.windows[0].auto, false); assert.equal(sdk.taskActive, false);
});
test('exit during PiP startup stops the late native window', async () => {
  const { s } = await rig(); const wait = deferred(); sdk.startPiPWait = wait.promise;
  const starting = s.startPiP(); await settle(); const closing = s.dispose(); wait.resolve(); await Promise.all([starting, closing]);
  assert.equal(sdk.windows[0].stopped, 1); assert.equal(sdk.taskActive, false); assert.deepEqual(sdk.windows[0].handlers, {});
});
test('stop releases player, session and PiP once; stale callbacks cannot resurrect playback', async () => {
  const { s, n, session, v } = await rig(); await s.startPiP(); const latePlay = session.handlers.play;
  await command(session, 'stop'); await s.dispose(); latePlay(); await settle();
  assert.equal(n.state, 'released'); assert.equal(n.calls.filter(c => c[0] === 'release').length, 1); assert.equal(session.destroyed, 1);
  assert.equal(v.stopped, 1); assert.equal(sdk.windows[0].stopped, 1); assert.equal(sdk.taskActive, false); assert.equal(SystemPlayback.current, undefined);
});
test('failed task cleanup is visible and retry succeeds without double session destruction', async () => {
  const { s, session, v } = await rig(); await s.setBackground(true); sdk.failStopTask = true; await s.dispose();
  assert.equal(sdk.taskActive, true); assert.ok(v.errors.includes('background_stop_failed')); sdk.failStopTask = false; await s.dispose();
  assert.equal(sdk.taskActive, false); assert.equal(session.destroyed, 1); assert.equal(SystemPlayback.current, undefined);
});
test('failed PiP cleanup retains owner until a successful retry', async () => {
  const { s, v } = await rig(); await s.startPiP(); sdk.failStopPiP = true; await s.dispose();
  assert.equal(SystemPlayback.current, s); assert.equal(v.flags.pipActive, true); assert.ok(v.errors.includes('system_playback_cleanup_failed'));
  sdk.failStopPiP = false; await s.dispose(); assert.equal(sdk.windows[0].stopped, 1); assert.equal(v.flags.pipActive, false); assert.equal(SystemPlayback.current, undefined);
});
test('failed session destruction retains ownership and is retried', async () => {
  const { s, session, v } = await rig(); sdk.failDestroySession = true; await s.dispose();
  assert.equal(SystemPlayback.current, s); assert.equal(session.destroyed, 0); assert.ok(v.errors.includes('system_playback_cleanup_failed'));
  sdk.failDestroySession = false; await s.dispose(); assert.equal(session.destroyed, 1); assert.equal(SystemPlayback.current, undefined);
});
test('new owner disposes previous player and session before activating replacement', async () => {
  const old = await rig(); await old.s.setBackground(true); const replacement = await rig(route(episode('e2', 1, 2)));
  assert.equal(old.n.state, 'released'); assert.equal(old.session.destroyed, 1); assert.equal(SystemPlayback.current, replacement.s); assert.equal(sdk.taskActive, false);
});
test('metadata publication coalesces slow requests and finishes with new route identity', async () => {
  const { s, c, session } = await rig(); const wait = deferred(); sdk.metadataWait = wait.promise;
  c.seek(1000); s.sync(true); await settle(); await c.open(route(episode('e2', 1, 2), 'source-b'), 'surface-main'); await settle();
  c.seek(23000); s.sync(true); delete sdk.metadataWait; wait.resolve(); await settle();
  assert.equal(session.metadata.at(-1).assetId, 'e2'); assert.equal(session.states.at(-1).position.elapsedTime, 23000);
});
test('terminal queue releases background task without restarting native player', async () => {
  const { s, n } = await rig(); await s.setBackground(true); n.change('completed'); await s.queueEnded();
  assert.equal(n.state, 'completed'); assert.equal(sdk.taskActive, false); assert.equal(s.canAutoAdvance, false);
});
test('UIAbility background/foreground share page controller and destruction cleans resources', async () => {
  const { s, n, session } = await rig(); await s.setBackground(true); const ability = new EntryAbility(); ability.onBackground(); await settle();
  assert.equal(n.state, 'playing'); ability.onForeground(); assert.equal(n.state, 'playing'); ability.onDestroy(); await s.dispose();
  assert.equal(session.destroyed, 1); assert.equal(n.state, 'released'); assert.equal(sdk.taskActive, false);
});
test('actual player page continues next episode in authorized background and updates session metadata', async () => {
  const p = await page(); const original = AppService.nextPlayback; AppService.nextPlayback = async () => route(episode('e2', 1, 2));
  try { await p.system.setBackground(true); p.onPageHide(); nativePlayers.at(-1).change('completed'); await settle();
    assert.equal(p.route.item.Id, 'e2'); assert.equal(nativePlayers.at(-1).state, 'playing'); assert.equal(nativePlayers.at(-1).calls.some(c => c[0] === 'seek'), false);
    assert.equal(sdk.sessions[0].metadata.at(-1).assetId, 'e2'); assert.equal(sdk.taskActive, true);
  } finally { AppService.nextPlayback = original; p.aboutToDisappear(); await settle(); }
});
test('pause during delayed auto-next response prevents new player startup', async () => {
  const p = await page(); const original = AppService.nextPlayback, wait = deferred(); AppService.nextPlayback = () => wait.promise;
  try { await p.system.setBackground(true); p.onPageHide(); nativePlayers[0].change('completed'); await settle(); await p.system.pause();
    wait.resolve(route(episode('e2', 1, 2))); await settle(); assert.equal(p.route.item.Id, 'e1'); assert.equal(nativePlayers.length, 1); assert.equal(sdk.taskActive, false);
  } finally { AppService.nextPlayback = original; p.aboutToDisappear(); await settle(); }
});
test('lock-screen pause cancels delayed manual next even while page is visible', async () => {
  const p = await page(); const original = AppService.nextPlayback, wait = deferred(); AppService.nextPlayback = () => wait.promise;
  try { const next = p.system.next(); await settle(); await p.system.pause(); wait.resolve(route(episode('e2', 1, 2))); await next; await settle();
    assert.equal(p.route.item.Id, 'e1'); assert.equal(nativePlayers.length, 1); assert.equal(nativePlayers[0].state, 'paused');
  } finally { AppService.nextPlayback = original; p.aboutToDisappear(); await settle(); }
});
test('page terminal episode cancels task and lock-screen stop allows explicit UI restart', async () => {
  const p = await page(); const original = AppService.nextPlayback; AppService.nextPlayback = async () => undefined;
  try { await p.system.setBackground(true); p.onPageHide(); nativePlayers[0].change('completed'); await settle(); assert.equal(sdk.taskActive, false);
    p.onPageShow(); await command(sdk.sessions[0], 'stop'); assert.equal(p.state, 'released'); await p.toggle(); await settle();
    assert.equal(nativePlayers.at(-1).state, 'playing'); assert.equal(sdk.sessions.length, 2); all.push(p.system);
  } finally { AppService.nextPlayback = original; p.aboutToDisappear(); await settle(); }
});
test('page exit always cleans active PiP and background task', async () => {
  const p = await page(); await p.system.startPiP(); await p.system.setBackground(true); p.onPageHide(); const owner = p.system;
  p.aboutToDisappear(); await owner.dispose(); assert.equal(sdk.taskActive, false); assert.equal(sdk.windows[0].stopped, 1); assert.equal(sdk.sessions[0].destroyed, 1);
});
(async () => {
  for (const [name, fn] of tests) {
    h.reset(); all.length = 0; SystemPlayback.current = undefined;
    try { await fn(); await settle(); console.log('PASS ' + name); }
    finally { delete sdk.taskWait; delete sdk.sessionWait; sdk.failStopTask = false; for (const s of all) await s.dispose(); await settle(); }
  }
  console.log(`${tests.length} system playback regression tests passed. SDK mocks do not prove PiP UI, lock-screen UI, background survival or device decoding.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
