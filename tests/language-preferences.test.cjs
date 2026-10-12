// Real settings store/page/player logic; file-backed Preferences and native tracks are explicit fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./player-regression.test.cjs');
const { load, NativePlayer, nativePlayers, nativeQueue, route, episode, deferred, settle, rig, AppService, Player } = h;
const { PlaybackPreferences, normalizeLanguage, preferredTrack } = load('utils/PlaybackPreferences.ts');
const { PlaybackPreferenceStore } = load('service/PlaybackPreferenceStore.ets');
const { PlaybackController } = load('service/PlaybackController.ets');
const fixture = h.preferencesPlatform, context = { filesDir: h.directory };
const pref = (audio = '', subtitle = '', off = false) => ({ version: 1, audioLanguage: audio, subtitleLanguage: subtitle, subtitlesOff: off });
const choice = (key, language, extra = {}) => ({ key, language, index: Number(key.split(':')[1]), type: 2, label: 'irrelevant name', remote: false, ...extra });
async function store(value) { const s = new PlaybackPreferenceStore(); await s.load(context); if (value) await s.save(value); return s; }
async function playing(value, n = new NativePlayer(), r = route(), overrides = {}) {
  const { values, c: unused } = rig(overrides);
  const c = new PlaybackController(unused.client, unused.view, () => value);
  nativeQueue.push(n); await c.open(r, 'surface'); await settle(); return { c, n, values };
}
function page(r = route()) { h.setRoute(r); const p = new Player(); p.aboutToAppear(); return p; }
const tests = [], test = (name, fn) => tests.push([name, fn]);

