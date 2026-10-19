const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./feature-regression.test.cjs'),f=require('./poster-platform.cjs').install(h);
const {PosterCache}=h.load('service/PosterCache.ets'),{PosterTransport}=h.load('api/PosterTransport.ets');
const {PosterOptions,validPosterOptions,validPosterTarget,posterByteLimit}=h.load('utils/PosterOptions.ts');
const {decodePoster}=h.load('service/PosterBitmap.ets'),{AppService}=h.load('service/AppService.ets');
const tests=[],test=(name,fn)=>tests.push([name,fn]),settle=async()=>{for(let n=0;n<8;n++)await new Promise(setImmediate)};
const jpeg=(size=1000,value=1)=>{const b=new Uint8Array(size).fill(value);b.set([255,216,255]);return b.buffer};
const target=(id='one',tag='tag')=>({id,tag,backdrop:false,width:480});
const keyAccount='server\0user';let fetched=0;
function fetch(bytes=jpeg()){return()=>{fetched++;return{result:Promise.resolve(bytes),cancel(){}}}}
const get=(cache,t=target(),online=true,account=keyAccount,bytes=jpeg())=>cache.request(account,t,fetch(bytes),()=>online,()=>true).result;
async function cache(){const c=new PosterCache(h.context);await c.initialize();assert.equal(c.issue,'');return c}
function reset(){AppService.posters?.cancelAll(false);AppService.posters=undefined;h.reset();f.reset();fetched=0}
test('defaults, capacity bounds and target validation keep a finite cache contract',()=>{
 assert.deepEqual({...new PosterOptions()},{enabled:true,maxMb:20});for(const n of [0,201,1.5,NaN,'20'])assert.equal(validPosterOptions({enabled:true,maxMb:n}),false);for(const n of [1,200])assert.equal(validPosterOptions({enabled:true,maxMb:n}),true);
 assert.equal(validPosterTarget(target()),true);for(const value of [{...target(),id:'../movie'},{...target(),tag:'x\n'},{...target(),width:30000}])assert.equal(validPosterTarget(value),false);
});
test('visited image persists and a new cache instance reads it offline without fetching',async()=>{
 const c=await cache(),data=await get(c);assert.equal((await c.usage()).files,1);const other=await cache();const cached=await get(other,target(),false);assert.equal(fetched,1);assert.deepEqual(new Uint8Array(cached.bytes),new Uint8Array(data.bytes));assert.equal(cached.key,data.key);
});
test('opaque filenames/index never contain credentials, addresses or account/item text',async()=>{
 const c=await cache();await get(c,target('private-item','private-tag'),true,'private-server\0private-user');const names=fs.readdirSync(f.root);assert.ok(names.some(n=>/^[a-f0-9]{64}\.img$/.test(n)));const index=fs.readFileSync(path.join(f.root,'index.json'),'utf8');assert.doesNotMatch(index,/private|https|api_key|token|user/);for(const n of names)assert.match(n,/^(index\.json|[a-f0-9]{64}\.img)$/);
});
test('same IDs across accounts, image variants and tags remain distinct',async()=>{
 const c=await cache();const a=await get(c);for(const [t,account]of [[target(),'server\0another'],[target('one','new-tag'),keyAccount],[{...target(),backdrop:true},keyAccount],[{...target(),width:160},keyAccount]])assert.notEqual((await get(c,t,true,account)).key,a.key);assert.equal(fetched,5);assert.equal((await c.usage()).files,5);
});
test('simultaneous consumers of one image share a transfer and cancellation is per consumer',async()=>{
 const c=await cache(),gate=h.deferred();let cancelled=0;const factory=()=>{fetched++;return{result:gate.promise,cancel(){cancelled++}}};
 const first=c.request(keyAccount,target(),factory,()=>true,()=>true),rejected=assert.rejects(first.result,/poster_cancelled/),second=c.request(keyAccount,target(),factory,()=>true,()=>true);await settle();assert.equal(fetched,1);first.cancel();gate.resolve(jpeg());await rejected;await second.result;assert.equal(cancelled,0);assert.equal((await c.usage()).files,1);
});
test('network queue uses at most three transfers and cancelled waiting rows do not occupy slots',async()=>{
 const c=await cache(),gates=[],tickets=[];let active=0,max=0;
 const factory=()=>{const gate=h.deferred();gates.push(gate);active++;max=Math.max(max,active);return{result:gate.promise.finally(()=>active--),cancel(){gate.reject(Error('poster_cancelled'))}}};
 for(let n=0;n<10;n++)tickets.push(c.request(keyAccount,target('item-'+n),factory,()=>true,()=>true));const results=tickets.map(t=>t.result.catch(e=>e));await settle();assert.equal(gates.length,3);
 for(let n=3;n<10;n++)tickets[n].cancel();gates.forEach(g=>g.resolve(jpeg()));await Promise.all(results);await get(c,target('visible'));assert.equal(max,3);assert.equal(gates.length,3);
});
test('clear invalidates an uncooperative late transfer and cannot be repopulated by its success',async()=>{
 const c=await cache(),gate=h.deferred(),ticket=c.request(keyAccount,target(),()=>({result:gate.promise,cancel(){}}),()=>true,()=>true),rejected=assert.rejects(ticket.result,/poster_cancelled/);await settle();await c.clear(()=>true);await rejected;gate.resolve(jpeg());await settle();assert.equal((await c.usage()).files,0);assert.equal(fs.readdirSync(f.root).filter(n=>n.endsWith('.img')).length,0);
});
test('cancelling after hashing or account/PIN changes blocks dispatch and cache writes',async()=>{
 const c=await cache();let allowed=true;const first=c.request(keyAccount,target(),fetch(),()=>true,()=>allowed),rejected=assert.rejects(first.result,/poster_cancelled/);allowed=false;await rejected;assert.equal(fetched,0);
 const gate=h.deferred();allowed=true;const second=c.request(keyAccount,target(),()=>({result:gate.promise,cancel(){}}),()=>true,()=>allowed),failed=assert.rejects(second.result,/poster_cancelled/);await settle();allowed=false;gate.resolve(jpeg());await failed;assert.equal((await c.usage()).files,0);
});
test('disabled disk policy preserves online images, ignores old disk hits and never writes new files',async()=>{
 const c=await cache();await get(c);await c.save({enabled:false,maxMb:20},()=>true);await assert.rejects(get(c,target(),false),/poster_missing/);await get(c,target('new'));assert.equal((await c.usage()).files,1);assert.equal(fetched,2);
 const reload=await cache();assert.equal(reload.snapshot().enabled,false);
});
test('untagged images refresh after TTL, fall back only on connection errors and still work offline',async()=>{
 const original=Date.now;let clock=1000;Date.now=()=>clock;
 try{const c=await cache();await get(c,target('one',''));clock+=25*3600000;const fallback=c.request(keyAccount,target('one',''),()=>({result:Promise.reject(Error('poster_unavailable')),cancel(){}}),()=>true,()=>true);await fallback.result;await get(c,target('one',''),false);assert.equal(fetched,1);
 await assert.rejects(c.request(keyAccount,target('one',''),()=>({result:Promise.reject(Error('poster_denied')),cancel(){}}),()=>true,()=>true).result,/poster_denied/)}finally{Date.now=original}
});
test('quota shrink and LRU eviction respect actual image bytes',async()=>{
 const c=await cache();await c.save({enabled:true,maxMb:1},()=>true);await get(c,target('one'),true,keyAccount,jpeg(400000));await new Promise(r=>setTimeout(r,2));await get(c,target('two'),true,keyAccount,jpeg(400000));await new Promise(r=>setTimeout(r,2));await get(c,target('one'),false);await new Promise(r=>setTimeout(r,2));await get(c,target('three'),true,keyAccount,jpeg(400000));
 const usage=await c.usage();assert.equal(usage.files,2);assert.equal(usage.bytes,800000);await assert.rejects(get(c,target('two'),false),/poster_missing/);await get(c,target('one'),false);await get(c,target('three'),false);
});
test('large display-only image exceeding selected quota is not persisted',async()=>{const c=await cache();await c.save({enabled:true,maxMb:1},()=>true);assert.equal((await get(c,target(),true,keyAccount,jpeg(1500000))).bytes.byteLength,1500000);assert.equal((await c.usage()).files,0)});
test('partial IO is completed and disk failure does not prevent online display',async()=>{
 const c=await cache();f.state.partial=17;await get(c);await get(c,target(),false);assert.equal((await c.usage()).bytes,1000);f.state.partial=Infinity;f.state.failWrite=1;await get(c,target('new'));assert.equal(c.issue,'poster_cache_unavailable');assert.equal((await c.usage()).files,1);
});
test('external OS eviction and damaged bytes do not masquerade as an offline image',async()=>{const c=await cache(),data=await get(c);fs.writeFileSync(path.join(f.root,data.key+'.img'),'bad');await assert.rejects(get(c,target(),false),/poster_missing/);assert.equal((await c.usage()).files,0)});
test('reconstructs interrupted metadata and clears only its own image files',async()=>{
 const c=await cache(),data=await get(c);fs.writeFileSync(path.join(f.root,'index.json'),'{broken');fs.writeFileSync(path.join(f.root,'sentinel.txt'),'keep');fs.writeFileSync(path.join(h.directory,'video.mp4'),'keep');
 const other=await cache();assert.equal((await get(other,target(),false)).key,data.key);await other.clear(()=>true);assert.equal(fs.readFileSync(path.join(f.root,'sentinel.txt'),'utf8'),'keep');assert.equal(fs.readFileSync(path.join(h.directory,'video.mp4'),'utf8'),'keep');assert.equal((await other.usage()).bytes,0);
});
test('preference flush failure keeps the old runtime and allows an explicit retry',async()=>{const c=await cache();f.preferences.state.failFlush=1;await assert.rejects(c.save({enabled:false,maxMb:1},()=>true),/poster_options_save_failed/);assert.deepEqual(c.snapshot(),{enabled:true,maxMb:20});await c.save({enabled:false,maxMb:1},()=>true);assert.deepEqual((await cache()).snapshot(),{enabled:false,maxMb:1})});
test('queued preference admission is checked after a pending flush',async()=>{
 const c=await cache(),gate=h.deferred();f.preferences.state.flushWait=gate.promise;const first=c.save({enabled:true,maxMb:10},()=>true);let allowed=true;const second=c.save({enabled:false,maxMb:1},()=>allowed),rejected=assert.rejects(second,/poster_cancelled/);await settle();allowed=false;f.preferences.state.flushWait=undefined;gate.resolve();await first;await rejected;assert.deepEqual(c.snapshot(),{enabled:true,maxMb:10});
});
test('invalid and oversized image data is never cached',async()=>{const c=await cache();for(const bytes of [new ArrayBuffer(0),new Uint8Array([60,104,116,109,108]).buffer,jpeg(posterByteLimit+1)])await assert.rejects(get(c,target(),true,keyAccount,bytes),/poster_invalid/);assert.equal((await c.usage()).files,0)});
test('poster HTTP uses generated routes with headers, no token URL, bounded options and one destroy',async()=>{
 const http=h.platform.get('@ohos.net.http'),create=http.createHttp;http.HttpDataType.ARRAY_BUFFER='ARRAY_BUFFER';let destroyed=0,request;http.createHttp=()=>({async request(url,options){request={url,options};return{responseCode:200,result:jpeg()}},destroy(){destroyed++}});
 try{const client=h.activate();await client.poster({...target(),backdrop:true,width:1280},()=>true).result;const url=new URL(request.url);assert.equal(url.pathname,'/jellyfin/Items/one/Images/Backdrop/0');assert.equal(url.searchParams.get('format'),'Jpg');assert.equal(url.searchParams.get('maxWidth'),'1280');assert.equal(url.searchParams.has('api_key'),false);assert.match(request.options.header.Authorization,/Token="mock-token"/);assert.equal(request.options.maxLimit,posterByteLimit);assert.equal(request.options.usingCache,false);assert.equal(destroyed,1)}finally{http.createHttp=create}
});
for(const code of [401,403,404,503])test('poster HTTP '+code+' stays a placeholder failure without body/credential logging',async()=>{const client=h.activate();h.queue.push({responseCode:code,result:jpeg()});await assert.rejects(client.poster(target(),()=>true).result,new RegExp(code===401||code===403?'poster_denied':code===404?'poster_missing':'poster_unavailable'))});
test('poster HTTP cancellation ignores late success and releases the native handle once',async()=>{
 const http=h.platform.get('@ohos.net.http'),create=http.createHttp,gate=h.deferred();let destroyed=0;http.createHttp=()=>({request:()=>gate.promise,destroy(){destroyed++}});
 try{const transfer=h.activate().poster(target(),()=>true),rejected=assert.rejects(transfer.result,/poster_cancelled/);transfer.cancel();await rejected;gate.resolve({responseCode:200,result:jpeg()});await settle();assert.equal(destroyed,1)}finally{http.createHttp=create}
});
test('bitmap decoding downsamples, frees sources and refuses image bombs',async()=>{const map=await decodePoster(jpeg(),160,()=>true);assert.equal(map.width,160);assert.deepEqual(f.imageState.decoded[0].desiredSize,{width:160,height:240});assert.equal(f.imageState.sourceReleases,1);await map.release();f.imageState.info={size:{width:30000,height:30000}};await assert.rejects(decodePoster(jpeg(),480,()=>true),/poster_invalid/);assert.equal(f.imageState.sourceReleases,2)});
test('late bitmap after owner cancellation is released, never handed to the component',async()=>{const gate=h.deferred();f.imageState.defer=gate.promise;let allowed=true;const pending=decodePoster(jpeg(),480,()=>allowed),rejected=assert.rejects(pending,/poster_cancelled/);await settle();allowed=false;gate.resolve();await rejected;assert.equal(f.imageState.bitmapReleases,1);assert.equal(f.imageState.sourceReleases,1)});
test('reconstruction and the next insert enforce the 512-file bound',async()=>{
 fs.mkdirSync(f.root,{recursive:true});for(let n=0;n<513;n++)fs.writeFileSync(path.join(f.root,n.toString(16).padStart(64,'0')+'.img'),Buffer.from(jpeg(128)));
 const c=await cache();assert.equal((await c.usage()).files,512);const data=await get(c,target('fresh'));assert.ok(fs.existsSync(path.join(f.root,data.key+'.img')));assert.equal((await c.usage()).files,512);assert.equal(fs.readdirSync(f.root).filter(n=>n.endsWith('.img')).length,512);
});
test('waiting work is capped at 64 and cancellation settles every subscriber',async()=>{
 const c=await cache(),gates=[],requests=[];const factory=()=>{const gate=h.deferred();gates.push(gate);return{result:gate.promise,cancel(){}}};
 for(let n=0;n<68;n++)requests.push(c.request(keyAccount,target('queued-'+n),factory,()=>true,()=>true).result.then(()=>null,e=>e.message));await settle();c.cancelAll(false);const results=await Promise.all(requests);assert.equal(results.filter(v=>v==='poster_busy').length,1);assert.equal(results.filter(v=>v==='poster_cancelled').length,67);assert.equal(gates.length,3);gates.forEach(g=>g.resolve(jpeg()));await settle();
});
test('failed eviction is visible and does not add bytes beyond existing files',async()=>{
 const c=await cache();await get(c,target('one'),true,keyAccount,jpeg(850000));await get(c,target('two'),true,keyAccount,jpeg(850000));f.state.failUnlink=99;
 await c.save({enabled:true,maxMb:1},()=>true);assert.equal(c.issue,'poster_cache_trim_failed');await get(c,target('new'),true,keyAccount,jpeg(850000));const usage=await c.usage();assert.equal(usage.files,2);assert.equal(usage.bytes,1700000);assert.ok(usage.issue);await assert.rejects(c.clear(()=>true));f.state.failUnlink=0;await c.clear(()=>true);assert.equal((await c.usage()).files,0);
});
test('confirmed clear also removes interrupted temporary image files',async()=>{
 const c=await cache();fs.writeFileSync(path.join(f.root,'a'.repeat(64)+'.part'),Buffer.from(jpeg()));await c.clear(()=>true);assert.ok(!fs.existsSync(path.join(f.root,'a'.repeat(64)+'.part')));
});
test('preference rollback failure is distinct and never publishes the new policy',async()=>{
 const c=await cache();f.preferences.state.failFlush=2;await assert.rejects(c.save({enabled:false,maxMb:1},()=>true),/poster_options_restore_failed/);assert.deepEqual(c.snapshot(),{enabled:true,maxMb:20});await c.save({enabled:false,maxMb:1},()=>true);assert.equal(c.snapshot().enabled,false);
});
test('poster total deadline destroys once and late HTTP success cannot revive it',async()=>{
 const http=h.platform.get('@ohos.net.http'),create=http.createHttp,nativeSet=global.setTimeout,nativeClear=global.clearTimeout,gate=h.deferred();let destroyed=0,fire,duration;
 global.setTimeout=(fn,ms)=>{fire=fn;duration=ms;return 1};global.clearTimeout=()=>{};http.createHttp=()=>({request:()=>gate.promise,destroy(){destroyed++}});
 try{const transfer=h.activate().poster(target(),()=>true),failed=assert.rejects(transfer.result,/poster_unavailable/);assert.equal(duration,10000);fire();await failed;gate.resolve({responseCode:200,result:jpeg()});await settle();assert.equal(destroyed,1)}finally{http.createHttp=create;global.setTimeout=nativeSet;global.clearTimeout=nativeClear}
});
test('digest failure keeps online images available without persisting an unisolated key',async()=>{
 const c=await cache(),crypto=h.platform.get('@ohos.security.cryptoFramework'),original=crypto.createMd;crypto.createMd=()=>{throw Error('digest unavailable')};
 try{const data=await get(c);assert.match(data.key,/^volatile-/);assert.equal(data.bytes.byteLength,1000);assert.equal((await c.usage()).files,0);assert.equal(c.issue,'poster_cache_unavailable');await assert.rejects(get(c,target(),false),/poster_missing/)}finally{crypto.createMd=original}
});
test('unavailable cache storage reports unknown usage while online images still display',async()=>{
 const api=h.platform.get('@ohos.file.fs'),original=api.listFile;api.listFile=async()=>{throw Error('directory unavailable')};
 try{const c=new PosterCache(h.context);await c.initialize();assert.equal((await get(c)).bytes.byteLength,1000);await assert.rejects(c.usage(),/poster_cache_unavailable/);assert.equal(c.issue,'poster_cache_unavailable')}finally{api.listFile=original}
});
(async()=>{for(const[name,fn]of tests){reset();await fn();console.log('PASS '+name)}console.log(`${tests.length} poster cache regressions passed. Native HTTP/crypto/image fixtures do not prove device file durability or actual raster decoding.`)})().catch(e=>{console.error(e);process.exitCode=1});
