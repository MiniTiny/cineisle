// Real product services and atomic temporary JSON; remote responses/Asset/scheduler/locks are explicit fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./feature-regression.test.cjs');
const {AppService}=h.load('service/AppService.ets'),{LocalStore}=h.load('service/LocalStore.ets'),{ExperienceStore}=h.load('service/ExperienceStore.ets');
const {PendingSync}=h.load('service/PendingSync.ets'),{SessionStore}=h.load('service/SessionStore.ets');
const {ExperienceState,validExperience}=h.load('utils/Experience.ts');
global.AppStorage||={setOrCreate(){}};
const tests=[],test=(name,fn)=>tests.push([name,fn]),tick=()=>new Promise(setImmediate);
function setup(played=false,favorite=false,user='a') {
 const client=h.activate(user),local=AppService.local,item={Id:'movie',Name:'Current metadata',Type:'Movie',Genres:['Keep'],UserData:{Played:played,IsFavorite:favorite,PlaybackPositionTicks:170000000,PlayCount:7}};
 AppService.snapshot=h.snapshot([item,h.film('other')],[h.library('lib')],[{libraryId:'lib',itemIds:['movie','other']}]);local.saveSnapshot(AppService.snapshot);
 const file=path.join(local.directory,'download-00000000000000000000000000000025.mp4');fs.writeFileSync(file,'fixture');AppService.downloads=[{id:'movie',item,state:'complete',progress:1,path:file,fileId:'00000000000000000000000000000025',mediaSourceId:'source'}];local.saveDownloads(AppService.downloads);local.saveHome([{id:'resume',kind:'resume',name:'Home',libraryId:'lib',items:[item,h.film('other')]}]);
 client.played=async()=>{};client.favorite=async()=>{};client.offlinePosition=async()=>{};client.validateAccount=async()=>{};return {client,item,local,record:AppService.downloads[0]};
}
const pending=(local=AppService.local)=>local.experience().pending;
function verify(local=AppService.local,played=false,favorite=false,ticks=450000000,pendingHome=false) {
 const cachedHome=local.home()[0].items.find(i=>i.Id==='movie');if(pendingHome)assert.equal(cachedHome.UserData.PlaybackPositionTicks,170000000);
 const home=pendingHome?h.load('utils/Experience.ts').applyPending([cachedHome],local.experience().pending,local.experience().positions)[0]:cachedHome;
 const values=[local.snapshot().items.find(i=>i.Id==='movie'),local.downloads()[0].item,home];for(const i of values){assert.equal(i.UserData.Played,played);assert.equal(i.UserData.IsFavorite,favorite);assert.equal(i.UserData.PlaybackPositionTicks,ticks);assert.equal(i.Name,'Current metadata');assert.deepEqual(i.Genres,['Keep']);assert.equal(i.UserData.PlayCount,7);}
 const pos=local.experience().positions[0];if(pos){assert.equal(pos.ticks,ticks);assert.equal(pos.item.UserData.Played,played);assert.equal(pos.item.UserData.IsFavorite,favorite);}
}
function launch(item,favorite,value,client,error=Error('permission_denied')) {
 const gate=h.deferred();client[favorite?'favorite':'played']=async()=>{await gate.promise;throw error};const result=AppService.edit(item,favorite,value).then(value=>({value}),error=>({error}));return {gate,result};
}
async function background(client){await SessionStore.save(client.session);h.context.applicationInfo={name:'com.cineisle.fixture'};PendingSync.configure(h.context,()=>({client,local:AppService.local,store:AppService.experience}));PendingSync.interactive=false;await PendingSync.run();await PendingSync.jobs;}
for(const favorite of [false,true])for(const base of [false,true])test(`rejected ${favorite?'favorite':'played'} retains ${!base} and newer progress for manual replay`,async()=>{
 const {item,client,local}=setup(favorite?false:base,favorite?base:false),r=launch(item,favorite,!base,client);await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);verify(local,favorite?false:!base,favorite?!base:false);assert.equal(pending().length,1);assert.equal(pending()[0].value,!base);assert.equal(pending()[0].localOnly,undefined);assert.equal(local.experience().syncBlocked,true);
 client.played=client.favorite=async()=>{};await AppService.flushPending();assert.equal(pending().length,0);assert.equal(local.experience().positions.length,0);verify(local,favorite?false:!base,favorite?!base:false);
});
test('stale caller metadata cannot replace current metadata during retention',async()=>{
 const {item,client,local}=setup(),r=launch({...item,Name:'Stale',Genres:[],UserData:{Played:true,IsFavorite:true}},false,true,client);await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);verify(local,true);
});
test('latest rejected request supersedes a prior offline intent instead of restoring it',async()=>{
 const {item,client,local}=setup();await AppService.edit(item,false,true,true);const prior=pending()[0],r=launch(item,false,false,client);await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);verify(local,false);assert.ok(pending()[0].revision>prior.revision);assert.equal(pending()[0].value,false);assert.equal(pending()[0].localOnly,undefined);
});
for(const firstSuccess of [false,true])test(`serialized edits retain latest desired value after first ${firstSuccess?'success':'failure'}`,async()=>{
 const {item,client,local}=setup(),gate=h.deferred();let calls=0;client.played=async()=>{calls++;if(calls===1){await gate.promise;if(firstSuccess)return;}throw Error('permission_denied')};
 const one=AppService.edit(item,false,true);await tick();const two=AppService.edit(item,false,false);await tick();assert.equal(calls,1);AppService.recordOfflinePosition(item,45000);gate.resolve();await one;assert.equal(await two,true);assert.equal(calls,2);verify(local,false);assert.equal(pending().length,1);assert.equal(pending()[0].value,false);
});
test('a later successful online edit acknowledges the latest revision after older failure',async()=>{
 const {item,client,local}=setup(),gate=h.deferred();let calls=0;client.played=async()=>{if(++calls===1){await gate.promise;throw Error('permission_denied')}};
 const one=AppService.edit(item,false,true);await tick();const two=AppService.edit(item,false,true);AppService.recordOfflinePosition(item,45000);gate.resolve();assert.equal(await one,true);await two;verify(local,true);assert.equal(pending().length,0);assert.equal(local.experience().syncBlocked,false);
});
test('newer offline intent supersedes waiting online edit and is not blocked by its older failure',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();const waiting=AppService.edit(item,false,false);await AppService.edit(item,false,true,true);AppService.recordOfflinePosition(item,45000);let extra=0;const original=client.played;client.played=async(...args)=>{extra++;return original(...args)};r.gate.resolve();assert.equal((await r.result).value,true);assert.equal(await waiting,true);assert.equal(extra,0);verify(local,true,false,450000000,true);assert.equal(pending()[0].value,true);assert.equal(local.experience().syncBlocked,false);
});
test('newer offline stop wins over rejected online played intent',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflineStop(item,45000,100000);const revision=pending()[0].revision;r.gate.resolve();assert.equal((await r.result).value,true);assert.equal(pending()[0].revision,revision);verify(local,false,false,450000000,true);assert.equal(local.experience().syncBlocked,false);
});
test('independent successful favorite does not acknowledge rejected played state',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();const other=AppService.edit(item,true,true);AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);await other;verify(local,true,true);assert.equal(pending().length,1);assert.equal(pending()[0].field,'played');
});
test('retention updates independent embedded intent snapshots without losing their values',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();await AppService.edit(item,true,true,true);AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);verify(local,true,true);assert.equal(pending().length,2);assert.ok(pending().every(p=>p.item.UserData.Played&&p.item.UserData.IsFavorite));
});
for(const message of ['permission_denied','login_expired','api_response_invalid','http_400','http_403','network_failed','http_503'])test(message+' keeps ordinary remote intent and the appropriate retry gate',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client,Error(message));await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);assert.equal(pending()[0].value,true);assert.equal(pending()[0].localOnly,undefined);const transient=['network_failed','http_503'].includes(message);assert.equal(local.experience().syncBlocked,!transient);assert.equal(local.experience().syncNextAt>Date.now(),transient);verify(local,true);
 let sends=0;client.validateAccount=async()=>{sends++};client.played=async()=>{sends++};await background(client);assert.equal(sends,0);assert.equal(pending().length,1);
});
for(const transient of [false,true])test(`automatic drain waiting on transfer rechecks ${transient?'backoff':'hard block'} before validation`,async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client,Error(transient?'network_failed':'permission_denied'));await tick();await SessionStore.save(client.session);h.context.applicationInfo={name:'com.cineisle.fixture'};PendingSync.configure(h.context,()=>({client,local,store:AppService.experience}));PendingSync.interactive=false;let validates=0;client.validateAccount=async()=>{validates++};const drain=PendingSync.run();await tick();r.gate.resolve();assert.equal((await r.result).value,true);await drain;assert.equal(validates,0);assert.equal(pending().length,1);
});
for(const stage of ['saveSnapshot','saveDownloads','saveHome'])for(const after of [false,true])test(`${stage} ${after?'after rename':'before write'} failure keeps desired intent for cold manual replay`,async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);const original=local[stage];local[stage]=function(...args){if(after)original.apply(this,args);throw Error('disk_full')};r.gate.resolve();assert.equal((await r.result).error.message,'sync_cache_write_failed');assert.equal(pending()[0].localOnly,undefined);assert.equal(pending()[0].value,true);local[stage]=original;
 const cold=new ExperienceStore(new LocalStore(h.context,client.session));cold.settleLocalEdits();assert.equal(cold.snapshot().pending.length,1);assert.equal(cold.snapshot().syncBlocked,true);client.played=async()=>{};await AppService.flushPending();assert.equal(pending().length,0);verify(local,true);
});
test('failed final retention journal write leaves durable desired intent after repaired mirrors',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);const original=local.saveExperience;let saves=0;local.saveExperience=function(value){if(++saves===2)throw Error('disk_full');return original.call(this,value)};r.gate.resolve();assert.equal((await r.result).error.message,'sync_cache_write_failed');assert.equal(pending()[0].localOnly,undefined);verify(local,true);local.saveExperience=original;client.played=async()=>{};await AppService.flushPending();assert.equal(pending().length,0);verify(local,true);
});
test('failed block-state write reports storage failure and preserves original unresolved remote intent',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);const original=local.saveExperience;local.saveExperience=()=>{throw Error('disk_full')};r.gate.resolve();assert.equal((await r.result).error.message,'disk_full');assert.equal(pending()[0].value,true);assert.equal(pending()[0].localOnly,undefined);local.saveExperience=original;
});
test('initial journal failure sends no request and publishes no accepted intent',async()=>{
 const {item,client,local}=setup();let sends=0;client.played=async()=>{sends++};const original=local.saveExperience;local.saveExperience=()=>{throw Error('disk_full')};await assert.rejects(AppService.edit(item,false,true),/disk_full/);assert.equal(sends,0);assert.equal(pending().length,0);local.saveExperience=original;
});
test('transfer lease failure remains an explicit error with recoverable journal',async()=>{
 const {item,client,local}=setup();let sends=0;client.played=async()=>{sends++};const original=local.transfer;local.transfer=async()=>{throw Error('account_busy')};await assert.rejects(AppService.edit(item,false,true),/account_busy/);assert.equal(sends,0);assert.equal(pending()[0].value,true);local.transfer=original;
});
test('cold initialization retains requested state in explicit offline mode without HTTP',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);AppService.experience.update(s=>{s.offline=true});client.played=async()=>{throw Error('no HTTP allowed')};AppService.useClient(client);verify(local,true);assert.equal(pending().length,1);assert.equal(AppService.downloads[0].item.UserData.Played,true);
});
test('only local corrections require no validation or remote write during automatic settlement',async()=>{
 const {item,client,local}=setup();AppService.experience.update(s=>{s.pending=[{id:'movie',field:'played',value:false,revision:1,item,localOnly:true}]});let calls=0;client.validateAccount=async()=>{calls++;throw Error('permission_denied')};client.played=async()=>{calls++};await background(client);assert.equal(calls,0);assert.equal(pending().length,0);verify(local,false,false,170000000);
});
test('automatic settlement repairs local state before a server validation failure while retaining remote progress',async()=>{
 const {item,client,local}=setup();AppService.recordOfflinePosition(item,45000);AppService.experience.update(s=>{s.pending=[{id:'movie',field:'played',value:false,revision:1,item,localOnly:true}]});client.validateAccount=async()=>{throw Error('permission_denied')};await background(client);verify(local);assert.equal(pending().length,0);assert.equal(local.experience().positions.length,1);assert.equal(local.experience().syncBlocked,true);
});
test('direct replay settles local corrections and only uploads legitimate progress',async()=>{
 const {item,client,local}=setup();AppService.recordOfflinePosition(item,45000);AppService.experience.update(s=>{s.pending=[{id:'movie',field:'played',value:false,revision:1,item,localOnly:true}]});const calls=[];client.played=async()=>calls.push('played');client.offlinePosition=async()=>calls.push('position');await AppService.flushPending();assert.deepEqual(calls,['position']);verify(local);assert.equal(pending().length,0);assert.equal(local.experience().positions.length,0);
});
test('a closed ownership gate settles no correction and sends no request',async()=>{
 const {item,client,local}=setup();AppService.experience.update(s=>{s.pending=[{id:'movie',field:'played',value:false,revision:1,item,localOnly:true}]});await PendingSync.flush(client,AppService.experience,async()=>false);assert.equal(pending().length,1);verify(local,false,false,170000000);
});
test('local-only marker schema accepts legacy absence and rejects nonboolean values',()=>{
 const state=new ExperienceState();state.pending=[{id:'movie',field:'played',value:false,revision:1}];assert.equal(validExperience(state),true);state.pending[0].localOnly=true;assert.equal(validExperience(state),true);state.pending[0].localOnly='yes';assert.equal(validExperience(state),false);
});
test('account replacement prevents late failure from touching replacement account',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);setup(false,false,'replacement');r.gate.resolve();assert.equal((await r.result).error.message,'login_required');assert.equal(local.experience().pending[0].value,true);verify(AppService.local,false,false,170000000);
});
test('retention preserves active download identity, files and unrelated memberships',async()=>{
 const {item,client,local,record}=setup(),r=launch(item,false,true,client);await tick();record.state='downloading';record.progress=.63;AppService.tasks.set('active',record);AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);assert.equal(AppService.downloads[0],record);assert.equal(AppService.tasks.get('active'),record);assert.equal(record.progress,.63);assert.equal(record.state,'downloading');verify(local,true);assert.deepEqual(local.snapshot().memberships,[{libraryId:'lib',itemIds:['movie','other']}]);assert.equal(local.home()[0].items[1].Id,'other');assert.equal(fs.readFileSync(record.path,'utf8'),'fixture');
});
for(const favorite of [false,true])test(`entering offline mode while ${favorite?'another field':'the same field'} waits prevents its HTTP send and retains the intent`,async()=>{
 const {item,client}=setup(),gate=h.deferred();let calls=0;client.played=async()=>{calls++;await gate.promise};client.favorite=async()=>{calls++};const first=AppService.edit(item,false,true);await tick();const second=AppService.edit(item,favorite,favorite);await tick();AppService.experience.update(s=>{s.offline=true});gate.resolve();await first;const queued=await second;assert.equal(calls,1);assert.equal(queued,true);assert.equal(pending().some(p=>p.field===(favorite?'favorite':'played')&&p.value===favorite),true);
});
(async()=>{for(const [name,fn]of tests){h.reset();await fn();await PendingSync.jobs;console.log('PASS '+name)}console.log(`${tests.length} edit intent retention regressions passed. Real temporary files and explicit remote/OS fixtures do not prove native lifecycle or live Jellyfin.`)})().catch(e=>{console.error(e);process.exitCode=1});