test('new install defaults preserve native audio/subtitle defaults and do not write storage', async () => {
  const s = await store(); assert.deepEqual(s.snapshot(), pref()); assert.equal(s.issue, '');
  assert.equal(fixture.state.calls.filter(x => x[0] === 'put').length, 0);
  const n = new NativePlayer(); n.selected = [5, 12]; const { c, values } = await playing(s.snapshot(), n);
  assert.equal(values.audioKey, 'native:5'); assert.equal(values.subtitleKey, 'native:12');
  assert.deepEqual(n.calls.filter(x => x[0] === 'select'), []); await c.close();
});
test('save flushes one versioned value and a new process fixture recovers language/off preferences', async () => {
  const s = await store(); await s.save(pref(' CHI ', 'ENG_us', true));
  assert.deepEqual(s.snapshot(), pref('zh', 'en-us', true));
  assert.deepEqual(fixture.state.calls.slice(-2).map(x => x[0]), ['put', 'flush']);
  const file = fixture.state.instances.values().next().value.filename;
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))), ['settings_v1']);
  fixture.state.instances.clear(); const restored = await store(); assert.deepEqual(restored.snapshot(), pref('zh', 'en-us', true));
});
test('snapshot copies and queued save return values cannot mutate persisted preferences', async () => {
  const s = await store(pref('en', 'ja')); const snapshot = s.snapshot(); snapshot.audioLanguage = 'ru';
  assert.equal(s.snapshot().audioLanguage, 'en'); const saved = await s.save(pref('zh')); saved.audioLanguage = 'fr';
  assert.equal(s.snapshot().audioLanguage, 'zh');
});
test('concurrent load opens once and a read failure remains retryable', async () => {
  const s = new PlaybackPreferenceStore(); fixture.state.failGet = true;
  await assert.rejects(s.load(context), /load_failed/); assert.equal(s.issue, 'playback_preferences_load_failed');
  fixture.state.failGet = false; await Promise.all([s.load(context), s.load(context)]);
  assert.equal(fixture.state.calls.filter(x => x[0] === 'open').length, 2); assert.equal(s.issue, '');
});
test('native open failure falls back to defaults and save retries loading', async () => {
  const s = new PlaybackPreferenceStore(); fixture.state.failOpen = true;
  await assert.rejects(s.load(context)); assert.deepEqual(s.snapshot(), pref());
  fixture.state.failOpen = false; await s.save(pref('ja', 'zh')); assert.deepEqual(s.snapshot(), pref('ja', 'zh'));
});
for (const raw of ['{broken', 'null', JSON.stringify({ version: 2, audioLanguage: 'en', subtitleLanguage: '', subtitlesOff: false }), JSON.stringify({ version: 1, audioLanguage: 3, subtitleLanguage: '', subtitlesOff: false }), JSON.stringify(pref('中文'))]) {
  test('invalid stored settings preserve raw data until explicit reset: ' + raw, async () => {
    const native = await fixture.api.getPreferences(context, { name: 'playback_languages' }); native.values.settings_v1 = raw; await native.flush();
    const s = await store(); assert.equal(s.issue, 'playback_preferences_invalid'); assert.deepEqual(s.snapshot(), pref());
    assert.equal(native.values.settings_v1, raw); await s.save(new PlaybackPreferences()); assert.equal(s.issue, '');
    assert.deepEqual(JSON.parse(native.values.settings_v1), pref());
  });
}
test('bad user language is rejected before any native write', async () => {
  const s = await store(pref('en')); fixture.state.calls.length = 0;
  for (const code of ['中文', 'en--US', 'und', 'zxx', 'e', 'https://example.invalid', 'zh-'.repeat(40)]) await assert.rejects(s.save(pref(code)), /language_invalid/);
  assert.equal(fixture.state.calls.length, 0); assert.equal(s.snapshot().audioLanguage, 'en');
  await s.save(pref('  ', ' ENG ')); assert.deepEqual(s.snapshot(), pref('', 'en'));
});
for (const kind of ['failPut', 'failFlush']) test('failed ' + kind + ' restores old setting without publishing success and later save retries', async () => {
  const s = await store(pref('en', 'ja')); fixture.state[kind] = 1;
  await assert.rejects(s.save(pref('zh', 'fr')), /save_failed/); assert.deepEqual(s.snapshot(), pref('en', 'ja'));
  fixture.state.instances.clear(); assert.deepEqual((await store()).snapshot(), pref('en', 'ja'));
  await s.save(pref('zh', 'fr')); assert.deepEqual(s.snapshot(), pref('zh', 'fr')); assert.equal(s.issue, '');
});
test('rollback failure is reported separately and cannot publish failed values; resave recovers', async () => {
  const s = await store(pref('en')); fixture.state.failFlush = 2;
  await assert.rejects(s.save(pref('zh')), /restore_failed/); assert.equal(s.snapshot().audioLanguage, 'en');
  assert.equal(s.issue, 'playback_preferences_restore_failed'); await s.save(pref('ja')); assert.equal(s.snapshot().audioLanguage, 'ja');
});
test('serialized writes commit only after flush and preserve invocation order', async () => {
  const s = await store(pref('en')), wait = deferred(); fixture.state.flushWait = wait.promise;
  const a = s.save(pref('zh')), b = s.save(pref('ja')); await settle(); assert.equal(s.snapshot().audioLanguage, 'en');
  assert.equal(fixture.state.calls.filter(x => x[0] === 'put').length, 2); // initial + first queued
  wait.resolve(); assert.equal((await a).audioLanguage, 'zh'); assert.equal((await b).audioLanguage, 'ja');
  fixture.state.instances.clear(); assert.equal((await store()).snapshot().audioLanguage, 'ja');
});
test('settings contain only language/off fields and survive logout/account change', async () => {
  AppService.playbackPreferences = await store(pref('zh', 'en')); const sessionStore = load('service/SessionStore.ets').SessionStore;
  const clear = sessionStore.clear; sessionStore.clear = async () => {};
  try { await AppService.logout(); assert.deepEqual(AppService.playbackPreferences.snapshot(), pref('zh', 'en')); }
  finally { sessionStore.clear = clear; }
  const payload = fixture.state.calls.find(x => x[0] === 'put')[2]; assert.deepEqual(Object.keys(JSON.parse(payload)).sort(), ['audioLanguage', 'subtitleLanguage', 'subtitlesOff', 'version']);
  assert.ok(!/token|url|track|source|user|server/i.test(payload));
});
test('application initializes preferences before session restoration and tolerates settings read failure', async () => {
  await store(pref('zh','en'));AppService.playbackPreferences=new PlaybackPreferenceStore();const sessionStore=load('service/SessionStore.ets').SessionStore;
  const loadSession=sessionStore.load,wasInitialized=AppService.initialized;AppService.initialized=false;
  sessionStore.load=async()=>{assert.equal(AppService.playbackPreferences.snapshot().audioLanguage,'zh');return undefined;};
  const appContext={...context,resourceManager:{getStringByNameSync:name=>name}};
  try {await AppService.initialize(appContext);assert.equal(AppService.initialized,true);
    AppService.initialized=false;AppService.playbackPreferences=new PlaybackPreferenceStore();fixture.state.failOpen=true;
    sessionStore.load=async()=>undefined;await AppService.initialize(appContext);assert.equal(AppService.initialized,true);assert.equal(AppService.playbackPreferences.issue,'playback_preferences_load_failed');
  }finally{sessionStore.load=loadSession;AppService.initialized=wasInitialized;}
});
test('language aliases normalize case/space/subtags but unknown metadata remains unmatched', () => {
  for (const [input, expected] of [['ZHO','zh'],['chi','zh'],['ENG_us','en-us'],[' fre ','fr'],['GER','de'],['jpn','ja'],['pt-BR','pt-br'],['zh_Hant_TW','zh-hant-tw']]) assert.equal(normalizeLanguage(input), expected);
  for (const input of ['', 'und', 'zxx', 'mul', 'English', '中文', 'en--US']) assert.equal(normalizeLanguage(input), '');
  assert.equal(preferredTrack([choice('native:1', '')], 'en', ''), undefined);
});
test('exact locale wins over base language; ties retain selected real track', () => {
  const list = [choice('native:5', 'eng'), choice('native:8', 'en-US'), choice('native:10', 'en-us')];
  assert.equal(preferredTrack(list, 'en-us', 'native:5'), 'native:8');
  assert.equal(preferredTrack(list, 'en-us', 'native:10'), 'native:10');
  assert.equal(preferredTrack(list, 'en', ''), 'native:5');
});
test('script-aware matching rejects explicit simplified/traditional conflicts and ranks compatible scripts', () => {
  const list = [choice('native:1', 'zh-CN'), choice('server:9', 'zh-Hant'), choice('server:8', 'chi')];
  assert.equal(preferredTrack(list, 'zh-TW', ''), 'server:9'); assert.equal(preferredTrack(list, 'zh-Hans', ''), 'native:1');
  assert.equal(preferredTrack([choice('native:1','zh-Hans')], 'zh-Hant', ''), undefined);
});
test('automatic audio selects native language metadata, never Jellyfin stream indices or names', async () => {
  const r = route(); r.sources = [{ Id: r.mediaSourceId, MediaStreams: [{ Type:'Audio', Index:99, Language:'zh' }] }];
  const { c, n, values } = await playing(pref('zh'), new NativePlayer(), r);
  assert.equal(values.audioKey, 'native:8'); assert.deepEqual(n.calls.filter(x => x[0] === 'select'), [['select',8]]); await c.close();
  const named = new NativePlayer([{ track_index:5, track_type:0, track_name:'中文' }]);
  const second = await playing(pref('zh'), named, r); assert.deepEqual(named.calls.filter(x => x[0] === 'select'), []); await second.c.close();
});
test('preferred online subtitle uses its own server index, updates cues and synchronizes PiP', async () => {
  AppService.playbackPreferences = await store(pref('zh','zh'));
  const r = route(); r.sources = [{ Id:r.mediaSourceId, MediaStreams:[{ Type:'Subtitle',Index:29,Codec:'srt',Language:'chi' }] }];
  const p = page(r); let index; AppService.client.subtitle = async (item, source, i) => { index = i; return '1\n00:00:01,000 --> 00:00:03,000\n你好'; };
  await p.controller.open(r,'surface'); await settle(); assert.equal(index,29); assert.equal(p.audioKey,'native:8'); assert.equal(p.subtitleKey,'server:29');
  p.controller.seek(1500); await p.system.startPiP(); await settle(); assert.equal(p.subtitle,'你好'); assert.equal(p.system.captions.node.params.text,'你好'); p.aboutToDisappear(); await settle();
});
test('offline track preferences use only actual native tracks and never fetch server subtitle', async () => {
  const filename = path.join(h.directory,'language-offline.media'); fs.writeFileSync(filename,'isolated fixture');
  let requests=0; const r=Object.assign(route(),{offline:true,filePath:filename});
  const { c,n,values }=await playing(pref('zh','en'),new NativePlayer(),r,{ async subtitle(){requests++;throw Error('unexpected');} });
  assert.equal(values.audioKey,'native:8');assert.equal(values.subtitleKey,'native:12');assert.equal(requests,0);assert.ok(n.fd.fd>=0); await c.close();
});
test('always-off overrides preferred/native-selected subtitle without muting audio', async () => {
  const n=new NativePlayer();n.selected=[5,12]; const {c,values}=await playing(pref('zh','en',true),n);
  assert.equal(values.subtitleKey,'');n.emit('subtitleUpdate',{text:'Hidden',startTime:0,duration:3000});assert.equal(values.subtitle,'');assert.equal(values.audioKey,'native:8');assert.equal(n.state,'playing');await c.close();
});
test('missing preferred language retains default selected tracks without guessing', async () => {
  const n=new NativePlayer();n.selected=[5,12];const {c,values}=await playing(pref('ru','ru'),n);
  assert.equal(values.audioKey,'native:5');assert.equal(values.subtitleKey,'native:12');assert.deepEqual(n.calls.filter(x=>x[0]==='select'),[]);await c.close();
});
test('malformed server language metadata is ignored without blocking playback', async () => {
  const r=route();r.sources=[{Id:r.mediaSourceId,MediaStreams:[{Type:'Subtitle',Index:29,Codec:'srt',Language:42},{Type:'Subtitle',Index:30,Codec:'srt',Language:null}]}];
  const {c,n,values}=await playing(pref('','zh'),new NativePlayer(),r);assert.equal(n.state,'playing');assert.equal(values.subtitleKey,'');assert.deepEqual(values.errors,[]);await c.close();
});
test('automatic track errors preserve prior selection and do not prevent playback', async () => {
  const n=new NativePlayer();n.selected=[5,12];n.failSelect=true;const r=route();r.sources=[{Id:r.mediaSourceId,MediaStreams:[{Type:'Subtitle',Index:29,Codec:'srt',Language:'zh'}]}];
  const {c,values}=await playing(pref('zh','zh'),n,r,{async subtitle(){throw Error('unavailable');}});
  assert.equal(values.audioKey,'native:5');assert.equal(values.subtitleKey,'native:12');assert.ok(values.errors.includes('track_switch_failed'));assert.ok(values.errors.includes('subtitle_failed'));assert.equal(n.state,'playing');await c.close();
});
test('manual choices remain for current media and preferences reapply to fresh native indices on next load', async () => {
  const value=pref('zh','en');const {c,values}=await playing(value);await c.selectAudio('native:5');await c.selectSubtitle('');
  nativePlayers[0].emit('timeUpdate',1500);assert.equal(values.audioKey,'native:5');assert.equal(values.subtitleKey,'');
  const n=new NativePlayer([{track_index:43,track_type:0,language:'chi'},{track_index:81,track_type:2,language:'eng'}]);n.selected=[];nativeQueue.push(n);
  await c.open(route(episode('e2',1,2)),'surface');await settle();assert.equal(values.audioKey,'native:43');assert.equal(values.subtitleKey,'native:81');assert.deepEqual(value,pref('zh','en'));await c.close();
});
test('manual subtitle wins while automatic audio selection is awaiting native completion', async () => {
  const n=new NativePlayer(),wait=deferred();const select=n.selectTrack.bind(n);n.selectTrack=async i=>{if(i===8)await wait.promise;await select(i);};
  const {c:unused,values}=rig();const c=new PlaybackController(unused.client,unused.view,()=>pref('zh','en'));nativeQueue.push(n);await c.open(route(),'surface');await settle();
  await c.selectSubtitle('');wait.resolve();await settle();assert.equal(values.subtitleKey,'');assert.equal(values.audioKey,'native:8');await c.close();
});
test('manual audio restores original track after an in-flight automatic native change', async () => {
  const n=new NativePlayer(),wait=deferred();const select=n.selectTrack.bind(n);n.selectTrack=async i=>{if(i===8)await wait.promise;await select(i);};
  const {c:unused,values}=rig();const c=new PlaybackController(unused.client,unused.view,()=>pref('zh'));nativeQueue.push(n);await c.open(route(),'surface');await settle();
  const manual=c.selectAudio('native:5');wait.resolve();await manual;await settle();assert.equal(values.audioKey,'native:5');assert.ok(n.selected.includes(5));await c.close();
});
test('new media audio selection does not wait for an obsolete native selection promise', async () => {
  const n=new NativePlayer(),wait=deferred();const select=n.selectTrack.bind(n);n.selectTrack=async i=>{if(i===8)await wait.promise;await select(i);};
  const {c:unused,values}=rig();const c=new PlaybackController(unused.client,unused.view,()=>pref('zh'));nativeQueue.push(n);await c.open(route(),'surface');await settle();
  const next=new NativePlayer([{track_index:44,track_type:0,language:'zho'}]);next.selected=[];nativeQueue.push(next);
  await c.open(route(episode('e2',1,2)),'surface');await settle();assert.equal(next.state,'playing');assert.equal(values.audioKey,'native:44');
  wait.resolve();await settle();assert.equal(values.audioKey,'native:44');assert.equal(next.state,'playing');await c.close();
});
test('later preference save defeats old automatic subtitle request', async () => {
  const wait=deferred(),r=route();r.sources=[{Id:r.mediaSourceId,MediaStreams:[{Type:'Subtitle',Index:29,Codec:'srt',Language:'zh'}]}];
  const {c:unused,values}=rig({subtitle:()=>wait.promise});const c=new PlaybackController(unused.client,unused.view,()=>pref('','zh'));await c.open(r,'surface');await settle();
  await c.applyPreferences(pref('','',true));wait.resolve('1\n00:00:00,000 --> 00:00:03,000\nOLD');await settle();assert.equal(values.subtitleKey,'');assert.equal(values.subtitle,'');await c.close();
});
test('source change during auto subtitle fetch rejects old text and cannot restart released playback', async () => {
  const wait=deferred(),r=route();r.sources=[{Id:r.mediaSourceId,MediaStreams:[{Type:'Subtitle',Index:29,Codec:'srt',Language:'zh'}]}];
  const {c:unused,values}=rig({subtitle:()=>wait.promise});const c=new PlaybackController(unused.client,unused.view,()=>pref('','zh'));await c.open(r,'surface');await settle();const old=nativePlayers[0];
  await c.open(route(episode('e2',1,2),'source-b'),'surface');await settle();wait.resolve('1\n00:00:00,000 --> 00:00:03,000\nOLD');await settle();
  assert.equal(values.subtitleKey,'');assert.equal(values.subtitle,'');assert.equal(old.state,'released');assert.equal(old.calls.filter(x=>x[0]==='play').length,1);await c.close();
});
test('slow preferred subtitle fetch does not block playback and close rejects its late result', async () => {
  const wait=deferred(),r=route();r.sources=[{Id:r.mediaSourceId,MediaStreams:[{Type:'Subtitle',Index:29,Codec:'srt',Language:'zh'}]}];
  const {c:unused,values}=rig({subtitle:()=>wait.promise});const c=new PlaybackController(unused.client,unused.view,()=>pref('zh','zh'));await c.open(r,'surface');await settle();
  const n=nativePlayers[0];assert.equal(n.state,'playing');assert.equal(values.audioKey,'native:8');await c.close();wait.resolve('1\n00:00:00,000 --> 00:00:03,000\nOLD');await settle();
  assert.equal(n.state,'released');assert.equal(values.subtitle,'');assert.equal(n.calls.filter(x=>x[0]==='play').length,1);
});
test('page saves draft once, applies after persistence and next page restores values', async () => {
  AppService.playbackPreferences=await store();const p=page();await p.controller.open(p.route,'surface');await settle();p.audioLanguage='zho';p.subtitleLanguage='ENG';
  await p.savePreferences();assert.equal(p.settingsMessage,'playback_preferences_saved');assert.equal(p.audioLanguage,'zh');assert.equal(p.audioKey,'native:8');assert.equal(p.subtitleKey,'native:12');
  p.aboutToDisappear();await settle();const next=page();assert.equal(next.audioLanguage,'zh');assert.equal(next.subtitleLanguage,'en');next.aboutToDisappear();await settle();
});
test('page source switch and authorized background next episode reapply persistent language/off settings', async () => {
  AppService.playbackPreferences=await store(pref('zh','en',true));const p=page();await p.controller.open(p.route,'surface');await settle();
  await p.controller.selectAudio('native:5');await p.controller.selectSubtitle('native:12');
  const playback=AppService.playback,next=AppService.nextPlayback;
  try{AppService.playback=async()=>route(p.route.item,'source-b');await p.source(1);await settle();assert.equal(p.audioKey,'native:8');assert.equal(p.subtitleKey,'');
    await p.system.setBackground(true);p.onPageHide();AppService.nextPlayback=async()=>route(episode('e2',1,2));await p.completed();await settle();
    assert.equal(p.route.item.Id,'e2');assert.equal(p.audioKey,'native:8');assert.equal(p.subtitleKey,'');assert.equal(nativePlayers.at(-1).state,'playing');
  }finally{AppService.playback=playback;AppService.nextPlayback=next;p.aboutToDisappear();await settle();}
});
test('page failed save keeps draft for retry and does not change current tracks', async () => {
  AppService.playbackPreferences=await store(pref('en'));const p=page();await p.controller.open(p.route,'surface');await settle();p.audioLanguage='zh';fixture.state.failFlush=1;
  await p.savePreferences();assert.equal(p.settingsMessage,'playback_preferences_save_failed');assert.equal(p.audioLanguage,'zh');assert.equal(p.audioKey,'native:5');assert.equal(p.settingsBusy,false);
  await p.savePreferences();assert.equal(p.audioKey,'native:8');p.aboutToDisappear();await settle();
});
test('page validates invalid draft and reset persists defaults while retaining current manual audio', async () => {
  AppService.playbackPreferences=await store(pref('zh','en',true));const p=page();await p.controller.open(p.route,'surface');await settle();p.audioLanguage='中文';await p.savePreferences();
  assert.equal(p.settingsMessage,'playback_language_invalid');assert.equal(AppService.playbackPreferences.snapshot().audioLanguage,'zh');
  await p.savePreferences(true);assert.deepEqual(AppService.playbackPreferences.snapshot(),pref());assert.equal(p.audioLanguage,'');assert.equal(p.subtitlesOff,false);assert.equal(p.audioKey,'native:8');p.aboutToDisappear();await settle();
});
test('page exit during flush retains durable setting but cannot update view or restart released player', async () => {
  AppService.playbackPreferences=await store();const p=page();await p.controller.open(p.route,'surface');await settle();const wait=deferred();fixture.state.flushWait=wait.promise;p.audioLanguage='zh';const save=p.savePreferences();await settle();p.aboutToDisappear();await settle();wait.resolve();await save;
  assert.equal(AppService.playbackPreferences.snapshot().audioLanguage,'zh');assert.equal(p.settingsMessage,'');assert.equal(nativePlayers[0].state,'released');assert.deepEqual(nativePlayers[0].calls.filter(x=>x[0]==='select'),[]);
});

(async()=>{for(const [name,fn]of tests){h.reset();fixture.reset();AppService.playbackPreferences=new PlaybackPreferenceStore();await fn();await settle();console.log('PASS '+name);}console.log(`${tests.length} language preference regression tests passed. Native Preferences durability, sound, subtitle pixels and settings UI remain device acceptance.`);})().catch(e=>{console.error(e);process.exitCode=1;});
