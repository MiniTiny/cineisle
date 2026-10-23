// Executes the real ArkTS adapter against explicit async bridge fixtures; no decoder/audio/UI claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.join(process.env.DEVECO_CONTENTS || '/Applications/DevEco-Studio.app/Contents', 'tools/hvigor/hvigor/node_modules/typescript'));
const source = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/service/MpvPlaybackEngine.ets'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
const focusJs = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/service/MpvAudioFocus.ets'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
const pureCache = new Map();
function pure(file) {
  if (pureCache.has(file)) return pureCache.get(file).exports;
  const m = { exports: {} }; pureCache.set(file, m);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module: m, exports: m.exports, require(id) { assert.ok(id.startsWith('.')); return pure(path.resolve(path.dirname(file), id + '.ts')); } }); return m.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 5; ++i) await new Promise(setImmediate); };
const initial = () => ({ loaded: true, rendered: true, paused: true, ended: false, seeking: false, error: 0,
  duration: 9000, position: 0, width: 640, height: 360, speed: 1, volume: 1, seekRevision: 0, seekDone: 0, surfaceWidth: 0, surfaceHeight: 0, hardwareDecoder: 'no', videoOutput: 'gpu-next', audioOutput: 'ohaudio',
  tracks: [{ index: 0, id: 1, kind: 'audio', language: 'eng', title: 'English', selected: true },
    { index: 1, id: 1, kind: 'sub', language: 'zho', title: 'Chinese', selected: true }] });
