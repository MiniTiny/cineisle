// Executes product services/pages; native transfer, capacity and network are explicit fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const { AppService } = h.load('service/AppService.ets');
const { SubtitleTransfer } = h.load('service/SubtitleTransfer.ets');
const { Collection } = h.load('pages/Collection.ets');
const { Settings } = h.load('pages/Settings.ets');
const { ExperienceState, validExperience } = h.load('utils/Experience.ts');
const { validDownloads } = h.load('utils/Cache.ts');
const tests=[], test=(name,fn)=>tests.push([name,fn]), ids=items=>items.map(i=>i.Id);
const M=1024*1024, box={Id:'box',Name:'合集',Type:'BoxSet'};
const film=(id='movie')=>({...h.film(id),CanDownload:true});
function collection(client) { const page=new Collection();Object.assign(page,{owner:client,alive:true,item:box});return page; }
function transfer(size=20*M,subs=[]) {
  const client=h.activate(), made=[],callbacks={};
  client.playbackInfo=async()=>({MediaSources:[{Id:'source',Container:'mp4',Size:size,MediaStreams:subs}]});
  client.stream=()=> 'https://example.invalid/synthetic';client.subtitle=async()=> '1\n00:00:01,000 --> 00:00:02,000\n字幕\n';
  h.platform.get('@ohos.request').downloadFile=async(_context,options)=>{made.push(options);return {on:(name,fn)=>{callbacks[options.filePath+':'+name]=fn;},delete:async()=>true};};
  return {client,made,callbacks};
}
function reset() { h.reset();require('./download-platform.cjs').install(h.platform); }
for(const version of ['10.8.13','10.10.0'])test(version+' collection library preserves BoxSet query, sort and paging',async()=>{
 const client=h.activate();client.api.setServerVersion(version);h.queue.push(h.response({Items:[box],TotalRecordCount:2}));
 const page=h.page({tab:2,mode:'library',parentId:'lib',collectionType:'boxsets',librarySort:'CommunityRating',libraryDescending:true});await page.load();
 assert.deepEqual(ids(page.items),['box']);const query=new URL(h.requests.at(-1).url).searchParams;
 assert.equal(query.get('includeItemTypes'),'BoxSet');assert.equal(query.get('sortBy'),'CommunityRating');assert.equal(query.get('parentId'),'lib');assert.equal(query.get('startIndex'),'0');
 h.queue.push(h.response({Items:[{...box,Id:'box2'}],TotalRecordCount:2}));await page.load(true);assert.equal(new URL(h.requests.at(-1).url).searchParams.get('startIndex'),'1');
 const routes=[],router=h.platform.get('@ohos.router'),old=router.pushUrl;router.pushUrl=v=>routes.push(v);try{page.open(box);page.open(film());}finally{router.pushUrl=old;}
 assert.deepEqual(routes.map(r=>r.url),['pages/Collection','pages/Detail']);
});
test('home collection shelves preserve type through view-all while normal scopes are unchanged',async()=>{
 const client=h.activate();client.resume=client.nextUp=async()=>[];client.libraries=async()=>[{Id:'sets',Name:'合集',Type:'CollectionFolder',CollectionType:'boxsets'}];client.latest=async()=>[box];
 const page=h.page({tab:1});await page.load();assert.equal(page.homeSections[0].collectionType,'boxsets');let query;
 client.items=async params=>{query=params;return {Items:[box],TotalRecordCount:1};};page.openLibrary(page.homeSections[0]);await new Promise(setImmediate);
 assert.equal(query.find(q=>q.key==='IncludeItemTypes').value,'BoxSet');page.switchTab(3);assert.equal(page.collectionType,'');
});
test('collection reads all pages atomically and retains movie/show/episode classification',async()=>{
 const client=h.activate(),queries=[];client.items=async params=>{queries.push(params);return {Items:queries.length===1?[film(),{Id:'show',Name:'Show',Type:'Series'}]:[{Id:'ep',Name:'EP',Type:'Episode'}],TotalRecordCount:3};};
 const page=collection(client);await page.load();assert.equal(page.loaded,true);assert.deepEqual(ids(page.items),['movie','show','ep']);
 assert.deepEqual(queries.map(q=>q.find(p=>p.key==='StartIndex').value),['0','2']);assert.equal(queries[0].find(q=>q.key==='Recursive').value,'false');assert.equal(queries[0].find(q=>q.key==='ParentId').value,'box');
});
for(const failure of ['network','duplicate','incomplete','wrongType'])test('collection '+failure+' never publishes a partial or empty-success result',async()=>{
 const client=h.activate();let calls=0;client.items=async()=>{calls++;if(calls===1)return {Items:failure==='wrongType'?[box]:[film()],TotalRecordCount:failure==='wrongType'?1:2};if(failure==='network')throw Error('network_failed');return {Items:failure==='duplicate'?[film()]:[],TotalRecordCount:2};};
 const page=collection(client);await page.load();assert.equal(page.loaded,false);assert.equal(page.items.length,0);assert.ok(page.message);assert.equal(page.busy,false);
});
test('empty collection is successful only after the complete response; offline does zero requests',async()=>{
 const client=h.activate();let calls=0;client.items=async()=>{calls++;return {Items:[],TotalRecordCount:0};};const page=collection(client);await page.load();assert.equal(page.loaded,true);assert.equal(page.items.length,0);
 AppService.experience.update(s=>{s.offline=true;});await page.load();assert.equal(page.message,'collection_online_required');assert.equal(page.loaded,false);assert.equal(calls,1);
});
for(const action of ['leave','switch'])test('late collection response after '+action+' is discarded',async()=>{
 const client=h.activate(),gate=h.deferred();client.items=()=>gate.promise;const page=collection(client),waiting=page.load();
 if(action==='leave')page.aboutToDisappear();else h.activate('other');gate.resolve({Items:[film()],TotalRecordCount:1});await waiting;assert.equal(page.items.length,0);assert.equal(page.loaded,false);
});
for(const free of [0,20*M,NaN,-1])test('space '+free+' rejects before creating a task or download record',async()=>{
 const {made}=transfer();h.platform.get('@ohos.file.statvfs').getFreeSize=async()=>free;await assert.rejects(AppService.download(film()),/download_space/);assert.equal(made.length,0);assert.equal(AppService.downloads.length,0);
});
test('capacity lookup failure remains explicit and retry can succeed',async()=>{
 const {made}=transfer();h.platform.get('@ohos.file.statvfs').getFreeSize=async()=>{throw Error('denied');};await assert.rejects(AppService.download(film()),/download_space_check_failed/);assert.equal(made.length,0);
 h.platform.get('@ohos.file.statvfs').getFreeSize=async()=>100*M;await AppService.download(film());assert.equal(made.length,1);assert.equal(AppService.downloads[0].expectedSize,20*M);
});
test('concurrent admission counts remaining bytes and prevents duplicate tasks',async()=>{
 const {made}=transfer(40*M);h.platform.get('@ohos.file.statvfs').getFreeSize=async()=>64*M;
 const results=await Promise.allSettled([AppService.download(film('a')),AppService.download(film('b')),AppService.download(film('a'))]);
 assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected','rejected']);assert.equal(made.length,1);assert.equal(AppService.downloads.length,1);
});
test('space accounts for bytes already on disk and releases completed reservations',async()=>{
 const {made}=transfer(40*M);h.platform.get('@ohos.file.statvfs').getFreeSize=async()=>100*M;await AppService.download(film('a'));
 const first=AppService.downloads[0];fs.writeFileSync(first.path,'');fs.truncateSync(first.path,32*M);
 h.platform.get('@ohos.file.statvfs').getFreeSize=async()=>56*M;await AppService.download(film('b'));assert.equal(made.length,2);
 first.state='complete';AppService.downloads[1].state='complete';await AppService.download(film('c'));assert.equal(made.length,3);
});
test('subtitle allowance is included in preflight and unknown source size stays explicitly unknown',async()=>{
 const {made}=transfer(20*M,[{Type:'Subtitle',Index:1,IsExternal:true,Codec:'srt'}]);h.platform.get('@ohos.file.statvfs').getFreeSize=async()=>30*M;
 await assert.rejects(AppService.download(film()),/download_space/);assert.equal(made.length,0);
 AppService.client.playbackInfo=async()=>({MediaSources:[{Id:'source'}]});await AppService.download(film());assert.equal(AppService.downloads[0].expectedSize,undefined);
});
for(const mobile of [false,true])for(const roaming of [false,true])test('video/record policy mobile='+mobile+' roaming='+roaming,async()=>{
 const {made}=transfer();AppService.experience.update(s=>{s.downloadMobile=mobile;s.downloadRoaming=roaming;});await AppService.download(film());
 assert.equal(made[0].enableMetered,mobile);assert.equal(made[0].enableRoaming,mobile&&roaming);assert.deepEqual(AppService.local.downloads()[0].network,{mobile,roaming:mobile&&roaming});
});
test('legacy Wi-Fi-only policy refuses cellular before video transfer',async()=>{
 const {made}=transfer();h.platform.get('@ohos.net.connection').getNetCapabilities=async()=>({bearerTypes:[0]});await assert.rejects(AppService.download(film()),/download_network_restricted/);assert.equal(made.length,0);
 AppService.experience.update(s=>{s.downloadMobile=true;});await AppService.download(film());assert.equal(made.length,1);
});
test('settings persist network options per account and save failure retains the prior selection',()=>{
 h.activate();const settings=new Settings();settings.aboutToAppear();settings.saveNetwork(true,true);assert.equal(settings.downloadRoaming,true);
 h.activate('b');const other=new Settings();other.aboutToAppear();assert.equal(other.downloadMobile,false);settings.saveNetwork(false,false);assert.equal(AppService.experience.snapshot().downloadMobile,false);
 h.activate('a');const restored=new Settings();restored.aboutToAppear();assert.equal(restored.downloadMobile,true);assert.equal(restored.downloadRoaming,true);
 AppService.local.saveExperience=()=>{throw Error('full');};restored.saveNetwork(false,false);assert.equal(restored.downloadMobile,true);assert.equal(restored.message,'full');
});
test('old metadata migrates with safe defaults and corrupt policy/size fields are rejected',()=>{
 const value=new ExperienceState();delete value.downloadMobile;delete value.downloadRoaming;assert.equal(validExperience(value),true);assert.equal(validExperience({...value,downloadMobile:'yes'}),false);
 h.activate();const record={id:'a',item:film('a'),path:path.join(AppService.local.directory,'a.mp4'),state:'complete',progress:1};assert.equal(validDownloads([record],AppService.local.directory),true);
 assert.equal(validDownloads([{...record,network:{mobile:true}}],AppService.local.directory),false);assert.equal(validDownloads([{...record,expectedSize:-1}],AppService.local.directory),false);
});
for(const mobile of [false,true])test('real subtitle facade uses generated SRT route with OS-enforced policy '+mobile,async()=>{
 const client=h.activate();h.capabilities.add('SystemCapability.Request.FileTransferAgent');const made=[],removed=[];
 h.platform.get('@ohos.request').agent={Action:{DOWNLOAD:1},Mode:{FOREGROUND:1},Network:{WIFI:1,ANY:2},remove:async id=>removed.push(id),create:async(_c,options)=>{made.push(options);const handlers={};return {tid:'11',on:(event,cb)=>{handlers[event]=cb;},start:async()=>{fs.writeFileSync(options.saveas,'1\n00:00:01,000 --> 00:00:02,000\n字幕\n');handlers.completed();}};}};
 const policy={mobile,roaming:mobile},filename=path.join(AppService.local.directory,'a.srt');const text=await client.subtitle('a','source',7,new SubtitleTransfer(client.subtitleTransport(),h.context,filename,policy,()=>true));
 assert.ok(text.includes('字幕'));assert.equal(new URL(made[0].url).pathname,'/jellyfin/Videos/a/source/Subtitles/7/Stream.srt');assert.equal(made[0].network,mobile?2:1);assert.equal(made[0].metered,mobile);assert.equal(made[0].roaming,mobile);assert.equal(fs.existsSync(filename+'.fetch'),false);assert.deepEqual(removed,['11']);assert.equal(h.requests.length,0);
});
test('subtitle transfer legacy fallback honors network constraints and deletes temporary files',async()=>{
 const client=h.activate(),made=[];h.platform.get('@ohos.request').downloadFile=async(_c,options)=>{made.push(options);return {on:(event,cb)=>{if(event==='complete')queueMicrotask(()=>{fs.writeFileSync(options.filePath,'SRT');cb();});},delete:async()=>true};};
 const filename=path.join(AppService.local.directory,'a.srt'),transfer=()=>new SubtitleTransfer(client.subtitleTransport(),h.context,filename,{mobile:false,roaming:false},()=>true);
 assert.equal(await client.subtitle('a','s',1,transfer()),'SRT');assert.equal(made[0].enableMetered,false);assert.equal(made[0].enableRoaming,false);assert.equal(fs.existsSync(filename+'.fetch'),false);
 h.platform.get('@ohos.net.connection').getNetCapabilities=async()=>({bearerTypes:[0]});await assert.rejects(client.subtitle('a','s',1,transfer()),/download_network_restricted/);assert.equal(made.length,1);
});
test('subtitle task failure cannot become successful cache or leak a temporary file',async()=>{
 const client=h.activate();h.capabilities.add('SystemCapability.Request.FileTransferAgent');let removed=0;h.platform.get('@ohos.request').agent={Action:{DOWNLOAD:1},Mode:{FOREGROUND:1},Network:{WIFI:1},remove:async()=>{removed++;},create:async(_c,options)=>{const handlers={};return {tid:'2',on:(name,fn)=>{handlers[name]=fn;},start:async()=>{fs.writeFileSync(options.saveas,'partial');handlers.failed();}};}};
 const filename=path.join(AppService.local.directory,'a.srt');await assert.rejects(client.subtitle('a','s',1,new SubtitleTransfer(client.subtitleTransport(),h.context,filename,{mobile:false,roaming:false},()=>true)),/offline_subtitle_failed/);assert.equal(removed,1);assert.equal(fs.existsSync(filename+'.fetch'),false);
});

