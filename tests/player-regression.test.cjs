// Executes real playback orchestration with explicit AVPlayer/HTTP fixtures; no decoding/UI claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.join(process.env.DEVECO_CONTENTS || '/Applications/DevEco-Studio.app/Contents', 'tools/hvigor/hvigor/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-player-'));
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));
const cache = new Map(), platform = new Map(), nativePlayers = [], nativeQueue = [], httpQueue = [], requests = [];
platform.set('libcineisle_ass.so', { async create() { throw new Error('ASS requires an explicit native fixture'); } });
platform.set('@ohos.font', {});
require('./download-platform.cjs').install(platform);
let routeParams = {}, closes = 0;
const fileApi = { accessSync: fs.existsSync, openSync: p => ({ fd: fs.openSync(p, 'r') }),
  closeSync: file => { closes++; fs.closeSync(file.fd); }, statSync: fs.statSync, readTextSync: p => fs.readFileSync(p, 'utf8'), OpenMode: { READ_ONLY: 0 } };
platform.set('@ohos.file.fs', fileApi);
require('./sync-platform.cjs').files(fileApi);
platform.set('@ohos.file.fileuri', { getUriFromPath: p => 'file://' + p });
for (const id of ['@ohos.app.ability.common', '@ohos.request', '@ohos.resourceManager', '@ohos.security.asset']) platform.set(id, {});
const systemPlatform = require('./system-platform.cjs');
systemPlatform.install(platform);
const windowPlatform = require('./window-platform.cjs'); windowPlatform.install(platform);
const preferencesPlatform = require('./preferences-platform.cjs').install(platform, directory);
platform.set('@ohos.util', { generateRandomUUID: () => 'device', TextEncoder: class { encodeInto(s) { return new TextEncoder().encode(s); } }, TextDecoder: class { decodeToString(s) { return new TextDecoder().decode(s); } } });
Object.assign(platform.get('@ohos.security.asset'), { Tag: { ALIAS: 'alias', SECRET: 'secret', RETURN_TYPE: 'return' }, ReturnType: { ALL: 1 }, query: async () => [] });
platform.set('@ohos.router', { getParams: () => routeParams, back() {} });
platform.set('@ohos.net.http', { RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }, HttpDataType: { STRING: 0 },
  createHttp: () => ({ async request(url, options) { requests.push({ url, options }); const value = httpQueue.shift(); assert.ok(value, 'explicit HTTP fixture required'); if (value instanceof Error) throw value; return value; }, destroy() {} }) });
