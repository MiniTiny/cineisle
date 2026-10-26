// Real page/controller/AV adapter and MPV adapter; backends and platform services remain explicit fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const h=require('./player-regression.test.cjs'),mpv=require('./mpv-engine.test.cjs'),common=require('./contract-external.cjs');
const media=h.platform.get('@ohos.multimedia.media'),originalCreate=media.createAVPlayer,originalValues={...media.PlaybackSpeed};
const rows=[[0.5,'SPEED_FORWARD_0_50_X'],[0.75,'SPEED_FORWARD_0_75_X'],[1,'SPEED_FORWARD_1_00_X'],[1.25,'SPEED_FORWARD_1_25_X'],[1.5,'SPEED_FORWARD_1_50_X'],[1.75,'SPEED_FORWARD_1_75_X'],[2,'SPEED_FORWARD_2_00_X']];
function make(scope='playback-rate'){
let trace,controllers,engines,systems,expectedSpeedRejection,sawExternalFailure;
function sdkValues(){return trace.call('sdk-declarations',()=>{const file=path.join(process.env.DEVECO_SDK_HOME||path.join(h.sdk,'sdk'),'default/openharmony/ets/api/@ohos.multimedia.media.d.ts'),source=fs.readFileSync(file,'utf8');return Object.fromEntries(rows.map(([,name])=>{const match=source.match(new RegExp('\\b'+name+'\\s*=\\s*(-?\\d+)'));assert.ok(match,name);return[name,Number(match[1])];}));});}
function enumValues(mode){return mode==='sdk'?sdkValues():Object.fromEntries(rows.map(([,key],i)=>[key,[104,8,201,17,63,91,55][i]]));}
async function before(){h.reset();h.load('utils/Strings.ets').initializeStrings({getStringByNameSync:(name,...args)=>name+':'+args.join(',')});controllers=[];engines=[];systems=[];expectedSpeedRejection=false;sawExternalFailure=false;Object.assign(media.PlaybackSpeed,originalValues);trace=common.external(scope,(process.argv.find(a=>a.startsWith('--fault='))||'').slice(8));if(process.argv.includes('--fault=setup'))assert.fail('unrelated playback-rate setup');
 media.createAVPlayer=()=>trace.call('av-create',async()=>{if(process.argv.includes('--native-init-failure'))throw Object.assign(Error('injected AV initialization failure'),{code:'EIO',contractInjected:true});const player=await originalCreate(),set=player.setSpeed.bind(player);player.setSpeed=value=>{const result=trace.call('av-speed',()=>expectedSpeedRejection?{error:Error('expected native speed rejection')}:{value:set(value)});if(result.error)throw result.error;return result.value;};return player;});
}
async function after(){for(const s of systems)await s.dispose();for(const c of controllers)await c.close();for(const p of engines)await p.release();media.createAVPlayer=originalCreate;Object.assign(media.PlaybackSpeed,originalValues);if(!sawExternalFailure)await trace.healthy();}
async function native(mode='sdk',playbackRoute=h.route(),overrides={}){
 Object.assign(media.PlaybackSpeed,enumValues(mode));
 const r = h.rig({async report(){return trace.call('report',()=>{});},...overrides});controllers.push(r.c);await r.c.open(playbackRoute,'surface');await h.settle();return r;
}
async function engine(mode='sdk'){
 const r=trace.call('mpv-rig',()=>mpv.rig(26,enumValues(mode)));
 for(const [object,key,phase]of [[r.fonts,'prepare','font-prepare'],[r.session,'on','focus-listen'],[r.session,'off','focus-remove'],[r.session,'activateAudioSession','focus-activate'],[r.session,'deactivateAudioSession','focus-deactivate'],...['capability','create','snapshot','command','release'].map(k=>[r.bridge,k,'bridge-'+k])]){const original=object[key].bind(object);object[key]=(...args)=>trace.call(phase,()=>{if(key==='create'&&process.argv.includes('--native-init-failure'))throw Object.assign(Error('injected MPV initialization failure'),{code:'EIO',contractInjected:true});return original(...args);});}
 const player=await r.open();engines.push(player);return{...r,player};
}
function choices(){return trace.call('ui-expression',()=>{const source=fs.readFileSync(path.join(__dirname,'../entry/src/main/ets/pages/Player.ets'),'utf8'),end=source.indexOf(', (speed: number) => {');assert.ok(end>0);const start=source.lastIndexOf('ForEach(',end)+8;assert.ok(start>=8);const expression=source.slice(start,end);const file=path.join(__dirname,'../entry/src/main/ets/utils/PlaybackRate.ts');const bindings=fs.existsSync(file)?h.load('utils/PlaybackRate.ts'):{};return Array.from(vm.runInNewContext(expression,bindings));});}
async function system(playbackRoute=h.route(),open=true){
 const r=open?await native('sdk',playbackRoute):h.rig({async report(){return trace.call('report',()=>{});}});if(!open)controllers.push(r.c);const api=h.platform.get('@ohos.multimedia.avsession'),create=api.createAVSession;
 api.createAVSession=(...args)=>trace.call('session-create',async()=>{const session=await create(...args);for(const key of ['on','off','setAVMetadata','setAVPlaybackState','setLaunchAbility','activate','deactivate','destroy'])if(typeof session[key]==='function'){const original=session[key].bind(session);session[key]=(...args)=>trace.call('session-'+key,()=>original(...args));}return session;});
 const {SystemPlayback}=h.load('service/SystemPlayback.ets'),errors=[],s=new SystemPlayback(h.systemPlatform.context,r.c,{},playbackRoute,{changed(){},error:e=>errors.push(e),next:async()=>{},stopped(){}});systems.push(s);
 try{await s.initialize();await h.settle();return{...r,s,session:h.systemPlatform.sessions.at(-1),errors};}finally{api.createAVSession=create;}
}
async function healthy(){try{await trace.healthy();}catch(error){sawExternalFailure=true;throw error;}}
return {rejectSpeed:()=>{expectedSpeedRejection=true;},assert,h,rows,sdkValues,enumValues,native,engine,system,choices,trace:()=>trace,run:tests=>common.run(tests,scope,before,after,healthy)};

}
module.exports=make();module.exports.make=make;
