// Real options decoder/Preferences and SDK Settings builder; the OS storage API is file-backed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),common=require('./contract-external.cjs'),h=require('./player-regression.test.cjs');
const {MpvPreferences:store}=h.load('service/MpvPreferences.ets'),options=h.load('utils/MpvOptions.ts'),platform=h.preferencesPlatform,originalOpen=platform.api.getPreferences,originalParse=JSON.parse;
const filename=path.join(h.directory,'mpv_playback_options.fixture.json'),context={filesDir:h.directory,cacheDir:h.directory};let trace,selectedRaw,parseCount;
function cold(){Object.assign(store,{context:undefined,store:undefined,loading:undefined,writes:Promise.resolve(),raw:'',value:options.defaultMpvOptions(),ready:false,issue:''});platform.state.instances.clear();}
const observed=promise=>Promise.resolve(promise).then(value=>({value}),error=>({error})),attempt=fn=>{try{return{value:fn()};}catch(error){return{error};}};
const f={assert,h,store,options,platform,filename,context,observed,attempt,cold,trace:()=>trace,parses:()=>parseCount,
 seed(raw){selectedRaw=raw;fs.writeFileSync(filename,JSON.stringify({options_v1:raw}));},raw:()=>originalParse(fs.readFileSync(filename,'utf8')).options_v1,
 page(){const ui=trace.call('ui-compile',()=>require('./brand-forms.test.cjs')),r=trace.call('ui-render',()=>ui.render('Settings',{deviceVisible:true,locked:false,engineKnown:true,engineChoice:'mpv',mpvOffered:true,mpvOptionsKnown:false,mpvStore:{load:()=>store.load(context),requireOptions:()=>store.requireOptions(),known:()=>store.known(),save:(value,allowed)=>store.save(value,allowed)}}));r.view.ownerClient=r.AppService.client;return{...r,button:label=>ui.button(r,label)};},
 run:tests=>common.run(tests,'mpv-settings-budget',async()=>{h.reset();trace=common.external('mpv-settings-budget',(process.argv.find(a=>a.startsWith('--fault='))||'').slice(8));if(process.argv.includes('--fault=setup'))assert.fail('unrelated MPV settings setup assertion');platform.reset();cold();fs.rmSync(filename,{force:true});selectedRaw=undefined;parseCount=0;
  JSON.parse=function(raw,...args){if(raw!==selectedRaw)return originalParse(raw,...args);return trace.call('options-json-parse',()=>{++parseCount;return originalParse(raw,...args);});};
  platform.api.getPreferences=(...args)=>trace.call('preferences-open',async()=>{
   if(process.argv.includes('--native-mpv-settings-init-failure'))throw Object.assign(Error('injected native MPV preferences initialization failure'),{code:'EIO',contractInjected:true});
   const instance=await originalOpen(...args);for(const [method,phase]of [['get','preferences-read'],['put','preferences-write'],['flush','preferences-flush']]){const original=instance[method].bind(instance);instance[method]=(...values)=>trace.call(phase,()=>original(...values));}return instance;
  });
 },async()=>{JSON.parse=originalParse;platform.api.getPreferences=originalOpen;platform.state.flushWait=undefined;},()=>trace.healthy())};
module.exports=f;
