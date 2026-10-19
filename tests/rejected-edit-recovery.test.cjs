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
for(const favorite of [false,true])for(const base of [false,true])test(`rejected ${favorite?'favorite':'played'} ${!base} restores ${base} while retaining newer raw progress`,async()=>{
 const {item,client,local}=setup(favorite?false:base,favorite?base:false),r=launch(item,favorite,!base,client);await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).error.message,'permission_denied');verify(local,favorite?false:base,favorite?base:false);assert.equal(pending().length,0);
});
test('a stale caller item cannot define the rollback base',async()=>{
 const {item,client}=setup(),r=launch({...item,UserData:{Played:true,IsFavorite:true}},false,true,client);await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.ok((await r.result).error);verify();
});
test('a prior offline intent is restored and remains remotely replayable',async()=>{
 const {item,client,local}=setup();await AppService.edit(item,false,true,true);const prior=pending()[0],r=launch(item,false,false,client);await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.ok((await r.result).error);verify(local,true);assert.equal(pending()[0].revision,prior.revision);assert.equal(pending()[0].localOnly,undefined);client.played=async()=>{};await AppService.flushPending();assert.equal(pending().length,0);verify(local,true);
});
for(const firstSuccess of [false,true])test(`two online edits capture resolved state; first ${firstSuccess?'succeeds':'is rejected'} and second is rejected`,async()=>{
 const {item,client,local}=setup(),gate=h.deferred();let calls=0;client.played=async()=>{calls++;if(calls===1){await gate.promise;if(firstSuccess)return;}throw Error('permission_denied')};
 const one=AppService.edit(item,false,true).catch(e=>e);await tick();const two=AppService.edit(item,false,!firstSuccess).catch(e=>e);await tick();assert.equal(calls,1);AppService.recordOfflinePosition(item,45000);gate.resolve();await one;assert.equal((await two).message,'permission_denied');assert.equal(calls,2);verify(local,firstSuccess);assert.equal(pending().length,0);
});
test('a later successful online intent survives an earlier rejected one',async()=>{
 const {item,client,local}=setup(),gate=h.deferred();let calls=0;client.played=async()=>{if(++calls===1){await gate.promise;throw Error('permission_denied')}};
 const one=AppService.edit(item,false,true).catch(e=>e);await tick();const two=AppService.edit(item,false,true);AppService.recordOfflinePosition(item,45000);gate.resolve();assert.ok(await one);await two;verify(local,true);assert.equal(pending().length,0);
});
test('a newer offline intent supersedes an online edit still waiting to start',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();const waiting=AppService.edit(item,false,false);await AppService.edit(item,false,true,true);AppService.recordOfflinePosition(item,45000);let extra=0;const original=client.played;client.played=async(...args)=>{extra++;return original(...args)};r.gate.resolve();assert.ok((await r.result).error);assert.equal(await waiting,true);assert.equal(extra,0);verify(local,true,false,450000000,true);assert.equal(pending()[0].value,true);
});
test('newer offline stop ownership prevents the rejected older edit from changing its state',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflineStop(item,45000,100000);const revision=pending()[0].revision;r.gate.resolve();assert.ok((await r.result).error);assert.equal(pending()[0].revision,revision);verify(local,false,false,450000000,true);assert.equal(pending()[0].value,false);
});
test('a successful independent favorite field survives rejected played state and newer progress',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();const other=AppService.edit(item,true,true);AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.ok((await r.result).error);await other;verify(local,false,true);assert.equal(pending().length,0);
});
test('pending independent edits and their embedded item snapshots are corrected without losing their values',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();await AppService.edit(item,true,true,true);AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.ok((await r.result).error);verify(local,false,true);assert.equal(pending()[0].field,'favorite');assert.equal(pending()[0].item.UserData.Played,false);
});
for(const message of ['network_failed','http_503'])test(message+' retains unknown outcomes for replay instead of rolling back',async()=>{
 const {item,client}=setup(),r=launch(item,false,true,client,Error(message));await tick();AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.equal((await r.result).value,true);assert.equal(pending()[0].value,true);assert.equal(pending()[0].localOnly,undefined);
});
for(const stage of ['saveSnapshot','saveDownloads','saveHome'])for(const after of [false,true])test(`${stage} ${after?'after rename':'before write'} failure retains local correction for cold replay without a remote field mutation`,async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);const original=local[stage];local[stage]=function(...args){if(after)original.apply(this,args);throw Error('disk_full')};r.gate.resolve();assert.equal((await r.result).error.message,'sync_cache_write_failed');assert.equal(pending()[0].localOnly,true);assert.equal(pending()[0].value,false);assert.equal(local.experience().positions[0].item.UserData.Played,false);local[stage]=original;
 const cold=new ExperienceStore(new LocalStore(h.context,client.session));let writes=0;client.played=async()=>{writes++};cold.settleLocalEdits();assert.equal(writes,0);assert.equal(cold.snapshot().pending.length,0);verify(local);
});
test('failed final acknowledgement leaves the durable correction after repaired mirrors',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);const original=local.saveExperience;let saves=0;local.saveExperience=function(value){if(++saves===2)throw Error('disk_full');return original.call(this,value)};r.gate.resolve();assert.equal((await r.result).error.message,'sync_cache_write_failed');assert.equal(pending()[0].localOnly,true);verify(local);local.saveExperience=original;AppService.experience.settleLocalEdits();assert.equal(pending().length,0);verify(local);
});
test('failed rejection journal write reports failure and keeps the unresolved original intent',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);const original=local.saveExperience;local.saveExperience=()=>{throw Error('disk_full')};r.gate.resolve();assert.equal((await r.result).error.message,'disk_full');assert.equal(pending()[0].value,true);assert.equal(pending()[0].localOnly,undefined);local.saveExperience=original;
});
test('cold account initialization repairs local corrections even in explicit offline mode',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);const original=local.saveHome;local.saveHome=()=>{throw Error('disk_full')};r.gate.resolve();assert.ok((await r.result).error);local.saveHome=original;AppService.experience.update(s=>{s.offline=true});client.played=async()=>{throw Error('no HTTP allowed')};AppService.useClient(client);verify(local);assert.equal(pending().length,0);assert.equal(AppService.experience.snapshot().offline,true);assert.equal(AppService.downloads[0].item.UserData.Played,false);
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
test('account replacement prevents a late rejection from repairing the replacement account',async()=>{
 const {item,client,local}=setup(),r=launch(item,false,true,client);await tick();AppService.recordOfflinePosition(item,45000);setup(false,false,'replacement');r.gate.resolve();assert.ok((await r.result).error);assert.equal(local.experience().pending[0].value,true);verify(AppService.local,false,false,170000000);
});
test('repair preserves active download task identity and unrelated library structure',async()=>{
 const {item,client,local,record}=setup(),r=launch(item,false,true,client);await tick();record.state='downloading';record.progress=.63;AppService.tasks.set('active',record);AppService.recordOfflinePosition(item,45000);r.gate.resolve();assert.ok((await r.result).error);assert.equal(AppService.downloads[0],record);assert.equal(AppService.tasks.get('active'),record);assert.equal(record.progress,.63);assert.equal(record.state,'downloading');verify(local);assert.deepEqual(local.snapshot().memberships,[{libraryId:'lib',itemIds:['movie','other']}]);assert.equal(local.home()[0].items[1].Id,'other');
});
for(const favorite of [false,true])test(`entering offline mode while ${favorite?'another field':'the same field'} waits prevents its HTTP send and retains the intent`,async()=>{
 const {item,client}=setup(),gate=h.deferred();let calls=0;client.played=async()=>{calls++;await gate.promise};client.favorite=async()=>{calls++};const first=AppService.edit(item,false,true);await tick();const second=AppService.edit(item,favorite,favorite);await tick();AppService.experience.update(s=>{s.offline=true});gate.resolve();await first;const queued=await second;assert.equal(calls,1);assert.equal(queued,true);assert.equal(pending().some(p=>p.field===(favorite?'favorite':'played')&&p.value===favorite),true);
});
(async()=>{for(const [name,fn]of tests){h.reset();await fn();await PendingSync.jobs;console.log('PASS '+name)}console.log(`${tests.length} rejected edit recovery regressions passed. Real temporary files and explicit remote/OS fixtures do not prove native lifecycle or live Jellyfin.`)})().catch(e=>{console.error(e);process.exitCode=1});
