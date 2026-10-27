const f=require('./playback-rate-fixture.cjs').make('media-time'),{assert,h}=f,tests=[],test=(name,action)=>tests.push({name,action});
for(const [ticks,ms]of [[0,0],[1,0.0001],[123456789,12345.6789]])test('media time actual resume '+ticks,async check=>{
 const route=h.route(h.episode('e1',1,1,{UserData:{PlaybackPositionTicks:ticks}})),r=await f.native('sdk',route);check(()=>{assert.equal(r.c.snapshot().position,ms);const seek=h.nativePlayers.at(-1).calls.filter(c=>c[0]==='seek').at(-1);if(ticks>0)assert.equal(seek[1],ms);else assert.equal(seek,undefined);});
});
for(const [ticks,ms]of [[0,0],[1,0.0001],[123456789,12345.6789]])test('media time actual session initial duration '+ticks,async check=>{
 const route=h.route(h.episode('e1',1,1,{RunTimeTicks:ticks})),r=await f.system(route,false);check(()=>{assert.equal(r.session.metadata[0].duration,ms);assert.deepEqual(r.errors,[]);});
});
test('media time native progress to real HTTP body',async check=>{
 const http=h.platform.get('@ohos.net.http'),create=http.createHttp,requests=[],now=Date.now;let time=100000;Date.now=()=>time;
 http.createHttp=()=>f.trace().call('http-create',()=>({request:async(url,options)=>f.trace().call('http-request',()=>{requests.push({url,options});return{responseCode:204,result:''};}),destroy(){}}));
 try{const {JellyfinClient}=h.load('service/JellyfinClient.ets'),client=new JellyfinClient({server:'https://example.invalid/jellyfin',serverId:'server',userId:'user',deviceId:'device',token:'fixture-token'},'10.10.0');const r=await f.native('sdk',h.route(),{report:client.report.bind(client)});time+=10001;h.nativePlayers.at(-1).emit('timeUpdate',12345.6789);await h.settle();await r.c.reports;const progress=requests.find(v=>v.url.endsWith('/Sessions/Playing/Progress'));check(()=>{assert.ok(progress);assert.equal(JSON.parse(progress.options.extraData).PositionTicks,123456789);});await r.c.close();}finally{http.createHttp=create;Date.now=now;}
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