(async()=>{
 for(const [name,fn]of tests){reset();await fn();console.log('PASS '+name);}
 const p=require('./player-regression.test.cjs'),gestureTests=[],gestureTest=(n,f)=>gestureTests.push([n,f]);
 function player(overrides={}) { const page=new p.Player(),calls=[];Object.assign(page,{alive:true,visible:true,locked:false,state:'playing',duration:60000,playbackPosition:20000,surfaceWidth:360,surfaceHeight:200,controller:{seek:v=>calls.push(['seek',v]),setSpeed:v=>calls.push(['speed',v])},system:{sync:()=>{},background:()=>{},foreground:()=>{},dispose:()=>{},pause:async()=>calls.push(['pause']),play:async()=>calls.push(['play'])},...overrides});return {page,calls}; }
 gestureTest('double tap uses bounded seek and middle playback toggle',async()=>{const {page,calls}=player();page.doubleTap(50,100);page.doubleTap(300,100);page.doubleTap(180,100);assert.deepEqual(calls,[['seek',15000],['seek',35000],['pause']]);page.playbackPosition=1000;page.doubleTap(50,100);assert.deepEqual(calls.at(-1),['seek',0]);page.playbackPosition=59000;page.doubleTap(300,100);assert.deepEqual(calls.at(-1),['seek',60000]);});
 gestureTest('horizontal drag previews then commits exactly once; cancel does not seek',()=>{const {page,calls}=player();page.beginSeek(100,100);page.previewSeek(60);assert.equal(page.seekPreview,35000);assert.equal(calls.length,0);page.endSeek();page.endSeek();assert.deepEqual(calls,[['seek',35000]]);page.beginSeek(100,100);page.previewSeek(500);assert.equal(page.seekPreview,60000);page.cancelGesture();page.endSeek();assert.equal(calls.length,1);});
 for(const key of ['locked','controlsLocked','busy','settingsBusy','pipActive'])gestureTest(key+' blocks all gestures and invalidates an active seek',()=>{const {page,calls}=player();page.beginSeek(100,100);page.previewSeek(10);page[key]=true;page.endSeek();page.doubleTap(300,100);page.holdSpeed(100,100);page.pinch(2);assert.equal(calls.length,0);assert.equal(page.zoomed,false);});
 gestureTest('system gesture edges, unknown duration and invalid offsets do not seek',()=>{const {page,calls}=player();for(const [x,y]of [[1,100],[359,100],[100,1],[NaN,100]]){page.beginSeek(x,y);page.previewSeek(80);page.endSeek();page.doubleTap(x,y);}assert.equal(calls.length,0);page.duration=0;page.beginSeek(100,100);page.previewSeek(10);page.endSeek();page.doubleTap(300,100);assert.equal(calls.length,0);});
 gestureTest('long press restores the original speed once and explicit speed defeats release',()=>{const {page,calls}=player({speed:1.25});page.holdSpeed(100,100);assert.equal(page.speed,2);page.cancelGesture();page.cancelGesture();assert.deepEqual(calls,[['speed',2],['speed',1.25]]);page.holdSpeed(100,100);page.changeSpeed(.75);page.cancelGesture();assert.equal(page.speed,.75);assert.deepEqual(calls.at(-1),['speed',.75]);});
 gestureTest('background and page destruction restore held speed and clear preview',()=>{const {page,calls}=player({speed:1.5});page.holdSpeed(100,100);page.onPageHide();assert.equal(page.speed,1.5);assert.equal(page.gestureHint,'');assert.equal(page.visible,false);page.onPageShow();page.beginSeek(100,100);page.previewSeek(20);page.aboutToDisappear();assert.equal(page.seekPreview,-1);assert.equal(page.alive,false);assert.ok(calls.some(c=>c[1]===1.5));});
 gestureTest('pinch toggles crop without altering aspect and releases temporary speed',()=>{const {page}=player();page.holdSpeed(100,100);page.pinch(1.3);assert.equal(page.zoomed,true);assert.equal(page.speed,1);page.pinch(.7);assert.equal(page.zoomed,false);const {UiLayout}=p.load('utils/UiLayout.ts');const cover=UiLayout.videoFrame(360,200,4/3,true);assert.ok(cover.height>=200&&cover.width>=360);assert.ok(Math.abs(cover.width/cover.height-4/3)<1e-6);});
 for(const [name,fn]of gestureTests){p.reset();await fn();console.log('PASS '+name);}
 console.log(`${tests.length+gestureTests.length} other parity regression tests passed. Fixtures do not prove device gestures, real network billing, OS survival or video decoding.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
