// Fixed Kotlin oracle, actual Player lifecycle, atomic local files and explicit replay/SDK fixtures.
const assert=require('node:assert/strict');
const {setup,start,cold,ticks,leave,h}=require('./offline-progress.test.cjs');
const {AppService,NativePlayer,nativeQueue,settle,load,platform}=h;
const {offlineStopState}=load('utils/OfflinePlayback.ts');
const {PendingSync}=load('service/PendingSync.ets');
const oracle=require('./fixtures/offline-stop-kotlin.json');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const played=()=>AppService.experience.snapshot().pending.find(x=>x.id==='movie'&&x.field==='played');
function verify(position,watched) {
 assert.deepEqual(ticks(),[position*10000,position*10000,position*10000]);const c=cold();assert.equal(c.library.items[0].UserData.Played,watched);const p=c.pending.positions.find(p=>p.id==='movie'),e=c.pending.pending.find(e=>e.id==='movie'&&e.field==='played');assert.equal(e.value,watched);assert.equal(e.revision,p.revision);return p.revision;
}
function online(){AppService.experience.update(s=>{s.offline=false});}
test('all 349 independent Kotlin Float/truncation reference cases match',()=>{
 assert.equal(oracle.cases.length,349);for(const [p,d,percent,saved,watched]of oracle.cases)assert.deepEqual(offlineStopState(p,d),{position:saved,played:watched},`${p}/${d} -> ${percent}`);
});
test('unknown,nonfinite,negative and unrepresentable values cannot invent a stop percentage',()=>{
 for(const [p,d]of [[0,0],[1,-1],[1,NaN],[1,Infinity],[1,.5],[NaN,100],[Infinity,100],[-1,100],[Number.MAX_SAFE_INTEGER,100],[1,Number.MAX_VALUE]])assert.equal(offlineStopState(p,d),undefined);
 const {route:r}=setup();AppService.recordOfflinePosition(r.item,NaN,true);assert.deepEqual(ticks(),[170000000,170000000,170000000]);assert.equal(played(),undefined);
});
for(const [position,saved,watched]of [[9999,0,false],[10000,10000,false],[90000,90000,false],[90900,90900,false],[90999,90999,false],[91000,0,true],[100000,0,true]])test(`stop at ${position}/100000 stores ${saved}/${watched} atomically`,()=>{
 const {route:r}=setup();AppService.recordOfflineStop(r.item,position,100000);verify(saved,watched);
});
test('stop replaces older played intent and preserves favorite intent',async()=>{
 const {route:r}=setup();await AppService.edit(r.item,false,true,true);await AppService.edit(r.item,true,true,true);AppService.recordOfflineStop(r.item,45000,100000);verify(45000,false);const edits=AppService.experience.snapshot().pending;assert.equal(edits.filter(e=>e.field==='played').length,1);assert.equal(edits.find(e=>e.field==='favorite').value,true);assert.equal(cold().library.items[0].UserData.IsFavorite,true);
});
test('older online played response cannot overwrite a newer durable stop decision',async()=>{
 const {route:r,client}=setup();online();const gate=h.deferred();client.played=()=>gate.promise;const edit=AppService.edit(r.item,false,true);await settle();AppService.recordOfflineStop(r.item,45000,100000);verify(45000,false);gate.resolve();await edit;verify(45000,false);
});
test('a failed atomic intent write never publishes half a stop pair',()=>{
 const {route:r}=setup(),before=AppService.experience.snapshot(),original=AppService.local.saveExperience;AppService.local.saveExperience=()=>{throw Error('disk_full')};try{assert.throws(()=>AppService.recordOfflineStop(r.item,93000,100000),/disk_full/)}finally{AppService.local.saveExperience=original}assert.deepEqual(AppService.experience.snapshot(),before);assert.deepEqual(ticks(),[170000000,170000000,170000000]);assert.equal(played(),undefined);
});
test('unknown duration preserves trusted position and existing watched state',async()=>{
 const {route:r}=setup();await AppService.edit(r.item,false,true,true);const revision=played().revision;AppService.recordOfflineStop(r.item,45000,0);assert.deepEqual(ticks(),[450000000,450000000,450000000]);assert.equal(played().revision,revision);assert.equal(cold().library.items[0].UserData.Played,true);
});
test('real page exit applies high-percentage stop after native progress',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',111600);await leave(p);verify(0,true);
});
test('background audio continues with raw progress and only actual disposal applies stop',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);await p.system.setBackground(true);n.emit('timeUpdate',6000);p.onPageHide();await settle();assert.equal(n.state,'playing');assert.deepEqual(ticks(),[60000000,60000000,60000000]);assert.equal(played(),undefined);p.aboutToDisappear();await settle();verify(0,false);
});
test('pause is not stop and repeated final teardown cannot reintroduce raw progress',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',6000);await p.system.pause();p.saveOffline();assert.deepEqual(ticks(),[60000000,60000000,60000000]);assert.equal(played(),undefined);await p.system.stop();const revision=verify(0,false);p.saveOffline();await leave(p);assert.equal(verify(0,false),revision);
});
test('failed startup has no confirmed duration or stop point and retains the prior resume',async()=>{
 const {route:r}=setup(),n=new NativePlayer();n.prepare=async()=>{throw Error('bad')};const {p}=await start(r,n);await leave(p);assert.deepEqual(ticks(),[170000000,170000000,170000000]);assert.equal(played(),undefined);
});
test('same-stream failed retry retains the logical session stop point',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',111600);n.emit('error');await settle();const replacement=new NativePlayer();replacement.prepare=async()=>{throw Error('bad retry')};nativeQueue.push(Promise.resolve(replacement));await p.toggle();await settle();assert.equal(p.controller.snapshot().checkpoint,undefined);assert.equal(played(),undefined);await leave(p);verify(0,true);
});
test('exit while retry is awaiting native release settles the logical session exactly once',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',111600);const gate=h.deferred();n.releaseWait=gate.promise;n.emit('error');await settle();const retry=p.toggle();await settle();p.aboutToDisappear();await settle();verify(0,true);gate.resolve();await retry;await settle();assert.equal(h.nativePlayers.length,1);verify(0,true);
});
test('completed stream scrubbed back to the middle stops as resumable and unplayed',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.change('completed');await settle();assert.equal(cold().library.items[0].UserData.Played,true);p.controller.seek(45000);p.saveOffline();assert.deepEqual(ticks(),[450000000,450000000,450000000]);await leave(p);verify(45000,false);
});
test('released playback restarts from the normalized local position',async()=>{
 const {route:r}=setup(),{p,n}=await start(r);n.emit('timeUpdate',6000);await p.system.stop();verify(0,false);await p.toggle();await settle();assert.equal(p.route.item.UserData.PlaybackPositionTicks,0);assert.equal(h.nativePlayers.at(-1).calls.some(c=>c[0]==='seek'&&c[1]===17000),false);await leave(p);
});
test('old account teardown cannot publish a stop into the replacement account',async()=>{
 const {route:r,client}=setup(),{p,n}=await start(r);n.emit('timeUpdate',111600);const {JellyfinClient}=load('service/JellyfinClient.ets');AppService.useClient(new JellyfinClient({...client.session,userId:'stop-other'},'10.10.0'));AppService.recordOfflinePosition(r.item,32000);await leave(p);assert.deepEqual(ticks(),[320000000,320000000,undefined]);assert.equal(played(),undefined);
});
test('sync uses Android played/favorite/position order and acknowledges the whole item once',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);await AppService.edit(r.item,true,true,true);online();const calls=[],remote={position:0,played:true};client.played=async(id,value)=>{calls.push('played');remote.position=0;remote.played=value};client.favorite=async()=>calls.push('favorite');client.offlinePosition=async(id,value)=>{calls.push('position');remote.position=value};await AppService.flushPending();assert.deepEqual(calls,['played','favorite','position']);assert.deepEqual(remote,{position:450000000,played:false});assert.equal(AppService.experience.snapshot().pending.length,0);assert.equal(AppService.experience.snapshot().positions.length,0);
});
test('partial replay failure keeps both stop intents durable for cold retry',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);online();const calls=[];client.played=async()=>calls.push('played');client.offlinePosition=async()=>{calls.push('position');throw Error('network_failed')};await AppService.flushPending();assert.deepEqual(calls,['played','position']);verify(45000,false);const store=new(load('service/ExperienceStore.ets').ExperienceStore)(AppService.local);client.offlinePosition=async()=>calls.push('position');await PendingSync.flush(client,store,async()=>true);assert.deepEqual(calls,['played','position','played','position']);assert.equal(store.snapshot().positions.length,0);assert.equal(store.snapshot().pending.length,0);
});
test('new position during played response prevents stale position upload or partial acknowledgement',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);online();const gate=h.deferred(),calls=[];client.played=async()=>{calls.push('played');await gate.promise};client.offlinePosition=async()=>calls.push('position');const replay=AppService.flushPending();await settle();AppService.recordOfflinePosition(r.item,50000);gate.resolve();await replay;assert.deepEqual(calls,['played']);assert.equal(AppService.experience.snapshot().positions[0].ticks,500000000);assert.equal(played().value,false);
});
test('new position during final response retains the entire latest group for replay',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);online();const gate=h.deferred();client.played=async()=>{};client.offlinePosition=()=>gate.promise;const replay=AppService.flushPending();await settle();AppService.recordOfflinePosition(r.item,50000);gate.resolve();await replay;assert.equal(AppService.experience.snapshot().positions[0].ticks,500000000);assert.equal(played().value,false);
});
test('new played edit during response remains pending and blocks the old position send',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);online();const gate=h.deferred(),calls=[];client.played=async()=>{calls.push('played');await gate.promise};client.offlinePosition=async()=>calls.push('position');const replay=AppService.flushPending();await settle();await AppService.edit(r.item,false,true,true);gate.resolve();await replay;assert.deepEqual(calls,['played']);assert.equal(played().value,true);assert.equal(AppService.experience.snapshot().positions[0].ticks,450000000);
});
test('offline gate during played response retains the complete group and sends no position',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);online();const gate=h.deferred(),calls=[];client.played=async()=>{calls.push('played');await gate.promise};client.offlinePosition=async()=>calls.push('position');const replay=AppService.flushPending();await settle();AppService.experience.update(s=>{s.offline=true});gate.resolve();await replay;assert.deepEqual(calls,['played']);verify(45000,false);
});
test('acknowledgement disk failure retains both intents after remote writes',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);online();const original=AppService.local.saveExperience;client.played=async()=>{};client.offlinePosition=async()=>{AppService.local.saveExperience=()=>{throw Error('disk_full')}};try{await assert.rejects(AppService.flushPending(),/sync_cache_write_failed/)}finally{AppService.local.saveExperience=original}verify(45000,false);
});
test('a stale item does not acknowledge its new intent or block another unchanged item',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);AppService.recordOfflineStop({Id:'other',Name:'Other',Type:'Movie'},93000,100000);online();const gate=h.deferred(),calls=[];client.played=async(id)=>{calls.push(['played',id]);if(id==='movie')await gate.promise};client.offlinePosition=async(id)=>calls.push(['position',id]);const replay=AppService.flushPending();await settle();AppService.recordOfflinePosition(r.item,50000);gate.resolve();await replay;assert.deepEqual(calls,[['played','movie'],['played','other'],['position','other']]);assert.equal(AppService.experience.snapshot().positions.length,1);assert.equal(AppService.experience.snapshot().positions[0].ticks,500000000);assert.equal(played().value,false);
});
test('account replacement during a response retains the old pair and sends no new-account position',async()=>{
 const {route:r,client}=setup();AppService.recordOfflineStop(r.item,45000,100000);online();const old=AppService.experience,gate=h.deferred(),calls=[];client.played=async()=>{calls.push('played');await gate.promise};client.offlinePosition=async()=>calls.push('position');const replay=AppService.flushPending();await settle();const {JellyfinClient}=load('service/JellyfinClient.ets');AppService.useClient(new JellyfinClient({...client.session,userId:'replacement-stop'},'10.10.0'));gate.resolve();await replay;assert.deepEqual(calls,['played']);assert.equal(old.snapshot().positions.length,1);assert.equal(old.snapshot().pending.length,1);assert.equal(AppService.experience.snapshot().positions.length,0);
});
(async()=>{for(const [name,fn]of tests){await fn();await settle();console.log('PASS '+name)}console.log(`${tests.length} offline stop regressions passed. Kotlin349-case oracle and real local files with SDK/HTTP fixtures do not prove native lifecycle or live Jellyfin.`)})().catch(e=>{console.error(e);process.exitCode=1});
