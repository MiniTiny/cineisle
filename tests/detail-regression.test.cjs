global.BlurStyle={NONE:0};global.DialogButtonDirection={VERTICAL:1,HORIZONTAL:2};
// Real services and page lifecycle/query methods. ArkUI builders are compiled by the SDK,
// not rendered here; HTTP/Asset are mocks and file APIs adapt to isolated real temp files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const sdk = process.env.DEVECO_CONTENTS || '/Applications/DevEco-Studio.app/Contents';
const ts = require(path.join(sdk, 'tools/hvigor/hvigor/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-regression-'));
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));
const modules = new Map(), platform = new Map(), queue = [], requests = [];
require('./download-platform.cjs').install(platform);
let assetValue, routeParams = {}, dialog;
const navigation = [], abilities = [];
const fileApi = { accessSync: fs.existsSync, mkdirSync: fs.mkdirSync, statSync: fs.statSync, readTextSync: p => fs.readFileSync(p, 'utf8'),
  openSync: (p, flags) => ({ fd: fs.openSync(p, flags) }), writeSync: fs.writeSync, fsyncSync: fs.fsyncSync,
  closeSync: file => fs.closeSync(file.fd), renameSync: fs.renameSync, unlinkSync: fs.unlinkSync,
  OpenMode: { CREATE: fs.constants.O_CREAT, WRITE_ONLY: fs.constants.O_WRONLY, TRUNC: fs.constants.O_TRUNC } };
const labels = new Map(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../entry/src/main/resources/base/element/string.json'))).string.map(x => [x.name, x.value]));
const context = { startAbility: async want => { abilities.push(want); }, filesDir: directory, resourceManager: {
  getStringSync: name => name, getStringByNameSync: (name, ...args) => {
    const value = labels.get(name) || name; let i = 0; return value.replace(/%[ds]/g, () => String(args[i++]));
  }
} };
platform.set('@ohos.file.fs', fileApi);
require('./sync-platform.cjs').files(fileApi);
platform.set('@ohos.app.ability.common', {});
const downloadTasks = [];
platform.set('@ohos.request', { downloadFile: async (context, options) => {
  const task = { options, handlers: new Map(), deleted: false, delete: async () => { task.deleted = true; return true; }, on: (event, fn) => task.handlers.set(event, fn) };
  downloadTasks.push(task); return task;
} });
platform.set('@ohos.file.fileuri', { getUriFromPath: p => 'file://' + p });
platform.set('@ohos.resourceManager', {});
require('./preferences-platform.cjs').install(platform, directory);
platform.set('@ohos.util', { generateRandomUUID: () => 'mock-device',
  TextEncoder: class { encodeInto(s) { return new TextEncoder().encode(s); } },
  TextDecoder: class { decodeToString(s) { return new TextDecoder().decode(s); } } });
platform.set('@ohos.security.asset', { Tag: { ALIAS: 'alias', SECRET: 'secret', RETURN_TYPE: 'return', ACCESSIBILITY: 'access', CONFLICT_RESOLUTION: 'conflict' },
  ReturnType: { ALL: 1 }, Accessibility: { DEVICE_UNLOCKED: 1 }, ConflictResolution: { OVERWRITE: 1 },
  query: async attrs => new TextDecoder().decode(attrs.get('alias')) === 'cineisle.app.lock.v1' ? [] : assetValue ? [new Map([['secret', assetValue]])] : [],
  add: async attrs => { assetValue = attrs.get('secret'); }, remove: async () => { assetValue = undefined; } });
platform.set('@ohos.net.http', { RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }, HttpDataType: { STRING: 'STRING' },
  createHttp: () => ({ async request(url, options) {
    requests.push({ url, options }); const value = queue.shift();
    if (value instanceof Error) throw value;
    assert.ok(value, 'Each platform request must have an explicit fixture'); return value;
  }, destroy() {} }) });
platform.set('@ohos.router', { getParams: () => routeParams, back() { navigation.push({ back: true }); }, async pushUrl(route) { navigation.push(route); } });