class NativePlayer {
  constructor(tracks = [{ track_index: 5, track_type: 0, language: 'eng' }, { track_index: 8, track_type: 0, language: 'zho' }, { track_index: 12, track_type: 2, language: 'eng' }]) {
    this.tracks = tracks; this.selected = [5]; this.handlers = {}; this.calls = []; this.state = 'idle'; this.duration = 60000; this.width = 1920; this.height = 1080;
  }
  on(event, callback) { this.handlers[event] = callback; }
  emit(event, value) { this.handlers[event]?.(value); }
  change(state) { this.state = state; this.emit('stateChange', state); }
  set url(value) { this.source = value; queueMicrotask(() => this.change('initialized')); }
  set fdSrc(value) { this.fd = value; queueMicrotask(() => this.change('initialized')); }
  async prepare() { this.calls.push(['prepare', this.surfaceId]); this.change('prepared'); }
  async getTrackDescription() { return this.tracks; }
  async getSelectedTracks() { return this.selected; }
  async selectTrack(index) { this.calls.push(['select', index]); if (this.failSelect) throw new Error('unsupported'); this.selected = this.selected.filter(i => this.tracks.find(t => t.track_index === i)?.track_type !== this.tracks.find(t => t.track_index === index)?.track_type).concat(index); }
  async play() { this.calls.push(['play']); if (this.playWait) await this.playWait; this.change('playing'); }
  async pause() { this.calls.push(['pause']); if (this.failPause) throw new Error('pause failed'); this.change('paused'); }
  seek(ms) { this.calls.push(['seek', ms]); this.emit('timeUpdate', ms); this.emit('seekDone', ms); }
  setSpeed(speed) { this.calls.push(['speed', speed]); }
  setVolume(value) { if (this.failVolume) throw new Error('native volume rejected'); this.calls.push(['volume', value]); this.volume = value; }
  async release() { this.calls.push(['release']); this.state = 'released'; if (this.releaseWait) await this.releaseWait; }
}
platform.set('@ohos.multimedia.media', {
  PlaybackSpeed: { SPEED_FORWARD_0_50_X: -1, SPEED_FORWARD_1_50_X: 3, SPEED_FORWARD_1_75_X: 5, SPEED_FORWARD_0_75_X: 0, SPEED_FORWARD_1_00_X: 1, SPEED_FORWARD_1_25_X: 2, SPEED_FORWARD_2_00_X: 4 },
  MediaType: { MEDIA_TYPE_AUD: 0, MEDIA_TYPE_SUBTITLE: 2 },
  MediaDescriptionKey: { MD_KEY_TRACK_INDEX: 'track_index', MD_KEY_TRACK_TYPE: 'track_type', MD_KEY_TRACK_NAME: 'track_name', MD_KEY_LANGUAGE: 'language' },
  SeekMode: { SEEK_CLOSEST: 3 }, async createAVPlayer() {
    const entry = nativeQueue.shift(); const player = entry ? await entry : new NativePlayer(); nativePlayers.push(player); return player;
  }
});
function load(relative) {
  const file = path.resolve(root, relative); if (cache.has(file)) return cache.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  // Declarative builders are SDK-compiled, not rendered by this Node harness.
  if (file.endsWith('/components/PiPSubtitle.ets')) source = source.replace(/@Builder[\s\S]*?(?=export class PiPSubtitleController)/, 'function pipSubtitleBuilder(params) {}\n');
  // Node has no AppStorage; its explicit unlocked fixture matches the real SDK UI fixture.
  if (relative.includes('pages/')) source = (source.slice(0, source.indexOf('\n  build()')) + '\n}').replace(/@Entry\s+@Component\s+struct (\w+)/, 'export class $1').replace(/@State\s+/g, '').replace(/@StorageLink\([^)]*\)\s+/g, '').replace(/@Watch\([^)]*\)\s+/g, '').replace('locked: boolean = true;', 'locked: boolean = false;');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} }; cache.set(file, module);
  const localRequire = id => { if (platform.has(id)) return platform.get(id); const base = path.resolve(path.dirname(file), id); return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.ets'); };
  vm.runInThisContext('(function(require,module,exports,XComponentController,getContext,canIUse,wrapBuilder,$r){' + js + '\n})', { filename: file })(localRequire, module, module.exports, class {}, () => systemPlatform.context, cap => systemPlatform.capabilities[cap] !== false, builder => ({ builder }), id => ({id}));
  return module.exports;
}
const { PlaybackRoute, LibrarySnapshot } = load('model/Models.ts');
const { followingEpisode, parseSubtitles, subtitleAt, textSubtitle } = load('utils/Playback.ts');
const { PlaybackController } = load('service/PlaybackController.ets');
const { AppService } = load('service/AppService.ets');
const { JellyfinClient } = load('service/JellyfinClient.ets');
const { Player } = load('pages/Player.ets');
const episode = (id, season, number, extra = {}) => ({ Id: id, Name: id, Type: 'Episode', SeriesId: 'show', SeasonId: 'season-' + season, ParentIndexNumber: season, IndexNumber: number, ...extra });
const response = value => ({ responseCode: 200, result: typeof value === 'string' ? value : JSON.stringify(value) });
const srt = '\uFEFF1\r\n00:00:01,000 --> 00:00:03,000\r\n<b>你好</b> &amp; hello\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nSecond\r\n';
const sources = [{ Id: 'source-a', Name: 'A', MediaStreams: [{ Type: 'Audio', Index: 1 }, { Type: 'Subtitle', Index: 20, Codec: 'subrip', IsExternal: true, DisplayTitle: '中文' }, { Type: 'Subtitle', Index: 21, Codec: 'ass' }, { Type: 'Subtitle', Index: 22, Codec: 'hdmv_pgs_subtitle' }] }, { Id: 'source-b', Name: 'B' }];
function route(item = episode('e1', 1, 1), source = 'source-a') { return Object.assign(new PlaybackRoute(), { item, mediaSourceId: source, playSessionId: 'session-' + source, url: 'https://example.invalid/video', sources }); }
function client() { return new JellyfinClient({ server: 'https://example.invalid/jellyfin', userId: 'user', token: 'mock-token', deviceId: 'device' }, '10.10.0'); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function settle() { for (let i = 0; i < 5; i++) await new Promise(setImmediate); }
function rig(overrides = {}) {
  const values = { state: '', subtitle: '', audio: [], subtitles: [], audioKey: '', subtitleKey: '', errors: [], reports: [], complete: 0 };
  const fakeClient = { async report(...args) { values.reports.push(args); }, async subtitle() { return srt; }, ...overrides };
  const view = { state: state => { values.state = state; }, time: (position, duration) => Object.assign(values, { position, duration }),
    tracks: (audio, subtitles, audioKey, subtitleKey) => Object.assign(values, { audio, subtitles, audioKey, subtitleKey }),
    subtitle: subtitle => { values.subtitle = subtitle; }, error: error => { values.errors.push(error); },
    reportError: failed => { values.reportFailed = failed; }, complete: () => { values.complete++; } };
  return { c: new PlaybackController(fakeClient, view), values };
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function reset() {
  AppService.intros = undefined; AppService.trickplays = undefined; AppService.loadAutoNext = async () => true;
  const { AppLock } = load('service/AppLock.ets'); AppLock.initialized = true; AppLock.locked = false; AppLock.enabled = false; AppLock.fault = false; systemPlatform.reset(); nativePlayers.length = 0; nativeQueue.length = 0; httpQueue.length = 0; requests.length = 0; AppService.client = client(); AppService.downloads = []; AppService.snapshot = new LibrarySnapshot(); routeParams = {}; }

test('queue sorts numerically, crosses seasons and ignores unrelated series and duplicates of current episode', () => {
  const e = episode('e9', 1, 9);
  assert.equal(followingEpisode(e, [episode('s2', 2, 1), episode('e10', 1, 10), episode('same', 1, 9), episode('other', 1, 10, { SeriesId: 'other' })]).Id, 'e10');
  assert.equal(followingEpisode(episode('e10', 1, 10), [episode('s2', 2, 1)]).Id, 's2');
});
test('queue ends at last episode, never loops a movie or completed episode', () => {
  assert.equal(followingEpisode(episode('last', 2, 5), [episode('last', 2, 5), episode('old', 1, 1)]), undefined);
  assert.equal(followingEpisode({ Id: 'film', Type: 'Movie' }, []), undefined);
});
test('old offline cache without season numbers only continues within known season', () => {
  const e = episode('e1', 1, 1, { ParentIndexNumber: undefined });
  assert.equal(followingEpisode(e, [episode('e2', 1, 2, { ParentIndexNumber: undefined }), episode('s2', 2, 1)]).Id, 'e2');
  assert.equal(followingEpisode(e, [episode('s2', 2, 1)]), undefined);
  assert.throws(() => followingEpisode({ ...e, IndexNumber: undefined }, []), /episode_order_unknown/);
});
test('SRT handles BOM, CRLF, Unicode, plain-text styling and cue gaps/seek boundaries', () => {
  const cues = parseSubtitles(srt); assert.equal(cues.length, 2); assert.equal(subtitleAt(cues, 1000), '你好 & hello');
  assert.equal(subtitleAt(cues, 3000), ''); assert.equal(subtitleAt(cues, 4000), 'Second'); assert.equal(subtitleAt(cues, 1500), '你好 & hello');
});
test('overlapping cues remain visible and malformed timestamps are rejected', () => {
  const cues = parseSubtitles('1\n00:00:01,000 --> 00:00:10,000\nA\n\n2\n00:00:02,000 --> 00:00:03,000\nB\n\n3\n00:99:00,000 --> 00:99:01,000\nBAD');
  assert.equal(cues.length, 2); assert.equal(subtitleAt(cues, 2500), 'A\nB'); assert.equal(subtitleAt(cues, 4000), 'A');
  assert.deepEqual(parseSubtitles('<html>gateway</html>'), []);
});
test('text subtitle options exclude bitmap, audio and invalid stream indices', () => {
  for (const Codec of ['subrip', 'webvtt', 'ass', 'mov_text']) assert.equal(textSubtitle({ Type: 'Subtitle', Index: 2, Codec }), true);
  for (const stream of [{ Type: 'Subtitle', Index: 2, Codec: 'hdmv_pgs_subtitle' }, { Type: 'Audio', Index: 1, Codec: 'srt' }, { Type: 'Subtitle', Index: -1, Codec: 'srt' }]) assert.equal(textSubtitle(stream), false);
});
test('subtitle HTTP uses authenticated server/base path and separately encoded stream/source IDs', async () => {
  httpQueue.push(response(srt)); assert.equal(await AppService.client.subtitle('item&x', 'source/y', 20), srt);
  const req = requests[0]; assert.ok(req.url.includes('/jellyfin/Videos/item%26x/source%2Fy/Subtitles/20/Stream.srt'));
  assert.ok(!req.url.includes('mock-token')); assert.ok(req.options.header.Authorization.includes('mock-token')); assert.equal(req.options.header.Accept, 'text/plain');
});
test('subtitle HTML/network failures propagate without successful cue selection', async () => {
  for (const value of [response('<html>gateway</html>'), new Error('offline')]) { httpQueue.push(value); await assert.rejects(() => AppService.client.subtitle('item', 'source', 20)); }
});
test('explicit media source is used in stream and report identity; unknown source is rejected', async () => {
  httpQueue.push(response({ MediaSources: sources, PlaySessionId: 'p' }));
  const r = await AppService.playback(episode('e1', 1, 1), 'source-b'); assert.equal(r.mediaSourceId, 'source-b'); assert.ok(r.url.includes('mediaSourceId=source-b')); assert.equal(r.sources.length, 2);
  httpQueue.push(response({ MediaSources: sources })); await assert.rejects(() => AppService.playback(r.item, 'missing'), /no_media_source/);
});
test('completed downloads use an owned FD route and explicit source bypasses local default', async () => {
  const p = path.join(directory, 'video.mp4'); fs.writeFileSync(p, 'fake');
  AppService.downloads = [{ id: 'e1', item: episode('e1', 1, 1), state: 'complete', path: p }];
  const r = await AppService.playback(episode('e1', 1, 1)); assert.equal(r.offline, true); assert.equal(r.filePath, p); assert.equal(requests.length, 0);
  httpQueue.push(response({ MediaSources: sources })); assert.equal((await AppService.playback(r.item, 'source-b')).offline, false);
});
test('next playback reads all episode pages and starts immediate following episode', async () => {
  httpQueue.push(response({ Items: [episode('e1', 1, 1)], TotalRecordCount: 2 }), response({ Items: [episode('e2', 1, 2)], TotalRecordCount: 2 }), response({ MediaSources: sources }));
  const next = await AppService.nextPlayback(route()); assert.equal(next.item.Id, 'e2');
  assert.ok(requests[1].url.includes('startIndex=1')); assert.ok(requests[0].url.includes('isMissing=false')); assert.ok(!requests[0].url.includes('sortBy='));
});
for (const bad of [[], [episode('e1', 1, 1)], [episode('other', 1, 2, { SeriesId: 'wrong' })]]) test('incomplete/duplicate/wrong-series queue fails before preparing any next media: ' + JSON.stringify(bad.map(x => x.Id)), async () => {
  httpQueue.push(response({ Items: [episode('e1', 1, 1)], TotalRecordCount: 2 }), response({ Items: bad, TotalRecordCount: 2 }));
  await assert.rejects(() => AppService.nextPlayback(route()), /episode_queue_failed/); assert.equal(requests.length, 2);
});
test('offline continuation requires the immediate next download; never skips it or requests network', async () => {
  AppService.client.playbackInfo = async () => { throw new Error('unexpected HTTP'); }; AppService.snapshot.items = [episode('e1', 1, 1), episode('e2', 1, 2), episode('e3', 1, 3)];
  const r = Object.assign(route(), { offline: true }); await assert.rejects(() => AppService.nextPlayback(r), /next_not_downloaded/); assert.equal(requests.length, 0);
  const p = path.join(directory, 'next.mp4'); fs.writeFileSync(p, 'fake'); AppService.downloads = [{ id: 'e2', item: episode('e2', 1, 2), state: 'complete', path: p }];
  const next = await AppService.nextPlayback(r); assert.equal(next.item.Id, 'e2'); assert.equal(next.offline, true); assert.equal(requests.length, 0);
});
test('changed account rejects playback information from a prior client', async () => {
  const old = AppService.client, pending = deferred(); old.playbackInfo = () => pending.promise;
  const result = AppService.playback(episode('e1', 1, 1)); AppService.client = client(); pending.resolve({ MediaSources: sources }); await assert.rejects(() => result, /login_required/);
});
test('native initialization attaches surface before prepare, resumes ticks in milliseconds, then plays', async () => {
  const { c, values } = rig(); await c.open(route(episode('e1', 1, 1, { UserData: { PlaybackPositionTicks: 120000000 } })), 'surface-id'); await settle();
  const n = nativePlayers[0]; assert.deepEqual(n.calls[0], ['prepare', 'surface-id']); assert.ok(n.calls.some(x => x[0] === 'seek' && x[1] === 12000)); assert.equal(values.state, 'playing'); await c.close();
});
test('audio selection uses native track index rather than Jellyfin stream index and commits after success', async () => {
  const { c, values } = rig(); await c.open(route(), 'surface'); await settle();
  assert.deepEqual(values.audio.map(x => x.index), [5, 8]); await c.selectAudio('native:8'); assert.equal(values.audioKey, 'native:8'); assert.deepEqual(nativePlayers[0].calls.filter(x => x[0] === 'select'), [['select', 8]]);
  nativePlayers[0].failSelect = true; await c.selectAudio('native:5'); assert.equal(values.audioKey, 'native:8'); assert.ok(values.errors.includes('track_switch_failed')); await c.close();
});
test('server text subtitle selection, seek, off and failed replacement preserve expected cue state', async () => {
  const { c, values } = rig(); await c.open(route(), 'surface'); await settle(); await c.selectSubtitle('server:20'); c.seek(1500); assert.equal(values.subtitle, '你好 & hello');
  c.seek(3500); assert.equal(values.subtitle, ''); c.seek(4500); assert.equal(values.subtitle, 'Second');
  c.client.subtitle = async () => 'invalid'; await c.selectSubtitle('server:21'); assert.equal(values.subtitleKey, 'server:20'); assert.ok(values.errors.includes('subtitle_failed'));
  await c.selectSubtitle(''); assert.equal(values.subtitle, ''); await c.close();
});
test('native subtitle update obeys selected/off/expiry and off does not mute audio', async () => {
  const { c, values } = rig(); await c.open(route(), 'surface'); await settle(); await c.selectSubtitle('native:12');
  const n = nativePlayers[0]; n.emit('subtitleUpdate', { text: 'Native', startTime: 0, duration: 2000 }); assert.equal(values.subtitle, 'Native');
  await c.selectSubtitle(''); assert.equal(values.subtitle, ''); await c.selectSubtitle('native:12'); assert.equal(values.subtitle, 'Native');
  n.emit('timeUpdate', 2500); assert.equal(values.subtitle, ''); assert.equal(n.state, 'playing'); await c.close();
});
test('old subtitle fetch cannot overwrite newly loaded media or closed view', async () => {
  const pending = deferred(), { c, values } = rig({ subtitle: () => pending.promise }); await c.open(route(), 's'); await settle();
  const selection = c.selectSubtitle('server:20'); await c.open(route(episode('e2', 1, 2)), 's'); await settle(); pending.resolve(srt); await selection;
  assert.equal(values.subtitleKey, ''); assert.equal(values.subtitle, ''); await c.close();
});
test('source switch releases old player and late state/time/error callbacks do not mutate new playback', async () => {
  const { c, values } = rig(); await c.open(route(), 's'); await settle(); const old = nativePlayers[0];
  await c.open(route(episode('e1', 1, 1), 'source-b'), 's', 15000, true); await settle();
  assert.equal(old.state, 'released'); assert.equal(values.position, 15000); old.emit('error', {}); old.emit('timeUpdate', 59000); old.change('completed');
  assert.equal(values.position, 15000); assert.equal(values.complete, 0); assert.deepEqual(values.errors, []); await c.close();
});
test('progress reports serialize captured identities with one stop per old source before new start', async () => {
  const gate = deferred(), records = []; let first = true;
  const { c } = rig({ async report(...args) { records.push(args); if (first) { first = false; await gate.promise; } } });
  await c.open(route(), 's'); await settle(); nativePlayers[0].emit('timeUpdate', 12000);
  await c.open(route(episode('e2', 1, 2), 'source-b'), 's', 0); await settle(); assert.equal(records.length, 1);
  gate.resolve(); await c.reports; assert.deepEqual(records.map(x => [x[0], x[1], x[2]]), [['', 'e1', 'source-a'], ['Progress', 'e1', 'source-a'], ['Stopped', 'e1', 'source-a'], ['', 'e2', 'source-b']]); await c.close();
});
test('hidden page during preparation cannot auto-play; speed remains applied after source change', async () => {
  const pending = deferred(), { c } = rig(); nativeQueue.push(pending.promise); const opening = c.open(route(), 's'); await settle(); c.pause();
  pending.resolve(new NativePlayer()); await opening; await settle(); assert.ok(!nativePlayers[0].calls.some(x => x[0] === 'play'));
  c.show(); await c.toggle(); c.setSpeed(2); await c.open(route(), 's'); await settle(); assert.ok(nativePlayers[1].calls.some(x => x[0] === 'speed' && x[1] === 4)); await c.close();
});
test('close during native creation releases the late player and never assigns source', async () => {
  const pending = deferred(), { c } = rig(); nativeQueue.push(pending.promise); const opening = c.open(route(), 's'); await settle(); await c.close();
  const n = new NativePlayer(); pending.resolve(n); await opening; assert.equal(n.state, 'released'); assert.equal(n.source, undefined);
});
test('close during old-player release prevents a pending open from resurrecting playback', async () => {
  const { c } = rig(); await c.open(route(), 's'); await settle(); const gate = deferred(); nativePlayers[0].releaseWait = gate.promise;
  const opening = c.open(route(episode('e2', 1, 2)), 's'); await c.close(); gate.resolve(); await opening; assert.equal(nativePlayers.length, 1);
});
test('offline native FD remains open while playing and closes once on repeated teardown; no HTTP reports', async () => {
  const p = path.join(directory, 'owned.mp4'); fs.writeFileSync(p, 'fake'); const before = closes, { c, values } = rig();
  await c.open(Object.assign(route(), { offline: true, filePath: p }), 's'); await settle(); assert.equal(fs.fstatSync(nativePlayers[0].fd.fd).size, 4);
  assert.equal(values.subtitles.some(x => x.remote), false); await c.close(); await c.close(); assert.equal(closes, before + 1); assert.equal(values.reports.length, 0);
});
test('actual page auto-advances once from completion with next episode at zero and can disable autoplay', async () => {
  const original = AppService.nextPlayback; let calls = 0; AppService.nextPlayback = async () => { calls++; return route(episode('e2', 1, 2)); };
  try {
    routeParams = route(); const p = new Player(); p.aboutToAppear(); p.surfaceId = 's'; await p.controller.open(p.route, 's'); await settle();
    nativePlayers[0].change('completed'); await settle(); assert.equal(p.route.item.Id, 'e2'); assert.equal(calls, 1); assert.equal(p.playbackPosition, 0);
    p.autoNext = false; nativePlayers[1].change('completed'); await settle(); assert.equal(calls, 1); p.aboutToDisappear();
  } finally { AppService.nextPlayback = original; }
});
test('actual page next failure stops and manual retry loads the same immediate next episode', async () => {
  const original = AppService.nextPlayback; let calls = 0; AppService.nextPlayback = async () => { if (++calls === 1) throw new Error('offline'); return route(episode('e2', 1, 2)); };
  try { routeParams = route(); const p = new Player(); p.aboutToAppear(); await settle(); p.surfaceId = 's'; await p.completed(); assert.equal(p.busy, false); assert.equal(p.route.item.Id, 'e1'); assert.equal(p.message, 'next_episode_failed'); await p.system.next(); assert.equal(p.route.item.Id, 'e2'); p.aboutToDisappear(); } finally { AppService.nextPlayback = original; }
});
test('page hidden/exited while fetching next episode never starts it', async () => {
  const original = AppService.nextPlayback, pending = deferred(); AppService.nextPlayback = () => pending.promise;
  try { routeParams = route(); const p = new Player(); p.aboutToAppear(); await settle(); const finishing = p.completed(); p.onPageHide(); pending.resolve(route(episode('e2', 1, 2))); await finishing; assert.equal(p.route.item.Id, 'e1'); assert.equal(nativePlayers.length, 0); p.aboutToDisappear(); } finally { AppService.nextPlayback = original; }
});
test('actual page source switch preserves position and pause, fails without losing prior route', async () => {
  const original = AppService.playback;
  try {
    routeParams = route(); const p = new Player(); p.aboutToAppear(); p.surfaceId = 's'; p.playbackPosition = 17000; p.state = 'paused';
    AppService.playback = async () => { throw new Error('offline'); }; await p.source(1); assert.equal(p.route.mediaSourceId, 'source-a'); assert.equal(p.message, 'source_switch_failed'); assert.equal(p.busy, false);
    AppService.playback = async () => route(episode('e1', 1, 1), 'source-b'); await p.source(1); await settle(); assert.equal(p.route.mediaSourceId, 'source-b'); assert.ok(nativePlayers[0].calls.some(x => x[0] === 'seek' && x[1] === 17000)); assert.ok(!nativePlayers[0].calls.some(x => x[0] === 'play')); p.aboutToDisappear();
  } finally { AppService.playback = original; }
});
test('slow HTTP coalesces queued progress to latest position/pause without losing stop order', async () => {
  const gate = deferred(), records = []; let first = true;
  const { c } = rig({ async report(...args) { records.push(args); if (first) { first = false; await gate.promise; } } });
  await c.open(route(), 's'); await settle();
  for (let i = 1; i <= 100; i++) { c.position = i * 1000; c.send('Progress'); }
  c.paused = true; c.send('Progress'); c.stopReport(); gate.resolve(); await c.reports;
  assert.equal(records.length, 3); assert.equal(records[1][4], 100); assert.equal(records[1][5], true); assert.equal(records[2][0], 'Stopped'); await c.close();
});
test('future native subtitle cue is displayed only in its time window', async () => {
  const { c, values } = rig(); await c.open(route(), 's'); await settle(); await c.selectSubtitle('native:12');
  nativePlayers[0].emit('subtitleUpdate', { text: 'Later', startTime: 5000, duration: 2000 }); assert.equal(values.subtitle, '');
  nativePlayers[0].emit('timeUpdate', 5500); assert.equal(values.subtitle, 'Later'); nativePlayers[0].emit('timeUpdate', 7000); assert.equal(values.subtitle, ''); await c.close();
});
test('report failure remains visible and a later success can still run', async () => {
  const { c, values } = rig({ report: async () => { throw new Error('offline'); } }); await c.open(route(), 's'); await settle(); assert.equal(values.reportFailed, true);
  c.client.report = async () => {}; c.send('Progress'); await c.reports; assert.equal(values.reportFailed, false); await c.close();
});
test('episode total changing between pages is rejected instead of declaring end of queue', async () => {
  httpQueue.push(response({ Items: [episode('e1', 1, 1)], TotalRecordCount: 2 }), response({ Items: [episode('e2', 1, 2)], TotalRecordCount: 3 }));
  await assert.rejects(() => AppService.nextPlayback(route()), /episode_queue_failed/);
});
test('completed movie and terminal episode do not loop', async () => {
  const original = AppService.nextPlayback; let calls = 0; AppService.nextPlayback = async () => { calls++; return undefined; };
  try { routeParams = route({ Id: 'film', Name: 'film', Type: 'Movie' }); const movie = new Player(); movie.aboutToAppear(); await movie.completed(); assert.equal(calls, 0); movie.aboutToDisappear();
    routeParams = route(); const p = new Player(); p.aboutToAppear(); p.surfaceId = 's'; await p.controller.open(p.route, 's'); await settle(); await p.completed(); await p.completed(); assert.equal(calls, 1); assert.equal(p.message, 'queue_finished'); p.aboutToDisappear();
  } finally { AppService.nextPlayback = original; }
});
test('disabling autoplay during next request leaves the completed episode in place', async () => {
  const original = AppService.nextPlayback, pending = deferred(); AppService.nextPlayback = () => pending.promise;
  try { routeParams = route(); const p = new Player(); p.aboutToAppear(); await settle(); const finishing = p.completed(); p.autoNext = false; pending.resolve(route(episode('e2', 1, 2))); await finishing; assert.equal(p.route.item.Id, 'e1'); assert.equal(nativePlayers.length, 0); p.aboutToDisappear(); } finally { AppService.nextPlayback = original; }
});
test('exiting during source request cannot restore a route or create a new player', async () => {
  const original = AppService.playback, pending = deferred(); AppService.playback = () => pending.promise;
  try { routeParams = route(); const p = new Player(); p.aboutToAppear(); const switching = p.source(1); p.aboutToDisappear(); pending.resolve(route(episode('e1', 1, 1), 'source-b')); await switching; assert.equal(p.route.mediaSourceId, 'source-a'); assert.equal(nativePlayers.length, 0); } finally { AppService.playback = original; }
});
module.exports = { load, platform, preferencesPlatform, directory, NativePlayer, nativePlayers, nativeQueue, route, episode, deferred, settle, rig, reset, AppService, Player, systemPlatform, setRoute: value => { routeParams = value; } };
if (require.main === module) (async () => { for (const [name, fn] of tests) { reset(); await fn(); await settle(); console.log('PASS ' + name); } console.log(`${tests.length} player regression tests passed. AVPlayer mocks do not prove device decoding or rendered UI.`); })().catch(e => { console.error(e); process.exitCode = 1; });
