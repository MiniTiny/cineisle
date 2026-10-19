// Product services and page methods; HTTP/Asset/scheduler/file locks are explicit fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./feature-regression.test.cjs');
global.AppStorage ||= {values:new Map(),setOrCreate(k,v){this.values.set(k,v)}};
const {AppService}=h.load('service/AppService.ets'),{SessionStore}=h.load('service/SessionStore.ets');
const {PendingSync}=h.load('service/PendingSync.ets'),{ExperienceStore}=h.load('service/ExperienceStore.ets');
const {LocalStore}=h.load('service/LocalStore.ets'),{AppLock}=h.load('service/AppLock.ets');
const {JellyfinClient}=h.load('service/JellyfinClient.ets'),{loadPublicUsers}=h.load('service/PublicUsers.ets');
const {PlayerOptions,validPlayerOptions}=h.load('utils/PlayerOptions.ts'),{ExperienceState,validExperience}=h.load('utils/Experience.ts');
const {Settings}=h.load('pages/Settings.ets');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const pending=(id='a',revision=1,value=true)=>({id,field:'favorite',value,revision,item:h.film(id)});
async function account(name='a') {const c=h.activate(name);await SessionStore.save(c.session);c.validateAccount=async()=>{};return c;}
function configure() {h.context.applicationInfo={name:'com.cineisle.fixture'};h.capabilities.add('SystemCapability.ResourceSchedule.WorkScheduler');PendingSync.configure(h.context,()=>AppService.client&&({client:AppService.client,store:AppService.experience,local:AppService.local}));PendingSync.interactive=false;}
function queue(edit=pending()) {AppService.experience.update(s=>{s.pending=[edit]});}
async function jobs() {await PendingSync.jobs;await new Promise(setImmediate);await PendingSync.jobs;}
for(const [key,value]of [['back',0],['back',-1000],['back',1001],['forward',301000],['back',NaN],['autoPiP','yes'],['zoom',null]])test('player preference rejects invalid '+key+'='+value,()=>{
 const options=Object.assign(new PlayerOptions(),{[key]:value});assert.equal(validPlayerOptions(options),false);assert.equal(validExperience(Object.assign(new ExperienceState(),{playerUi:options})),false);
});
test('legacy preference defaults preserve basic gestures and keep auto PiP disabled',()=>{const options=new PlayerOptions();assert.deepEqual([options.gestures,options.seek,options.zoom,options.back,options.forward,options.autoPiP],[true,true,true,5000,15000,false]);assert.equal(validExperience(new ExperienceState()),true)});
test('settings persist all switches and seconds by account and survive reconstruction',()=>{
 h.activate();const p=new Settings();p.aboutToAppear();p.onPageShow();for(const key of ['gestures','seek','zoom'])p.savePlayer(key,false);p.savePlayer('maximized',true);p.savePlayer('pip',true);p.seekBack='12';p.seekForward='30';p.savePlayer();
 let saved=new ExperienceStore(AppService.local).snapshot().playerUi;assert.deepEqual([saved.gestures,saved.seek,saved.zoom,saved.startMaximized,saved.autoPiP,saved.back,saved.forward],[false,false,false,true,true,12000,30000]);h.activate('b');const other=new Settings();other.aboutToAppear();other.onPageShow();assert.equal(other.playerUi.autoPiP,false);h.activate('a');assert.equal(AppService.experience.snapshot().playerUi.forward,30000);
});
test('settings invalid seconds and failed persistence retain previous options',()=>{
 h.activate();const p=new Settings();p.aboutToAppear();p.onPageShow();p.seekBack='0';p.savePlayer();assert.equal(AppService.experience.snapshot().playerUi,undefined);assert.equal(p.message,'app.string.player_steps_invalid');
 AppService.local.saveExperience=()=>{throw Error('disk_full')};p.savePlayer('pip',true);assert.equal(p.playerUi.autoPiP,false);assert.equal(p.message,'disk_full');
});
test('late settings save cannot write another account',()=>{h.activate();const p=new Settings();p.aboutToAppear();h.activate('b');p.savePlayer('pip',true);assert.equal(AppService.experience.snapshot().playerUi,undefined)});
for(const version of ['10.8.13','10.10.0'])test(version+' public users require anonymous server identity and de-duplicate by ID',async()=>{
 h.queue.push(h.response({Id:'server',Version:version}),h.response([{Id:'u1',Name:'One',ServerId:'server'},{Id:'u1',Name:'duplicate'},{Id:'u2',Name:'Two'}]));
 const users=await loadPublicUsers('https://example.invalid/jellyfin');assert.deepEqual(users.map(u=>u.name),['One','Two']);assert.deepEqual(h.requests.map(r=>new URL(r.url).pathname),['/jellyfin/System/Info/Public','/jellyfin/Users/Public']);for(const r of h.requests)assert.ok(!r.options.header.Authorization.includes('Token='));
});
for(const data of [null,{},[{Id:'u'}],[{Id:'u',Name:''}],[{Id:'u',Name:'U',ServerId:'other'}],[{Id:'u/',Name:'U'}]])test('public users reject malformed identity '+JSON.stringify(data),async()=>{
 h.queue.push(h.response({Id:'server',Version:'10.10.0'}),h.response(data));await assert.rejects(loadPublicUsers('https://one.invalid'),/public_users_invalid/);
});
test('saved server identity mismatch blocks public list with no credential request',async()=>{
 await SessionStore.updateServer({id:'expected',name:'One',preferred:'https://one.invalid',addresses:['https://one.invalid']});h.queue.push(h.response({Id:'wrong',Version:'10.10.0'}));await assert.rejects(loadPublicUsers('https://one.invalid'),/server_identity_mismatch/);assert.equal(h.requests.length,1);
});
test('disabled public listing remains an error and manual password login remains usable',async()=>{
 h.queue.push(h.response({Id:'server',Version:'10.10.0'}),{responseCode:403,result:''});await assert.rejects(loadPublicUsers('https://one.invalid'),/permission_denied/);
 h.queue.push(h.response({Id:'server',Version:'10.10.0'}),h.response({User:{Id:'u',Name:'U'},AccessToken:'fixture'}));const c=await JellyfinClient.login('https://one.invalid','U','password');assert.equal(c.session.userId,'u');
});
test('public users cannot run through an authenticated client',async()=>{await assert.rejects(h.activate().publicUsers(),/api_session_invalid/);assert.equal(h.requests.length,0)});
test('two reconstructed stores merge preferences and edits without stale memory overwrites',()=>{
 h.activate();const one=AppService.experience,two=new ExperienceStore(new LocalStore(h.context,AppService.client.session));one.update(s=>{s.pending=[pending()]});two.update(s=>{s.playerUi=new PlayerOptions();s.playerUi.autoPiP=true});assert.equal(one.snapshot().playerUi.autoPiP,true);assert.equal(two.snapshot().pending.length,1);
});
test('automatic run validates identity then drains positions and edits with snapshot confirmation',async()=>{
 const c=await account(),calls=[];queue();AppService.experience.update(s=>{s.positions=[{id:'a',ticks:123,revision:2,item:h.film('a')}]});c.validateAccount=async()=>calls.push('validate');c.offlinePosition=async()=>calls.push('position');c.favorite=async()=>calls.push('favorite');configure();await PendingSync.run();await jobs();assert.deepEqual(calls,['validate','favorite','position']);assert.equal(AppService.experience.snapshot().pending.length,0);assert.equal(AppService.experience.snapshot().positions.length,0);
});
test('scheduler persists one credential-free network job and cancels it after drain',async()=>{
 const c=await account();queue();configure();const scheduler=h.platform.get('@ohos.resourceschedule.workScheduler');scheduler.jobs.clear();scheduler.calls.length=0;PendingSync.wake();PendingSync.wake();await jobs();assert.equal(scheduler.jobs.size,1);const work=scheduler.jobs.get(1701);assert.equal(work.isPersisted,true);assert.equal(work.isRepeat,true);assert.equal(work.repeatCycleTime,1200000);assert.equal(work.networkType,0);assert.equal(JSON.stringify(work).includes('mock-token'),false);
 c.favorite=async()=>{};await PendingSync.run();await jobs();assert.equal(scheduler.jobs.size,0);
});
for(const mode of ['offline','pin','empty'])test('automatic '+mode+' gate does zero server writes',async()=>{
 const c=await account();queue();let calls=0;c.validateAccount=c.favorite=async()=>{calls++};if(mode==='offline')AppService.experience.update(s=>{s.offline=true});if(mode==='pin')AppLock.locked=true;if(mode==='empty')AppService.experience.update(s=>{s.pending=[]});configure();await PendingSync.run();assert.equal(calls,0);
});
test('automatic concurrent triggers share one drain',async()=>{
 const c=await account();queue();const gate=h.deferred();let calls=0;c.favorite=async()=>{calls++;await gate.promise};configure();const a=PendingSync.run(),b=PendingSync.run();await new Promise(setImmediate);assert.equal(calls,1);gate.resolve();await Promise.all([a,b]);assert.equal(calls,1);
});
test('manual and automatic replay share the same account transfer lock',async()=>{
 const c=await account();queue();const gate=h.deferred();let calls=0;c.favorite=async()=>{calls++;await gate.promise};configure();const a=PendingSync.run();await new Promise(setImmediate);const b=AppService.flushPending();await new Promise(setImmediate);assert.equal(calls,1);gate.resolve();await Promise.all([a,b]);assert.equal(calls,1);
});
test('older successful acknowledgment retains a concurrent newer edit',async()=>{
 const c=await account();queue();const gate=h.deferred();c.favorite=()=>gate.promise;configure();const work=PendingSync.run();await new Promise(setImmediate);AppService.experience.update(s=>{s.pending=[pending('a',2,false)]});gate.resolve();await work;assert.deepEqual(AppService.experience.snapshot().pending.map(p=>[p.revision,p.value]),[[2,false]]);
});
test('older failure cannot block a newly recorded intent',async()=>{
 const c=await account();queue();const gate=h.deferred();c.favorite=()=>gate.promise;configure();const work=PendingSync.run();await new Promise(setImmediate);AppService.experience.update(s=>{s.pending=[pending('a',2,false)]});gate.reject(Error('permission_denied'));await work;assert.equal(AppService.experience.snapshot().syncBlocked,undefined);assert.equal(AppService.experience.snapshot().pending[0].revision,2);
});
test('offline enabled during a transfer prevents acknowledgment and all following writes',async()=>{
 const c=await account();queue();AppService.experience.update(s=>s.pending.push(pending('b')));const gate=h.deferred();let calls=0;c.favorite=async()=>{calls++;await gate.promise};configure();const work=PendingSync.run();await new Promise(setImmediate);AppService.experience.update(s=>{s.offline=true});gate.resolve();await work;assert.equal(calls,1);assert.equal(AppService.experience.snapshot().pending.length,2);
});
test('OS stop cancels subsequent sends and preserves unknown outcomes',async()=>{
 const c=await account();queue();const gate=h.deferred();c.favorite=()=>gate.promise;configure();const work=PendingSync.run();await new Promise(setImmediate);PendingSync.stop();gate.resolve();await work;assert.equal(AppService.experience.snapshot().pending.length,1);
});
test('removing credentials while a response is pending cannot acknowledge or send more',async()=>{
 const c=await account();queue();const gate=h.deferred();c.favorite=()=>gate.promise;configure();const work=PendingSync.run();await new Promise(setImmediate);await SessionStore.remove((await SessionStore.list())[0].key);gate.resolve();await work;assert.equal(AppService.experience.snapshot().pending.length,1);
});
test('connection retry metadata survives cold store reconstruction and stops after five attempts',async()=>{
 const c=await account();queue();let calls=0;c.favorite=async()=>{calls++;throw Error('network_failed')};configure();const original=Date.now;let now=original();Date.now=()=>now;
 try {for(let n=1;n<=5;n++){await PendingSync.run();const state=new ExperienceStore(AppService.local).snapshot();assert.equal(state.syncAttempts,n);assert.ok(state.syncNextAt>now);await PendingSync.run();assert.equal(calls,n);now=state.syncNextAt+1;}await PendingSync.run();assert.equal(calls,5);assert.equal(PendingSync.issue,'sync_retry_exhausted');}finally{Date.now=original}
});
test('permission failure suspends retries and explicit manual replay can recover',async()=>{
 const c=await account();queue();let calls=0;c.favorite=async()=>{calls++;throw Error('permission_denied')};configure();await PendingSync.run();assert.equal(AppService.experience.snapshot().syncBlocked,true);await PendingSync.run();assert.equal(calls,1);c.favorite=async()=>{calls++};await AppService.flushPending();assert.equal(calls,2);assert.equal(AppService.experience.snapshot().pending.length,0);
});
test('failed acknowledgment keeps intent on disk for safe replay',async()=>{
 const c=await account();queue();configure();c.favorite=async()=>{AppService.local.saveExperience=()=>{throw Error('disk_full')}};await PendingSync.run();assert.equal(new ExperienceStore(AppService.local).snapshot().pending.length,1);
});
test('manual replay respects explicit offline mode',async()=>{await account();queue();AppService.experience.update(s=>{s.offline=true});await assert.rejects(AppService.flushPending(),/offline_mode_enabled/);assert.equal(AppService.experience.snapshot().pending.length,1)});
test('cold scheduler processes each saved account with its own token and directory',async()=>{
 const one=await account('a');queue(pending('a'));const localA=AppService.local;const two=await account('b');queue(pending('b'));configure();PendingSync.owner=undefined;
 const validate=JellyfinClient.prototype.validateAccount,favorite=JellyfinClient.prototype.favorite,calls=[];
 JellyfinClient.prototype.validateAccount=async function(){calls.push(['validate',this.session.userId])};JellyfinClient.prototype.favorite=async function(id){calls.push([this.session.userId,id])};
 try {await PendingSync.run();assert.deepEqual(calls,[['validate','a'],['a','a'],['validate','b'],['b','b']]);assert.equal(localA.experience().pending.length,0);assert.equal(AppService.experience.snapshot().pending.length,0);}finally{JellyfinClient.prototype.validateAccount=validate;JellyfinClient.prototype.favorite=favorite}
});
test('network availability and foreground coalesce trigger scheduling without UI action',async()=>{
 await account();queue();h.capabilities.add('SystemCapability.Communication.NetManager.Core');let handler,registered=0;Object.assign(h.platform.get('@ohos.net.connection'),{createNetConnection:()=>({on:(event,fn)=>{assert.equal(event,'netAvailable');handler=fn},register:cb=>{registered++;cb()},unregister:cb=>cb()})});
 configure();assert.equal(registered,1);handler({netId:1});PendingSync.foreground();assert.ok(PendingSync.timer>=0);PendingSync.background();assert.equal(PendingSync.timer,-1);await jobs();
});
test('module registers a private WorkScheduler extension',()=>{const m=JSON.parse(fs.readFileSync('entry/src/main/module.json5')).module;const e=m.extensionAbilities.find(a=>a.name==='PendingSyncAbility');assert.equal(e.type,'workScheduler');assert.equal(e.exported,false)});
test('actual extension callback reconstructs the saved account and drains without UI initialization',async()=>{
 await account();queue();PendingSync.owner=undefined;h.context.applicationInfo={name:'com.cineisle.fixture'};
 const Ability=h.load('entryability/PendingSyncAbility.ets').default,ability=new Ability();ability.context=h.context;
 const validate=JellyfinClient.prototype.validateAccount,favorite=JellyfinClient.prototype.favorite;let writes=0;
 JellyfinClient.prototype.validateAccount=async()=>{};JellyfinClient.prototype.favorite=async()=>{writes++};
 try{ability.onWorkStart({workId:1701});for(let i=0;i<6;i++)await new Promise(setImmediate);assert.equal(writes,1);assert.equal(AppService.experience.snapshot().pending.length,0)}finally{JellyfinClient.prototype.validateAccount=validate;JellyfinClient.prototype.favorite=favorite}
});
test('extension ignores foreign work IDs and preserves PIN-locked intents',async()=>{
 await account();queue();const Ability=h.load('entryability/PendingSyncAbility.ets').default,ability=new Ability();ability.context=h.context;ability.onWorkStart({workId:99});assert.equal(PendingSync.context,undefined);AppLock.locked=true;ability.onWorkStart({workId:1701});for(let i=0;i<3;i++)await new Promise(setImmediate);assert.equal(AppService.experience.snapshot().pending.length,1);assert.equal(h.requests.length,0);
});

module.exports={tests};
if(require.main===module)(async()=>{try{for(const [name,fn]of tests){h.reset();await fn();await jobs();PendingSync.stop();console.log('PASS '+name)}console.log(`${tests.length} remaining parity regressions passed. Scheduler/HTTP/file-lock fixtures do not prove OS survival or real-server behavior.`)}finally{PendingSync.stop();PendingSync.context=undefined;fs.rmSync(h.directory,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