function load(relative) {
  const file = path.resolve(root, relative);
  if (modules.has(file)) return modules.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  if (relative.includes('/pages/') || relative.startsWith('pages/')) {
    const builder = source.indexOf('\n  @Builder');
    const boundary = builder >= 0 ? builder : source.indexOf('\n  build()');
    assert.ok(boundary > 0, 'Expected an ArkUI builder boundary');
    source = (source.slice(0, boundary) + '\n}').replace(/@Entry\s+@Component\s+struct (\w+)/, 'export class $1').replace(/@State\s+/g, '').replace(/@StorageLink\([^)]*\)\s+/g, '');
  }
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020
  } }).outputText;
  const module = { exports: {} }; modules.set(file, module);
  const localRequire = id => {
    if(id.endsWith('/CompactDialog'))return {showBrandDialog:(_context,options)=>{ dialog=require('./dialog-fixture.cjs').dialogFixture(options); }};
    if (platform.has(id)) return platform.get(id);
    if (!id.startsWith('.')) throw new Error('Unexpected dependency ' + id);
    const base = path.resolve(path.dirname(file), id);
    return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.ets');
  };
  vm.runInThisContext('(function(require,module,exports,getContext,$r,AlertDialog,canIUse){' + js + '\n})', { filename: file })
    (localRequire, module, module.exports, () => context, id => ({ id }), { show: value => { dialog = require('./dialog-fixture.cjs').dialogFixture(value); } }, () => false);
  return module.exports;
}
const { AppService } = load('service/AppService.ets');
const { SessionStore } = load('service/SessionStore.ets');
const { LocalStore } = load('service/LocalStore.ets');
const { JellyfinClient } = load('service/JellyfinClient.ets');
const { LibrarySnapshot } = load('model/Models.ts');
const { Detail } = load('pages/Detail.ets');
const { loadDetail } = load('service/DetailData.ets');
const { detailMetadata, dateRange, trailerUrl, firstEpisode } = load('utils/DetailPresentation.ets');
const { mediaItem, playbackInfo } = load('api/DomainMapping.ets');
const { validMediaItem, validDownloads } = load('utils/Cache.ts');
load('utils/Strings.ets').initializeStrings(context.resourceManager);
const session = user => ({ server: 'https://example.invalid/jellyfin', serverId: 'server', userId: user,
  userName: user, deviceId: 'mock-device', token: 'mock-token' });
