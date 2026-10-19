// Actual Player -> AppService -> atomic LocalStore/outbox, with explicit native AVPlayer fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./player-regression.test.cjs');
const {load,platform,directory,AppService,Player,NativePlayer,nativeQueue,nativePlayers,settle}=h;
const api=platform.get('@ohos.file.fs');
Object.assign(api,{mkdirSync:fs.mkdirSync,openSync:(p,flags)=>({fd:fs.openSync(p,flags)}),writeSync:fs.writeSync,fsyncSync:fs.fsyncSync,closeSync:f=>fs.closeSync(f.fd),renameSync:fs.renameSync,unlinkSync:fs.unlinkSync,OpenMode:{READ_ONLY:0,READ_WRITE:fs.constants.O_RDWR,CREATE:fs.constants.O_CREAT,WRITE_ONLY:fs.constants.O_WRONLY,TRUNC:fs.constants.O_TRUNC}});
require('./sync-platform.cjs').files(api);
const {LocalStore}=load('service/LocalStore.ets'),{JellyfinClient}=load('service/JellyfinClient.ets');
let account=0;
function setup(position=17000) {
 h.reset();AppService.context={...h.systemPlatform.context,filesDir:directory};AppService.client.session.serverId='server';AppService.client.session.userId='progress-'+(++account);AppService.useClient(AppService.client);AppService.experience.update(s=>{s.offline=true});
 const item={Id:'movie',Name:'Offline fixture',Type:'Movie',RunTimeTicks:1200000000,UserData:{PlaybackPositionTicks:position*10000}};
 const file=path.join(AppService.local.directory,'download-00000000000000000000000000000025.mp4');fs.writeFileSync(file,'SDK fixture');
 AppService.downloads=[{id:item.Id,item,state:'complete',progress:1,path:file,fileId:'00000000000000000000000000000025',mediaSourceId:'source'}];AppService.recordOfflinePosition(item,position);
 return {route:AppService.downloadPlayback(AppService.downloads[0]),client:AppService.client};
}
async function start(r,n=new NativePlayer(),paused=false) {
 n.duration=120000;nativeQueue.push(Promise.resolve(n));h.setRoute(r);const p=new Player();p.aboutToAppear();p.surfaceId='surface';await p.controller.open(r,'surface',-1,paused);await settle();return {p,n};
}
function cold(client=AppService.client) { const store=new LocalStore(AppService.context,client.session);return {library:store.snapshot(),pending:store.experience(),downloads:store.downloads()}; }
function ticks(client=AppService.client,id='movie') {const c=cold(client);return [c.library.items.find(i=>i.Id===id)?.UserData?.PlaybackPositionTicks,c.pending.positions.find(i=>i.id===id)?.ticks,c.downloads.find(i=>i.id===id)?.item.UserData?.PlaybackPositionTicks];}
async function leave(p) {p.onPageHide();p.aboutToDisappear();await settle();}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
for(const kind of ['prepare','surface','restart'])test(kind+' startup failure preserves prior snapshot,download and outbox progress',async()=>{
 const {route:r}=setup(),revision=AppService.experience.snapshot().positions[0].revision,n=new NativePlayer();
 if(kind==='surface')Object.defineProperty(n,'surfaceId',{set(){throw Error('surface')}});else n.prepare=async()=>{throw Error('unsupported')};
 if(kind==='restart')r.item=JSON.parse(JSON.stringify({...r.item,UserData:{PlaybackPositionTicks:0}}));
 const {p}=await start(r,n);assert.equal(p.state,'error');assert.equal(p.controller.snapshot().checkpoint,undefined);assert.equal(p.playbackPosition,0);await leave(p);assert.deepEqual(ticks(),[170000000,170000000,170000000]);assert.equal(AppService.experience.snapshot().positions[0].revision,revision);
 AppService.useClient(AppService.client);assert.equal(AppService.snapshot.items[0].UserData.PlaybackPositionTicks,170000000);
});
test('exit during native creation cannot write placeholder zero or resurrect playback',async()=>{
 const {route:r}=setup(),gate=h.deferred();nativeQueue.push(gate.promise);h.setRoute(r);const p=new Player();p.aboutToAppear();const opening=p.controller.open(r,'surface');await settle();await leave(p);const n=new NativePlayer();gate.resolve(n);await opening;assert.equal(n.state,'released');assert.deepEqual(ticks(),[170000000,170000000,170000000]);
});
test('initial seek awaits native acknowledgement; early playing zero never becomes durable',async()=>{
 const {route:r}=setup(),n=new NativePlayer();n.seek=function(ms){this.calls.push(['seek',ms]);this.emit('timeUpdate',0)};const {p}=await start(r,n);
 n.emit('timeUpdate',0);p.saveOffline();assert.equal(p.controller.snapshot().checkpoint,undefined);assert.deepEqual(ticks(),[170000000,170000000,170000000]);
 n.emit('seekDone',17000);assert.equal(p.controller.snapshot().checkpoint,17000);n.emit('timeUpdate',18000);await leave(p);assert.deepEqual(ticks(),[180000000,180000000,180000000]);
});
test('failure after real progress saves the controller checkpoint rather than a reset UI clock',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',25000);n.emit('error');p.playbackPosition=0;assert.equal(p.controller.snapshot().checkpoint,25000);await leave(p);assert.deepEqual(ticks(),[250000000,250000000,250000000]);
});
test('equivalent observed route wrappers still save the same media and file checkpoint',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);p.route={...p.route,item:{...p.route.item}};n.emit('timeUpdate',25000);await leave(p);assert.deepEqual(ticks(),[250000000,250000000,250000000]);
});
test('retry persists last confirmed progress before a second failed load resets its checkpoint',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',25000);n.emit('error');await settle();const replacement=new NativePlayer();replacement.prepare=async()=>{throw Error('still bad')};nativeQueue.push(Promise.resolve(replacement));await p.toggle();await settle();assert.equal(p.state,'error');assert.equal(p.controller.snapshot().checkpoint,undefined);await leave(p);assert.deepEqual(ticks(),[250000000,250000000,250000000]);
});
test('pending seek retains previous checkpoint until seekDone confirms an intentional zero',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);await p.controller.pausePlayback();n.seek=function(ms){this.calls.push(['seek',ms]);this.emit('timeUpdate',0)};
 p.controller.seek(0);p.saveOffline();assert.deepEqual(ticks(),[170000000,170000000,170000000]);n.emit('seekDone',0);await leave(p);assert.deepEqual(ticks(),[0,0,0]);assert.notEqual(cold().library.items[0].UserData.Played,true);
});
test('playback completion remains played at zero across hide,disappear and cold reconstruction',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.change('completed');await settle();assert.equal(p.finished,true);assert.equal(cold().library.items[0].UserData.Played,true);await leave(p);assert.deepEqual(ticks(),[0,0,0]);assert.equal(cold().pending.pending.find(x=>x.field==='played').value,true);AppService.useClient(AppService.client);assert.equal(AppService.snapshot.items[0].UserData.PlaybackPositionTicks,0);
});
test('replay cannot save the completed duration before its first new progress update',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.change('completed');await settle();await p.toggle();assert.equal(p.controller.snapshot().checkpoint,undefined);p.saveOffline();assert.deepEqual(ticks(),[0,0,0]);n.emit('timeUpdate',0);assert.equal(p.controller.snapshot().checkpoint,0);await leave(p);assert.deepEqual(ticks(),[0,0,0]);
});
test('paused prepared restart without a confirmed position preserves the previous resume point',async()=>{
 const {route:r}=setup();r.item=JSON.parse(JSON.stringify({...r.item,UserData:{PlaybackPositionTicks:0}}));const {p,n}=await start(r,new NativePlayer(),true);assert.equal(p.state,'prepared');n.emit('timeUpdate',0);assert.equal(p.controller.snapshot().checkpoint,undefined);await leave(p);assert.deepEqual(ticks(),[170000000,170000000,170000000]);
});
test('released completed replay followed immediately by exit cannot resurrect its old duration',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.change('completed');await settle();await p.system.stop();await settle();assert.equal(p.state,'released');const gate=h.deferred();nativeQueue.push(gate.promise);const replay=p.toggle();p.onPageHide();p.aboutToDisappear();gate.resolve(new NativePlayer());await replay;await settle();assert.deepEqual(ticks(),[0,0,0]);
});
test('late old time and seek acknowledgements cannot replace the failed stream checkpoint',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',25000);n.emit('error');n.emit('seekDone',0);n.emit('timeUpdate',0);await leave(p);assert.deepEqual(ticks(),[250000000,250000000,250000000]);
});
test('failed native seek leaves progress usable and rejects nonfinite or negative observations',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.seek=()=>{throw Error('seek rejected')};p.controller.seek(0);n.emit('timeUpdate',25000);for(const value of [NaN,Infinity,-1]){n.emit('timeUpdate',value);n.emit('seekDone',value)}assert.equal(p.controller.snapshot().checkpoint,25000);await leave(p);assert.deepEqual(ticks(),[250000000,250000000,250000000]);
});
test('late page teardown after account replacement cannot write its position into the new account',async()=>{
 const {route:r,client}=setup(),{p,n}=await start(r);n.emit('timeUpdate',25000);
 const next=new JellyfinClient({...client.session,userId:'different-account'},'10.10.0');AppService.useClient(next);AppService.recordOfflinePosition({...r.item,UserData:{PlaybackPositionTicks:320000000}},32000);await leave(p);assert.deepEqual(ticks(next),[320000000,320000000,undefined]);assert.notEqual(cold(client).pending.positions[0].ticks,320000000);
});
test('pending route replacement never assigns the previous media checkpoint to the new item',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',25000);const item={Id:'other',Name:'Other',Type:'Movie',UserData:{PlaybackPositionTicks:320000000}};AppService.recordOfflinePosition(item,32000);const gate=h.deferred();n.releaseWait=gate.promise;const next={...r,item};p.route=next;const replacement=new NativePlayer();replacement.prepare=async()=>{throw Error('bad next')};nativeQueue.push(Promise.resolve(replacement));const opening=p.controller.open(next,'surface');await settle();p.saveOffline();assert.deepEqual(ticks(AppService.client,'other').slice(0,2),[320000000,320000000]);gate.resolve();await opening;await settle();await leave(p);assert.deepEqual(ticks(AppService.client,'other').slice(0,2),[320000000,320000000]);
});
module.exports={setup,start,cold,ticks,leave,h};
if(require.main===module)(async()=>{for(const [name,fn]of tests){await fn();await settle();console.log('PASS '+name)}console.log(`${tests.length} offline progress regressions passed. Real temp files/cold stores with SDK fixtures do not prove native playback or real Jellyfin.`)})().catch(e=>{console.error(e);process.exitCode=1});
