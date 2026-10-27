const f=require('./catalog-contract-fixture.cjs').make('sync-catalog');
const {assert,h,A,client,response,page,observed,movie}=f;
const tests=[],test=(name,action)=>tests.push({name,action}),ids=values=>values.map(v=>v.Id);
const lib=(type,id='library')=>({...h.library(id),...(type===undefined?{}:{CollectionType:type})});
for(const count of [0,199,200,201])test('sync catalog actual '+count,async check=>{
 client();const values=Array.from({length:count},(_,i)=>movie(i)),progress=[];
 f.fileTargets((n,phase)=>n.startsWith('sync-progress.')||phase==='file-lock');
 f.provider(url=>url.pathname.endsWith('Views')?response(page([lib('movies')])):response(page(Number(url.searchParams.get('startIndex'))===0?values.slice(0,200):values.slice(200),count)));
 const result=await observed(A.sync(message=>progress.push({message,files:f.trace().calls['file-rename']||0})));
 check(()=>{assert.ifError(result.error);assert.deepEqual(ids(A.snapshot.items),ids(values));assert.deepEqual(A.snapshot.memberships,[{libraryId:'library',itemIds:ids(values)}]);const queries=f.requests().filter(r=>r.url.searchParams.has('limit'));assert.deepEqual(queries.map(r=>r.url.searchParams.get('limit')),Array(count>200?2:1).fill('200'));assert.deepEqual(queries.map(r=>r.url.searchParams.get('startIndex')),count>200?['0','200']:['0']);for(const {url}of queries){assert.deepEqual(url.searchParams.getAll('includeItemTypes'),['Movie','Series','Season','Episode']);assert.equal(url.searchParams.get('sortBy'),'SortName');assert.equal(url.searchParams.get('sortOrder'),'Ascending');assert.equal(url.searchParams.get('parentId'),'library');}assert.deepEqual(progress.map(p=>p.files),count>200?[0,1,2]:[0,1]);assert.equal(progress.at(-1).message,'sync_complete:'+count+',0');assert.equal(A.syncing,false);assert.deepEqual(ids(A.local.snapshot().items),ids(values));});
});
for(const [type,allowed]of [[undefined,true],['',true],['movies',true],['tvshows',true],['boxsets',false],['music',false]])test('sync catalog library '+String(type),async check=>{
 client();f.provider(url=>response(url.pathname.endsWith('Views')?page([lib(type)]):page([])));const result=await observed(A.sync(()=>{}));check(()=>{assert.ifError(result.error);assert.equal(f.requests().length,allowed?2:1);assert.deepEqual(ids(A.snapshot.libraries),allowed?['library']:[]);});
});
test('sync catalog unique scopes and short offsets',async check=>{
 client();const values=[movie('a'),movie('b'),movie('c')];f.provider(url=>{if(url.pathname.endsWith('Views'))return response(page([lib('movies'),lib('tvshows')]));const start=Number(url.searchParams.get('startIndex'));return response(page(start===0?values.slice(0,1):start===1?values.slice(1):[],3));});const progress=[],result=await observed(A.sync(p=>progress.push(p)));check(()=>{assert.ifError(result.error);assert.deepEqual(ids(A.snapshot.items),ids(values));assert.equal(A.snapshot.libraries.length,1);assert.deepEqual(f.requests().filter(r=>r.phase==='request'&&r.url.searchParams.has('startIndex')).map(r=>r.url.searchParams.get('startIndex')),['0','1']);assert.equal(progress.length,3);});
});
const bad=[['gap',[page([],1)]],['overflow',[page([movie('a')],0)]],['duplicate',[page([movie('a'),movie('a')],2)]],['cross-duplicate',[page([movie('a')],2),page([movie('a')],2)]],['total-drift',[page([movie('a')],2),page([movie('b')],3)]],['invalid-item',[page([null],1)]],['invalid-total',[page([],NaN)]],['missing-total',[{Items:[]}]]];
for(const [name,pages]of bad)test('sync catalog independent '+name,async check=>{
 const c=client();let calls=0;c.items=async()=>f.trace().call('domain',()=>pages[calls++]||page([],-1));const result=await observed(A.syncItems(c,[],()=>{}));check(()=>{assert.equal(result.error?.message,'sync_incomplete');assert.ok(calls<=pages.length);});
});
test('sync catalog callback rejection precedes checkpoint',async check=>{
 client();f.fileTargets((n,phase)=>n.startsWith('sync-progress.')||phase==='file-lock');f.provider(url=>response(page(url.pathname.endsWith('Views')?[lib('movies')]:[movie('a')])));const error=Error('user progress failure'),old=A.snapshot,result=await observed(A.sync(()=>{throw error;}));check(()=>{assert.strictEqual(result.error,error);assert.strictEqual(A.snapshot,old);assert.equal(f.trace().calls['file-open']||0,0);assert.equal(A.syncing,false);});
});
test('sync catalog switched account cancels before checkpoint',async check=>{
 client();const old=A.snapshot,gate=h.deferred();f.fileTargets((n,phase)=>n.startsWith('sync-progress.')||phase==='file-lock');f.provider(url=>url.pathname.endsWith('Views')?response(page([lib('movies')])):gate.promise);const pending=observed(A.sync(()=>{}));await f.settle();h.activate('b');const next=A.snapshot;gate.resolve(response(page([movie('old')])));const result=await pending;check(()=>{assert.equal(result.error?.message,'sync_cancelled');assert.strictEqual(A.snapshot,next);assert.equal(f.trace().calls['file-open']||0,0);assert.equal(A.syncing,false);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
