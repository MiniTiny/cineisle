// Real converter and real MPV adapter; snapshots and native bridge are explicit fixtures.
const assert=require('node:assert/strict'),common=require('./contract-external.cjs');
let trace,rig,originalRun,engines,allocations;
const attempt=fn=>{try{return{value:fn()};}catch(error){return{error};}},observed=promise=>Promise.resolve(promise).then(value=>({value}),error=>({error}));
const f={assert,attempt,trace:()=>trace,allocations:()=>({...allocations}),event:text=>'Dialogue: 0,0:00:00.50,0:00:03.50,Default,,0,0,0,,'+text,
 rig(){if(rig)return rig;rig=trace.call('rig-create',()=>require('./mpv-engine.test.cjs').rig());originalRun=rig.subtitleTypes.SubtitleRun;
  rig.subtitleTypes.SubtitleRun=function(text='',style){return trace.call('run-create',()=>{
   if(process.argv.includes('--native-run-init-failure'))throw Object.assign(Error('injected subtitle model initialization failure'),{code:'EIO',contractInjected:true});
   allocations[text?'text':'style']++;return new originalRun(text,style);
  });};rig.subtitleTypes.SubtitleRun.prototype=originalRun.prototype;
  const create=rig.Engine.create.bind(rig.Engine);rig.Engine.create=async(...args)=>{const engine=await create(...args);engines.push(engine);return engine;};
  for(const [key,phase]of [['create','native-create'],['snapshot','native-snapshot'],['command','native-command']]){const original=rig.bridge[key].bind(rig.bridge);rig.bridge[key]=(...args)=>trace.call(phase,()=>{
   if(key==='create'&&process.argv.includes('--native-mpv-text-init-failure'))throw Object.assign(Error('injected native MPV subtitle initialization failure'),{code:'EIO',contractInjected:true});
   return original(...args);
  },key==='command'?{command:args[1].type}:{});}
  return rig;
 },async invoke(mode,events,options={}){const r=this.rig(),codec=options.codec??'subrip',fontSize=options.fontSize??8,overflow=options.overflow??false;
  if(mode==='lower')return attempt(()=>r.subtitleFormatter.mpvTextSubtitle(codec,events,fontSize,overflow));
  Object.assign(r.value,{subtitleEvents:events,subtitleFontSize:fontSize,subtitleOverflow:overflow,subtitleStart:500,subtitleEnd:3500});r.value.tracks.find(t=>t.kind==='sub').codec=codec;
  const result=await observed(r.open());return{...result,content:r.events.filter(e=>e[0]==='subtitle').at(-1)?.[1].content,commands:r.calls.filter(c=>c[0]==='subtitle-visible'),errors:r.events.filter(e=>e[0]==='error')};
 },run:tests=>common.run(tests,'mpv-text-budget',async()=>{trace=common.external('mpv-text-budget',(process.argv.find(a=>a.startsWith('--fault='))||'').slice(8));rig=undefined;originalRun=undefined;engines=[];allocations={style:0,text:0};if(process.argv.includes('--fault=setup'))assert.fail('unrelated subtitle budget setup assertion');},async()=>{for(const engine of engines)await engine.release();if(rig&&originalRun)rig.subtitleTypes.SubtitleRun=originalRun;},()=>trace.healthy())};
module.exports=f;
