// Execute product queries, account persistence, download files and player/page state machines.
// Network, AVPlayer and OS transfer APIs are explicit fixtures; no device decoding claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./feature-regression.test.cjs');
const { AppService } = h.load('service/AppService.ets');
const { JellyfinClient } = h.load('service/JellyfinClient.ets');
const { LocalStore } = h.load('service/LocalStore.ets');
const { ExperienceState, validExperience } = h.load('utils/Experience.ts');
const { validDownloads } = h.load('utils/Cache.ts');
const { browseParams, cachedItems, librarySortFields } = h.load('utils/Browse.ts');
const { OfflineSubtitles } = h.load('service/OfflineSubtitles.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const film = (id, extra = {}) => ({ ...h.film(id), ...extra });
const ids = values => values.map(v => v.Id);
const srt = '1\n00:00:01,000 --> 00:00:03,000\n离线字幕\n';
const ass = '[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\b1}离线 ASS\n';
const documentFor = index => index === 8 ? ass : srt;
const source = () => ({ Id: 'source', Container: 'mp4', MediaStreams: [
  { Type: 'Subtitle', Index: 7, IsExternal: true, Codec: 'srt', Language: 'zho', DisplayTitle: '中文' },
  { Type: 'Subtitle', Index: 8, IsExternal: true, Codec: 'ass', Language: 'eng' },
  { Type: 'Subtitle', Index: 9, IsExternal: false, Codec: 'srt' },
  { Type: 'Subtitle', Index: 10, IsExternal: true, Codec: 'hdmv_pgs_subtitle' }
] });
function transfer(client) {
  const callbacks = {}; let created = 0;
  h.platform.get('@ohos.request').downloadFile = async (_context, options) => {
    created++; fs.writeFileSync(options.filePath, 'synthetic video bytes');
    return { on: (name, cb) => { callbacks[name] = cb; }, delete: async () => true };
  };
  client.playbackInfo = async () => ({ MediaSources: [source()] });
  client.stream = () => 'https://example.invalid/synthetic'; client.subtitle = async (_i, _s, index) => documentFor(index);
  return { callbacks, created: () => created };
}
function legacyRecord() {
  const client = h.activate(); const record = { id: 'movie', item: film('movie'), mediaSourceId: 'source', path: path.join(AppService.local.directory, 'movie.mp4'), state: 'complete', progress: 1 };
  fs.writeFileSync(record.path, 'synthetic'); AppService.downloads = [record]; AppService.local.saveDownloads([record]);
  return { client, record };
}
for (const version of ['10.8.13', '10.10.0']) test(version + ' recommendation query filters unplayed on server before its 200-item limit', async () => {
  const client = h.activate(); client.api.setServerVersion(version);
  h.queue.push(h.response({ Items: [film('older', { UserData: { Played: false } })], TotalRecordCount: 1 }));
  assert.deepEqual(ids(await client.discoveryCandidates()), ['older']); const url = new URL(h.requests.at(-1).url);
  assert.equal(url.searchParams.get('filters'), 'IsUnplayed'); assert.equal(url.searchParams.get('limit'), '200');
  assert.equal(url.searchParams.get('userId') ?? (url.pathname.includes('/a/') ? 'a' : ''), 'a');
});
test('actual recommendation page still removes local pending watched items and rejects a late old-account response', async () => {
  const client = h.activate(); AppService.experience.update(s => { s.pending = [{ id: 'a', field: 'played', value: true, revision: 1 }]; });
  client.discoveryCandidates = async () => [film('a'), film('b')]; const page = h.page({ tab: 0 }); await page.load(); assert.deepEqual(ids(page.items), ['b']);
  const gate = h.deferred(); client.discoveryCandidates = () => gate.promise; const waiting = page.load(); h.activate('b'); gate.resolve([film('old')]); await waiting;
  assert.ok(!ids(page.items).includes('old'));
});
for (const field of librarySortFields) for (const descending of [false, true]) test('library sort query ' + field + '/' + descending + ' preserves scope and wire mapping', async () => {
  const client = h.activate(); const params = browseParams('library', '', 'lib', '', field, descending);
  h.queue.push(h.response({ Items: [], TotalRecordCount: 0 })); await client.items(params); const url = new URL(h.requests.at(-1).url);
  assert.equal(url.searchParams.get('sortBy'), field); assert.equal(url.searchParams.get('sortOrder'), descending ? 'Descending' : 'Ascending');
  assert.equal(url.searchParams.get('parentId'), 'lib'); assert.ok(url.searchParams.getAll('fields').includes('SortName'));
});
test('library sort persists per account and reload starts at offset zero, later pages keep the selected order', async () => {
  const client = h.activate(); const queries = []; client.items = async params => { queries.push(params); return { Items: [film('a')], TotalRecordCount: 2 }; };
  const page = h.page({ mode: 'library', parentId: 'lib', items: [film('old')], total: 12 });
  await page.changeLibrarySort(1); assert.equal(page.librarySort, 'CommunityRating'); assert.deepEqual(ids(page.items), ['a']);
  await page.changeLibrarySort(1, true); await page.load(true);
  const param = (i, key) => queries[i].find(p => p.key === key)?.value;
  assert.equal(param(0, 'StartIndex'), '0'); assert.equal(param(1, 'StartIndex'), '0'); assert.equal(param(2, 'StartIndex'), '1'); assert.equal(param(2, 'SortOrder'), 'Descending');
  const restored = h.page(); assert.equal(restored.librarySort, 'CommunityRating'); assert.equal(restored.libraryDescending, true);
  h.activate('other'); assert.equal(h.page().librarySort, 'SortName'); h.activate('a'); assert.equal(h.page().libraryDescending, true);
});
test('failed sort persistence retains current list and selection; invalid/busy selections do no work', async () => {
  h.activate(); const page = h.page({ mode: 'library', items: [film('old')] }); let calls = 0; page.load = async () => { calls++; };
  AppService.local.saveExperience = () => { throw Error('disk_full'); }; await page.changeLibrarySort(1);
  assert.equal(page.librarySort, 'SortName'); assert.deepEqual(ids(page.items), ['old']); assert.equal(calls, 0); assert.equal(page.message, 'disk_full');
  for (const index of [-1, 6, 1.5, NaN]) await page.changeLibrarySort(index); page.busy = true; await page.changeLibrarySort(1); assert.equal(calls, 0);
});
test('offline sorting uses mapped metadata, puts unknown values last, and keeps search outside library preferences', async () => {
  const list = [film('a', { Name: 'Z', SortName: 'A', CommunityRating: 8, CriticRating: 20, DateCreated: '2020-01-01', PremiereDate: '2025-01-01', UserData: { LastPlayedDate: '2024-01-01' } }),
    film('b', { Name: 'A', SortName: 'Z', CommunityRating: 2, CriticRating: 90, DateCreated: '2025-01-01', PremiereDate: '2020-01-01', UserData: { LastPlayedDate: '2020-01-01' } }), film('missing')];
  const snap = h.snapshot(list, [], [{ libraryId: 'lib', itemIds: ['a', 'b', 'missing'] }]);
  for (const [field, first] of [['SortName','b'],['CommunityRating','a'],['CriticRating','b'],['DateCreated','b'],['DatePlayed','a'],['PremiereDate','a']]) {
    const values = cachedItems(snap, 'library', '', 'lib', '', field, true); assert.equal(values[0].Id, first, field);
    if (field !== 'SortName') assert.equal(values.at(-1).Id, 'missing');
  }
  assert.deepEqual(ids(cachedItems(snap, 'search', '', '', '', 'CommunityRating', true)), ['b', 'missing', 'a']);
  assert.equal(browseParams('search', 'q', '', '', 'CommunityRating', true).find(p => p.key === 'SortBy').value, 'SortName');
});
test('old experience JSON migrates without losing data while invalid new preferences are rejected', () => {
  const old = new ExperienceState(); delete old.librarySort; delete old.libraryDescending; delete old.autoNextMode;
  assert.equal(validExperience(old), true);
  for (const values of [{ librarySort: 'bad' }, { libraryDescending: 'yes' }, { autoNextMode: 'bad' }, { serverAutoNext: 'no' }]) assert.equal(validExperience({ ...old, ...values }), false);
});
test('domain mapping preserves sort-name/critic/date metadata and rejects invalid numeric fields', async () => {
  const client = h.activate(); h.queue.push(h.response({ Items: [film('a', { SortName: 'sort', CriticRating: 72, DateCreated: '2024-01-01' })], TotalRecordCount: 1 }));
  const result = await client.items(); assert.equal(result.Items[0].SortName, 'sort'); assert.equal(result.Items[0].CriticRating, 72);
  h.queue.push(h.response({ Items: [film('a', { CriticRating: 'bad' })], TotalRecordCount: 1 })); await assert.rejects(client.items(), /api_response_invalid/);
});
test('video download caches external and embedded text subtitles, persists safe metadata, and restores offline playback', async () => {
  const client = h.activate(); const transport = transfer(client); const fetched = []; client.subtitle = async (...args) => { fetched.push(args); return documentFor(args[2]); };
  await AppService.download(film('movie', { CanDownload: true })); const record = AppService.downloads[0]; transport.callbacks.complete();
  assert.deepEqual(fetched.map(a => a[2]), [7, 8, 9]); assert.equal(record.subtitleState, 'ready');
  const restored = AppService.local.downloads()[0]; assert.equal(restored.subtitles.length, 3); assert.equal(validDownloads([restored], AppService.local.directory), true);
  assert.ok(!/token|https|api_key/i.test(JSON.stringify(restored))); assert.equal(fs.readFileSync(restored.subtitles[0].path, 'utf8'), srt);
  const route = await AppService.playback(record.item, '', true); assert.equal(route.subtitles.length, 3); assert.equal(route.mediaSourceId, 'source'); assert.equal(route.offline, true);
});
test('subtitle partial failure is visible, video remains playable and retry avoids redownloading video or good subtitles', async () => {
  const client = h.activate(), t = transfer(client); client.subtitle = async (_item, _source, index) => { if (index === 8) throw Error('http_403'); return documentFor(index); };
  await AppService.download(film('movie', { CanDownload: true })); const record = AppService.downloads[0]; t.callbacks.complete();
  assert.equal(record.state, 'complete'); assert.equal(record.subtitleState, 'failed'); assert.deepEqual(record.subtitles.map(s => s.state), ['ready','failed','ready']);
  const fetched = []; client.subtitle = async (_i,_s,index) => { fetched.push(index); return documentFor(index); }; await AppService.retrySubtitles(record);
  assert.equal(t.created(), 1); assert.deepEqual(fetched, [8]); assert.equal(record.subtitleState, 'ready');
});
test('legacy downloads can add subtitles without changing video or losing offline access', async () => {
  const { client, record } = legacyRecord(); transfer(client); assert.equal(validDownloads([record], AppService.local.directory), true);
  assert.equal((await AppService.playback(record.item, '', true)).subtitles.length, 0); await AppService.retrySubtitles(record);
  assert.equal(record.subtitleState, 'ready'); assert.equal(fs.readFileSync(record.path, 'utf8'), 'synthetic');
});
test('missing subtitle file is fetched again; malformed SRT never becomes ready', async () => {
  const { client, record } = legacyRecord(); transfer(client); await AppService.retrySubtitles(record);
  fs.unlinkSync(record.subtitles[0].path); let count = 0; client.subtitle = async () => { count++; return 'not srt'; };
  await AppService.retrySubtitles(record); assert.equal(count, 1); assert.equal(record.subtitleState, 'failed'); assert.equal(record.subtitles[0].state, 'failed');
});
test('late subtitle response after download removal cannot recreate a file or record', async () => {
  const { client, record } = legacyRecord(); transfer(client); const gate = h.deferred(); client.subtitle = () => gate.promise;
  const waiting = AppService.retrySubtitles(record); await new Promise(setImmediate); const target = OfflineSubtitles.plan(record, source(), AppService.local.directory)[0].path;
  await AppService.removeDownload(record); gate.resolve(srt); await waiting; assert.equal(AppService.downloads.length, 0); assert.equal(fs.existsSync(target), false);
});
test('subtitle files are removed with video and cache path traversal/duplicate indexes are rejected', async () => {
  const { client, record } = legacyRecord(); transfer(client); await AppService.retrySubtitles(record); const files = record.subtitles.map(s => s.path);
  const bad = structuredClone(record); bad.subtitles[0].path = path.join(h.directory, 'outside.srt'); assert.equal(validDownloads([bad], AppService.local.directory), false);
  const duplicate = structuredClone(record); duplicate.subtitles.push(duplicate.subtitles[0]); assert.equal(validDownloads([duplicate], AppService.local.directory), false);
  await AppService.removeDownload(record); for (const file of files) assert.equal(fs.existsSync(file), false);
});
test('offline subtitle retry makes no network request and server source removal preserves prior metadata', async () => {
  const { client, record } = legacyRecord(); let calls = 0; client.playbackInfo = async () => { calls++; return { MediaSources: [] }; };
  AppService.experience.update(s => { s.offline = true; }); await assert.rejects(AppService.retrySubtitles(record), /offline_mode/); assert.equal(calls, 0);
  AppService.experience.update(s => { s.offline = false; }); await assert.rejects(AppService.retrySubtitles(record), /no_media_source/); assert.equal(record.subtitles, undefined);
});
test('subtitle writes fail explicitly without leaving a partial file or changing video completion', async () => {
  const { client, record } = legacyRecord(); transfer(client);const api=h.platform.get('@ohos.file.fs'),open=api.openSync;
  api.openSync=(filename,...args)=>{if(/\.(srt|ass)\.tmp$/.test(filename))throw Error('disk full');return open(filename,...args);};try{await AppService.retrySubtitles(record);}finally{api.openSync=open;}
  assert.equal(record.state,'complete');assert.equal(record.subtitleState,'failed');for(const sub of record.subtitles){assert.equal(fs.existsSync(sub.path),false);assert.equal(fs.existsSync(sub.path+'.tmp'),false);}
});
test('late subtitle fetch cannot persist into a switched account', async () => {
  const { client, record }=legacyRecord();transfer(client);const gate=h.deferred();client.subtitle=()=>gate.promise;
  const waiting=AppService.retrySubtitles(record);await new Promise(setImmediate);const target=OfflineSubtitles.plan(record,source(),AppService.local.directory)[0].path;h.activate('b');gate.resolve(srt);await waiting;
  assert.equal(AppService.downloads.length,0);assert.equal(fs.existsSync(target),false);assert.equal(AppService.local.downloads().length,0);
});
test('selected media source determines cached subtitle identities', async () => {
  const client=h.activate();transfer(client);client.playbackInfo=async()=>({MediaSources:[source(),{Id:'second',Container:'mkv',MediaStreams:[{Type:'Subtitle',Index:31,IsExternal:true,Codec:'vtt',Language:'eng'}]}]});
  const seen=[];client.subtitle=async(...a)=>{seen.push(a);return srt;};await AppService.download(film('movie',{CanDownload:true}),'second');
  assert.deepEqual(seen.map(a=>[a[1],a[2]]),[['second',31]]);assert.equal(AppService.downloads[0].mediaSourceId,'second');
});
test('system-agent download also caches external subtitles using the real persistent transfer adapter', async () => {
  const client=h.activate();transfer(client);const {PersistentDownload}=h.load('service/PersistentDownload.ets');const available=PersistentDownload.available;
  const api=h.platform.get('@ohos.request'),old=api.agent;const callbacks={};
  api.agent={Action:{DOWNLOAD:1},Mode:{BACKGROUND:1},Network:{WIFI:1},State:{COMPLETED:2,FAILED:3,STOPPED:4,REMOVED:5},
    create:async(_context,options)=>({tid:'123',on:(name,fn)=>{callbacks[name]=fn;},start:async()=>{fs.writeFileSync(options.saveas,'synthetic');callbacks.completed({sizes:[9],processed:9,state:2});}})};
  PersistentDownload.available=()=>true;
  try{await AppService.download(film('movie',{CanDownload:true}));assert.equal(AppService.downloads[0].state,'complete');assert.equal(AppService.downloads[0].subtitleState,'ready');assert.equal(AppService.downloads[0].agentId,'123');}
  finally{PersistentDownload.available=available;api.agent=old;}
});
test('invalid server autoplay metadata is rejected without enabling autoplay', async () => {
  const client=h.activate();for(const config of [true,[],{EnableNextEpisodeAutoPlay:'yes'}]){h.queue.push(h.response({Id:'a',Configuration:config}));await assert.rejects(client.autoNextEnabled(),/api_response_invalid/);}
});
for (const version of ['10.8.13','10.10.0']) for (const enabled of [false,true,undefined]) test(version + ' server autoplay ' + enabled + ' respects the account configuration', async () => {
  const client = h.activate(); client.api.setServerVersion(version); h.queue.push(h.response({ Id: 'a', Configuration: { EnableNextEpisodeAutoPlay: enabled } }));
  assert.equal(await AppService.loadAutoNext(), enabled !== false); assert.equal(AppService.experience.snapshot().serverAutoNext, enabled !== false);
  assert.equal(new URL(h.requests.at(-1).url).pathname, '/jellyfin/Users/Me');
});
test('autoplay explicit overrides survive cold account restoration and do not change another account', async () => {
  h.activate(); AppService.saveAutoNext('off'); assert.equal(await AppService.loadAutoNext(), false); assert.equal(h.requests.length, 0);
  h.activate('b'); assert.equal(AppService.experience.snapshot().autoNextMode, 'server'); AppService.saveAutoNext('on'); assert.equal(await AppService.loadAutoNext(true), true);
  h.activate('a'); assert.equal(await AppService.loadAutoNext(), false); AppService.saveAutoNext('server'); h.queue.push(h.response({ Id: 'a', Configuration: { EnableNextEpisodeAutoPlay: false } })); assert.equal(await AppService.loadAutoNext(), false);
});
test('offline and connection-failure autoplay use last server preference; 401 and wrong-user responses do not become success', async () => {
  const client = h.activate(); AppService.experience.update(s => { s.serverAutoNext = false; }); assert.equal(await AppService.loadAutoNext(true), false);
  client.autoNextEnabled = async () => { throw Error('network unavailable'); }; assert.equal(await AppService.loadAutoNext(), false);
  client.autoNextEnabled = async () => { throw Error('http_401'); }; await assert.rejects(AppService.loadAutoNext(), /401/);
  delete client.autoNextEnabled; h.queue.push(h.response({ Id: 'other' })); await assert.rejects(AppService.loadAutoNext(), /login_response_invalid/);
});
test('autoplay old-account result cannot change new account or overwrite a newer explicit selection', async () => {
  const client = h.activate(), gate = h.deferred(); client.autoNextEnabled = () => gate.promise; const loading = AppService.loadAutoNext();
  AppService.saveAutoNext('off'); gate.resolve(true); assert.equal(await loading, false);
  AppService.saveAutoNext('server'); const next = h.deferred(); client.autoNextEnabled = () => next.promise; const obsolete = AppService.loadAutoNext(); h.activate('b'); next.resolve(false);
  await assert.rejects(obsolete, /login_required/); assert.equal(AppService.experience.snapshot().serverAutoNext, undefined);
});
test('autoplay save failure retains previous mode', async () => {
  h.activate(); AppService.saveAutoNext('off'); AppService.local.saveExperience = () => { throw Error('disk full'); };
  assert.throws(() => AppService.saveAutoNext('on'), /disk full/); assert.equal(await AppService.loadAutoNext(), false);
});

(async () => {
  for (const [name, fn] of tests) { h.reset(); await fn(); console.log('PASS ' + name); }
  const p = require('./player-regression.test.cjs');
  const playerTests = [];
  const playerTest = (name,fn) => playerTests.push([name,fn]);
  playerTest('offline SRT selection and language preference read local files with zero HTTP and clear on seek/off', async () => {
    const filename = path.join(p.directory,'subtitle.srt'), video = path.join(p.directory,'offline.mp4'); fs.writeFileSync(filename,srt); fs.writeFileSync(video,'fixture');
    const route = Object.assign(p.route(), { offline:true, filePath:video, subtitles:[{index:7,title:'中文',language:'zho',path:filename,state:'ready'}] });
    const {c,values} = p.rig({subtitle:async()=>{throw Error('must not request');}}); c.preferences=()=>({audioLanguage:'',subtitleLanguage:'zh',subtitlesOff:false});
    await c.open(route,'surface'); await p.settle(); assert.equal(values.subtitleKey,'local:7'); c.seek(1500); assert.equal(values.subtitle,'离线字幕'); c.seek(4000); assert.equal(values.subtitle,'');
    await c.selectSubtitle(''); c.seek(1500); assert.equal(values.subtitle,''); assert.ok(!p.nativePlayers[0].calls.some(a=>a[0]==='select'&&a[1]===7)); await c.close();
  });
  playerTest('missing cached subtitle reports error without stopping playback or replacing current subtitle', async () => {
    const video = path.join(p.directory,'missing.mp4'); fs.writeFileSync(video,'fixture'); const route = Object.assign(p.route(),{offline:true,filePath:video,subtitles:[{index:7,title:'missing',language:'zh',path:path.join(p.directory,'missing.srt'),state:'ready'}]});
    const {c,values}=p.rig(); await c.open(route,'surface'); await p.settle(); await c.selectSubtitle('local:7'); assert.ok(values.errors.includes('subtitle_failed')); assert.equal(p.nativePlayers[0].state,'playing'); assert.equal(values.subtitleKey,''); await c.close();
  });
  playerTest('server disabled autoplay prevents actual completion from loading another episode',async()=>{
    p.AppService.loadAutoNext=async()=>false;let calls=0;const old=p.AppService.nextPlayback;p.AppService.nextPlayback=async()=>{calls++;return p.route(p.episode('e2',1,2));};
    p.setRoute(p.route());const page=new p.Player();page.aboutToAppear();page.surfaceId='s';await page.controller.open(page.route,'s');await p.settle();assert.equal(p.nativePlayers[0].state,'playing');await page.completed();assert.equal(calls,0);assert.equal(page.route.item.Id,'e1');page.aboutToDisappear();p.AppService.nextPlayback=old;
  });
  playerTest('autoplay pending read cannot auto-advance and a manual selection defeats a late server response',async()=>{
    const gate=p.deferred();p.AppService.loadAutoNext=()=>gate.promise;let mode;p.AppService.saveAutoNext=value=>{mode=value;};p.setRoute(p.route());const page=new p.Player();page.aboutToAppear();assert.equal(page.autoNextReady,false);
    page.changeAutoNext('off');gate.resolve(true);await p.settle();assert.equal(mode,'off');assert.equal(page.autoNext,false);assert.equal(page.autoNextMode,'off');page.aboutToDisappear();
  });
  playerTest('autoplay save failure retains effective state and page exit discards a late preference read',async()=>{
    p.AppService.loadAutoNext=async()=>true;p.AppService.saveAutoNext=()=>{throw Error('full');};p.setRoute(p.route());const page=new p.Player();page.aboutToAppear();await p.settle();page.changeAutoNext('off');assert.equal(page.autoNext,true);assert.equal(page.settingsMessage,'auto_next_save_failed');page.aboutToDisappear();
    const gate=p.deferred();p.AppService.loadAutoNext=()=>gate.promise;const closed=new p.Player();closed.aboutToAppear();closed.aboutToDisappear();gate.resolve(true);await p.settle();assert.equal(closed.autoNext,false);
  });
  for(const [name,fn] of playerTests){p.reset();await fn();await p.settle();console.log('PASS '+name);}
  console.log(`${tests.length+playerTests.length} Android parity regression tests passed. Fixtures do not prove native durability, subtitle pixels, video decoding or OS task survival.`);
})().catch(e=>{console.error(e);process.exitCode=1});
