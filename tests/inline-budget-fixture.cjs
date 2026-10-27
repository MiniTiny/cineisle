// Real HTML/SRT parsing, actual controller and Jellyfin subtitle transport; OS/media APIs are fixtures.
const assert=require('node:assert/strict'),common=require('./contract-external.cjs'),h=require('./player-regression.test.cjs');
const inline=h.load('utils/InlineSubtitle.ts'),playback=h.load('utils/Playback.ts'),{JellyfinClient}=h.load('service/JellyfinClient.ets');
const http=h.platform.get('@ohos.net.http'),media=h.platform.get('@ohos.multimedia.media'),oldHttp=http.createHttp,oldPlayer=media.createAVPlayer;
let trace,controllers,raw,requests,nativeCreates;
const attempt=fn=>{try{return{value:fn()};}catch(error){return{error};}},doc=body=>'1\n00:00:00,000 --> 00:00:10,000\n'+body+'\n';
const f={assert,h,inline,doc,attempt,trace:()=>trace,requests:()=>requests,
 async invoke(mode,body){trace.call('converter-entry',()=>{});
  if(mode==='lower')return attempt(()=>inline.inlineSubtitle(body));
  if(mode==='parse')return attempt(()=>playback.parseSubtitles(doc(body))[0]);
  const client=new JellyfinClient({server:'https://subtitle.invalid',token:'fixture-token',deviceId:'fixture-device',userId:'fixture-user'},'10.10.0');
  const {c,values}=h.rig({subtitle:(...args)=>client.subtitle(...args)}),captions=[];controllers.push(c);c.view.caption=value=>captions.push(value);raw=doc('<b>old</b>');
  await c.open(h.route(),'surface');await h.settle();await c.selectSubtitle('server:20');raw=doc(body);await c.selectSubtitle('server:20');h.nativePlayers[0]?.emit('timeUpdate',1000);
  return{value:captions.at(-1),errors:[...values.errors],subtitleKey:values.subtitleKey,requests:[...requests]};
 },run:tests=>common.run(tests,'inline-budget',async()=>{h.reset();trace=common.external('inline-budget',(process.argv.find(a=>a.startsWith('--fault='))||'').slice(8));controllers=[];raw=doc('fixture');requests=[];nativeCreates=0;if(process.argv.includes('--fault=setup'))assert.fail('unrelated inline budget setup assertion');
  http.createHttp=()=>trace.call('http-create',()=>{++nativeCreates;if(process.argv.includes('--native-init-failure')||nativeCreates===Number((process.argv.find(a=>a.startsWith('--native-init-failure-at='))||'').split('=')[1]))throw Object.assign(Error('injected native subtitle HTTP initialization failure'),{code:'EIO',contractInjected:true});
   return{async request(address,options){requests.push({address,options});return trace.call('subtitle-response',()=>({responseCode:200,result:raw}));},destroy(){trace.call('http-destroy',()=>{});}};
  });
  media.createAVPlayer=()=>trace.call('player-create',()=>{if(process.argv.includes('--native-inline-player-init-failure'))throw Object.assign(Error('injected native player initialization failure'),{code:'EIO',contractInjected:true});return oldPlayer();});
 },async()=>{for(const c of controllers)await c.close();http.createHttp=oldHttp;media.createAVPlayer=oldPlayer;},()=>trace.healthy())};
module.exports=f;