function rig(api = 26) {
  const timers = new Map(), calls = [], events = [], pending = [], device = { sdkApiVersion: api };
  let next = 0, value = initial(); const handle = {};
  const bridge = {
    async capability(level) { calls.push(['capability', level]); return { supported: level >= 15, loaded: level >= 15 }; },
    async create(request) { calls.push(['create', request]); return handle; },
    async snapshot(h) { assert.equal(h, handle); calls.push(['snapshot']); if (pending.length) return pending.shift(); return structuredClone(value); },
    async command(h, command) { assert.equal(h, handle); calls.push(command.type === 'surface-size' ? [command.type, command.value, command.height] : [command.type, command.value]);
      if (command.type === 'pause') value.paused = !!command.value;
      if (command.type === 'seek') { value.seekRevision++; value.seeking = true; value.ended = false; value.position = command.value; }
      if (command.type === 'surface-size') { value.surfaceWidth = command.value; value.surfaceHeight = command.height; }
      if (command.type === 'audio' || command.type === 'subtitle') value.tracks.forEach(t => { if (t.kind === (command.type === 'audio' ? 'audio' : 'sub')) t.selected = t.index === command.value; });
    },
    async release(h) { assert.equal(h, handle); calls.push(['release']); }
  };
  const media = { SeekMode: { SEEK_CLOSEST: 3 }, MediaType: { MEDIA_TYPE_AUD: 0, MEDIA_TYPE_SUBTITLE: 2 },
    PlaybackSpeed: { SPEED_FORWARD_0_50_X: -1, SPEED_FORWARD_0_75_X: 0, SPEED_FORWARD_1_00_X: 1, SPEED_FORWARD_1_25_X: 2, SPEED_FORWARD_1_50_X: 3, SPEED_FORWARD_1_75_X: 5, SPEED_FORWARD_2_00_X: 4 } };
  const listeners = new Set();
  const session = { active: false,
    on(name, fn) { assert.equal(name, 'audioSessionDeactivated'); listeners.add(fn); },
    off(name, fn) { assert.equal(name, 'audioSessionDeactivated'); listeners.delete(fn); },
    isAudioSessionActivated() { return this.active; },
    async activateAudioSession(strategy) { assert.equal(strategy.concurrencyMode, 0); calls.push(['focus-activate']); this.active = true; },
    async deactivateAudioSession() { calls.push(['focus-deactivate']); this.active = false; },
    interrupt(reason = 0) { this.active = false; for (const listener of [...listeners]) listener({ reason }); }
  };
  const audio = { getAudioManager: () => ({ getSessionManager: () => session }), AudioConcurrencyMode: { CONCURRENCY_DEFAULT: 0 },
    InterruptType: { INTERRUPT_TYPE_BEGIN: 1 }, InterruptForceType: { INTERRUPT_FORCE: 0 }, InterruptHint: { INTERRUPT_HINT_PAUSE: 2 } };
  const fonts = { prepare(directory) { calls.push(['font-prepare', directory]); return { configuration: directory + '/ass-fonts/fonts.conf' }; } };
  const platform = { './AssFonts': { AssFonts: fonts }, 'libcineisle_mpv.so': bridge, '@ohos.deviceInfo': device, '@ohos.multimedia.media': media, '@ohos.multimedia.audio': audio };
  const focusModule = { exports: {} };
  vm.runInNewContext(focusJs, { module: focusModule, exports: focusModule.exports, require(id) { assert.equal(id, '@ohos.multimedia.audio'); return audio; } });
  platform['./MpvAudioFocus'] = focusModule.exports;
  platform['../utils/MpvTextSubtitle'] = pure(path.join(__dirname, '../entry/src/main/ets/utils/MpvTextSubtitle.ts'));
  platform['../utils/MpvOptions'] = pure(path.join(__dirname, '../entry/src/main/ets/utils/MpvOptions.ts'));
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require(id) { assert.ok(id in platform, 'unexpected platform import ' + id); return platform[id]; },
    setInterval(fn) { const id = ++next; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); },
    setTimeout(fn) { const id = ++next; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  const Engine = module.exports.MpvPlaybackEngine;
  const eventSink = Object.fromEntries(['state', 'time', 'seek', 'subtitle', 'frame', 'error', 'interrupt'].map(name => [name, (...args) => events.push([name, ...args])]));
  async function open(width = 0, height = 0) { const player = await Engine.create('/cache'); if (width) player.setSurfaceSize(width, height); player.bind(eventSink); player.url = 'https://example.invalid/synthetic'; await settle(); player.surfaceId = '123'; await player.prepare(); return player; }
  return { Engine, bridge, fonts, calls, events, pending, timers, device, handle, open, eventSink, session, listeners,
    get value() { return value; }, set value(v) { value = v; }, async tick() { for (const fn of [...timers.values()]) { await fn(); } await settle(); } };
}
const cases = [];
function test(name, fn) { cases.push([name, fn]); }
test('API12 rejects the optional engine without touching native capability or create', async () => {
  const r = rig(12); assert.equal(await r.Engine.available(), false); await assert.rejects(r.Engine.create('/cache'), /mpv_unavailable/); assert.deepEqual(r.calls, []);
});
test('each MPV source receives its platform font configuration without global config loading', async () => {
  const r = rig(), p = await r.open();
  assert.ok(r.calls.some(c => c[0] === 'font-prepare' && c[1] === '/cache'));
  const request = r.calls.find(c => c[0] === 'create')[1];
  assert.equal(request.fontConfiguration, '/cache/ass-fonts/fonts.conf');
  assert.equal(request.source, 'https://example.invalid/synthetic'); await p.release();
});
test('new MPV instances request platform hardware by default and retain their own option snapshot', async () => {
  const r = rig(), defaults = await r.open(); const request = r.calls.find(c => c[0] === 'create')[1];
  assert.equal(request.hardwareDecoder, 'ohcodec'); assert.equal(request.videoOutput, 'gpu-next'); await defaults.release();
  const options = { hwdec: 'no', vo: 'gpu' }; const p = await r.Engine.create('/cache', options);
  options.hwdec = 'ohcodec-copy'; options.vo = 'gpu-next'; p.bind(r.eventSink); p.url = 'https://example.invalid/second'; await settle(); p.surfaceId = '456';
  await p.prepare(); const second = r.calls.filter(c => c[0] === 'create').at(-1)[1];
  assert.equal(second.hardwareDecoder, 'no'); assert.equal(second.videoOutput, 'gpu'); await p.release();
});
test('actual backend reports software fallback rather than the requested hardware mode', async () => {
  const r = rig(), p = await r.open(); assert.equal(p.backend.hardwareDecoder, 'no'); assert.equal(p.backend.videoOutput, 'gpu-next'); assert.equal(p.backend.audioOutput, 'ohaudio');
  r.value.hardwareDecoder = 'ohcodec-copy'; r.value.videoOutput = 'gpu'; await p.refresh(); assert.equal(p.backend.hardwareDecoder, 'ohcodec-copy'); assert.equal(p.backend.videoOutput, 'gpu');
  await p.release(); assert.equal(p.backend, undefined);
});
test('invalid native option choices stop before font preparation or native create', async () => {
  const r = rig(); await assert.rejects(r.Engine.create('/cache', { hwdec: 'mediacodec', vo: 'null' }), /mpv_options_invalid/);
  assert.equal(r.calls.filter(c => c[0] === 'font-prepare' || c[0] === 'create').length, 0);
});
test('font preparation failure is visible before a native source is created', async () => {
  const r = rig(); r.fonts.prepare = () => { throw Error('font fixture unavailable'); };
  await assert.rejects(r.Engine.create('/cache'), /font fixture unavailable/);
  assert.equal(r.calls.filter(c => c[0] === 'create').length, 0);
});
test('prepare exposes actual tracks, frame, dimensions and media state', async () => {
  const r = rig(); const p = await r.open(); assert.equal(p.state, 'prepared'); assert.equal(p.duration, 9000); assert.equal(p.width, 640); assert.equal(p.height, 360);
  assert.equal(r.events.filter(e => e[0] === 'frame').length, 1); const tracks = await p.getTrackDescription();
  assert.equal(tracks[0].track_index, 0); assert.equal(tracks[1].track_type, 2); assert.equal(tracks[1].language, 'zho');
  assert.deepEqual(Array.from(await p.getSelectedTracks()), [0, 1]); await p.setNativeSubtitleVisible(false);
  await p.selectTrack(1); await assert.rejects(p.selectTrack(99), /mpv_track_invalid/); await p.release(); assert.equal(r.timers.size, 0);
});
for (const operation of ['play', 'pause']) test(operation + ' reads after a stale in-flight snapshot before resolving', async () => {
  const r = rig(), p = await r.open(); if (operation === 'pause') await p.play();
  const old = structuredClone(r.value), delayed = deferred(); r.pending.push(delayed.promise);
  const poll = p.refresh(); await settle(); let done = false; const action = p[operation]().then(() => { done = true; });
  await settle(); assert.equal(done, false); delayed.resolve(old); await poll; await action;
  assert.equal(p.state, operation === 'play' ? 'playing' : 'paused'); assert.equal(r.value.paused, operation === 'pause'); await p.release();
});
test('release waits for late native create and duplicate release shares completion', async () => {
  const r = rig(), creation = deferred(), closing = deferred(); r.bridge.create = async () => creation.promise;
  r.bridge.release = async h => { assert.equal(h, r.handle); r.calls.push(['release']); await closing.promise; };
  const p = await r.Engine.create('/cache'); p.bind(r.eventSink); p.fdSrc = { fd: 43, offset: 0, length: 1000 }; await settle(); p.surfaceId = '123';
  const opening = p.prepare(); let released = false; const first = p.release(); assert.equal(first, p.release()); first.then(() => { released = true; });
  creation.resolve(r.handle); await settle(); assert.equal(released, false); assert.equal(r.calls.filter(c => c[0] === 'release').length, 1);
  closing.resolve(); await first; await opening; assert.equal(p.state, 'released'); assert.equal(r.timers.size, 0); assert.equal(r.events.filter(e => e[0] === 'error').length, 0);
});
test('release ignores a snapshot arriving after teardown started', async () => {
  const r = rig(), p = await r.open(), late = deferred(); r.pending.push(late.promise); const poll = p.refresh(); await settle(); const count = r.events.length;
  const close = p.release(); late.resolve({ ...initial(), position: 7000, paused: false }); await poll; await close;
  assert.equal(r.events.length, count); assert.equal(p.state, 'released');
});
test('multiple seeks suppress old time and acknowledge only the newest native revision', async () => {
  const r = rig(), p = await r.open(); r.events.length = 0; p.seek(1000, 3); p.seek(7000, 3); await settle();
  r.value = { ...r.value, seeking: false, seekDone: 1, position: 1000 }; await p.refresh(); assert.equal(r.events.filter(e => ['time', 'seek'].includes(e[0])).length, 0);
  r.value = { ...r.value, seekDone: 2, position: 7000 }; await p.refresh(); await p.refresh();
  assert.deepEqual(r.events.filter(e => e[0] === 'seek'), [['seek', 7000]]); assert.equal(p.currentTime, 7000); await p.release();
});
test('native EOF completes and replay seeks back through the same engine', async () => {
  const r = rig(), p = await r.open(); await p.play(); r.value.ended = true; r.value.position = 9000; await p.refresh(); assert.equal(p.state, 'completed');
  assert.equal(r.session.active, false); const releases = r.calls.filter(c => c[0] === 'focus-deactivate').length;
  await p.refresh(); assert.equal(r.calls.filter(c => c[0] === 'focus-deactivate').length, releases);
  await p.play(); assert.equal(p.state, 'playing'); assert.equal(r.session.active, true);
  assert.ok(r.calls.some(c => c[0] === 'seek' && c[1] === 0)); await p.release();
});
test('EOF releases focus before publishing completion to the next episode', async () => {
  const r = rig(), p = await r.open(); await p.play(); const closing = deferred();
  r.session.deactivateAudioSession = async () => { await closing.promise; r.session.active = false; };
  r.value.ended = true; const poll = p.refresh(); await settle();
  assert.notEqual(p.state, 'completed'); assert.equal(r.session.active, true);
  closing.resolve(); await poll; assert.equal(p.state, 'completed'); assert.equal(r.session.active, false); await p.release();
});
test('explicit replay during pending EOF cleanup wins without obsolete completion', async () => {
  const r = rig(), p = await r.open(); await p.play(); const closing = deferred();
  r.session.deactivateAudioSession = async () => { await closing.promise; r.session.active = false; };
  r.events.length = 0; r.value.ended = true; const poll = p.refresh(); await settle();
  const replay = p.play(); await settle(); closing.resolve(); await poll; await replay;
  assert.equal(p.state, 'playing'); assert.equal(r.session.active, true); assert.equal(r.value.ended, false);
  assert.ok(r.calls.some(c => c[0] === 'seek' && c[1] === 0));
  assert.equal(r.events.filter(e => e[0] === 'state' && e[1] === 'completed').length, 0); await p.release();
});
test('a stale EOF snapshot cannot revoke a newer explicit play or pending seek', async () => {
  const r = rig(), p = await r.open(); await p.play(); const delayed = deferred();
  const oldEnd = { ...structuredClone(r.value), ended: true, paused: true, position: 9000 };
  r.pending.push(delayed.promise); const poll = p.refresh(); await settle(); const play = p.play();
  await settle(); delayed.resolve(oldEnd); await poll; await play;
  assert.equal(p.state, 'playing'); assert.equal(r.session.active, true);
  p.seek(3000, 3); await settle(); Object.assign(r.value, { ended: true, paused: true }); await p.refresh();
  assert.equal(p.state, 'playing'); assert.equal(r.session.active, true);
  Object.assign(r.value, { ended: false, paused: false, seeking: false, seekDone: r.value.seekRevision });
  await p.refresh(); assert.equal(p.state, 'playing'); await p.release();
});
test('EOF cleanup failure is visible and release retries the retained focus owner', async () => {
  const r = rig(), p = await r.open(); await p.play(); let attempts = 0;
  r.session.deactivateAudioSession = async () => { if (++attempts === 1) throw new Error('EOF audio server fixture'); r.session.active = false; };
  r.value.ended = true; await p.refresh(); await p.refresh();
  assert.equal(p.state, 'error'); assert.equal(r.session.active, true);
  assert.equal(r.events.filter(e => e[0] === 'error').length, 1); await p.release(); assert.equal(r.session.active, false);
});
test('seek during pending EOF cleanup retains playback focus without obsolete completion', async () => {
  const r = rig(), p = await r.open(); await p.play(); const closing = deferred();
  r.session.deactivateAudioSession = async () => { await closing.promise; r.session.active = false; };
  r.value.ended = true; const poll = p.refresh(); await settle(); r.events.length = 0;
  p.seek(3000, 3); await settle(); closing.resolve(); await poll;
  assert.notEqual(p.state, 'completed'); assert.equal(r.session.active, true);
  assert.equal(r.events.filter(e => e[0] === 'state' && e[1] === 'completed').length, 0);
  Object.assign(r.value, { seeking: false, seekDone: r.value.seekRevision }); await p.refresh();
  assert.equal(p.currentTime, 3000); assert.equal(p.state, 'playing'); await p.release();
});
test('release during EOF cleanup suppresses completion and waits for focus teardown', async () => {
  const r = rig(), p = await r.open(); await p.play(); const closing = deferred();
  r.session.deactivateAudioSession = async () => { await closing.promise; r.session.active = false; };
  r.value.ended = true; const poll = p.refresh(); await settle(); r.events.length = 0;
  let closed = false; const release = p.release().then(() => { closed = true; }); await settle(); assert.equal(closed, false);
  closing.resolve(); await poll; await release; assert.equal(p.state, 'released'); assert.equal(r.session.active, false);
  assert.equal(r.events.length, 0);
});
test('snapshot failure reports once and stops polling without accepting later frames', async () => {
  const r = rig(), p = await r.open(); r.events.length = 0; r.value.error = -13; await p.refresh(); await p.refresh();
  assert.equal(p.state, 'error'); assert.equal(r.events.filter(e => e[0] === 'error').length, 1); assert.equal(r.timers.size, 0); await p.release();
});
test('creation failure becomes a visible adapter error and remains releasable', async () => {
  const r = rig(); r.bridge.create = async () => { throw new Error('sanitized_native_failure'); }; const p = await r.Engine.create('/cache'); p.bind(r.eventSink);
  p.url = 'https://example.invalid/synthetic'; await settle(); p.surfaceId = '123'; await assert.rejects(p.prepare(), /mpv_playback_failed/);
  assert.equal(r.events.filter(e => e[0] === 'error').length, 1); await p.release(); assert.equal(r.timers.size, 0);
});
test('invalid local descriptors and numeric controls are rejected before dispatch', async () => {
  const r = rig(), p = await r.Engine.create('/cache'); for (const fd of [-1, NaN, 1.5]) assert.throws(() => { p.fdSrc = { fd }; }, /mpv_source_invalid/);
  assert.throws(() => { p.fdSrc = { fd: 1, offset: 4 }; }, /mpv_source_invalid/); await p.release();
  const live = await r.open(); for (const amount of [NaN, -0.1, 1.1]) assert.throws(() => live.setVolume(amount), /mpv_volume_invalid/);
  assert.throws(() => live.setSpeed(100), /mpv_speed_invalid/); assert.throws(() => live.seek(-1, 3), /mpv_seek_invalid/); await live.release();
});
test('focus is acquired before unpausing and released after explicit pause', async () => {
  const r = rig(), p = await r.open(); r.calls.length = 0; await p.play();
  assert.ok(r.calls.findIndex(c => c[0] === 'focus-activate') < r.calls.findIndex(c => c[0] === 'pause' && c[1] === 0));
  await p.pause(); assert.equal(r.session.active, false); await p.release(); assert.equal(r.listeners.size, 0);
});
test('focus loss pauses native media and requires an explicit play to resume', async () => {
  const r = rig(), p = await r.open(); await p.play(); r.events.length = 0;
  r.session.interrupt(); r.session.interrupt(); await settle(); await p.refresh();
  assert.equal(r.value.paused, true); assert.equal(p.state, 'paused'); assert.equal(r.events.filter(e => e[0] === 'interrupt').length, 1);
  await p.refresh(); assert.equal(p.state, 'paused'); await p.play(); assert.equal(p.state, 'playing'); await p.release();
});
test('a native core pause releases a still-active session and emits one interruption', async () => {
  const r = rig(), p = await r.open(); await p.play(); r.events.length = 0;
  r.value.paused = true; await p.refresh(); await settle(); await p.refresh();
  assert.equal(p.state, 'paused'); assert.equal(r.session.active, false);
  assert.equal(r.events.filter(e => e[0] === 'interrupt').length, 1);
  await p.refresh(); assert.equal(p.state, 'paused'); await p.play(); assert.equal(p.state, 'playing');
  assert.equal(r.session.active, true); await p.release();
});
test('prepared, explicit pause and EOF snapshots do not synthesize focus loss', async () => {
  const r = rig(), p = await r.open(); await p.refresh(); assert.equal(r.events.filter(e => e[0] === 'interrupt').length, 0);
  await p.play(); await p.pause(); assert.equal(r.events.filter(e => e[0] === 'interrupt').length, 0);
  await p.play(); r.value.paused = true; r.value.ended = true; await p.refresh();
  assert.equal(p.state, 'completed'); assert.equal(r.events.filter(e => e[0] === 'interrupt').length, 0); await p.release();
});
test('native interruption during a pending focus grant prevents a late unpause', async () => {
  const r = rig(), p = await r.open(); await p.play(); const activation = deferred(); r.calls.length = 0;
  r.session.activateAudioSession = async () => { await activation.promise; r.session.active = true; };
  const play = p.play(); await settle(); r.value.paused = true; await p.refresh(); activation.resolve(); await play; await settle();
  assert.equal(r.value.paused, true); assert.equal(r.session.active, false);
  assert.equal(r.calls.filter(c => c[0] === 'pause' && c[1] === 0).length, 0); await p.release();
});
test('late interruption acknowledgement cannot release a newer explicit play focus', async () => {
  const r = rig(), p = await r.open(); await p.play(); const acknowledgement = deferred(), command = r.bridge.command;
  r.bridge.command = async (h, c) => { await command(h, c); if (c.type === 'pause' && c.value === 1) await acknowledgement.promise; };
  r.value.paused = true; await p.refresh(); await settle(); await p.play();
  assert.equal(p.state, 'playing'); acknowledgement.resolve(); await settle();
  assert.equal(r.session.active, true); assert.equal(r.value.paused, false); await p.release();
});
test('native interruption cleanup failure remains visible and owned until release retries', async () => {
  const r = rig(), p = await r.open(); await p.play(); let attempts = 0;
  r.session.deactivateAudioSession = async () => { if (++attempts === 1) throw new Error('audio server fixture'); r.session.active = false; };
  r.value.paused = true; await p.refresh(); await settle(); assert.equal(p.state, 'error'); assert.equal(r.session.active, true);
  assert.equal(r.events.filter(e => e[0] === 'error').length, 1); await p.release(); assert.equal(r.session.active, false);
});
test('native pause and session deactivation share one interruption during a pending acknowledgement', async () => {
  const r = rig(), p = await r.open(); await p.play(); const acknowledgement = deferred(), command = r.bridge.command;
  r.bridge.command = async (h, c) => { await command(h, c); if (c.type === 'pause' && c.value === 1) await acknowledgement.promise; };
  r.events.length = 0; r.value.paused = true; await p.refresh(); r.session.interrupt();
  assert.equal(r.events.filter(e => e[0] === 'interrupt').length, 1); acknowledgement.resolve(); await settle();
  assert.equal(r.value.paused, true); assert.equal(r.session.active, false); await p.release();
});
test('a pause during focus activation cannot be undone by late play', async () => {
  const r = rig(), p = await r.open(), activation = deferred();
  r.session.activateAudioSession = async () => { await activation.promise; r.session.active = true; };
  const play = p.play(); await settle(); const pause = p.pause(); await settle(); activation.resolve(); await Promise.all([play, pause]);
  assert.equal(r.value.paused, true); assert.equal(r.session.active, false); assert.equal(r.calls.filter(c => c[0] === 'pause' && c[1] === 0).length, 0); await p.release();
});
test('close waits for pending focus activation and leaves no late native play', async () => {
  const r = rig(), p = await r.open(), activation = deferred();
  r.session.activateAudioSession = async () => { await activation.promise; r.session.active = true; };
  const play = p.play(); const rejection = assert.rejects(play, /mpv_audio_unavailable|mpv_closed/); await settle(); let done = false;
  const close = p.release().then(() => { done = true; }); await settle(); assert.equal(done, false); activation.resolve(); await close; await rejection;
  assert.equal(r.session.active, false); assert.equal(r.listeners.size, 0); assert.equal(r.calls.filter(c => c[0] === 'pause' && c[1] === 0).length, 0);
});
test('failed audio activation rejects play without unpausing native media', async () => {
  const r = rig(), p = await r.open(); r.session.activateAudioSession = async () => { throw new Error('audio server fixture'); };
  await assert.rejects(p.play(), /mpv_audio_unavailable/); assert.equal(r.value.paused, true); await p.release(); assert.equal(r.listeners.size, 0);
});
test('late close of a paused engine cannot deactivate a newer engine owner', async () => {
  const r = rig(), first = await r.open(); await first.play(); await first.pause(); const second = await r.open(); await second.play();
  const deactivations = r.calls.filter(c => c[0] === 'focus-deactivate').length; await first.release();
  assert.equal(r.session.active, true); assert.equal(r.listeners.size, 1); assert.equal(r.calls.filter(c => c[0] === 'focus-deactivate').length, deactivations);
  r.session.interrupt(); await settle(); assert.equal(r.value.paused, true); await second.release(); assert.equal(r.listeners.size, 0);
});
test('failed focus deactivation retains ownership until release retries cleanup', async () => {
  const r = rig(), first = await r.open(); await first.play(); let attempts = 0;
  r.session.deactivateAudioSession = async () => { if (++attempts === 1) throw new Error('audio server fixture'); r.session.active = false; };
  await assert.rejects(first.pause(), /audio server fixture/); const second = await r.open(); await assert.rejects(second.play(), /mpv_audio_busy/);
  assert.equal(r.session.active, true); await first.release(); assert.equal(r.session.active, false); await second.play(); assert.equal(r.session.active, true); await second.release();
});
test('partial activation failure keeps a failed cleanup owned and releasable', async () => {
  const r = rig(), p = await r.open(); let attempts = 0;
  r.session.activateAudioSession = async () => { r.session.active = true; throw new Error('partial activation fixture'); };
  r.session.deactivateAudioSession = async () => { if (++attempts === 1) throw new Error('cleanup fixture'); r.session.active = false; };
  await assert.rejects(p.play(), /mpv_audio_unavailable/); assert.equal(r.session.active, true); await p.release(); assert.equal(r.session.active, false); assert.equal(r.listeners.size, 0);
});
const dialogue = text => 'Dialogue: 0,0:00:00.50,0:00:03.50,Default,,0,0,0,,' + text;
test('embedded SRT uses rich shared cues with native rendering disabled', async () => {
  const r = rig(); Object.assign(r.value, { subtitleEvents: dialogue('{\\b1}Bold{\\b0} {\\c&HFF00&}Green'), subtitleFontSize: 55, subtitleOverflow: false, subtitleStart: 500, subtitleEnd: 3500 }); r.value.tracks[1].codec = 'subrip';
  const p = await r.open(); assert.equal(p.nativeSubtitles, false); assert.ok(r.calls.some(c => c[0] === 'subtitle-visible' && c[1] === 0));
  const info = r.events.filter(e => e[0] === 'subtitle').at(-1)[1]; assert.equal(info.content.text, 'Bold Green'); assert.equal(info.startTime, 500); assert.equal(info.duration, 3000);
  assert.ok(info.content.runs.some(run => run.bold && run.text === 'Bold')); assert.ok(info.content.runs.some(run => run.color === '#FF00FF00'));
  await p.setNativeSubtitleVisible(false); assert.equal(r.events.filter(e => e[0] === 'subtitle').at(-1)[1].text, ''); await p.setNativeSubtitleVisible(true);
  assert.equal(r.events.filter(e => e[0] === 'subtitle').at(-1)[1].content.text, 'Bold Green'); await p.release();
});
test('native ASS and unsupported SRT effects keep the original video renderer', async () => {
  for (const [codec, text] of [['ass', 'Authored'], ['subrip', '{\\move(1,2,3,4)}Moving']]) {
    const r = rig(); Object.assign(r.value, { subtitleEvents: dialogue(text), subtitleFontSize: 55, subtitleOverflow: false }); r.value.tracks[1].codec = codec;
    const p = await r.open(); assert.equal(p.nativeSubtitles, true); assert.ok(r.calls.some(c => c[0] === 'subtitle-visible' && c[1] === 1));
    assert.equal(r.events.filter(e => e[0] === 'subtitle').at(-1)[1].content, undefined); await p.release();
  }
});
test('seek waits clear shared cues and only the confirmed native window republishes them', async () => {
  const r = rig(); Object.assign(r.value, { subtitleEvents: dialogue('First'), subtitleFontSize: 55, subtitleOverflow: false, subtitleStart: 500, subtitleEnd: 3500 }); r.value.tracks[1].codec = 'subrip'; const p = await r.open();
  p.seek(7000, 3); await settle(); await p.refresh(); assert.equal(r.events.filter(e => e[0] === 'subtitle').at(-1)[1].text, '');
  Object.assign(r.value, { subtitleEvents: dialogue('{\\an9}Second'), subtitleStart: 6000, subtitleEnd: 8000, seeking: false, seekDone: 1 }); await p.refresh();
  const info = r.events.filter(e => e[0] === 'subtitle').at(-1)[1]; assert.equal(info.content.positioned[0].alignment, 9); assert.equal(info.text, 'Second'); await p.release();
});
test('a fast seek within the same native cue republishes it even without an intermediate seeking poll', async () => {
  const r = rig(); Object.assign(r.value, { subtitleEvents: dialogue('Same window'), subtitleFontSize: 55, subtitleOverflow: false, subtitleStart: 500, subtitleEnd: 8000 }); r.value.tracks[1].codec = 'subrip'; const p = await r.open();
  r.events.length = 0; p.seek(1500, 3); p.seek(2000, 3); await settle();
  Object.assign(r.value, { position: 2000, seeking: false, seekDone: 2 }); await p.refresh();
  const info = r.events.filter(e => e[0] === 'subtitle').at(-1)?.[1]; assert.equal(info?.text, 'Same window'); await p.release();
});
test('native floating point milliseconds do not hide a cue at its exact first timestamp', async () => {
  const r = rig(); Object.assign(r.value, { position: 20.999999999999996, subtitleEvents: dialogue('First frame'), subtitleFontSize: 38, subtitleOverflow: false, subtitleStart: 21, subtitleEnd: 55021 }); r.value.tracks[1].codec = 'subrip'; const p = await r.open();
  const time = r.events.filter(e => e[0] === 'time').at(-1)[1], cue = r.events.filter(e => e[0] === 'subtitle').at(-1)[1];
  assert.ok(time >= cue.startTime && time < cue.startTime + cue.duration, 'the decoded first frame must lie inside its cue window'); assert.equal(p.currentTime, time); await p.release();
});
test('physical surface dimensions received before native creation are applied before prepared', async () => {
  const r = rig(), p = await r.open(2276, 1280); assert.deepEqual(r.calls.filter(c => c[0] === 'surface-size'), [['surface-size', 2276, 1280]]); await p.refresh(); assert.equal(r.calls.filter(c => c[0] === 'surface-size').length, 1); await p.release();
});
test('rapid surface changes coalesce to the latest physical dimensions across an in-flight snapshot', async () => {
  const r = rig(), p = await r.open(), wait = deferred(); r.pending.push(wait.promise); const reading = p.refresh(); p.setSurfaceSize(2276, 1280); p.setSurfaceSize(1280, 720); wait.resolve(initial()); await reading;
  assert.deepEqual(r.calls.filter(c => c[0] === 'surface-size'), [['surface-size', 1280, 720]]); await p.release();
});
test('late resize after release and invalid physical dimensions never reach native video output', async () => {
  const r = rig(), p = await r.open(), wait = deferred(); r.pending.push(wait.promise); const reading = p.refresh(); p.setSurfaceSize(1280, 720); const closed = p.release(); wait.resolve(initial()); await reading; await closed; p.setSurfaceSize(320, 180);
  assert.equal(r.calls.filter(c => c[0] === 'surface-size').length, 0);
  for (const [w,h] of [[0,10],[10,NaN],[8193,10],[10.5,20],[-1,20]]) assert.throws(() => p.setSurfaceSize(w,h), /mpv_surface_invalid/);
});
test('native surface update failure becomes a real playback error', async () => {
  const r = rig(), p = await r.open(); const command = r.bridge.command; r.bridge.command = async (h,c) => { if (c.type === 'surface-size') throw Error('native resize failed'); return command(h,c); }; p.setSurfaceSize(1280,720); await settle(); assert.equal(p.state,'error'); assert.equal(r.events.filter(e=>e[0]==='error').length,1); await p.release();
});
test('a pre-render size stays pending until VO exists', async () => {
  const r=rig();r.value.rendered=false;const p=await r.open(1280,720);assert.equal(r.calls.filter(c=>c[0]==='surface-size').length,0);r.value.rendered=true;await p.refresh();assert.deepEqual(r.calls.filter(c=>c[0]==='surface-size'),[['surface-size',1280,720]]);await p.release();
});
test('native VO geometry that drifts after seek/reconfiguration is brought back to the requested surface', async () => {
  const r=rig(),p=await r.open(1280,720);await p.refresh();assert.equal(r.calls.filter(c=>c[0]==='surface-size').length,1);r.value.surfaceWidth=2276;r.value.surfaceHeight=1280;await p.refresh();await p.refresh();assert.deepEqual(r.calls.filter(c=>c[0]==='surface-size'),[['surface-size',1280,720],['surface-size',1280,720]]);await p.release();
});
const watchdog = setTimeout(() => { console.error('FAIL: adapter fixture did not settle'); process.exitCode = 1; }, 15000);
(async () => { for (const [name, fn] of cases) { await fn(); console.log('PASS', name); } console.log(`${cases.length} MPV adapter cases passed. Async bridge fixtures; no decoder/audio/UI claim.`); })().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
