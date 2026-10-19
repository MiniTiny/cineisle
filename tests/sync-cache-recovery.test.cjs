// Actual AppService/LocalStore/PendingSync, real temporary JSON files; HTTP/Asset/OS scheduler are explicit fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./feature-regression.test.cjs');
const {AppService}=h.load('service/AppService.ets'),{LocalStore}=h.load('service/LocalStore.ets'),{ExperienceStore}=h.load('service/ExperienceStore.ets');
const {PendingSync}=h.load('service/PendingSync.ets'),{SessionStore}=h.load('service/SessionStore.ets'),{JellyfinClient}=h.load('service/JellyfinClient.ets');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
global.AppStorage||={setOrCreate(){}};
function setup(user='a') {
 const client=h.activate(user),local=AppService.local;
 const item={Id:'movie',Name:'Current metadata',Type:'Movie',Genres:['Keep'],UserData:{PlaybackPositionTicks:170000000,Played:false,IsFavorite:false,PlayCount:7}};
 AppService.snapshot=h.snapshot([item,h.film('other')],[h.library('lib')],[{libraryId:'lib',itemIds:['movie','other']}]);local.saveSnapshot(AppService.snapshot);
 const file=path.join(local.directory,'download-00000000000000000000000000000025.mp4');fs.writeFileSync(file,'fixture-media');
 AppService.downloads=[{id:item.Id,item,path:file,fileId:'00000000000000000000000000000025',mediaSourceId:'source',state:'complete',progress:1}];local.saveDownloads(AppService.downloads);
 local.saveHome([{id:'resume',kind:'resume',name:'Home',libraryId:'lib',items:[item,h.film('other')]}]);
 client.played=async()=>{};client.favorite=async()=>{};client.offlinePosition=async()=>{};client.validateAccount=async()=>{};
 return {client,local,item,record:AppService.downloads[0]};
}
function mirrors(local=AppService.local) {return [local.snapshot().items.find(i=>i.Id==='movie'),...local.downloads().filter(r=>r.id==='movie').map(r=>r.item),local.home()[0]?.items.find(i=>i.Id==='movie')].filter(Boolean)}
function verify(local=AppService.local,ticks=0,played=true,favorite=false) {const m=mirrors(local);assert.equal(m.length,3);for(const i of m){assert.equal(i.UserData.PlaybackPositionTicks,ticks);assert.equal(i.UserData.Played,played);assert.equal(i.UserData.IsFavorite,favorite);assert.equal(i.Name,'Current metadata');assert.deepEqual(i.Genres,['Keep']);assert.equal(i.UserData.PlayCount,7);}return m;}
function intent(item,ticks=0,played=true) {AppService.experience.update(s=>{s.pending=[{id:item.Id,field:'played',value:played,revision:101,item:{...item,Name:'Stale intent metadata'}}];s.positions=[{id:item.Id,ticks,revision:101,item:{...item,Name:'Stale intent metadata',UserData:{...item.UserData,LastPlayedDate:'2026-10-20T00:00:00Z'}}}];s.offline=false;});}
function drained(local=AppService.local) {const s=new ExperienceStore(local).snapshot();assert.equal(s.pending.length,0);assert.equal(s.positions.length,0)}
async function background(client,active=true) {await SessionStore.save(client.session);h.context.applicationInfo={name:'com.cineisle.fixture'};h.capabilities.add('SystemCapability.ResourceSchedule.WorkScheduler');PendingSync.configure(h.context,active?()=>({client:AppService.client,local:AppService.local,store:AppService.experience}):undefined);if(!active)PendingSync.owner=undefined;PendingSync.interactive=false;await PendingSync.run();await PendingSync.jobs;}