const film = (id, people = []) => ({ Id: id, Name: id, Type: 'Movie', People: people });
const library = id => ({ Id: id, Name: id, Type: 'CollectionFolder' });
const response = value => ({ responseCode: 200, result: JSON.stringify(value) });
const valueOf = (params, key) => params.find(p => p.key === key)?.value;
const ids = items => Array.from(items, i => i.Id);
function snapshot(items = [], libraries = [], memberships = []) {
  return Object.assign(new LibrarySnapshot(), { syncedAt: 1, items, libraries, memberships });
}
function activate(user = 'a') {
  const client = new JellyfinClient(session(user), '10.10.0'); AppService.useClient(client); return client;
}
function deferred() {
  let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function reset() {
  const { AppLock } = load('service/AppLock.ets'); AppLock.initialized = true; AppLock.locked = false; AppLock.enabled = false; AppLock.fault = false;
  for (const entry of fs.readdirSync(directory)) fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  AppService.client = undefined; AppService.local = undefined; AppService.snapshot = new LibrarySnapshot();
  AppService.downloads = []; AppService.tasks.clear(); AppService.syncing = false;
  AppService.cacheRecovered = false; AppService.initialized = false; AppService.context = context;
  queue.length = 0; requests.length = 0; assetValue = undefined; routeParams = {}; dialog = undefined; navigation.length = 0; abilities.length = 0; downloadTasks.length = 0;
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const source = (id, options = {}) => ({ Id: id, Container: 'mp4', ...options });
const movie = (options = {}) => ({ ...film('film'), MediaSources: [source('one')], CanDownload: true, CanDelete: true, ...options });
const show = (options = {}) => ({ Id: 'show', Name: 'Show', Type: 'Series', ...options });
const season = (n, options = {}) => ({ Id: 'season-' + n, Name: 'Season ' + n, Type: 'Season', IndexNumber: n, SeriesId: 'show', ...options });
const episode = (n, s = 1, options = {}) => ({ Id: `episode-${s}-${n}`, Name: 'Episode ' + n, Type: 'Episode', SeriesId: 'show', SeasonId: 'season-' + s, IndexNumber: n, ParentIndexNumber: s, MediaSources: [source('episode-source')], ...options });
const row = (value, key) => detailMetadata(value).rows.find(r => r.key === key)?.value;
async function detail(item = movie()) {
  const client = activate(); client.detail = async () => item; client.children = async () => []; client.nextUp = async () => [];
  routeParams = { item: { Id: item.Id, Name: 'Old summary', Type: item.Type } };
  const p = new Detail(); await p.aboutToAppear(); return { p, client };
}
function localDownload(item, state = 'complete') {
  const file = path.join(AppService.local.directory, item.Id + '.mp4'); fs.writeFileSync(file, 'fixture video bytes');
  const record = { id: item.Id, item, state, path: file, progress: state === 'complete' ? 1 : 0, mediaSourceId: 'one' };
  AppService.downloads.push(record); return record;
}

test('fresh movie details replace list summaries with full metadata', async () => {
  const { p } = await detail(movie({ Overview: 'Full synopsis', OriginalTitle: 'Original' }));
  assert.equal(p.item.Name, 'film'); assert.equal(p.item.Overview, 'Full synopsis'); assert.equal(p.loaded, true); assert.equal(p.busy, false);
});
test('movie metadata shows original title, year, minutes, official rating and zero score', () => {
  const value = detailMetadata(movie({ OriginalTitle: 'Original', ProductionYear: 2024, RunTimeTicks: 599 * 10000000, OfficialRating: 'PG-13', CommunityRating: 0 }));
  assert.equal(value.original, 'Original'); assert.equal(value.summary, '2024 · 9 分钟 · PG-13 · 评分 0.0');
});
test('duplicate original title and absent or unknown technical metadata are hidden', () => {
  const result = detailMetadata(movie({ OriginalTitle: 'film' })); assert.equal(result.original, ''); assert.deepEqual(result.chips, []); assert.deepEqual(result.rows, []);
});
for (const [options, expected] of [
  [{ ProductionYear: 2018, Status: 'Continuing' }, '2018 – 至今'],
  [{ ProductionYear: 2018, Status: 'Ended', EndDate: '2024-01-01T00:00:00Z' }, '2018 – 2024'],
  [{ ProductionYear: 2024, Status: 'Ended', EndDate: '2024-12-31T00:00:00Z' }, '2024'],
  [{ PremiereDate: '2020-01-01T00:00:00Z', Status: 'Ended', EndDate: 'bad' }, '2020'],
  [{ ProductionYear: undefined, PremiereDate: 'bad', EndDate: 'bad' }, '']
]) test('broadcast range: ' + expected, () => assert.equal(dateRange(show(options)), expected));
test('selected source controls file size, video profile, all audio and subtitle rows', () => {
  const value = movie({ MediaSources: [source('one', { Size: 1 }), source('two', { Size: 2 * 1073741824, MediaStreams: [
    { Type: 'Video', Index: 0, Codec: 'hevc', Width: 3840, Height: 1600, VideoRangeType: 'DOVIWithHDR10', BitDepth: 10 },
    { Type: 'Audio', Index: 1, Codec: 'eac3', Channels: 6, ChannelLayout: '5.1', DisplayTitle: 'English Atmos' },
    { Type: 'Audio', Index: 3, Codec: 'aac', Language: 'zho', Channels: 2 },
    { Type: 'Subtitle', Index: 20, Codec: 'srt', Language: 'eng' }, { Type: 'Subtitle', Index: 23, DisplayTitle: '中文 ASS' }
  ] })] });
  const result = detailMetadata(value, 'two');
  assert.deepEqual(result.chips, ['4K', 'HEVC', 'Dolby Vision', 'EAC3', '5.1', 'Atmos', 'CC']);
  assert.equal(result.rows.find(r => r.key === 'size').value, '2.00 GiB');
  assert.match(result.rows.find(r => r.key === 'video').value, /3840×1600.*Dolby Vision.*10 位/);
  assert.equal(result.rows.find(r => r.key === 'audio').value, 'English Atmos\nAAC · zho · 2 声道');
  assert.equal(result.rows.find(r => r.key === 'subtitles').value, 'SRT · eng\n中文 ASS');
  assert.deepEqual(detailMetadata(value, 'unknown').rows, []);
});
for (const [range, label] of [['HDR10', 'HDR10'], ['HDR10Plus', 'HDR10+'], ['HLG', 'HLG'], ['Unknown', undefined], ['SDR', undefined]])
  test('video profile does not invent support: ' + range, () => {
    const value = movie({ MediaSources: [source('one', { MediaStreams: [{ Type: 'Video', Index: 0, VideoRangeType: range }] })] });
    assert.deepEqual(detailMetadata(value).chips, label ? [label] : []);
  });
test('item-level streams work without a source, and audio spatial format is shown only when supplied', () => {
  const value = movie({ MediaSources: [], MediaStreams: [{ Type: 'Audio', Index: 0, AudioSpatialFormat: 'DTSX' }] });
  assert.deepEqual(detailMetadata(value).chips, ['DTS:X']); assert.equal(row(value, 'audio'), undefined);
});
test('genres and complete director/writer lists are separate from actors', () => {
  const value = movie({ Genres: ['Drama', 'Comedy'], People: [
    { Id: 'd1', Name: 'Director 1', Type: 'Director' }, { Id: 'd2', Name: 'Director 2', Type: 'Director' },
    { Id: 'w', Name: 'Writer', Type: 'Writer' }, { Id: 'a', Name: 'Actor', Type: 'Actor', Role: 'Hero' }, { Id: 'p', Name: 'Producer', Type: 'Producer' }
  ] });
  assert.equal(row(value, 'genres'), 'Drama、Comedy'); assert.equal(row(value, 'directors'), 'Director 1、Director 2'); assert.equal(row(value, 'writers'), 'Writer');
  assert.deepEqual(detailMetadata(value).actors.map(p => p.Id), ['a']);
});
test('detail DTOs preserve optional metadata and normalize server nulls', () => {
  const value = mediaItem({ ...movie(), OriginalTitle: null, CanDownload: false, CanDelete: null, Genres: ['Drama'], Status: 'Ended', RemoteTrailers: [{ Name: null, Url: null }],
    MediaSources: [source('one', { Size: 123, MediaStreams: [{ Type: 'Video', Index: 0, Width: 1920, Height: 1080, VideoRangeType: 'HDR10', AudioSpatialFormat: null }] })] });
  assert.equal(value.OriginalTitle, undefined); assert.equal(value.CanDownload, false); assert.equal(value.CanDelete, undefined);
  assert.equal(value.RemoteTrailers[0].Url, undefined); assert.equal(value.MediaSources[0].MediaStreams[0].Width, 1920); assert.equal(value.MediaSources[0].Size, 123);
});
for (const bad of [{ Genres: [3] }, { CanDownload: 'true' }, { CanDelete: 1 }, { OriginalTitle: {} }, { RemoteTrailers: [null] }, { RemoteTrailers: [{ Url: {} }] },
  { MediaStreams: [{ Type: 'Video', Index: 0, Width: '4K' }] }, { MediaSources: [source('one', { Size: 'many' })] }])
  test('malformed detail DTO rejected: ' + Object.keys(bad)[0] + JSON.stringify(bad), () => assert.throws(() => mediaItem({ ...movie(), ...bad }), /api_response_invalid/));
test('old cache/download records remain valid and selected source IDs persist', () => {
  activate(); const record = localDownload(movie()); assert.equal(validDownloads([record], AppService.local.directory), true);
  AppService.local.saveDownloads([record]); assert.equal(AppService.local.downloads()[0].mediaSourceId, 'one');
  delete record.mediaSourceId; assert.equal(validDownloads([record], AppService.local.directory), true); assert.equal(validMediaItem(film('old')), true);
});
test('series loads its own next up and sorts horizontal season data numerically', async () => {
  const { p, client } = await detail(show()); let scope;
  client.children = async () => [season(2), season(0), season(1)]; client.nextUp = async id => { scope = id; return [episode(3)]; };
  await p.refresh(); assert.equal(scope, 'show'); assert.deepEqual(ids(p.children), ['season-0', 'season-1', 'season-2']); assert.equal(p.nextUp.Id, 'episode-1-3');
});
test('season details have sorted episodes and do not request series next-up', async () => {
  const { p, client } = await detail(season(1)); client.children = async () => [episode(3), episode(1)]; client.nextUp = async () => { throw new Error('unexpected_next_up'); };
  await p.refresh(); assert.deepEqual(ids(p.children), ['episode-1-1', 'episode-1-3']); assert.equal(p.nextUp, undefined); assert.equal(p.message, '');
});
test('auxiliary request failure retains fresh metadata with a warning and cached children', async () => {
  const { p, client } = await detail(show({ Overview: 'Fresh overview' })); AppService.snapshot = snapshot([season(1)]);
  client.children = async () => { throw new Error('children_failed'); }; client.nextUp = async () => { throw new Error('next_failed'); };
  await p.refresh(); assert.equal(p.item.Overview, 'Fresh overview'); assert.deepEqual(ids(p.children), ['season-1']); assert.equal(p.usingCache, false); assert.match(p.message, /children_failed.*next_failed/);
});
test('offline fallback includes only seasons belonging to the cached series', async () => {
  const { p, client } = await detail(show()); AppService.snapshot = snapshot([show(), season(2), season(1), season(0, { SeriesId: 'other' }), episode(1)]);
  client.detail = async () => { throw new Error('offline'); }; await p.refresh();
  assert.equal(p.usingCache, true); assert.deepEqual(ids(p.children), ['season-1', 'season-2']); assert.equal(p.nextUp, undefined);
});
test('wrong-series next-up is rejected and never presented or played', async () => {
  const { p, client } = await detail(show()); client.nextUp = async () => [episode(1, 1, { SeriesId: 'other' })];
  await p.refresh(); assert.equal(p.nextUp, undefined); assert.match(p.message, /单集列表/); await assert.rejects(AppService.detailPlayback(show()), /episode_queue_failed/);
});
test('late refresh after hiding cannot overwrite page content', async () => {
  const { p, client } = await detail(); const request = deferred(); client.detail = () => request.promise; const pending = p.refresh();
  p.onPageHide(); request.resolve(movie({ Name: 'Late' })); await pending; assert.equal(p.item.Name, 'film'); assert.equal(p.busy, false);
});
test('switching account during detail fetch neither falls back to another account nor updates the page', async () => {
  const { p, client } = await detail(); const request = deferred(); client.detail = () => request.promise; const pending = p.refresh(); activate('b');
  AppService.snapshot = snapshot([movie({ Name: 'Other private data' })]); request.reject(new Error('offline')); await pending; assert.equal(p.item.Name, 'film');
  p.onPageShow(); assert.equal(p.item.Id, ''); assert.deepEqual(p.children, []); assert.equal(navigation.at(-1).back, true);
});
test('return from Player refreshes played/favorite flags and resume position', async () => {
  const { p, client } = await detail(); p.onPageHide(); client.detail = async () => movie({ UserData: { Played: true, PlaybackPositionTicks: 10000000 } });
  p.onPageShow(); await new Promise(resolve => setImmediate(resolve)); assert.equal(p.item.UserData.Played, true); assert.equal(p.item.UserData.PlaybackPositionTicks, 10000000);
});
test('playback uses selected source and keeps resume position', async () => {
  const { p, client } = await detail(movie({ MediaSources: [source('one'), source('two')], UserData: { PlaybackPositionTicks: 10000000 } }));
  client.playbackInfo = async () => ({ MediaSources: [source('one'), source('two')] }); p.sourceId = 'two'; await p.play();
  assert.equal(navigation.at(-1).url, 'pages/Player'); assert.equal(navigation.at(-1).params.mediaSourceId, 'two'); assert.equal(navigation.at(-1).params.item.UserData.PlaybackPositionTicks, 10000000);
});
test('restart only zeroes the Player route without changing snapshot or detail item', async () => {
  const original = movie({ UserData: { PlaybackPositionTicks: 90000000, IsFavorite: true } }); const { p, client } = await detail(original); AppService.snapshot = snapshot([original]);
  client.playbackInfo = async () => ({ MediaSources: [source('one')] }); await p.play(true);
  assert.equal(navigation.at(-1).params.item.UserData.PlaybackPositionTicks, 0); assert.equal(original.UserData.PlaybackPositionTicks, 90000000); assert.equal(navigation.at(-1).params.item.UserData.IsFavorite, true);
});
test('permission-blocked playback is disabled and cannot issue a playback request', async () => {
  const { p, client } = await detail(movie({ PlayAccess: 'None' })); client.playbackInfo = () => { throw new Error('unexpected'); };
  assert.equal(p.canPlay(), false); await p.play(); assert.equal(navigation.length, 0); await assert.rejects(AppService.detailPlayback(p.item), /play_not_allowed/);
});
test('missing source does not silently switch versions', async () => {
  const { p, client } = await detail(); client.playbackInfo = async () => ({ MediaSources: [source('one')] }); p.sourceId = 'unknown'; await p.play();
  assert.equal(navigation.length, 0); assert.match(p.message, /视频源/); assert.equal(p.busy, false);
});
test('late playback cannot navigate after page hide or account change', async () => {
  const { p, client } = await detail(); const request = deferred(); client.playbackInfo = () => request.promise; const pending = p.play();
  p.onPageHide(); activate('b'); request.resolve({ MediaSources: [source('one')] }); await pending; assert.equal(navigation.length, 0);
});
test('series playback uses scoped next-up first', async () => {
  const { p, client } = await detail(show()); let scope;
  client.nextUp = async id => { scope = id; return [episode(5)]; }; client.playbackInfo = async () => ({ MediaSources: [source('one')] });
  await p.play(); assert.equal(scope, 'show'); assert.equal(navigation.at(-1).params.item.Id, 'episode-1-5');
});
test('empty next-up falls back to first episode from complete pagination', async () => {
  const { client } = await detail(show()); client.episodePage = async (id, start) => ({ Items: start === 0 ? [episode(2, 2)] : [episode(3), episode(1)], TotalRecordCount: 3 });
  client.playbackInfo = async () => ({ MediaSources: [source('one')] }); const route = await AppService.detailPlayback(show()); assert.equal(route.item.Id, 'episode-1-1');
});
test('season play resolves first episode only within its selected season', async () => {
  const { client } = await detail(season(2)); client.episodePage = async () => ({ Items: [episode(1), episode(3, 2), episode(2, 2)], TotalRecordCount: 3 });
  client.playbackInfo = async () => ({ MediaSources: [source('one')] }); assert.equal((await AppService.detailPlayback(season(2))).item.Id, 'episode-2-2');
});
for (const [name, pages] of [
  ['duplicate page', [{ Items: [episode(1)], TotalRecordCount: 2 }, { Items: [episode(1)], TotalRecordCount: 2 }]],
  ['missing page', [{ Items: [], TotalRecordCount: 2 }]],
  ['changing total', [{ Items: [episode(1)], TotalRecordCount: 2 }, { Items: [episode(2)], TotalRecordCount: 3 }]],
  ['wrong series', [{ Items: [episode(1, 1, { SeriesId: 'other' })], TotalRecordCount: 1 }]]
]) test('series queue rejects ' + name, async () => {
  const { client } = await detail(show()); client.episodePage = async () => pages.shift(); await assert.rejects(AppService.detailPlayback(show()), /episode_queue_failed/);
});
test('unknown ordering and empty series do not guess playable episodes', async () => {
  assert.throws(() => firstEpisode([episode(1, 1, { IndexNumber: undefined })], 'show'), /episode_order_unknown/);
  const { client } = await detail(show()); client.episodePage = async () => ({ Items: [], TotalRecordCount: 0 }); await assert.rejects(AppService.detailPlayback(show()), /no_playable_episode/);
});
test('offline series plays a downloaded first episode without querying server', async () => {
  const { client } = await detail(show()); const item = episode(1); localDownload(item); AppService.snapshot = snapshot([show(), item]); client.nextUp = async () => { throw new Error('unexpected'); };
  assert.equal((await AppService.detailPlayback(show(), '', true)).offline, true);
});
test('offline series never jumps over an undownloaded first episode', async () => {
  await detail(show()); localDownload(episode(2)); AppService.snapshot = snapshot([show(), episode(1), episode(2)]); await assert.rejects(AppService.detailPlayback(show(), '', true), /next_not_downloaded/);
});
for (const favorite of [true, false]) {
  test((favorite ? 'favorite' : 'watched') + ' updates after server success without mutating the snapshot', async () => {
    const original = movie({ UserData: { IsFavorite: false, Played: false } }); const { p, client } = await detail(original); let called;
    client[favorite ? 'favorite' : 'played'] = async (id, value) => { called = [id, value]; }; await p.setFlag(favorite);
    assert.deepEqual(called, ['film', true]); assert.equal(p.item.UserData[favorite ? 'IsFavorite' : 'Played'], true); assert.equal(original.UserData[favorite ? 'IsFavorite' : 'Played'], false);
  });
  test((favorite ? 'favorite' : 'watched') + ' failure leaves state intact and retry succeeds', async () => {
    const { p, client } = await detail(); client[favorite ? 'favorite' : 'played'] = async () => { throw new Error('permission_denied'); }; await p.setFlag(favorite);
    assert.equal(p.item.UserData, undefined); assert.match(p.message, /权限/); assert.equal(p.busy, false);
    client[favorite ? 'favorite' : 'played'] = async () => {}; await p.setFlag(favorite); assert.equal(p.message, '');
  });
}
test('offline mutations are disabled and double clicks cannot start parallel flag requests', async () => {
  const { p, client } = await detail(); let calls = 0; const request = deferred(); client.favorite = () => { calls++; return request.promise; };
  p.usingCache = true; await p.setFlag(true); assert.equal(calls, 0); p.usingCache = false;
  const pending = p.setFlag(true); await p.setFlag(true); await new Promise(setImmediate); assert.equal(calls, 1); request.resolve(); await pending;
});
test('late mutation response cannot update another account or a hidden page', async () => {
  const { p, client } = await detail(); const request = deferred(); client.favorite = () => request.promise; const pending = p.setFlag(true); p.onPageHide(); activate('b'); request.resolve(); await pending; assert.equal(p.item.UserData, undefined);
});
for (const url of ['javascript:alert(1)', 'file:///private/video', 'https://user:pass@example.invalid/', 'https://example.invalid/?api_key=secret', 'https://example.invalid/?access_token=secret', 'https://example.invalid/ bad'])
  test('trailer blocks credential or unsupported URI: ' + url.replace(/secret/g, 'fixture'), () => assert.equal(trailerUrl(movie({ RemoteTrailers: [{ Url: url }] })), ''));
test('trailer selects a valid web link and invokes native viewData action', async () => {
  const { p } = await detail(movie({ RemoteTrailers: [{ Url: 'bad' }, { Url: 'https://example.invalid/trailer' }] })); await p.trailer();
  assert.deepEqual(abilities[0], { action: 'ohos.want.action.viewData', uri: 'https://example.invalid/trailer' });
});
test('failed trailer intent is displayed and releases the busy state', async () => {
  const { p } = await detail(movie({ RemoteTrailers: [{ Url: 'https://example.invalid/trailer' }] })); const before = context.startAbility;
  try { context.startAbility = async () => { throw new Error('native error'); }; await p.trailer(); assert.match(p.message, /无法打开预告片/); assert.equal(p.busy, false); } finally { context.startAbility = before; }
});
test('actor and next-up navigation carry correct item/person identifiers', async () => {
  const { p } = await detail(); p.openPerson({ Id: 'actor', Name: 'Actor' }); p.openChild(episode(2));
  assert.equal(navigation[0].params.personId, 'actor'); assert.equal(navigation[1].params.item.Id, 'episode-1-2'); p.onPageHide(); p.openChild(episode(3)); assert.equal(navigation.length, 2);
});
test('new download requires confirmation and uses the selected version', async () => {
  const { p, client } = await detail(movie({ MediaSources: [source('one'), source('two')] })); client.playbackInfo = async () => ({ MediaSources: [source('one'), source('two')] }); p.sourceId = 'two';
  p.download(); assert.equal(downloadTasks.length, 0); dialog.primaryButton.action(); assert.equal(downloadTasks.length, 0);
  p.download(); await dialog.secondaryButton.action(); assert.equal(downloadTasks.length, 1); assert.equal(AppService.downloads[0].mediaSourceId, 'two');
  assert.equal(new URL(downloadTasks[0].options.url).searchParams.get('mediaSourceId'), 'two'); assert.equal(downloadTasks[0].options.enableMetered, false);
});
test('download permission false or unknown hides creation but keeps local removal available', async () => {
  const { p } = await detail(movie({ CanDownload: false })); assert.equal(p.canDownload(), false); p.download(); assert.equal(dialog, undefined);
  await assert.rejects(AppService.download(p.item), /download_not_allowed/); p.item.CanDownload = undefined; assert.equal(p.canDownload(), false);
  localDownload(p.item); assert.equal(p.canDownload(), true);
});
test('completed download removal deletes only its local file after confirmation', async () => {
  const { p } = await detail(); const record = localDownload(p.item); p.download(); dialog.primaryButton.action(); assert.equal(fs.existsSync(record.path), true);
  p.download(); await dialog.secondaryButton.action(); assert.equal(fs.existsSync(record.path), false); assert.equal(AppService.downloads.length, 0); assert.equal(requests.length, 0);
});
test('in-progress download cancellation waits for native task deletion', async () => {
  const { p, client } = await detail(); client.playbackInfo = async () => ({ MediaSources: [source('one')] }); p.download(); await dialog.secondaryButton.action();
  const task = downloadTasks[0]; const nativeDelete = deferred(); task.delete = () => nativeDelete.promise; p.download(); const pending = dialog.secondaryButton.action();
  assert.equal(AppService.downloads.length, 1); nativeDelete.resolve(true); await pending; assert.equal(AppService.downloads.length, 0); assert.equal(AppService.tasks.size, 0);
});
test('failed native cancellation retains record and exposes an error', async () => {
  const { p } = await detail(); const record = localDownload(p.item, 'downloading'); AppService.tasks.set(record.id, { delete: async () => false });
  p.download(); await dialog.secondaryButton.action(); assert.equal(AppService.downloads[0], record); assert.equal(fs.existsSync(record.path), true); assert.match(p.message, /下载任务未能取消/);
});
test('download progress/completion events update the visible detail status', async () => {
  const { p, client } = await detail(); p.onPageShow(); await new Promise(resolve => setImmediate(resolve)); client.playbackInfo = async () => ({ MediaSources: [source('one')] });
  p.download(); await dialog.secondaryButton.action(); downloadTasks[0].handlers.get('progress')(25, 100); assert.equal(p.downloadState, '下载中 25%%');
  downloadTasks[0].handlers.get('complete')(); assert.match(p.downloadState, /已下载/); p.onPageHide(); assert.equal(AppService.downloadListener, undefined);
});
test('download confirmation becomes invalid after changing account', async () => {
  const { p } = await detail(); p.download(); const confirm = dialog.secondaryButton.action; activate('b'); await confirm(); assert.equal(downloadTasks.length, 0);
});
test('a native task returned after account change is cancelled without polluting new downloads', async () => {
  const { p, client } = await detail(); client.playbackInfo = async () => ({ MediaSources: [source('one')] });
  const before = platform.get('@ohos.request').downloadFile, request = deferred(); platform.get('@ohos.request').downloadFile = () => request.promise;
  try {
    const pending = AppService.download(p.item); await new Promise(resolve => setImmediate(resolve)); activate('b'); let deleted = false;
    request.resolve({ delete: async () => { deleted = true; return true; } }); await assert.rejects(pending, /login_required/); assert.equal(deleted, true); assert.equal(AppService.downloads.length, 0);
  } finally { platform.get('@ohos.request').downloadFile = before; }
});
test('remote deletion is absent for unknown permissions, Series and cached details', async () => {
  const { p } = await detail(movie({ CanDelete: undefined })); p.deleteMedia(); assert.equal(dialog, undefined);
  p.item.CanDelete = true; p.usingCache = true; p.deleteMedia(); assert.equal(dialog, undefined); p.usingCache = false; p.item.Type = 'Series'; p.deleteMedia(); assert.equal(dialog, undefined);
});
test('server delete requires a fresh allowed item and confirmation, preserving local video', async () => {
  const { p, client } = await detail(); const record = localDownload(p.item); let removed = 0, queried = 0;
  client.detail = async id => { queried++; return movie(); }; client.removeItem = async id => { assert.equal(id, 'film'); removed++; };
  AppService.snapshot = snapshot([movie(), film('other')], [library('films')], [{ libraryId: 'films', itemIds: ['film', 'other'] }]);
  p.deleteMedia(); dialog.primaryButton.action(); assert.equal(removed, 0); p.deleteMedia(); await dialog.secondaryButton.action();
  assert.equal(queried, 1); assert.equal(removed, 1); assert.equal(navigation.at(-1).back, true); assert.equal(p.deleted, true);
  assert.deepEqual(ids(AppService.snapshot.items), ['other']); assert.deepEqual(AppService.snapshot.memberships[0].itemIds, ['other']); assert.equal(fs.existsSync(record.path), true); assert.equal(AppService.downloads.length, 1);
});
test('revoked delete permission prevents DELETE even when page previously allowed it', async () => {
  const { p, client } = await detail(); let removed = 0; client.detail = async () => movie({ CanDelete: false }); client.removeItem = async () => removed++;
  p.deleteMedia(); await dialog.secondaryButton.action(); assert.equal(removed, 0); assert.equal(p.deleted, false); assert.match(p.message, /删除此媒体的权限/);
});
test('delete permission refresh failure and account switch both prevent DELETE', async () => {
  const { p, client } = await detail(); let removed = 0; client.removeItem = async () => removed++; client.detail = async () => { throw new Error('offline'); };
  await assert.rejects(AppService.deleteMedia(p.item), /offline/); const request = deferred(); client.detail = () => request.promise;
  const pending = AppService.deleteMedia(p.item); activate('b'); request.resolve(movie()); await assert.rejects(pending, /login_required/); assert.equal(removed, 0);
});
test('post-delete disk failure is distinct and prevents accidental repeated DELETE', async () => {
  const { p, client } = await detail(); let removed = 0; client.removeItem = async () => removed++; AppService.snapshot = snapshot([movie()]);
  AppService.local.saveSnapshot = () => { throw new Error('disk'); }; p.deleteMedia(); await dialog.secondaryButton.action();
  assert.equal(removed, 1); assert.equal(p.deleted, true); assert.match(p.message, /服务器媒体已删除/); p.deleteMedia(); await dialog.secondaryButton.action(); assert.equal(removed, 1);
});
test('permission change or failure of actual DELETE leaves snapshot intact', async () => {
  const { p, client } = await detail(); AppService.snapshot = snapshot([movie()]); client.removeItem = async () => { throw new Error('permission_denied'); };
  p.deleteMedia(); await dialog.secondaryButton.action(); assert.equal(p.deleted, false); assert.deepEqual(ids(AppService.snapshot.items), ['film']); assert.match(p.message, /权限/);
});
for (const children of [[season(1), season(1)], [season(1, { SeriesId: 'other' })], [episode(1)]])
  test('series rejects duplicate or mis-scoped children: ' + JSON.stringify(children.map(i => i.Id)), async () => {
    const { p, client } = await detail(show()); client.children = async () => children; await p.refresh(); assert.equal(p.children.length, 0); assert.match(p.message, /单集列表/);
  });
test('account change during children fetch stops subsequent next-up request', async () => {
  const { p, client } = await detail(show()); const request = deferred(); let calls = 0; client.children = () => request.promise; client.nextUp = async () => { calls++; return []; };
  const pending = p.refresh(); await new Promise(resolve => setImmediate(resolve)); activate('b'); request.resolve([season(1)]); await pending; assert.equal(calls, 0); assert.equal(p.children.length, 0);
});
test('next-up play respects episode-specific access restrictions', async () => {
  const { client } = await detail(show()); client.nextUp = async () => [episode(1, 1, { PlayAccess: 'None' })]; await assert.rejects(AppService.detailPlayback(show()), /play_not_allowed/);
});
test('unknown download permission is denied by the business entry too', async () => {
  await detail(); await assert.rejects(AppService.download(movie({ CanDownload: undefined })), /download_not_allowed/);
});
for (const bad of [{ Name: {} }, { Container: {} }, { MediaStreams: [{ Type: 'Audio', Index: 0, AudioSpatialFormat: {} }] },
  { MediaStreams: [{ Type: 'Subtitle', Index: 20, IsTextSubtitleStream: 'yes' }] }])
  test('playback DTO cannot bypass technical-field validation: ' + Object.keys(bad)[0], () => assert.throws(() => playbackInfo({ MediaSources: [source('one', bad)] }), /api_response_invalid/));
test('real detail load publishes scoped seasons into SDK observers and account clearing removes them', async () => {
  const client = activate(); client.detail = async () => show(); client.children = async () => [season(2), season(1)]; client.nextUp = async () => [episode(1)];
  routeParams = { item: show() }; const render = require('./library-grid.test.cjs').createDetail(), p = new Detail();
  Object.defineProperty(p, 'children', { get: () => render.view.children, set: items => render.update(items) });
  assert.deepEqual(render.visible(), []); await p.aboutToAppear(); assert.equal(render.visible().length, 2); assert.match(render.visible()[0], /^season-1:/);
  p.onPageHide(); activate('b'); p.onPageShow(); assert.deepEqual(render.visible(), []);
});
test('cancel and redownload ignores old progress, completion and failure without removing the new task', async () => {
  const { p, client } = await detail(); client.playbackInfo = async () => ({ MediaSources: [source('one')] }); await AppService.download(p.item);
  const oldTask = downloadTasks[0]; await AppService.removeDownload(AppService.downloads[0]); await AppService.download(p.item);
  const task = downloadTasks[1], record = AppService.downloads[0]; oldTask.handlers.get('progress')(100, 100); oldTask.handlers.get('complete')(); oldTask.handlers.get('fail')();
  assert.equal(AppService.tasks.get('film'), task); assert.equal(record.state, 'downloading'); assert.equal(record.progress, 0);
  assert.equal(AppService.local.downloads()[0].state, 'downloading');
});
test('late failure or progress after completion cannot downgrade a completed download', async () => {
  const { p, client } = await detail(); client.playbackInfo = async () => ({ MediaSources: [source('one')] }); await AppService.download(p.item); const task = downloadTasks[0];
  task.handlers.get('complete')(); task.handlers.get('fail')(); task.handlers.get('progress')(1, 100);
  assert.equal(AppService.downloads[0].state, 'complete'); assert.equal(AppService.downloads[0].progress, 1);
});
test('native progress stays valid for empty totals, overshoot and invalid numbers', async () => {
  const { p, client } = await detail(); client.playbackInfo = async () => ({ MediaSources: [source('one')] }); await AppService.download(p.item); const progress = downloadTasks[0].handlers.get('progress');
  for (const [received, total, expected] of [[10,0,0],[101,100,1],[-1,100,0],[NaN,10,0]]) { progress(received,total); assert.equal(AppService.downloads[0].progress,expected); }
});
(async () => {
  try {
    for (const [name, fn] of tests) { reset(); await fn(); console.log('PASS ' + name); }
    console.log(tests.length + ' detail regressions passed. Real page/service methods with platform fixtures; no authenticated Jellyfin deletion, native intents, pixels or decoding executed.');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
