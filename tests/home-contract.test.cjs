const f = require('./home-contract-fixture.cjs');
const { assert, h, A, ProgressiveHome, loadHome, cachedHome, media, view, response, page, client, settle, observed } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
for (const version of ['10.8.13', '10.10.0']) for (const cold of [false, true]) for (const [method, argument, limit] of [['resume', undefined, 20], ['latest', '', 30], ['latest', 'library', 12], ['nextUp', '', 9], ['nextUp', 'series', 1]]) {
  const name = `home actual ${method} ${argument || 'global'} ${version} ${cold ? 'cold' : 'warm'}`;
  test(name, async check => {
    const c = client(version, cold);
    f.provider((phase, url) => phase === 'version' ? response({ Id: 'server', Version: version }) : phase === 'latest' ? response([media('item')]) : response(page([media('item')])));
    const result = await observed(argument === undefined ? c[method]() : c[method](argument)), requests = f.requests(), query = requests.at(-1)?.url.searchParams;
    check(() => {
      assert.ifError(result.error); assert.equal(query.get('limit'), String(limit)); assert.equal(requests.length, cold ? 2 : 1);
      const legacy = version === '10.8.13' && method !== 'nextUp';
      assert.equal(query.get('userId'), legacy ? null : 'a');
      if (legacy) assert.ok(requests.at(-1).url.pathname.startsWith('/jellyfin/Users/a/Items/'));
      if (cold) assert.equal(requests[0].phase, 'version');
      if (method === 'resume') assert.equal(query.get('mediaTypes'), 'Video');
      if (method === 'nextUp') assert.equal(query.get('seriesId'), argument || null);
      if (method === 'latest') { assert.equal(query.get('parentId'), argument || null); assert.deepEqual(query.getAll('includeItemTypes'), argument ? [] : ['Movie', 'Series']); }
    });
  });
}
for (const entry of ['batch', 'progressive', 'Index', 'cached']) test('home library matrix ' + entry, async check => {
  const c = client(), libraries = [view('movie','movies'),view('show','tvshows'),view('box','boxsets'),view('missing'),view('empty',''),view('unknown','music')];
  f.provider((phase, url) => phase === 'views' ? response(page(libraries)) : phase === 'latest' ? response([media('item-' + url.searchParams.get('parentId'))]) : response(page([media(phase)])));
  let sections;
  if (entry === 'batch') sections = await loadHome(c);
  if (entry === 'progressive') { const updates = []; await new ProgressiveHome(c, value => updates.push(value)).start([]); sections = updates.at(-1).sections; }
  if (entry === 'Index') { const p = h.page({ tab: 1 }); await p.load(); sections = p.homeSections; }
  if (entry === 'cached') sections = cachedHome(h.snapshot(libraries.map(v => media('item-'+v.Id)),libraries,libraries.map(v => ({ libraryId:v.Id,itemIds:['item-'+v.Id] }))));
  check(() => {
    assert.deepEqual(sections.filter(s=>s.libraryId).map(s=>s.libraryId), ['movie','show','box','missing','empty']);
    if (entry !== 'cached') {
      assert.deepEqual(f.requests().filter(r=>r.phase==='latest').map(r=>r.url.searchParams.get('limit')),Array(5).fill('12'));
      assert.equal(f.requests().find(r=>r.phase==='resume').url.searchParams.get('limit'),'20');
      assert.equal(f.requests().find(r=>r.phase==='nextup').url.searchParams.get('limit'),'9');
    }
  });
});
for (const count of [3,4,5]) test('home scheduler count ' + count, async check => {
  client(); let active=0,peak=0,calls=0; const pending=[];
  const source={resume:async()=>[],nextUp:async()=>[],libraries:async()=>f.trace().call('views',()=>Array.from({length:count},(_,i)=>view('v'+i,'movies'))),latest:id=>f.trace().call('scheduler',()=>{calls++;active++;peak=Math.max(peak,active);const gate=h.deferred();pending.push(gate);return gate.promise.finally(()=>active--);})};
  const loader=new ProgressiveHome(source,()=>{}),op=loader.start([]);await settle();const initial=calls;
  while(pending.length){pending.splice(0).forEach(g=>g.resolve([]));await settle();}await op;
  check(()=>{assert.equal(initial,Math.min(count,4));assert.equal(peak,Math.min(count,4));assert.equal(calls,count);});
});
test('home retry waits when four slots are occupied',async check=>{
  client();let active=0,peak=0;const pending=[],calls=[],updates=[];
  const source={resume:async()=>[],nextUp:async()=>[],libraries:async()=>Array.from({length:6},(_,i)=>view('v'+i,'movies')),latest:id=>{calls.push(id);active++;peak=Math.max(peak,active);const gate=h.deferred();pending.push(gate);return gate.promise.finally(()=>active--);}};
  const loader=new ProgressiveHome(source,u=>updates.push(u)),op=loader.start([]);await settle();pending.shift().reject(Error('temporary'));await settle();const before=calls.length;
  loader.retry('library-v0');await settle();const after=calls.length;
  while(pending.length){pending.splice(0).forEach(g=>g.resolve([]));await settle();}await op;
  check(()=>{assert.equal(before,5);assert.equal(after,5);assert.equal(peak,4);assert.equal(calls.filter(id=>id==='v0').length,2);assert.equal(updates.at(-1).failures.length,0);});
});
test('home cancellation rejects late publications',async check=>{
  client();const gate=h.deferred(),updates=[];const loader=new ProgressiveHome({resume:()=>gate.promise,nextUp:async()=>[],libraries:async()=>[]},u=>updates.push(u));const op=loader.start([]);loader.cancel();const count=updates.length;gate.resolve([media('late')]);await op;await settle();check(()=>assert.equal(updates.length,count));
});
test('home authorization clears cache and cancels late results',async check=>{
  const c=client(),gate=h.deferred(),updates=[];
  f.provider(phase=>phase==='resume'?response({},401):phase==='nextup'?gate.promise:response(page([])));
  const op=new ProgressiveHome(c,u=>updates.push(u)).start([{id:'resume',kind:'resume',name:'',libraryId:'',items:[media('private')]}]);
  await settle();const count=updates.length,last=updates.at(-1);gate.resolve(response(page([media('late')])));await op;await settle();
  check(()=>{assert.deepEqual(last.sections,[]);assert.equal(last.cached,false);assert.equal(last.failures[0].message,'login_expired');assert.equal(updates.length,count);});
});
test('home partial HTTP error preserves independent shelves',async check=>{
  const c=client();f.provider((phase,url)=>phase==='views'?response(page([view('fail','movies')])):phase==='latest'?response({},500):response(page([media(phase)])));
  const updates=[];await new ProgressiveHome(c,u=>updates.push(u)).start([]);const last=updates.at(-1);
  check(()=>{assert.deepEqual(last.sections.map(s=>s.id),['resume','nextup']);assert.equal(last.failures.length,1);assert.equal(last.failures[0].message,'http_failed:500');});
});
test('home batch loader preserves all-or-nothing error',async check=>{
  const c=client();f.provider(phase=>phase==='resume'?response({},403):response(page([])));const result=await observed(loadHome(c));check(()=>assert.equal(result.error?.message,'permission_denied'));
});
test('home scoped next up through detail consumer',async check=>{
  const c=client();f.provider((phase,url)=>phase==='nextup'?response(page([{...media('episode'),Type:'Episode',SeriesId:'series'}])):url.pathname.endsWith('/Items/series')?response({...media('series'),Type:'Series'}):url.pathname.endsWith('/Seasons')?response(page([])):assert.fail('Unexpected detail operation'));
  const result=await observed(h.load('service/DetailData.ets').loadDetail(c,'series'));
  check(()=>{assert.ifError(result.error);assert.equal(result.value.nextUp.Id,'episode');assert.equal(f.requests().find(r=>r.phase==='nextup').url.searchParams.get('limit'),'1');});
});
test('home scoped next up through playback consumer',async check=>{
  client();f.provider((phase,url)=>phase==='nextup'?response(page([{...media('episode'),Type:'Episode',SeriesId:'series'}])):url.pathname.endsWith('/PlaybackInfo')?response({MediaSources:[{Id:'source'}]}):assert.fail('Unexpected playback operation'));
  const result=await observed(A.detailPlayback({...media('series'),Type:'Series'}));
  check(()=>{assert.ifError(result.error);assert.equal(result.value.item.Id,'episode');assert.equal(f.requests().find(r=>r.phase==='nextup').url.searchParams.get('limit'),'1');});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});
module.exports=tests;
