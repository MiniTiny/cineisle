// Actual ArkTS services/page methods + real filesystem/PBKDF2 behind explicit SDK fixtures.
// No native download, lockscreen or real-server claim is made by this harness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const h = require('./feature-regression.test.cjs');
const { AppService } = h.load('service/AppService.ets');
const { ExperienceState, actorProfiles, sortActors, filterFavorites, favoriteGenres, discovery, connectionFailure, applyPending } = h.load('utils/Experience.ts');
const { ExperienceStore } = h.load('service/ExperienceStore.ets');
const { LocalStore } = h.load('service/LocalStore.ets');
const { ProgressiveHome } = h.load('service/ProgressiveHome.ets');
const { AppLock } = h.load('service/AppLock.ets');
const { PersistentDownload } = h.load('service/PersistentDownload.ets');
const { BackgroundLease } = h.load('service/BackgroundLease.ets');
const { loadDetail } = h.load('service/DetailData.ets');
global.Scroller = class { scrollTo() {} };
const { Favorites } = h.load('pages/Favorites.ets');
const { Actor } = h.load('pages/Actor.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const actor = { Id: 'person', Name: 'Actor', Type: 'Actor', Role: 'Detective' };
const film = (id, extra = {}) => ({ Id: id, Name: id, Type: 'Movie', People: [actor], ...extra });
const filter = extra => ({ category: '', genre: '', query: '', unwatched: false, order: 'name', ...extra });
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
function state() { return AppService.experience.snapshot(); }
function configure(fn) { AppService.experience.update(fn); }
function localAccount() { h.activate(); return AppService.local; }

for (const genre of ['Crime', '犯罪']) test('actor genre alias: ' + genre, () => {
  const items = [film('a', { Genres: [genre] }), film('b', { Genres: ['Crime'] }), film('c', { Genres: ['犯罪'] })];
  const value = actorProfiles(items)[0]; assert.equal(value.tags[0].key, 'genre:crime'); assert.equal(value.tags[0].works.length, 3);
});
test('actor deduplicates works/cast, counts series once and excludes episode credit', () => {
  const a = film('a', { People: [actor, actor], UserData: { Played: true, PlayCount: 3, IsFavorite: true } });
  const p = actorProfiles([a, a, film('show', { Type: 'Series' }), film('episode', { Type: 'Episode' })])[0];
  assert.equal(p.works.length, 2); assert.deepEqual([p.watched, p.unplayed, p.favorite, p.playCount], [1, 1, 1, 3]);
});
test('actor tags require three distinct works and 35 percent; drama is suppressed', () => {
  const values = Array.from({ length: 10 }, (_, i) => film('m-' + i, { Genres: i < 3 ? ['crime', 'drama'] : ['drama'] }));
  assert.equal(actorProfiles(values)[0].tags.length, 0); values[3].Genres.push('犯罪'); assert.equal(actorProfiles(values)[0].tags[0].works.length, 4);
});
test('theme evidence is based on overviews and never creates a role or personality', () => {
  const p = actorProfiles(['a', 'b', 'c'].map(id => film(id, { People: [{ ...actor, Role: undefined }], Overview: 'A detective investigation.' })))[0];
  assert.equal(p.tags[0].key, 'theme:investigation'); assert.equal(p.tags[0].works.length, 3); assert.equal(p.person.Role, undefined);
});
test('actor follow new count and acknowledgement use distinct work IDs', () => {
  const values = [film('a'), film('b'), film('c')]; assert.equal(actorProfiles(values, [{ id: 'person', acknowledged: ['a'] }])[0].newCount, 2);
  assert.equal(actorProfiles(values, [{ id: 'person', acknowledged: ['a', 'b', 'c'] }])[0].newCount, 0);
});
for (const order of ['playCount', 'watched', 'unplayed', 'works', 'recent', 'name', 'recommended']) test('actor sort has stable name/ID ties: ' + order, () => {
  const profiles = actorProfiles([film('a', { People: [{ ...actor, Id: 'z' }] }), film('b', { People: [{ ...actor, Id: 'a' }] })]);
  assert.deepEqual(sortActors(profiles, order, '', '', false).map(p => p.person.Id), ['a', 'z']);
});
test('actor filtering combines name, evidence tag and follow state', () => {
  const p = actorProfiles(['a', 'b', 'c'].map(id => film(id, { Genres: ['crime'] })), [{ id: 'person', acknowledged: [] }]);
  assert.equal(sortActors(p, 'name', 'ACT', 'genre:crime', true).length, 1); assert.equal(sortActors(p, 'name', 'missing', '', true).length, 0);
});
test('discovery combines followed actor and favorite bilingual genre, deduplicates and caps at 30', () => {
  const values = Array.from({ length: 45 }, (_, i) => film('m-' + i, { Genres: ['犯罪'], DateCreated: '2026-10-10T00:00:00Z' }));
  values[0].UserData = { Played: true }; const ranked = discovery([...values, values[1]], [film('signal', { Genres: ['Crime'], UserData: { IsFavorite: true } })], [{ id: 'person', acknowledged: [] }]);
  assert.equal(ranked.length, 30); assert.equal(ranked[0].score, 6); assert.equal(new Set(ranked.map(r => r.item.Id)).size, 30); assert.ok(ranked.every(r => r.item.Id !== 'm-0'));
});
test('favorite genres do not infer series genre from episode data', () => { assert.deepEqual(favoriteGenres([film('a', { Genres: ['Crime'] }), film('e', { Type: 'Episode', Genres: ['Fake'] })], ''), ['Crime']); });
test('favorite combinations search original and series titles, isolate episode genre', () => {
  const items = [film('a', { OriginalTitle: 'ORIGINAL', Genres: ['Crime'] }), film('e', { Type: 'Episode', SeriesName: 'Series title', Genres: ['Crime'] })];
  assert.deepEqual(filterFavorites(items, filter({ query: 'original', genre: 'crime' })).map(i => i.Id), ['a']);
  assert.deepEqual(filterFavorites(items, filter({ query: 'series', category: 'Episode' })).map(i => i.Id), ['e']);
  assert.equal(filterFavorites(items, filter({ category: 'Episode', genre: 'Crime' })).length, 0);
});
test('favorite continue-first orders unfinished progress ahead of unplayed and played', () => {
  const items = [film('a', { UserData: { Played: true, PlaybackPositionTicks: 100 } }), film('b'), film('c', { UserData: { PlaybackPositionTicks: 50 } })];
  assert.deepEqual(filterFavorites(items, filter({ order: 'continue' })).map(i => i.Id), ['c', 'b', 'a']);
  assert.deepEqual(filterFavorites(items, filter({ order: 'nameDesc' })).map(i => i.Id), ['c', 'b', 'a']);
});
test('favorites fetches all 1506 items across eight pages with exact offsets', async () => {
  const client = h.activate(); const offsets = []; const values = Array.from({ length: 1506 }, (_, i) => film('m-' + i, { UserData: { IsFavorite: true } }));
  client.items = async params => { const start = Number(params.find(p => p.key === 'StartIndex').value); offsets.push(start); return { Items: values.slice(start, start + 200), TotalRecordCount: 1506 }; };
  const p = new Favorites(); p.client = client; await p.refresh(); assert.equal(p.all.length, 1506); assert.equal(p.preview, false); assert.deepEqual(offsets, [0, 200, 400, 600, 800, 1000, 1200, 1400]);
});
for (const response of [{ Items: [], TotalRecordCount: 1 }, { Items: [film('a'), film('a')], TotalRecordCount: 2 }, { Items: [film('a')], TotalRecordCount: NaN }]) test('complete pagination rejects missing/duplicate/invalid page ' + JSON.stringify(response), async () => {
  h.activate().items = async () => response; await assert.rejects(AppService.allItems([]), /sync_incomplete/);
});
test('favorites persists combined filters across cold store reconstruction and account isolation', () => {
  const local = localAccount(); configure(s => { s.favoriteCategory = 'Series'; s.favoriteQuery = 'name'; s.favoriteUnwatched = true; s.favoriteOrder = 'continue'; });
  assert.equal(new ExperienceStore(local).snapshot().favoriteOrder, 'continue'); h.activate('b'); assert.equal(state().favoriteQuery, '');
});
test('batch unfavorite/undo only affects confirmed successes and leaves failed items', async () => {
  const client = h.activate(); client.favorite = async id => { if (id === 'b') throw Error('permission_denied'); };
  const p = new Favorites(); p.client = client; p.all = ['a', 'b'].map(id => film(id, { UserData: { IsFavorite: true } }));
  await p.batch([...p.all], false); assert.deepEqual(p.all.map(i => i.Id), ['b']); assert.deepEqual(p.undoItems.map(i => i.Id), ['a']);
  await p.batch(p.undoItems, true); assert.deepEqual(p.all.map(i => i.Id).sort(), ['a', 'b']); assert.equal(p.undoItems.length, 0);
});
test('batch response after account change cannot update view or undo state', async () => {
  const client = h.activate(), pending = h.deferred(); client.favorite = () => pending.promise;
  const p = new Favorites(); p.client = client; p.all = [film('a')]; const op = p.batch(p.all, false); h.activate('b'); pending.resolve(); await op; assert.equal(p.all.length, 1); assert.equal(p.undoItems.length, 0);
});
test('home publishes cache and independent success before a stalled next-up; retries only failed shelf', async () => {
  const stall = h.deferred(); let calls = 0, fail = true; const publications = [];
  const client = { resume: async () => [film('resume')], nextUp: () => stall.promise, libraries: async () => [h.library('a')], latest: async () => { calls++; if (fail) throw Error('offline'); return [film('latest')]; } };
  const loader = new ProgressiveHome(client, value => publications.push(value)); const complete = loader.start([{ id: 'resume', kind: 'resume', name: '', libraryId: '', items: [film('cached')] }]);
  await settle(); assert.equal(publications[0].sections[0].items[0].Id, 'cached'); assert.ok(publications.some(v => v.sections[0]?.items[0].Id === 'resume' && v.busy));
  fail = false; loader.retry('library-a'); await settle(); stall.resolve([]); await complete; assert.equal(calls, 2); assert.equal(publications.at(-1).failures.length, 0);
});
test('home initial requests and retries share four slots', async () => {
  let active = 0, maximum = 0; const pending = [];
  const latest = () => { active++; maximum = Math.max(maximum, active); const d = h.deferred(); pending.push(d); return d.promise.finally(() => active--); };
  const loader = new ProgressiveHome({ resume: async () => [], nextUp: async () => [], libraries: async () => Array.from({ length: 9 }, (_, i) => h.library('l-' + i)), latest }, () => {});
  const op = loader.start([]); await settle(); assert.equal(pending.length, 4);
  while (pending.length) { pending.splice(0).forEach(d => d.resolve([film('a')])); await settle(); } await op; assert.equal(maximum, 4);
});
for (const error of ['permission_denied', 'login_expired']) test('home clears all preview and ignores late completions on ' + error, async () => {
  const late = h.deferred(), updates = []; const loader = new ProgressiveHome({ resume: async () => { throw Error(error); }, nextUp: () => late.promise, libraries: async () => [] }, value => updates.push(value));
  await loader.start([{ id: 'resume', kind: 'resume', name: '', libraryId: '', items: [film('private')] }]); const count = updates.length; late.resolve([film('late')]); await settle(); assert.equal(updates.length, count); assert.equal(updates.at(-1).sections.length, 0);
});
test('home page cancellation rejects late publications', async () => {
  const d = h.deferred(), updates = []; const loader = new ProgressiveHome({ resume: () => d.promise, nextUp: async () => [], libraries: async () => [] }, value => updates.push(value));
  const op = loader.start([]); loader.cancel(); const count = updates.length; d.resolve([film('late')]); await op; await settle(); assert.equal(updates.length, count);
});
test('actor works render before biography and scoped online fallback excludes episode duplication', async () => {
  const client = h.activate(), bio = h.deferred(); client.detail = () => bio.promise;
  client.items = async params => { assert.equal(params.find(p => p.key === 'PersonIds').value, 'person'); assert.equal(params.find(p => p.key === 'IncludeItemTypes').value, 'Movie,Series'); return { Items: [film('a'), film('show', { Type: 'Series' })], TotalRecordCount: 2 }; };
  const p = new Actor(); p.person = actor; p.client = client; const op = p.refresh(); await settle(); assert.equal(p.works.length, 2); assert.equal(p.busy, false); assert.equal(p.biographyLoading, true);
  bio.resolve({ Id: 'person', Name: 'Actor', Overview: 'Biography', Type: 'Person' }); await op; assert.equal(p.overview, 'Biography');
});
test('actor cached works avoid catalog request; opening acknowledges followed new works', async () => {
  const client = h.activate(); AppService.snapshot.items = [film('a'), film('b')]; configure(s => s.follows = [{ id: 'person', acknowledged: ['a'] }]); client.detail = async () => film('person'); client.items = async () => { throw Error('must use scoped cache'); };
  const p = new Actor(); p.person = actor; p.client = client; await p.refresh(); assert.equal(p.works.length, 2); assert.deepEqual(state().follows[0].acknowledged, ['a', 'b']);
});
test('actor permission rejection clears cached works and late biography', async () => {
  const client = h.activate(); AppService.snapshot.items = [film('a')]; client.detail = async () => { throw Error('permission_denied'); };
  const p = new Actor(); p.person = actor; p.client = client; await p.refresh(); assert.equal(p.works.length, 0); assert.equal(p.overview, '');
});
test('recent search deduplicates case and bounds 20; saved navigation is account-scoped', () => {
  localAccount(); for (let i = 0; i < 25; i++) AppService.experience.search('q-' + i); AppService.experience.search('Q-24'); configure(s => s.tab = 3);
  assert.equal(state().searches.length, 20); assert.equal(state().searches[0], 'Q-24'); assert.equal(h.page().tab, 3); h.activate('b'); assert.equal(h.page().tab, 1);
});
test('offline edits survive cold reconstruction even if catalog save failed', async () => {
  localAccount(); const original = AppService.local.saveSnapshot; AppService.local.saveSnapshot = () => { throw Error('disk full'); };
  await assert.rejects(AppService.edit(film('a'), true, true, true), /disk full/); AppService.local.saveSnapshot = original;
  h.activate(); assert.equal(state().pending.length, 1); assert.equal(AppService.snapshot.items[0].UserData.IsFavorite, true);
});
test('outbox stale acknowledgement cannot remove a newer revision, even with identical value', async () => {
  const client = h.activate(); await AppService.edit(film('a'), true, true, true); const before = state().pending[0].revision;
  const d = h.deferred(); client.favorite = () => d.promise; const flushing = AppService.flushPending(); await settle(); await AppService.edit(film('a'), true, true, true); d.resolve(); await flushing;
  assert.equal(state().pending.length, 1); assert.ok(state().pending[0].revision > before);
});
test('outbox confirms successes and retains network failure plus subsequent edits', async () => {
  const client = h.activate(); await AppService.edit(film('a'), true, true, true); await AppService.edit(film('b'), false, true, true); client.favorite = async () => {}; client.played = async () => { throw Error('network_failed'); };
  await AppService.flushPending(); assert.deepEqual(state().pending.map(p => p.id), ['b']);
});
for (const message of ['permission_denied', 'login_expired', 'api_response_invalid', 'cache_write_failed']) test('invalid/security error never becomes offline success: ' + message, async () => {
  const client = h.activate(); client.favorite = async () => { throw Error(message); }; client.detail = async () => { throw Error(message); }; AppService.snapshot.items = [film('a')];
  assert.equal(connectionFailure(Error(message)), false); await assert.rejects(AppService.edit(film('a'), true, true), new RegExp(message)); await assert.rejects(loadDetail(client, 'a'), new RegExp(message)); assert.equal(state().pending.length, 0);
});
test('explicit offline mode makes no HTTP calls and only plays completed downloads', async () => {
  const client = h.activate(); configure(s => s.offline = true); AppService.snapshot = h.snapshot([film('a')]); client.detail = async () => { throw Error('must not access network'); }; client.favorite = client.detail;
  const result = await loadDetail(client, 'a'); assert.equal(result.offline, true); assert.equal(await AppService.edit(film('a'), true, true), true); await assert.rejects(AppService.playback(film('a')), /next_not_downloaded/); await assert.rejects(AppService.sync(() => {}), /offline_mode_enabled/);
});
test('cancelled sync never replaces catalog or touches download files', async () => {
  const client = h.activate(), d = h.deferred(); client.libraries = async () => [h.library('a')]; client.items = () => d.promise; AppService.snapshot = h.snapshot([film('old')]);
  const op = AppService.sync(() => {}); await settle(); AppService.cancelSync(); d.resolve({ Items: [film('new')], TotalRecordCount: 1 }); await assert.rejects(op, /sync_cancelled/); assert.equal(AppService.snapshot.items[0].Id, 'old'); assert.equal(AppService.syncing, false);
});

const assetValues = new Map(); const asset = h.platform.get('@ohos.security.asset'); Object.assign(asset, { Tag: { ALIAS: 'alias', SECRET: 'secret', RETURN_TYPE: 'return', ACCESSIBILITY: 'access', CONFLICT_RESOLUTION: 'conflict' }, ReturnType: { ALL: 1 }, Accessibility: { DEVICE_UNLOCKED: 1 }, ConflictResolution: { OVERWRITE: 1 },
  query: async query => assetValues.has(Buffer.from(query.get('alias')).toString()) ? [new Map([['secret', assetValues.get(Buffer.from(query.get('alias')).toString())]])] : [],
  add: async attrs => assetValues.set(Buffer.from(attrs.get('alias')).toString(), attrs.get('secret')), remove: async attrs => assetValues.delete(Buffer.from(attrs.get('alias')).toString()) });
test('app lock stores random salt/hash, cold-locks, verifies PIN and requires current PIN for changes', async () => {
  h.platform.set('@ohos.security.asset', asset); assetValues.clear(); await AppLock.initialize(); assert.equal(AppLock.locked, false); await AppLock.configure('', '123456');
  const raw = Buffer.from(assetValues.values().next().value).toString(); assert.ok(!raw.includes('123456')); assert.equal(JSON.parse(raw).hash.length, 32); await AppLock.initialize(); assert.equal(AppLock.locked, true); assert.equal(await AppLock.unlock('000000'), false); assert.equal(await AppLock.unlock('123456'), true);
  await assert.rejects(AppLock.configure('wrong', '654321'), /lock_pin_wrong/); await AppLock.configure('123456', '654321'); const changed = Buffer.from(assetValues.values().next().value).toString(); assert.notEqual(JSON.parse(changed).salt.join(), JSON.parse(raw).salt.join()); await AppLock.configure('654321', ''); assert.equal(assetValues.size, 0);
});
test('app lock storage read/write failures fail closed and never disable existing lock', async () => {
  h.platform.set('@ohos.security.asset', asset); assetValues.clear(); await AppLock.initialize(); await AppLock.configure('', '123456'); const add = asset.add; asset.add = async () => { throw Error('storage unavailable'); };
  await assert.rejects(AppLock.configure('123456', '654321')); asset.add = add; assert.equal(await AppLock.verify('123456'), true);
  const query = asset.query; asset.query = async () => { throw Error('storage unavailable'); }; await assert.rejects(AppLock.initialize(), /lock_storage_failed/); assert.equal(AppLock.permit(), false); assert.equal(await AppLock.unlock('123456'), false); asset.query = query;
});
test('app lock relocks after 15 background minutes and throttles repeated wrong PIN', async () => {
  h.platform.set('@ohos.security.asset', asset); assetValues.clear(); AppLock.blockedUntil = 0; await AppLock.initialize(); await AppLock.configure('', '123456');
  const original = Date.now; let now = original(); Date.now = () => now;
  try { AppLock.background(); now += 14 * 60000; AppLock.foreground(); assert.equal(AppLock.locked, false); AppLock.background(); now += 15 * 60000; AppLock.foreground(); assert.equal(AppLock.locked, true); for (let i = 0; i < 5; i++) await AppLock.verify('000000'); assert.equal(await AppLock.unlock('123456'), false); now += 30001; assert.equal(await AppLock.unlock('123456'), true); } finally { Date.now = original; }
});
test('native HTTP connection error is classified and permission remains distinct', async () => {
  const client = h.activate(); h.queue.push(Object.assign(Error('native failure'), { code: 2300007 })); await assert.rejects(client.detail('a'), /network_failed/); h.queue.push({ responseCode: 403, result: '' }); await assert.rejects(client.detail('a'), /permission_denied/);
});
test('persistent download restores OS running/complete state and ignores old-account event', async () => {
  const record = { id: 'a', item: film('a'), path: h.directory + '/a.mp4', state: 'downloading', progress: 0, agentId: '42' }, handlers = {}; let owned = true, saves = 0;
  h.platform.get('@ohos.request').agent = { State: { COMPLETED: 64, FAILED: 65, STOPPED: 49, REMOVED: 80 }, show: async () => ({ progress: { state: 32, processed: 50, sizes: [100] } }), getTask: async () => ({ on: (name, fn) => { handlers[name] = fn; } }) };
  await PersistentDownload.restore(h.context, record, () => owned, () => saves++); assert.equal(record.progress, .5); assert.ok(handlers.completed);
  owned = false; handlers.completed({ state: 64, processed: 100, sizes: [100] }); assert.equal(record.state, 'downloading'); owned = true; fs.writeFileSync(record.path, 'fixture'); handlers.completed({ state: 64, processed: 100, sizes: [100] }); assert.equal(record.state, 'complete'); assert.equal(saves, 2);
});
test('shared background lease retains audio when synchronization is released', async () => {
  const calls = []; BackgroundLease.modes.clear(); BackgroundLease.operations = Promise.resolve();
  Object.assign(h.platform.get('@ohos.resourceschedule.backgroundTaskManager'), { BackgroundMode: { AUDIO_PLAYBACK: 2, DATA_TRANSFER: 1 }, startBackgroundRunning: async (context, modes) => calls.push(modes), stopBackgroundRunning: async () => calls.push('stop') });
  Object.assign(h.platform.get('@ohos.app.ability.wantAgent'), { OperationType: { START_ABILITY: 1 }, WantAgentFlags: { UPDATE_PRESENT_FLAG: 4 }, getWantAgent: async () => ({}) });
  const ctx = { abilityInfo: { bundleName: 'com.cineisle.app', name: 'EntryAbility' } };
  await BackgroundLease.set(ctx, 2, true); await BackgroundLease.set(ctx, 1, true); await BackgroundLease.set(ctx, 1, false); assert.deepEqual(calls, [2, ['audioPlayback', 'dataTransfer'], 2]); await BackgroundLease.set(ctx, 2, false); assert.equal(calls.at(-1), 'stop');
});

test('offline progress survives cold reconstruction and overlays a later online response', async () => {
  const client = h.activate(); const item = film('a', { UserData: { IsFavorite: true } }); AppService.recordOfflinePosition(item, 12345); h.activate();
  assert.equal(AppService.snapshot.items[0].UserData.PlaybackPositionTicks, 123450000); const current = AppService.client; current.detail = async () => item;
  const result = await loadDetail(current, 'a'); assert.equal(result.item.UserData.PlaybackPositionTicks, 123450000); assert.equal(result.item.UserData.IsFavorite, true);
});
test('offline completion keeps zero position and played edit; response confirms only matching position revision', async () => {
  const client = h.activate(); const item = film('a', { UserData: { PlaybackPositionTicks: 9999 } }); AppService.recordOfflinePosition(item, 12345, true); await AppService.edit(item, false, true, true);
  assert.equal(AppService.snapshot.items[0].UserData.PlaybackPositionTicks, 0); const d = h.deferred(); client.offlinePosition = () => d.promise; client.played = async () => {};
  const op = AppService.flushPending(); await settle(); AppService.recordOfflinePosition(item, 33333); d.resolve(); await op; assert.equal(state().positions.length, 1); assert.equal(state().pending.length, 0);
});
test('download retry preserves a failed record and reason if replacement creation fails', async () => {
  const client = h.activate(); const record = { id: 'a', item: film('a'), path: AppService.local.directory + '/a.mp4', state: 'failed', progress: 0, mediaSourceId: 'removed' }; AppService.downloads = [record];
  client.detail = async () => film('a', { CanDownload: true }); client.playbackInfo = async () => { throw Error('no_download_source'); };
  await assert.rejects(AppService.retryDownload(record), /no_download_source/); assert.equal(AppService.downloads.length, 1); assert.equal(AppService.downloads[0].failure, 'no_download_source');
});
test('season queues all 120 items durably while starting at most four', async () => {
  const client = h.activate(), api = h.platform.get('@ohos.request'); api.downloadFile = async () => ({ on() {}, delete: async () => true });
  client.detail = async id => film(id, { Type: 'Episode', CanDownload: true }); client.playbackInfo = async () => ({ MediaSources: [{ Id: 'source', Container: 'mp4' }] }); client.stream = () => 'https://example.invalid/fixture';
  const chosen = Array.from({ length: 120 }, (_, i) => film('e-' + i, { Type: 'Episode', CanDownload: true }));
  assert.equal((await AppService.batchDownload(chosen)).length, 0); assert.equal(AppService.downloads.filter(r => r.state === 'downloading').length, 4); assert.equal(AppService.downloads.filter(r => r.state === 'queued').length, 116); assert.equal(AppService.local.downloads().length, 120);
});
test('lock rejects queued AVSession play before and after asynchronous session initialization', async () => {
  // Use real SystemPlayback from the explicit AVPlayer harness; gate races cannot be checked by metadata alone.
  const p = require('./player-regression.test.cjs'); p.reset(); const { AppLock: lock } = p.load('service/AppLock.ets'); const { SystemPlayback } = p.load('service/SystemPlayback.ets'); const { PlaybackController } = p.load('service/PlaybackController.ets');
  const c = new PlaybackController(undefined, { state() {}, time() {}, tracks() {}, subtitle() {}, error() {}, reportError() {}, complete() {} });
  const s = new SystemPlayback(p.systemPlatform.context, c, {}, p.route(), { changed() {}, error() {}, next: async () => {}, stopped() {} });
  lock.locked = true; assert.equal(await s.permitPlay(), false); lock.locked = false; const wait = p.deferred(); p.systemPlatform.sessionWait = wait.promise; const op = s.permitPlay(); lock.locked = true; wait.resolve(); assert.equal(await op, false); await s.dispose(); lock.locked = false;
});
test('all seven speeds reach native enums and survive reopening a source', async () => {
  const p = require('./player-regression.test.cjs'); p.reset(); const { c } = p.rig(); await c.open(p.route(), 'surface'); await p.settle();
  for (const speed of [.5, .75, 1, 1.25, 1.5, 1.75, 2]) { c.setSpeed(speed); assert.equal(c.snapshot().speed, speed); assert.notEqual(p.nativePlayers[0].calls.at(-1)[1], undefined); }
  await c.open(p.route(), 'other'); await p.settle(); assert.equal(c.snapshot().speed, 2); await c.close();
});
test('control lock blocks back until explicitly unlocked', () => { const p = require('./player-regression.test.cjs'); p.reset(); const page = new p.Player(); page.controlsLocked = true; assert.equal(page.onBackPress(), true); page.controlsLocked = false; assert.equal(page.onBackPress(), false); });
test('persistent terminal completion ignores a late native failure', async () => {
  const api = h.platform.get('@ohos.request'), handlers = {}; const record = { id: 'a', item: film('a'), path: h.directory + '/complete.mp4', agentId: '42', state: 'downloading', progress: 0 };
  api.agent = { State: { COMPLETED: 64, FAILED: 65 }, show: async () => ({ progress: { state: 32, processed: 0, sizes: [100] } }), getTask: async () => ({ on: (name, fn) => { handlers[name] = fn; } }) };
  await PersistentDownload.restore(h.context, record, () => true, () => {}); fs.writeFileSync(record.path, 'fixture'); handlers.completed({ state: 64, processed: 100, sizes: [100] }); handlers.failed({ state: 65, processed: 0, sizes: [100] }); assert.equal(record.state, 'complete'); assert.equal(record.progress, 1);
});
test('checkbox state callbacks are idempotent after select-all publication', () => { const p = new Favorites(); p.selected = ['a', 'b']; p.select('a', true); p.select('b', true); assert.deepEqual(p.selected, ['a', 'b']); p.select('a', false); p.select('a', false); assert.deepEqual(p.selected, ['b']); });
test('restored genre survives an empty cache and partial preview until complete refresh', () => { const p = new Favorites(); p.genre = 'Crime'; p.preview = true; p.all = []; p.filter(false); assert.equal(p.genre, 'Crime'); p.all = [film('a', { Genres: ['Crime'] })]; p.preview = false; p.filter(false); assert.equal(p.genre, 'Crime'); });
test('download metadata write failure cancels the native task before publishing it', async () => {
  const client = h.activate(); let deleted = 0; h.platform.get('@ohos.request').downloadFile = async () => ({ on() {}, delete: async () => { deleted++; return true; } });
  client.playbackInfo = async () => ({ MediaSources: [{ Id: 'source', Container: 'mp4' }] }); client.stream = () => 'https://example.invalid/fixture';
  AppService.local.saveDownloads = () => { throw Error('disk full'); };
  await assert.rejects(AppService.download(film('a', { CanDownload: true })), /download_create_failed/); assert.equal(deleted, 1); assert.equal(AppService.downloads.length, 0); assert.equal(AppService.tasks.size, 0);
});
test('batch queue disk failure publishes no undurable tasks or records', async () => {
  h.activate(); AppService.local.saveDownloads = () => { throw Error('disk full'); }; await assert.rejects(AppService.batchDownload([film('a', { CanDownload: true })]), /disk full/); assert.equal(AppService.downloads.length, 0);
});
test('late online acknowledgement cannot remove or overwrite a newer offline intent', async () => {
  const client = h.activate(), d = h.deferred(); client.favorite = () => d.promise; const op = AppService.edit(film('a'), true, false); await settle(); await AppService.edit(film('a'), true, true, true); d.resolve(); await op;
  assert.equal(state().pending[0].value, true); assert.equal(AppService.snapshot.items[0].UserData.IsFavorite, true);
});
test('online writes for the same field serialize in user intent order', async () => {
  const client = h.activate(), d = h.deferred(), calls = []; client.favorite = async (id, value) => { calls.push(value); if (!value) await d.promise; };
  const first = AppService.edit(film('a'), true, false); await settle(); const second = AppService.edit(film('a'), true, true); await settle(); assert.deepEqual(calls, [false]); d.resolve(); await Promise.all([first, second]); assert.deepEqual(calls, [false, true]); assert.equal(state().pending.length, 0); assert.equal(AppService.snapshot.items[0].UserData.IsFavorite, true);
});
test('a failed intent checkpoint sends no server mutation', async () => {
  const client = h.activate(); let calls = 0; client.favorite = async () => { calls++; }; AppService.local.saveExperience = () => { throw Error('disk full'); }; await assert.rejects(AppService.edit(film('a'), true, true), /disk full/); assert.equal(calls, 0); assert.equal(state().pending.length, 0);
});
(async () => { for (const [name, fn] of tests) { h.reset(); await fn(); await settle(); console.log('PASS ' + name); } console.log(`${tests.length} actor-baseline regressions passed. Native UI, Asset, OS transfer and decoding require separate evidence.`); })().catch(e => { console.error(e); process.exitCode = 1; });
