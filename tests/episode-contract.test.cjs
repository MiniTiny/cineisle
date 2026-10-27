const f=require('./catalog-contract-fixture.cjs').make('episode-queue');
const {assert,h,A,client,response,page,observed,movie}=f;
const tests=[],test=(name,action)=>tests.push({name,action}),ids=items=>items.map(v=>v.Id);
const episode=(id,extra={})=>movie(id,{Type:'Episode',SeriesId:'series',SeasonId:'season',ParentIndexNumber:1,IndexNumber:Number(id),...extra});
function supply(values,version='10.10.0') {f.provider(url=>url.pathname.endsWith('/System/Info/Public')?response({Version:version,Id:'server'}):response(page(Number(url.searchParams.get('startIndex'))===0?values.slice(0,200):values.slice(200),values.length)));}
for(const version of ['10.8.9','10.10.0'])for(const count of [0,199,200,201])test(`episode queue actual ${version} ${count}`,async check=>{
 client(version,true);const values=Array.from({length:count},(_,i)=>episode(i));supply(values,version);const result=await observed(A.seriesEpisodes('series'));
 check(()=>{assert.ifError(result.error);assert.deepEqual(ids(result.value),ids(values));const queries=f.requests().filter(r=>r.phase==='request');assert.deepEqual(queries.map(r=>r.url.searchParams.get('limit')),Array(count>200?2:1).fill('200'));assert.deepEqual(queries.map(r=>r.url.searchParams.get('startIndex')),count>200?['0','200']:['0']);assert.equal(f.requests()[0].phase,'version');for(const {url}of queries){assert.ok(url.pathname.endsWith('/Shows/series/Episodes'));assert.equal(url.searchParams.get('isMissing'),'false');assert.deepEqual(url.searchParams.getAll('fields'),['MediaSources']);assert.equal(url.searchParams.has('sortBy'),false);assert.equal(url.searchParams.get('userId'),'a');}});
});
test('episode queue actual short-page offsets',async check=>{
 client();const values=[episode(0),episode(1),episode(2)];f.provider(url=>response(page(Number(url.searchParams.get('startIndex'))===0?values.slice(0,1):values.slice(1),3)));const result=await observed(A.seriesEpisodes('series'));check(()=>{assert.ifError(result.error);assert.deepEqual(ids(result.value),ids(values));assert.deepEqual(f.requests().map(r=>r.url.searchParams.get('startIndex')),['0','1']);});
});
const bad=[['gap',[page([],1)]],['overflow',[page([episode(0)],0)]],['duplicate',[page([episode(0),episode(0)],2)]],['cross-duplicate',[page([episode(0)],2),page([episode(0)],2)]],['total-drift',[page([episode(0)],2),page([episode(1)],3)]],['invalid-item',[page([null],1)]],['invalid-type',[page([movie('a',{SeriesId:'series'})],1)]],['wrong-series',[page([episode(0,{SeriesId:'other'})],1)]],['invalid-total',[page([],NaN)]],['missing-total',[{Items:[]}]]];
for(const [name,pages]of bad)test('episode queue independent '+name,async check=>{
 const c=client();let calls=0;c.episodePage=async()=>f.trace().call('domain',()=>pages[calls++]||page([],-1));const result=await observed(A.seriesEpisodes('series'));check(()=>{assert.equal(result.error?.message,'episode_queue_failed');assert.ok(calls<=pages.length);});
});
for(const mode of ['detail-series','detail-season','next','previous'])test('episode queue actual consumer '+mode,async check=>{
 client();const values=Array.from({length:201},(_,i)=>episode(i));f.provider(url=>{
  if(url.pathname.endsWith('/PlaybackInfo'))return response({MediaSources:[{Id:'source',Container:'mp4'}],PlaySessionId:'play'});
  if(url.pathname.endsWith('/NextUp'))return response(page([]));
  const start=Number(url.searchParams.get('startIndex'));return response(page(start===0?values.slice(0,200):values.slice(200),201));
 });
 const result=await observed(mode.startsWith('detail')?A.detailPlayback(movie(mode==='detail-series'?'series':'season',{Type:mode==='detail-series'?'Series':'Season',SeriesId:'series'})):mode==='next'?A.nextPlayback({item:values[199],offline:false}):A.previousPlayback({item:values[200],offline:false}));
 check(()=>{assert.ifError(result.error);assert.equal(result.value.item.Id,mode==='next'?'200':mode==='previous'?'199':'0');assert.equal(result.value.mediaSourceId,'source');const queries=f.requests().filter(r=>r.url.pathname.endsWith('/Episodes'));assert.deepEqual(queries.map(r=>r.url.searchParams.get('limit')),['200','200']);assert.deepEqual(queries.map(r=>r.url.searchParams.get('startIndex')),['0','200']);});
});
test('episode queue switched account rejects late page',async check=>{
 client();const gate=h.deferred();f.provider(()=>gate.promise);const pending=observed(A.seriesEpisodes('series'));await f.settle();h.activate('b');gate.resolve(response(page([episode(0)])));const result=await pending;check(()=>assert.equal(result.error?.message,'login_required'));
});
for(const status of [401,403,500])test('episode queue HTTP error '+status,async check=>{
 client();f.provider(()=>response({},status));const result=await observed(A.seriesEpisodes('series'));check(()=>{assert.equal(result.error?.message,({401:'login_expired',403:'permission_denied',500:'http_failed:500'})[status]);if(status===500)assert.equal(result.error.status,500);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
