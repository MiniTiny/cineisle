const f=require('./catalog-contract-fixture.cjs').make('browse');
const {assert,h,A,client,response,page,observed,movie}=f;
const tests=[],test=(name,action)=>tests.push({name,action}),ids=values=>values.map(v=>v.Id);
for(const mode of ['library','search','actor','favorites'])for(const count of [59,60,61])test(`browse Index ${mode} ${count}`,async check=>{
 client();const values=Array.from({length:count},(_,i)=>movie(i));f.provider(url=>{const start=Number(url.searchParams.get('startIndex'));return response(page(start===0?values.slice(0,60):start===60?values.slice(60):[],count));});
 const p=h.page({tab:2,mode,parentId:mode==='library'?'library':'',personId:mode==='actor'?'person':'',searchQuery:'sample'});await p.load();if(count>60)await p.load(true);
 check(()=>{assert.deepEqual(ids(p.items),ids(values));assert.equal(p.total,count);assert.deepEqual(f.requests().map(r=>r.url.searchParams.get('limit')),Array(count>60?2:1).fill('60'));assert.deepEqual(f.requests().map(r=>r.url.searchParams.get('startIndex')),count>60?['0','60']:['0']);});
});
for(const count of [0,199,200,201])test('browse allItems actual '+count,async check=>{
 client();const values=Array.from({length:count},(_,i)=>movie(i));f.provider(url=>{const start=Number(url.searchParams.get('startIndex'));return response(page(start===0?values.slice(0,200):start===200?values.slice(200):[],count));});
 const result=await observed(A.allItems([{key:'ParentId',value:'library'}]));
 check(()=>{assert.ifError(result.error);assert.deepEqual(ids(result.value),ids(values));assert.deepEqual(f.requests().map(r=>r.url.searchParams.get('limit')),Array(count>200?2:1).fill('200'));assert.deepEqual(f.requests().map(r=>r.url.searchParams.get('startIndex')),count>200?['0','200']:['0']);assert.ok(f.requests().every(r=>r.url.searchParams.get('parentId')==='library'));});
});
test('browse allItems uses actual short-page offsets and callback copies',async check=>{
 client();const values=Array.from({length:67},(_,i)=>movie(i)),counts=[];f.provider(url=>{const start=Number(url.searchParams.get('startIndex'));return response(page(start===0?values.slice(0,37):start===37?values.slice(37,66):start===66?values.slice(66):[],67));});
 const result=await observed(A.allItems([],copy=>{counts.push(copy.length);copy.push(movie('callback-only'));}));
 check(()=>{assert.ifError(result.error);assert.deepEqual(ids(result.value),ids(values));assert.deepEqual(counts,[37,66,67]);assert.deepEqual(f.requests().map(r=>r.url.searchParams.get('startIndex')),['0','37','66']);});
});
const bad=[['gap',[{Items:[],TotalRecordCount:1}]],['overflow',[{Items:[movie('a')],TotalRecordCount:0}]],['duplicate-in-page',[{Items:[movie('a'),movie('a')],TotalRecordCount:2}]],['duplicate-across-pages',[{Items:[movie('a')],TotalRecordCount:2},{Items:[movie('a')],TotalRecordCount:2}]],['changing-total',[{Items:[movie('a')],TotalRecordCount:2},{Items:[movie('b')],TotalRecordCount:3}]],['invalid-item',[{Items:[null],TotalRecordCount:1}]],['invalid-total',[{Items:[],TotalRecordCount:NaN}]],['missing-total',[{Items:[]}]]];
for(const [name,pages]of bad)test('browse allItems independent '+name,async check=>{
 const c=client();let calls=0;c.items=async()=>f.trace().call('domain',()=>pages[calls++]||{Items:[],TotalRecordCount:-1});const result=await observed(A.allItems([]));
 check(()=>{assert.equal(result.error?.message,'sync_incomplete');assert.ok(calls<=pages.length);});
});
test('browse Index append failure retries identical offset',async check=>{
 client();const initial=Array.from({length:60},(_,i)=>movie(i));let call=0;f.provider(()=>++call===1?response({},500):response(page([movie(60)],61)));
 const p=h.page({tab:2,mode:'library',parentId:'library',items:initial,total:61});await p.load(true);const failed=ids(p.items);await p.load(true);
 check(()=>{assert.deepEqual(failed,ids(initial));assert.deepEqual(ids(p.items),ids([...initial,movie(60)]));assert.deepEqual(f.requests().map(r=>r.url.searchParams.get('startIndex')),['60','60']);});
});
test('browse allItems callback rejection propagates unchanged',async check=>{
 client();f.provider(()=>response(page([movie('a')])));const error=Error('callback aborted'),result=await observed(A.allItems([],()=>{throw error;}));check(()=>assert.strictEqual(result.error,error));
});
test('browse allItems old account response is rejected',async check=>{
 client();const gate=h.deferred();f.provider(()=>gate.promise);const pending=observed(A.allItems([]));await f.settle();h.activate('b');gate.resolve(response(page([movie('old')])));const result=await pending;check(()=>assert.equal(result.error?.message,'login_required'));
});
for(const kind of ['favorites','actor','collection'])test('browse actual consumer '+kind,async check=>{
 const c=client(),values=Array.from({length:201},(_,i)=>movie(i,{UserData:{IsFavorite:true},People:[{Id:'person',Name:'Actor',Type:'Actor'}]}));
 f.provider(url=>url.pathname.endsWith('/Items/person')?response({Id:'person',Name:'Actor',Type:'Person'}):response(page(Number(url.searchParams.get('startIndex'))===0?values.slice(0,200):values.slice(200),201)));
 let p,loaded;if(kind==='favorites'){const {Favorites}=h.load('pages/Favorites.ets');p=new Favorites();p.client=c;await p.refresh();loaded=p.all;}
 if(kind==='actor'){const {Actor}=h.load('pages/Actor.ets');p=new Actor();p.client=c;p.person={Id:'person',Name:'Actor'};await p.refresh();loaded=p.works;}
 if(kind==='collection'){const {Collection}=h.load('pages/Collection.ets');p=new Collection();p.owner=c;p.alive=true;p.item={Id:'set',Name:'Set',Type:'BoxSet'};await p.load();loaded=p.items;}
 check(()=>{assert.deepEqual(ids(loaded),ids(values));const queries=f.requests().filter(r=>r.url.searchParams.has('limit'));assert.deepEqual(queries.map(r=>r.url.searchParams.get('limit')),['200','200']);assert.deepEqual(queries.map(r=>r.url.searchParams.get('startIndex')),['0','200']);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});
module.exports=tests;
