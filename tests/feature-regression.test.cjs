global.BlurStyle={NONE:0};global.DialogButtonDirection={VERTICAL:1,HORIZONTAL:2};
// Real services and page lifecycle/query methods. ArkUI builders are compiled by the SDK,
// not rendered here; HTTP/Asset are mocks and file APIs adapt to isolated real temp files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const sdk = require('./deveco-runtime.cjs').contents;
const ts = require(path.join(sdk, 'tools/hvigor/hvigor/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-regression-'));
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));
const modules = new Map(), platform = new Map(), queue = [], requests = [];
platform.set('@ohos.deviceInfo', { sdkApiVersion: 26 });
platform.set('@ohos.multimedia.media', { async createAVPlayer() { throw new Error('Playback requires an explicit native fixture'); } });
platform.set('@ohos.multimedia.audio', {});
platform.set('@ohos.font', { getUIFontConfig() { throw new Error('Font inventory requires an explicit platform fixture'); } });
platform.set('libcineisle_mpv.so', { async capability() { return { supported: false, loaded: false }; }, async create() { throw new Error('MPV requires an explicit native fixture'); } });
require('./download-platform.cjs').install(platform);
const assets = new Map(), capabilities = new Set();
let assetValue, routeParams = {}, replacedRoute;
const fileApi = { accessSync: fs.existsSync, mkdirSync: fs.mkdirSync, readTextSync: p => fs.readFileSync(p, 'utf8'), statSync: fs.statSync,
  openSync: (p, flags) => ({ fd: fs.openSync(p, flags) }), writeSync: fs.writeSync, fsyncSync: fs.fsyncSync,
  closeSync: file => fs.closeSync(file.fd), renameSync: fs.renameSync, unlinkSync: fs.unlinkSync,
  OpenMode: { CREATE: fs.constants.O_CREAT, WRITE_ONLY: fs.constants.O_WRONLY, TRUNC: fs.constants.O_TRUNC } };
const context = { filesDir: directory, resourceManager: {
  getStringSync: name => name, getStringByNameSync: (name, ...args) => name + ':' + args.join(',')
} };
platform.set('@ohos.file.fs', fileApi);
require('./sync-platform.cjs').files(fileApi);
platform.set('@ohos.app.ability.common', {});
platform.set('@ohos.request', {});
platform.set('@ohos.file.fileuri', { getUriFromPath: p => 'file://' + p });
platform.set('@ohos.resourceManager', {});
require('./preferences-platform.cjs').install(platform, directory);
platform.set('@ohos.util', { generateRandomUUID: () => require('node:crypto').randomUUID(),
  TextEncoder: class { encodeInto(s) { return new TextEncoder().encode(s); } },
  TextDecoder: class { decodeToString(s) { return new TextDecoder().decode(s); } } });
platform.set('@ohos.security.asset', { Tag: { ALIAS: 'alias', SECRET: 'secret', RETURN_TYPE: 'return', ACCESSIBILITY: 'access', CONFLICT_RESOLUTION: 'conflict' },
  ReturnType: { ALL: 1 }, Accessibility: { DEVICE_UNLOCKED: 1 }, ConflictResolution: { OVERWRITE: 1 },
  query: async attrs => { const value = assets.get(new TextDecoder().decode(attrs.get('alias'))); return value ? [new Map([['secret', value]])] : []; },
  add: async attrs => { const bytes = attrs.get('secret'); assert.ok(bytes.length <= 1024); assets.set(new TextDecoder().decode(attrs.get('alias')), bytes); }, remove: async attrs => { assets.delete(new TextDecoder().decode(attrs.get('alias'))); } });
platform.set('@ohos.net.http', { RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }, HttpDataType: { STRING: 'STRING' },
  createHttp: () => ({ async request(url, options) {
    requests.push({ url, options }); const value = queue.shift();
    if (value instanceof Error) throw value;
    assert.ok(value, 'Each platform request must have an explicit fixture'); return value;
  }, destroy() {} }) });
platform.set('@ohos.router', { getParams: () => routeParams, back() {}, pushUrl() {}, clear() {}, replaceUrl(value) { replacedRoute = value; } });