test('stop intent survives failed mirror write, upload and cold reconstruction with all three mirrors repaired',async()=>{
 const {item,local}=setup(),save=local.saveSnapshot;local.saveSnapshot=()=>{throw Error('disk_full')};assert.throws(()=>AppService.recordOfflineStop(item,93000,100000),/disk_full/);local.saveSnapshot=save;
 await AppService.flushPending();drained();verify(new LocalStore(h.context,AppService.client.session));assert.equal(AppService.downloads[0].item.UserData.Played,true);
});
for(const stage of ['saveSnapshot','saveDownloads','saveHome'])for(const after of [false,true])test(`${stage} ${after?'after atomic rename':'before write'} failure retains intent and recovers on cold replay`,async()=>{
 const {item,client,local}=setup();intent(item);const original=local[stage];local[stage]=function(...args){if(after)original.apply(this,args);throw Error('disk_full')};
 await assert.rejects(AppService.flushPending(),/sync_cache_write_failed/);assert.equal(local.experience().pending.length,1);assert.equal(local.experience().positions.length,1);local[stage]=original;
 const cold=new LocalStore(h.context,client.session);await cold.transfer(()=>PendingSync.flush(client,new ExperienceStore(cold),async()=>true));drained(cold);verify(cold);
});
test('acknowledgement failure after all mirrors are durable retains a recoverable whole item',async()=>{
 const {item,client,local}=setup();intent(item);const original=local.saveExperience;client.offlinePosition=async()=>{local.saveExperience=()=>{throw Error('disk_full')}};
 await assert.rejects(AppService.flushPending(),/sync_cache_write_failed/);verify(local);assert.equal(local.experience().pending.length,1);assert.equal(local.experience().positions.length,1);local.saveExperience=original;client.offlinePosition=async()=>{};await AppService.flushPending();drained();verify();
});
test('real rename failure leaves the intent and original cache recoverable',async()=>{
 const {item,local}=setup();intent(item);const api=h.platform.get('@ohos.file.fs'),original=api.renameSync;api.renameSync=(a,b)=>{if(b===local.directory+'/downloads.json')throw Error('ENOSPC');return original(a,b)};
 try{await assert.rejects(AppService.flushPending(),/sync_cache_write_failed/);assert.equal(local.experience().positions.length,1);}finally{api.renameSync=original}
 await AppService.flushPending();drained();verify();
});
test('active download record identity, task state, paths and unrelated metadata survive acknowledgement',async()=>{
 const {item,record}=setup();intent(item);record.state='downloading';record.progress=.63;record.agentId='active-agent';AppService.tasks.set('owned-task',record);
 await AppService.flushPending();verify();assert.equal(AppService.downloads[0],record);assert.equal(AppService.tasks.get('owned-task'),record);assert.equal(record.state,'downloading');assert.equal(record.progress,.63);assert.equal(record.agentId,'active-agent');assert.equal(record.item.UserData.Played,true);
});
test('online edit cache failure retains its own intent and replay repairs every mirror',async()=>{
 const {item,local}=setup(),original=local.saveSnapshot;local.saveSnapshot=()=>{throw Error('disk_full')};await assert.rejects(AppService.edit(item,true,true),/sync_cache_write_failed/);assert.equal(local.experience().pending[0].field,'favorite');local.saveSnapshot=original;
 await AppService.flushPending();drained();verify(local,170000000,false,true);
});
test('normal online edit updates cached download and home as well as live library without stale metadata',async()=>{
 const {item}=setup();const stale={...item,Name:'Old server response',Genres:['Old']};assert.equal(await AppService.edit(stale,true,true),false);drained();verify(AppService.local,170000000,false,true);assert.equal(AppService.snapshot.items[0].Name,item.Name);
});
test('acknowledging one online field retains concurrent fields and position while materializing their latest values',async()=>{
 const {item,client,local}=setup();intent(item,450000000,false);const gate=h.deferred();client.favorite=()=>gate.promise;const op=AppService.edit(item,true,true);await new Promise(setImmediate);gate.resolve();await op;
 assert.deepEqual(local.experience().pending.map(e=>e.field),['played']);assert.equal(local.experience().positions[0].ticks,450000000);verify(local,450000000,false,true);await AppService.flushPending();drained();verify(local,450000000,false,true);
});
test('an older online response cannot overwrite a newer raw playback position',async()=>{
 const {item,client,local}=setup(),gate=h.deferred();client.favorite=()=>gate.promise;const op=AppService.edit(item,true,true);await new Promise(setImmediate);AppService.recordOfflinePosition(item,45000);gate.resolve();await op;verify(local,450000000,false,true);assert.equal(AppService.snapshot.items[0].UserData.PlaybackPositionTicks,450000000);
});
test('concurrent online favorite and played responses merge only their own latest fields',async()=>{
 const {item,client,local}=setup(),gate=h.deferred();client.favorite=()=>gate.promise;const one=AppService.edit(item,true,true);await new Promise(setImmediate);const two=AppService.edit(item,false,true);gate.resolve();await Promise.all([one,two]);drained();verify(local,170000000,true,true);
});
test('stale whole-item response never materializes or removes a newer durable position',async()=>{
 const {item,client,local}=setup();intent(item);const gate=h.deferred();client.offlinePosition=()=>gate.promise;const replay=AppService.flushPending();await new Promise(setImmediate);
 AppService.experience.update(s=>{s.positions[0].ticks=450000000;s.positions[0].revision=102});gate.resolve();await replay;assert.equal(local.snapshot().items[0].UserData.PlaybackPositionTicks,170000000);assert.equal(local.experience().positions[0].ticks,450000000);client.offlinePosition=async()=>{};await AppService.flushPending();drained();verify(local,450000000,true);
});
test('other items, library membership and home layout survive repairing one item',async()=>{
 const {item,local}=setup();intent(item);await AppService.flushPending();verify();const s=local.snapshot();assert.deepEqual(s.memberships,[{libraryId:'lib',itemIds:['movie','other']}]);assert.equal(s.libraries[0].Id,'lib');assert.equal(s.items.find(i=>i.Id==='other').UserData,undefined);assert.equal(local.home()[0].name,'Home');assert.equal(local.home()[0].items[1].Id,'other');assert.equal(local.downloads().length,1);
});
test('a missing library item is restored from the newest valid journal item without inventing a download',async()=>{
 const {item,local}=setup();local.saveSnapshot(h.snapshot([]));local.saveDownloads([]);intent(item);AppService.experience.update(s=>{s.positions[0].revision=103;s.positions[0].item={...item,Name:'Newest journal item'}});await AppService.flushPending();drained();const s=local.snapshot();assert.equal(s.items[0].Name,'Newest journal item');assert.equal(s.items[0].UserData.Played,true);assert.equal(local.downloads().length,0);
});
test('legacy field intent without item metadata updates existing mirrors safely',async()=>{
 const {local}=setup();AppService.experience.update(s=>{s.pending=[{id:'movie',field:'favorite',value:true,revision:1}]});await AppService.flushPending();drained();verify(local,170000000,false,true);
});
test('malformed library cache is preserved and rebuilt from valid durable intent',async()=>{
 const {item,local}=setup();intent(item);fs.writeFileSync(local.directory+'/library.json','{broken');await AppService.flushPending();drained();assert.ok(fs.readdirSync(local.directory).some(n=>n.startsWith('library.json.corrupt-')));assert.equal(local.snapshot().items[0].UserData.Played,true);assert.equal(fs.readFileSync(AppService.downloads[0].path,'utf8'),'fixture-media');
});
test('active automatic replay refreshes visible items after repairing caches',async()=>{
 const {item,client,record}=setup();intent(item);await background(client);drained();verify();assert.equal(record,AppService.downloads[0]);assert.equal(record.item.UserData.Played,true);assert.equal(AppService.snapshot.items[0].UserData.Played,true);
});
test('background cache failure schedules bounded retry instead of blocking the account as authentication failure',async()=>{
 const {item,client,local}=setup();intent(item);const original=local.saveHome;local.saveHome=()=>{throw Error('disk_full')};await background(client);const s=local.experience();assert.equal(s.pending.length,1);assert.equal(s.syncAttempts,1);assert.equal(s.syncBlocked,false);assert.ok(s.syncNextAt>Date.now());assert.equal(PendingSync.issue,'sync_retry_waiting');local.saveHome=original;AppService.experience.update(s=>{s.syncNextAt=0});await PendingSync.run();drained();verify();
});
test('persistent local write failures stop after five automatic attempts and recover on explicit replay',async()=>{
 const {item,client,local}=setup();intent(item);const original=local.saveHome,clock=Date.now;let now=clock(),calls=0;local.saveHome=()=>{throw Error('disk_full')};client.played=async()=>{calls++};Date.now=()=>now;
 try{await background(client);for(let n=1;n<=5;n++){const s=local.experience();assert.equal(s.syncAttempts,n);assert.equal(s.syncBlocked,false);assert.equal(s.pending.length,1);await PendingSync.run();assert.equal(calls,n);if(n<5){now=s.syncNextAt+1;await PendingSync.run();}}assert.equal(PendingSync.issue,'sync_retry_exhausted');local.saveHome=original;await AppService.flushPending();drained();verify();}finally{Date.now=clock;local.saveHome=original}
});
test('cold background account replay repairs its own files without publishing into a different active account',async()=>{
 const {item,client:one,local:localA}=setup('a');intent(item);await SessionStore.save(one.session);const {client:two,local:localB}=setup('b');await SessionStore.save(two.session);const played=JellyfinClient.prototype.played,pos=JellyfinClient.prototype.offlinePosition,validate=JellyfinClient.prototype.validateAccount;
 JellyfinClient.prototype.played=async()=>{};JellyfinClient.prototype.offlinePosition=async()=>{};JellyfinClient.prototype.validateAccount=async()=>{};
 try{await background(two,false);drained(localA);verify(localA);verify(localB,170000000,false);assert.equal(AppService.snapshot.items[0].UserData.Played,false);}finally{JellyfinClient.prototype.played=played;JellyfinClient.prototype.offlinePosition=pos;JellyfinClient.prototype.validateAccount=validate}
});
test('reconstructed stores materialize fresh cache metadata rather than stale in-memory snapshots',async()=>{
 const {item,client,local}=setup();intent(item);const s=local.snapshot();s.items[0].Name='Current metadata';s.items[0].Overview='Fresh server detail';local.saveSnapshot(s);const cold=new ExperienceStore(new LocalStore(h.context,client.session));await PendingSync.flush(client,cold,async()=>true);drained();verify();assert.equal(local.snapshot().items[0].Overview,'Fresh server detail');
});
test('late response after account replacement neither acknowledges nor materializes the old account',async()=>{
 const {item,client,local}=setup();intent(item);const gate=h.deferred();client.played=()=>gate.promise;const replay=AppService.flushPending();await new Promise(setImmediate);setup('replacement');gate.resolve();await replay;assert.equal(local.experience().pending.length,1);verify(local,170000000,false);verify(AppService.local,170000000,false);
});
test('a detached store can repair its files without invoking the replacement account refresh',async()=>{
 const {item,local}=setup();intent(item);const old=AppService.experience;setup('replacement');old.acknowledge('movie',()=>true);drained(local);verify(local);verify(AppService.local,170000000,false);assert.equal(AppService.snapshot.items[0].UserData.Played,false);
});
test('a UI listener failure cannot turn durable mirror acknowledgement into data loss',async()=>{
 const {item,local}=setup();intent(item);AppService.downloadListener=()=>{throw Error('view destroyed')};try{await AppService.flushPending();drained();verify(local);}finally{AppService.downloadListener=undefined}
});
test('a second flush after recovery sends nothing and preserves all repaired cache fields',async()=>{
 const {item,client}=setup();intent(item);let calls=0;client.played=async()=>{calls++};client.offlinePosition=async()=>{calls++};await AppService.flushPending();await AppService.flushPending();assert.equal(calls,2);drained();verify();
});
(async()=>{for(const [name,fn]of tests){h.reset();await fn();await PendingSync.jobs;console.log('PASS '+name)}console.log(`${tests.length} sync cache recovery regressions passed. Real files and explicit remote/OS fixtures do not prove live Jellyfin or native process scheduling.`)})().catch(e=>{console.error(e);process.exitCode=1});
