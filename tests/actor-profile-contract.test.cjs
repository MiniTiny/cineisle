const f=require('./catalog-contract-fixture.cjs').make('actor-profile');
const {assert,h,A,client,response,page,observed,movie}=f,{actorProfiles,sortActors}=h.load('utils/Experience.ts');
const tests=[],test=(name,action)=>tests.push({name,action}),person={Id:'person',Name:'Actor',Type:'Actor'},work=(id,genres=[])=>movie(id,{People:[person],Genres:genres});
const profile=items=>actorProfiles(items)[0];
for(const [total,support,allowed]of [[4,2,false],[4,3,true],[4,4,true],[9,3,false],[9,4,true],[10,3,false],[10,4,true],[100,34,false],[100,35,true],[100,36,true]])test(`actor profile support ${total}/${support}`,async check=>{
 const p=profile(Array.from({length:total},(_,i)=>work(i,i<support?['Crime']:[])));check(()=>{assert.deepEqual(p.tags.map(t=>t.key),allowed?['genre:crime']:[]);if(allowed)assert.equal(p.tags[0].works.length,support);});
});
for(const count of [4,5,6])test('actor profile tag cap '+count,async check=>{
 const genres=Array.from({length:count},(_,i)=>'genre'+i),p=profile([work('a',genres),work('b',genres),work('c',genres)]);check(()=>assert.deepEqual(p.tags.map(t=>t.key),genres.slice(0,5).map(g=>'genre:'+g)));
});
for(const reverse of [false,true])test('actor profile recommended weights '+reverse,async check=>{
 const a={person:{Id:'a',Name:'Same'},works:[],watched:reverse?0:3,favorite:reverse?2:0,unplayed:5,tags:[]},b={...a,person:{Id:'b',Name:'Same'},watched:a.favorite?3:0,favorite:a.favorite?0:2};const result=sortActors([b,a],'recommended','','',false);check(()=>assert.deepEqual(result.map(p=>p.person.Id),['a','b']));
});
test('actor profile recommended all watched and secondary ties',async check=>{
 const p=(id,unplayed,favorite,watched)=>({person:{Id:id,Name:'Same'},works:[],unplayed,favorite,watched,tags:[]});const sorted=sortActors([p('watched',0,50,50),p('b',2,1,0),p('a',1,1,0)],'recommended','','',false);check(()=>assert.deepEqual(sorted.map(p=>p.person.Id),['b','a','watched']));
});
test('actor profile evidence dedup aliases and episode exclusion',async check=>{
 const a=work('a',['Crime','犯罪','drama']),b=work('b',['犯罪','剧情']),c=work('c',['Crime']);a.People.push(person);const p=profile([a,a,b,c,{...work('e',['Fake']),Type:'Episode'}]);check(()=>{assert.equal(p.works.length,3);assert.deepEqual(p.tags.map(t=>t.key),['genre:crime']);assert.equal(p.tags[0].works.length,3);});
});
test('actor profile actual refresh publishes evidence and follow acknowledgement',async check=>{
 f.fileTargets(n=>n==='experience.json.tmp'||n==='experience.json');const c=client(),values=[work('a',['Crime']),work('b',['犯罪']),work('c',['Crime'])];f.stage('account-init');A.experience.update(s=>{s.follows=[{id:'person',acknowledged:[]}];});f.stage('business');f.provider(url=>url.pathname.endsWith('/Items/person')?response({Id:'person',Name:'Actor',Type:'Person',Overview:'Biography'}):response(page(values)));
 const {Actor}=h.load('pages/Actor.ets'),p=new Actor();p.client=c;p.person=person;const result=await observed(p.refresh());check(()=>{assert.ifError(result.error);assert.equal(p.overview,'Biography');assert.equal(p.profile.works.length,3);assert.deepEqual(p.profile.tags.map(t=>t.key),['genre:crime']);assert.equal(p.profile.newCount,0);assert.equal(p.profile.followed,true);assert.equal(p.message,'');assert.equal(p.busy,false);assert.equal(f.requests().length,2);});
});
for(const [status,message]of [[401,'login_expired:'],[403,'permission_denied:'],[500,'http_failed:500']])test('actor profile actual refresh error '+status,async check=>{
 const c=client();f.provider(()=>response({},status));const {Actor}=h.load('pages/Actor.ets'),p=new Actor();p.client=c;p.person=person;await p.refresh();check(()=>{assert.equal(p.message,message);assert.equal(p.profile,undefined);assert.equal(p.busy,false);assert.equal(p.biographyLoading,false);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