function load(relative) {
  const file = path.resolve(root, relative);
  if (modules.has(file)) return modules.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  if (relative.includes('/pages/') || relative.startsWith('pages/')) {
    const builder = source.indexOf('\n  @Builder');
    const boundary = builder >= 0 ? builder : source.indexOf('\n  build()');
    assert.ok(boundary > 0, 'Expected an ArkUI builder boundary');
    source = (source.slice(0, boundary) + '\n}').replace(/@Entry\s+@Component\s+struct (\w+)/, 'export class $1').replace(/@State\s+/g, '').replace(/@StorageLink\([^)]*\)\s+/g, '').replace(/@Watch\([^)]*\)\s*/g, '');
  }
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020
  } }).outputText;
  const module = { exports: {} }; modules.set(file, module);
  const localRequire = id => {
    if(id.endsWith('/CompactDialog'))return {showBrandDialog:(_context,options)=>{ global.AlertDialog?.show(options); }};
    if (platform.has(id)) return platform.get(id);
    if (!id.startsWith('.')) throw new Error('Unexpected dependency ' + id);
    const base = path.resolve(path.dirname(file), id);
    return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.ets');
  };
  vm.runInThisContext('(function(require,module,exports,getContext,$r,canIUse){' + js + '\n})', { filename: file })
    (localRequire, module, module.exports, () => context, id => ({ id }), value => capabilities.has(value));
  return module.exports;
}
const { AppService } = load('service/AppService.ets');
const { SessionStore } = load('service/SessionStore.ets');
const { LocalStore } = load('service/LocalStore.ets');
const { JellyfinClient } = load('service/JellyfinClient.ets');
const { LibrarySnapshot } = load('model/Models.ts');
const { Index } = load('pages/Index.ets');
const { Detail } = load('pages/Detail.ets');
const { cachedItems } = load('utils/Browse.ts');
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
function page(overrides = {}) {
  const p = new Index(); p.resetAccountState(); p.ready = true; return Object.assign(p, overrides);
}
function deferred() {
  let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function reset() {
  const { PendingSync } = load('service/PendingSync.ets'); PendingSync.stop(); PendingSync.context = undefined; PendingSync.owner = undefined; PendingSync.interactive = false; PendingSync.running = undefined; PendingSync.jobs = Promise.resolve(); PendingSync.net = undefined;
  capabilities.clear();
  const { AppLock } = load('service/AppLock.ets'); AppLock.initialized = true; AppLock.locked = false; AppLock.enabled = false; AppLock.fault = false;
  for (const entry of fs.readdirSync(directory)) fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  AppService.client = undefined; AppService.local = undefined; AppService.snapshot = new LibrarySnapshot();
  AppService.downloads = []; AppService.tasks.clear(); AppService.pumping = false; AppService.polling = false; AppService.syncing = false;
  AppService.cacheRecovered = false; AppService.initialized = false; AppService.intros = undefined; AppService.trickplays = undefined; AppService.context = context;
  queue.length = 0; requests.length = 0; assetValue = undefined; assets.clear(); AppService.accountBusy = false; AppService.accountListener = undefined; AppService.closePlayback = undefined; routeParams = {};
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('F1 login clears all prior account view state before loading the new account', async () => {
  activate(); const p = page({ server: session('b').server, username: 'b', password: 'mock-password',
    libraries: [library('old')], actors: [{}], downloads: [{}], items: [film('old')],
    resume: [film('old')], mode: 'library', parentId: 'old', personId: 'old', search: 'old',
    sectionTitle: 'old', syncMessage: 'old', usingCache: true });
  queue.push(response({ Id: 'server', Version: '10.10.0' }), response({ User: { Id: 'b', Name: 'b' }, AccessToken: 'mock-token-b' }),
    response({ Items: [] }), response({ Items: [] }), response({ Items: [] }));
  await p.login();
  assert.equal(AppService.client.session.userId, 'b'); assert.equal(p.signedIn, true);
  for (const field of ['libraries', 'actors', 'downloads', 'items', 'resume', 'homeSections']) assert.equal(p[field].length, 0, field);
  for (const field of ['mode', 'parentId', 'personId', 'search', 'sectionTitle', 'syncMessage', 'password']) assert.equal(p[field], '', field);
  assert.equal(p.usingCache, false);
});
test('F1 logout clears page metadata as well as the service account', async () => {
  activate(); const p = page({ libraries: [library('private')], actors: [{}], resume: [film('old')],
    downloads: [{}], syncMessage: 'old', sectionTitle: 'old', total: 10 });
  await p.logout(); assert.equal(p.signedIn, false); assert.equal(AppService.client, undefined);
  for (const field of ['libraries', 'actors', 'resume', 'downloads', 'items', 'homeSections']) assert.equal(p[field].length, 0);
  assert.equal(p.syncMessage, ''); assert.equal(p.sectionTitle, ''); assert.equal(p.total, 0);
});
test('10.8 restored account home loads resume/latest through version-selected routes', async () => {
  await SessionStore.save(session('a')); await AppService.initialize(context);
  queue.push(response({ Id: 'server', Version: '10.8.13' }), response({ Items: [film('resume')] }), response({ Items: [] }), response({ Items: [library('films')] }), response([film('latest')]));
  const p = page({ tab: 1 }); await p.load();
  assert.equal(p.message, ''); assert.deepEqual(ids(p.resume), ['resume']); assert.deepEqual(ids(p.items), ['latest']);
  assert.deepEqual(requests.map(r => new URL(r.url).pathname), ['/jellyfin/System/Info/Public', '/jellyfin/Users/a/Items/Resume', '/jellyfin/Shows/NextUp', '/jellyfin/Users/a/Views', '/jellyfin/Users/a/Items/Latest']);
  assert.equal(new URL(requests.at(-1).url).searchParams.get('parentId'), 'films');
  assert.equal(p.usingCache, false);
});
test('10.8 synced 23 movies appear when the actual movie library page publishes its async result', async () => {
  const client = new JellyfinClient(session('a'), '10.8.13'); AppService.useClient(client);
  const movies = Array.from({ length: 23 }, (_, n) => film('movie-' + n));
  queue.push(response({ Items: [library('films')] }), response({ Items: movies, TotalRecordCount: 23 }));
  await AppService.sync(() => {}); assert.equal(AppService.snapshot.items.length, 23);
  const render = require('./library-grid.test.cjs').createGrid();
  const p = page({ tab: 2, mode: 'library', parentId: 'films' });
  Object.defineProperty(p, 'items', { get: () => render.view.items, set: items => render.update(items) });
  assert.deepEqual(render.visible(), []);
  queue.push(response({ Items: movies, TotalRecordCount: 23 })); await p.load();
  assert.equal(p.message, ''); assert.equal(p.total, 23); assert.equal(p.busy, false);
  assert.deepEqual(render.visible(), movies.map(item => item.Id));
  const query = new URL(requests.at(-1).url).searchParams;
  assert.equal(query.get('parentId'), 'films'); assert.equal(query.get('recursive'), 'true');
  assert.deepEqual(query.getAll('includeItemTypes'), ['Movie', 'Series']);
});
test('F1 blocked logout preserves the active account and its page state', async () => {
  const client = activate(); AppService.syncing = true;
  const p = page({ libraries: [library('current')] }); await p.logout();
  assert.equal(AppService.client, client); assert.equal(p.signedIn, true); assert.deepEqual(ids(p.libraries), ['current']);
  assert.match(p.message, /tasks_active/);
});
for (const fail of [false, true]) test('F1 stale ' + (fail ? 'failed' : 'successful') + ' request cannot restore old account libraries', async () => {
  const old = activate(); const request = deferred(); old.libraries = () => request.promise;
  const p = page({ tab: 2, libraries: [library('private-a')] }); const pending = p.load();
  const current = activate('b'); current.libraries = async () => { throw new Error('offline-b'); };
  p.resetAccountState(); p.tab = 2; await p.load();
  const message = p.message;
  if (fail) request.reject(new Error('offline-a')); else request.resolve([library('private-a')]);
  await pending;
  assert.equal(p.libraries.length, 0); assert.equal(p.items.length, 0); assert.equal(p.message, message); assert.equal(p.busy, false);
});

test('F2 search and favorites include episodes while library and actor queries retain root types', () => {
  activate();
  for (const mode of ['search', 'favorites']) assert.equal(valueOf(page({ mode }).params(), 'IncludeItemTypes'), 'Movie,Series,Episode');
  for (const mode of ['library', 'actor']) assert.equal(valueOf(page({ mode }).params(), 'IncludeItemTypes'), 'Movie,Series');
});
test('F2 an episode favorite is returned by the actual favorite page query', async () => {
  const client = activate(); const episode = { Id: 'ep', Name: 'Episode', Type: 'Episode', UserData: { IsFavorite: true } };
  client.items = async params => ({ Items: valueOf(params, 'IncludeItemTypes').split(',').includes('Episode') ? [episode] : [], TotalRecordCount: 1 });
  const p = page({ tab: 4, mode: 'favorites' }); await p.load(); assert.deepEqual(ids(p.items), ['ep']);
});

test('F3 sync persists library membership and a cold offline session can navigate library, show, season and episode', async () => {
  const client = activate(); const movie = film('movie');
  const show = { Id: 'show', Name: 'Show', Type: 'Series' };
  const season = { Id: 'season', Name: 'Season', Type: 'Season', SeriesId: 'show' };
  const episode = { Id: 'episode', Name: 'Episode', Type: 'Episode', SeriesId: 'show', SeasonId: 'season' };
  client.libraries = async () => [library('films'), library('shows')];
  client.items = async params => ({ Items: valueOf(params, 'ParentId') === 'films' ? [movie] : [show, season, episode], TotalRecordCount: valueOf(params, 'ParentId') === 'films' ? 1 : 3 });
  await AppService.sync(() => {});
  assert.equal(AppService.local.snapshot().memberships.length, 2);
  await SessionStore.save(session('a')); AppService.client = undefined; AppService.initialized = false; AppService.intros = undefined; AppService.trickplays = undefined;
  await AppService.initialize(context); queue.push(new Error('offline'));
  const p = page({ tab: 2 }); await p.load();
  assert.deepEqual(ids(p.libraries), ['films', 'shows']); assert.equal(p.mode, ''); assert.equal(p.usingCache, true);
  queue.push(new Error('offline')); p.mode = 'library'; p.parentId = 'films'; await p.load();
  assert.deepEqual(ids(p.items), ['movie']);
  queue.push(new Error('offline')); p.parentId = 'shows'; await p.load(); assert.deepEqual(ids(p.items), ['show']);
  routeParams = { item: show }; queue.push(new Error('offline')); const detail = new Detail(); await detail.aboutToAppear();
  assert.deepEqual(ids(detail.children), ['season']);
  routeParams = { item: season }; queue.push(new Error('offline')); const seasonDetail = new Detail(); await seasonDetail.aboutToAppear();
  assert.deepEqual(ids(seasonDetail.children), ['episode']);
});
test('F3 old snapshots stay readable and expose a flat offline collection without invented library membership', async () => {
  const local = new LocalStore(context, session('a'));
  fs.writeFileSync(path.join(local.directory, 'library.json'), JSON.stringify({ syncedAt: 1, items: [film('legacy')], actors: [] }));
  const client = activate(); client.libraries = async () => { throw new Error('offline'); };
  const p = page({ tab: 2 }); await p.load();
  assert.equal(p.mode, 'offline-library'); assert.deepEqual(ids(p.items), ['legacy']); assert.equal(p.usingCache, true);
  assert.equal(AppService.cacheRecovered, false); assert.deepEqual(AppService.snapshot.memberships, []);
  assert.throws(() => cachedItems(AppService.snapshot, 'library', '', 'unknown', ''), /cache_library_unavailable/);
});
test('F3 an uncached library fails explicitly instead of mixing items from other libraries', async () => {
  const client = activate(); AppService.snapshot = snapshot([film('other')]); client.items = async () => { throw new Error('offline'); };
  const p = page({ tab: 2, mode: 'library', parentId: 'not-cached' }); await p.load();
  assert.equal(p.items.length, 0); assert.match(p.message, /cache_library_unavailable/);
});
test('F2/F3 offline search trims the term and includes matching episodes', async () => {
  const client = activate(); AppService.snapshot = snapshot([{ Id: 'ep', Name: '测试单集', Type: 'Episode' }, film('other')]);
  client.items = async () => { throw new Error('offline'); };
  const p = page({ mode: 'search', search: ' 单集 ' }); await p.load(); assert.deepEqual(ids(p.items), ['ep']);
});

test('F4 offline actor works use cached People and exclude unrelated media and episode duplicates', async () => {
  const client = activate(); const actor = { Id: 'person', Name: 'Actor', Type: 'Actor' };
  AppService.snapshot = snapshot([film('movie', [actor]), film('other'), { Id: 'show', Name: 'Show', Type: 'Series', People: [actor] },
    { Id: 'episode', Name: 'Episode', Type: 'Episode', People: [actor] }]);
  client.items = async () => { throw new Error('offline'); };
  const p = page({ tab: 3, mode: 'actor', personId: 'person' }); await p.load();
  assert.deepEqual(ids(p.items).sort(), ['movie', 'show']); assert.equal(p.usingCache, true);
});
test('F4 person route loads cached works through the actual Index lifecycle', async () => {
  const local = new LocalStore(context, session('a'));
  local.saveSnapshot(snapshot([film('movie', [{ Id: 'person', Name: 'Actor', Type: 'Actor' }])]));
  await SessionStore.save(session('a')); routeParams = { personId: 'person', personName: 'Actor' }; queue.push(new Error('offline'));
  const p = new Index(); await p.aboutToAppear();
  assert.equal(replacedRoute.url, 'pages/Actor'); assert.deepEqual(replacedRoute.params, { personId: 'person', personName: 'Actor' }); assert.equal(AppService.snapshot.items[0].Id, 'movie');
});

for (const mode of ['library', 'favorites', 'actor']) test('F5 ' + mode + ' pagination retains its page on failure and retries the same offset', async () => {
  const client = activate(); const initial = Array.from({ length: 60 }, (_, i) => film('item-' + i));
  const offsets = []; let failing = true;
  client.items = async params => {
    offsets.push(valueOf(params, 'StartIndex'));
    if (failing) throw new Error('offline'); return { Items: [film('item-60'), film('item-61')], TotalRecordCount: 62 };
  };
  const p = page({ mode, parentId: mode === 'library' ? 'films' : '', personId: mode === 'actor' ? 'person' : '', items: initial, total: 62 });
  await p.load(true); assert.deepEqual(ids(p.items), ids(initial)); assert.equal(p.total, 62); assert.equal(p.busy, false);
  failing = false; await p.load(true); assert.deepEqual(offsets, ['60', '60']);
  assert.equal(p.items.length, 62); assert.equal(new Set(ids(p.items)).size, 62); assert.equal(p.total, 62);
});

function syncFixture(pages) {
  const client = activate(); const old = snapshot([film('old')]); AppService.local.saveSnapshot(old); AppService.snapshot = old;
  client.libraries = async () => [library('films')]; let call = 0;
  client.items = async () => {
    const page = pages[call++]; assert.ok(page, 'Sync must stop after detecting invalid pagination');
    if (page instanceof Error) throw page; return page;
  };
  return old;
}
const invalidPages = [
  ['premature empty page', [{ Items: [film('new')], TotalRecordCount: 3 }, { Items: [], TotalRecordCount: 3 }]],
  ['duplicate across pages', [{ Items: [film('new')], TotalRecordCount: 2 }, { Items: [film('new')], TotalRecordCount: 2 }]],
  ['duplicate within a page', [{ Items: [film('new'), film('new')], TotalRecordCount: 2 }]],
  ['changing total', [{ Items: [film('new')], TotalRecordCount: 2 }, { Items: [film('next')], TotalRecordCount: 3 }]],
  ['missing total', [{ Items: [film('new')] }]],
  ['invalid total', [{ Items: [], TotalRecordCount: -1 }]],
  ['too many items', [{ Items: [film('new')], TotalRecordCount: 0 }]],
  ['invalid item', [{ Items: [null], TotalRecordCount: 1 }]]
];
for (const [name, pages] of invalidPages) test('F6 ' + name + ' preserves old memory and disk snapshots', async () => {
  const old = syncFixture(pages);
  await assert.rejects(() => AppService.sync(() => {}), /sync_incomplete/);
  assert.equal(AppService.snapshot, old); assert.deepEqual(ids(AppService.local.snapshot().items), ['old']); assert.equal(AppService.syncing, false);
});
test('F6 network failure preserves old snapshots and releases sync lock', async () => {
  const old = syncFixture([new Error('offline')]); await assert.rejects(() => AppService.sync(() => {}), /offline/);
  assert.equal(AppService.snapshot, old); assert.deepEqual(ids(AppService.local.snapshot().items), ['old']); assert.equal(AppService.syncing, false);
});
test('F6 valid multi-page sync commits all items and their membership', async () => {
  syncFixture([{ Items: [film('one')], TotalRecordCount: 2 }, { Items: [film('two')], TotalRecordCount: 2 }]);
  await AppService.sync(() => {}); assert.deepEqual(ids(AppService.local.snapshot().items), ['one', 'two']);
  assert.deepEqual(AppService.snapshot.memberships[0].itemIds, ['one', 'two']); assert.ok(AppService.snapshot.syncedAt > 1);
});
test('F6 a genuinely empty library can commit an empty snapshot', async () => {
  syncFixture([{ Items: [], TotalRecordCount: 0 }]); await AppService.sync(() => {});
  assert.equal(AppService.local.snapshot().items.length, 0); assert.deepEqual(AppService.snapshot.memberships[0].itemIds, []);
});
test('F6 failure in a later library does not commit an earlier library by itself', async () => {
  const old = syncFixture([{ Items: [film('new')], TotalRecordCount: 1 }, new Error('second-library-offline')]);
  AppService.client.libraries = async () => [library('first'), library('second')];
  await assert.rejects(() => AppService.sync(() => {}), /second-library-offline/);
  assert.equal(AppService.snapshot, old); assert.deepEqual(ids(AppService.local.snapshot().items), ['old']);
});
test('F6 snapshot write failure never advances the in-memory success snapshot', async () => {
  const old = syncFixture([{ Items: [film('new')], TotalRecordCount: 1 }]);
  AppService.local.saveSnapshot = () => { throw new Error('disk-full'); };
  await assert.rejects(() => AppService.sync(() => {}), /disk-full/); assert.equal(AppService.snapshot, old); assert.equal(AppService.syncing, false);
});

function corruptLibrary(value) {
  const local = new LocalStore(context, session('a')); fs.writeFileSync(path.join(local.directory, 'library.json'), value); return local;
}
for (const [name, value] of [['bad JSON', '{broken'], ['null', 'null'], ['bad shape', JSON.stringify({ syncedAt: 1, items: {}, actors: [] })],
  ['bad nested People', JSON.stringify({ syncedAt: 1, items: [{ ...film('movie'), People: [null] }], actors: [] })]]) {
  test('F7 ' + name + ' is quarantined and a restored account remains usable', async () => {
    const local = corruptLibrary(value); await SessionStore.save(session('a')); await AppService.initialize(context);
    assert.equal(AppService.client.session.userId, 'a'); assert.equal(AppService.snapshot.items.length, 0); assert.equal(AppService.cacheRecovered, true);
    const backup = fs.readdirSync(local.directory).find(f => f.startsWith('library.json.corrupt-'));
    assert.ok(backup); assert.equal(fs.readFileSync(path.join(local.directory, backup), 'utf8'), value);
    const p = page(); assert.match(p.cacheMessage, /cache_recovered/);
  });
}
test('F7 malformed library does not remove valid completed download metadata or its video', async () => {
  const local = corruptLibrary('{broken'); const video = path.join(local.directory, 'movie.mp4'); fs.writeFileSync(video, 'existing-video');
  local.saveDownloads([{ id: 'movie', item: film('movie'), path: video, state: 'complete', progress: 1 }]);
  await SessionStore.save(session('a')); await AppService.initialize(context);
  assert.equal(AppService.downloads[0].state, 'complete'); assert.equal(fs.readFileSync(video, 'utf8'), 'existing-video');
  assert.equal((await AppService.playback(film('movie'))).offline, true);
});
test('F7 corrupted download metadata is preserved and does not delete any media file', async () => {
  const local = new LocalStore(context, session('a')); const video = path.join(local.directory, 'movie.mp4'); fs.writeFileSync(video, 'existing-video');
  fs.writeFileSync(path.join(local.directory, 'downloads.json'), '{broken'); activate();
  assert.equal(AppService.cacheRecovered, true); assert.equal(AppService.downloads.length, 0); assert.equal(fs.readFileSync(video, 'utf8'), 'existing-video');
  assert.ok(fs.readdirSync(local.directory).some(f => f.startsWith('downloads.json.corrupt-')));
});
test('F7 cached download paths outside the account are quarantined, never acted upon', () => {
  const local = new LocalStore(context, session('a')); const other = path.join(directory, 'outside.mp4'); fs.writeFileSync(other, 'keep');
  local.saveDownloads([{ id: 'movie', item: film('movie'), path: other, state: 'complete', progress: 1 }]);
  activate(); assert.equal(AppService.downloads.length, 0); assert.equal(fs.readFileSync(other, 'utf8'), 'keep'); assert.equal(AppService.cacheRecovered, true);
});
test('F7 quarantine failure retains the original metadata and surfaces a recoverable error', () => {
  const local = corruptLibrary('{broken'); const rename = fileApi.renameSync;
  fileApi.renameSync = () => { throw new Error('read-only'); };
  try {
    assert.throws(() => local.snapshot(), /cache_recovery_failed/);
    assert.equal(fs.readFileSync(path.join(local.directory, 'library.json'), 'utf8'), '{broken');
  } finally { fileApi.renameSync = rename; }
});
test('F7 a fresh login after cache corruption succeeds and keeps the quarantined metadata', async () => {
  const local = corruptLibrary('{broken');
  queue.push(response({ Id: 'server', Version: '10.10.0' }), response({ User: { Id: 'a', Name: 'a' }, AccessToken: 'mock-token' }));
  await AppService.login(session('a').server, 'a', 'mock-password');
  assert.equal(AppService.client.session.userId, 'a'); assert.equal(AppService.cacheRecovered, true);
  assert.ok(fs.readdirSync(local.directory).some(f => f.startsWith('library.json.corrupt-')));
});
test('F7 valid optional null fields remain usable and are not quarantined', () => {
  const local = new LocalStore(context, session('a'));
  local.saveSnapshot(snapshot([{ Id: 'movie', Name: 'Movie', Type: 'Movie', People: null,
    CommunityRating: null, RunTimeTicks: null, SeriesId: null, SeasonId: null, Overview: null, UserData: null }]));
  activate(); assert.equal(AppService.cacheRecovered, false); assert.deepEqual(ids(AppService.snapshot.items), ['movie']);
  assert.equal(fs.readdirSync(local.directory).some(f => f.includes('.corrupt-')), false);
});
test('F6 optional null media fields do not cause a complete sync to be rejected', async () => {
  syncFixture([{ Items: [{ Id: 'movie', Name: 'Movie', Type: 'Movie', People: null,
    UserData: { PlayCount: null, Played: null, IsFavorite: null, PlaybackPositionTicks: null } }], TotalRecordCount: 1 }]);
  await AppService.sync(() => {}); assert.deepEqual(ids(AppService.local.snapshot().items), ['movie']);
});

// Feed parity uses real Index and HomeFeed; methods below represent isolated server responses.
function homeFixture() {
  const client = activate();
  client.resume = async () => [film('continue')];
  client.nextUp = async () => [{ Id: 'next', Name: 'Episode', Type: 'Episode', SeriesId: 'show' }];
  client.libraries = async () => [Object.assign(library('films'), { CollectionType: 'movies' }),
    Object.assign(library('shows'), { CollectionType: 'tvshows' }), Object.assign(library('music'), { CollectionType: 'music' }), library('empty')];
  const scoped = [];
  client.latest = async id => { scoped.push(id); return id === 'empty' ? [] : [film(id + '-latest')]; };
  return { client, scoped };
}
test('home matches resume/next-up/library order, scopes latest and omits unsupported/empty shelves', async () => {
  const { scoped } = homeFixture(); const p = page(); await p.load();
  assert.equal(p.message, ''); assert.deepEqual(Array.from(p.homeSections, s => s.kind), ['resume', 'nextup', 'latest', 'latest']);
  assert.deepEqual(Array.from(p.homeSections, s => s.libraryId), ['', '', 'films', 'shows']);
  assert.deepEqual(scoped, ['films', 'shows', 'empty']); assert.equal(p.total, 2);
  const render = require('./library-grid.test.cjs').createHome(); render.update(p.homeSections);
  assert.deepEqual(render.visible(), ['resume', 'nextup', 'library-films', 'library-shows']);
});
test('home hides empty dynamic sections and exposes a genuine empty result', async () => {
  const { client } = homeFixture(); client.resume = client.nextUp = client.libraries = async () => [];
  const p = page(); await p.load(); assert.equal(p.homeSections.length, 0); assert.equal(p.message, ''); assert.equal(p.busy, false);
});
test('home view-all opens the correct library without a retained search or actor scope', async () => {
  const { client } = homeFixture(); const params = []; client.items = async q => { params.push(q); return { Items: [film('in-library')], TotalRecordCount: 1 }; };
  const p = page({ search: 'old', personId: 'old-person', searchExpanded: true });
  p.openLibrary({ libraryId: 'films', name: 'Movies' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(p.tab, 2); assert.equal(p.mode, 'library'); assert.equal(p.sectionTitle, 'Movies');
  assert.equal(valueOf(params[0], 'ParentId'), 'films'); assert.equal(valueOf(params[0], 'SearchTerm'), undefined);
  assert.equal(valueOf(params[0], 'PersonIds'), undefined); assert.deepEqual(ids(p.items), ['in-library']);
});
for (const fail of [false, true]) test('late home ' + (fail ? 'failure' : 'success') + ' cannot repopulate a different account', async () => {
  const { client } = homeFixture(), d = deferred(); client.latest = () => d.promise;
  const p = page(); const pending = p.load(); await new Promise(resolve => setImmediate(resolve));
  activate('b'); p.resetAccountState();
  if (fail) d.reject(new Error('late-error')); else d.resolve([film('private-a')]);
  await pending; assert.equal(p.homeSections.length, 0); assert.equal(p.items.length, 0); assert.equal(p.message, '');
});
test('switching away while home requests run discards the previous feed', async () => {
  const { client } = homeFixture(), d = deferred(); client.latest = () => d.promise;
  const p = page(); const pending = p.load(); await new Promise(resolve => setImmediate(resolve));
  p.switchTab(3); d.resolve([film('late')]); await pending;
  assert.equal(p.homeSections.length, 0); assert.equal(p.tab, 3); assert.equal(p.searchExpanded, false);
});
test('offline home uses membership and cached labels instead of inventing latest or next-up order', async () => {
  const { client } = homeFixture(); client.resume = client.nextUp = client.libraries = client.latest = async () => { throw new Error('offline'); };
  AppService.snapshot = snapshot([film('a'), film('b')], [library('films'), library('shows')],
    [{ libraryId: 'films', itemIds: ['a'] }, { libraryId: 'shows', itemIds: ['b'] }]);
  const p = page(); await p.load(); assert.equal(p.usingCache, true);
  assert.deepEqual(Array.from(p.homeSections, s => s.kind), ['cached', 'cached']);
  assert.deepEqual(Array.from(p.homeSections, s => ids(s.items)), [['a'], ['b']]);
});
test('old offline snapshots remain visible in a single cached home shelf', async () => {
  const { client } = homeFixture(); client.resume = client.nextUp = client.libraries = client.latest = async () => { throw new Error('offline'); };
  AppService.snapshot = snapshot([film('legacy')]); const p = page(); await p.load();
  assert.equal(p.homeSections.length, 1); assert.equal(p.homeSections[0].libraryId, ''); assert.deepEqual(ids(p.homeSections[0].items), ['legacy']);
});
test('a failed shelf retains successful home sections and reports independent failures', async () => {
  const { client } = homeFixture(); client.latest = async () => { throw new Error('latest-failed'); };
  const p = page(); await p.load(); assert.ok(p.homeFailures.some(f => f.message === 'latest-failed')); assert.ok(p.homeSections.some(s => s.id === 'resume')); assert.ok(p.homeSections.some(s => s.id === 'nextup')); assert.equal(p.busy, false);
});

module.exports = { ts, capabilities, assets, load, platform, context, directory, activate, page, reset, deferred, film, library, snapshot, response, queue, requests, setRoute: value => { routeParams = value; } };
if (require.main === module) (async () => {
  try {
    for (const [name, fn] of tests) { reset(); await fn(); console.log('PASS ' + name); }
    console.log(tests.length + ' feature regression tests passed. Platform mocks/page methods do not prove rendered UI, device APIs or real Jellyfin.');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
