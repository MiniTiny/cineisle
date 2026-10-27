const f=require('./catalog-contract-fixture.cjs').make('discovery-ranking');
const {assert,h,A,client,response,page,observed,movie}=f,{discovery}=h.load('utils/Experience.ts');
const tests=[],test=(name,action)=>tests.push({name,action}),actor=(id,name=id)=>({Id:id,Name:name,Type:'Actor'}),follow=[{id:'person',acknowledged:[]}],signal=movie('signal',{Genres:['Crime'],UserData:{IsFavorite:true}});
for(const count of [29,30,31])test('discovery ranking cap '+count,async check=>{
 const items=Array.from({length:count},(_,i)=>movie(String(i).padStart(3,'0'))),result=discovery(items,[],[]);check(()=>assert.deepEqual(result.map(r=>r.item.Id),items.slice(0,30).map(i=>i.Id)));
});
for(const [actors,genres,score]of [[[],[],0],[[actor('person')],[],4],[[],['Crime'],2],[[actor('person')],['Crime'],6]])test('discovery ranking score '+score,async check=>{
 const ranked=discovery([movie('a',{People:actors,Genres:genres})],[signal],follow);check(()=>assert.equal(ranked[0].score,score));
});
test('discovery ranking dedup identities preserve bilingual evidence and ties',async check=>{
 const value=movie('b',{People:[actor('person','Same'),actor('p2','Same'),actor('person','Same')],Genres:['Crime','犯罪','Crime']}),r=discovery([value,value,movie('a',{...value,Id:'a'})],[signal],[...follow,{id:'p2',acknowledged:[]}]);check(()=>{assert.deepEqual(r.map(v=>v.item.Id),['a','b']);assert.deepEqual(r[0].actors,['Same']);assert.deepEqual(r[0].genres,['Crime','犯罪']);assert.equal(r[0].score,8);});
});
test('discovery ranking excludes played episodes and preserves date order',async check=>{
 const items=[movie('a'),movie('b',{DateCreated:'2026-01-01'}),movie('played',{UserData:{Played:true}}),movie('episode',{Type:'Episode'}),movie('series',{Type:'Series',DateCreated:'2025-01-01'})],ranked=discovery(items,[],[]);check(()=>assert.deepEqual(ranked.map(r=>r.item.Id),['b','series','a']));
});
for(const version of ['10.8.9','10.10.0'])for(const count of [199,200,201])test(`discovery ranking actual Index ${version} ${count}`,async check=>{
 client(version,true);A.snapshot.items=[signal];A.experience.update(s=>{s.follows=follow;});const items=Array.from({length:count},(_,i)=>movie(String(i).padStart(3,'0'),{People:[actor('person')],Genres:['Crime']}));
 f.provider(url=>url.pathname.endsWith('/System/Info/Public')?response({Version:version,Id:'server'}):response(page(items.slice(0,200),count)));const p=h.page({tab:0,discover:true});await p.load();check(()=>{assert.equal(p.items.length,30);assert.equal(p.discoveries[0].score,6);assert.deepEqual(p.items.map(i=>i.Id),items.slice(0,30).map(i=>i.Id));const queries=f.requests().filter(r=>r.phase==='request');assert.equal(queries.length,1);assert.equal(f.requests()[0].phase,'version');const q=queries[0].url.searchParams;assert.equal(q.get('limit'),'200');assert.equal(q.get('filters'),'IsUnplayed');assert.deepEqual(q.getAll('includeItemTypes'),['Movie','Series']);assert.equal(q.get('sortBy'),'DateCreated');assert.equal(q.get('sortOrder'),'Descending');assert.equal(p.message,'');});
});
test('discovery ranking actual Index applies pending edits before scoring',async check=>{
 client();A.snapshot.items=[signal];const a=movie('a',{People:[actor('person')],Genres:['Crime']}),b=movie('b');A.experience.update(s=>{s.follows=follow;s.pending=[{id:'a',field:'played',value:true,revision:1,item:a}];});f.provider(()=>response(page([a,b])));const p=h.page({tab:0,discover:true});await p.load();check(()=>{assert.deepEqual(p.items.map(i=>i.Id),['b']);assert.equal(p.discoveries[0].score,0);});
});
for(const [status,message]of [[401,'login_expired:'],[403,'permission_denied:'],[500,'http_failed:500']])test('discovery ranking actual Index error '+status,async check=>{
 client();f.provider(()=>response({},status));const p=h.page({tab:0,discover:true});await p.load();check(()=>{assert.equal(p.message,message);assert.deepEqual(p.items,[]);assert.equal(p.busy,false);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
