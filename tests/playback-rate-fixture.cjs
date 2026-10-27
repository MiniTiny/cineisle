// Real page/controller/AV adapter and MPV adapter; backends and platform services remain explicit fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const h=require('./player-regression.test.cjs'),mpv=require('./mpv-engine.test.cjs'),common=require('./contract-external.cjs');
const media=h.platform.get('@ohos.multimedia.media'),originalCreate=media.createAVPlayer,originalValues={...media.PlaybackSpeed};
const rows=[[0.5,'SPEED_FORWARD_0_50_X'],[0.75,'SPEED_FORWARD_0_75_X'],[1,'SPEED_FORWARD_1_00_X'],[1.25,'SPEED_FORWARD_1_25_X'],[1.5,'SPEED_FORWARD_1_50_X'],[1.75,'SPEED_FORWARD_1_75_X'],[2,'SPEED_FORWARD_2_00_X']];
function make(scope='playback-rate'){
let trace,controllers,engines,systems,expectedSpeedRejection,sawExternalFailure;
function sdkValues(){return trace.call('sdk-declarations',()=>{const file=path.join(require('./deveco-runtime.cjs').resolveDeveco().sdkHome,'default/openharmony/ets/api/@ohos.multimedia.media.d.ts'),source=fs.readFileSync(file,'utf8');return Object.fromEntries(rows.map(([,name])=>{const match=source.match(new RegExp('\\b'+name+'\\s*=\\s*(-?\\d+)'));assert.ok(match,name);return[name,Number(match[1])];}));});}
function enumValues(mode){return mode==='sdk'?sdkValues():Object.fromEntries(rows.map(([,key],i)=>[key,[104,8,201,17,63,91,55][i]]));}
async function before(){h.reset();h.load('utils/Strings.ets').initializeStrings({getStringByNameSync:(name,...args)=>name+':'+args.join(',')});controllers=[];engines=[];systems=[];expectedSpeedRejection=false;sawExternalFailure=false;Object.assign(media.PlaybackSpeed,originalValues);trace=common.external(scope,(process.argv.find(a=>a.startsWith('--fault='))||'').slice(8));if(process.argv.includes('--fault=setup'))assert.fail('unrelated playback-rate setup');
 media.createAVPlayer=()=>trace.call('av-create',async()=>{if(process.argv.includes('--native-init-failure'))throw Object.assign(Error('injected AV initialization failure'),{code:'EIO',contractInjected:true});const player=await originalCreate(),set=player.setSpeed.bind(player);player.setSpeed=value=>{const result=trace.call('av-speed',()=>expectedSpeedRejection?{error:Error('expected native speed rejection')}:{value:set(value)});if(result.error)throw result.error;return result.value;};return player;});
}
async function after(){for(const s of systems)await s.dispose();for(const c of controllers)await c.close();for(const p of engines)await p.release();media.createAVPlayer=originalCreate;Object.assign(media.PlaybackSpeed,originalValues);if(!sawExternalFailure)await trace.healthy();}
async function native(mode='sdk',playbackRoute=h.route(),overrides={}){
 Object.assign(media.PlaybackSpeed,enumValues(mode));
 const reportCalls=[];const r = h.rig({async report(...args){return trace.call('report',()=>{reportCalls.push(args);});},...overrides});controllers.push(r.c);await r.c.open(playbackRoute,'surface');await h.settle();return{...r,reportCalls};
}
function engineRig(mode='sdk',timing){
 const r=trace.call('mpv-rig',()=>mpv.rig(26,enumValues(mode),timing));
 for(const [object,key,phase]of [[r.fonts,'prepare','font-prepare'],[r.session,'on','focus-listen'],[r.session,'off','focus-remove'],[r.session,'activateAudioSession','focus-activate'],[r.session,'deactivateAudioSession','focus-deactivate'],...['capability','create','snapshot','command','release'].map(k=>[r.bridge,k,'bridge-'+k])]){const original=object[key].bind(object);object[key]=(...args)=>trace.call(phase,()=>{if(key==='create'&&process.argv.includes('--native-init-failure'))throw Object.assign(Error('injected MPV initialization failure'),{code:'EIO',contractInjected:true});return original(...args);});}
 return r;
}
async function createMpv(mode='sdk',timing){const r=engineRig(mode,timing),player=await r.Engine.create('/cache');engines.push(player);player.bind(r.eventSink);return{...r,player};}
async function engine(mode='sdk',timing){const r=await createMpv(mode,timing);r.player.url='https://example.invalid/synthetic';await h.settle();r.player.surfaceId='123';await r.player.prepare();return r;}

function choices(){return trace.call('ui-expression',()=>{const source=fs.readFileSync(path.join(__dirname,'../entry/src/main/ets/pages/Player.ets'),'utf8'),end=source.indexOf(', (speed: number) => {');assert.ok(end>0);const start=source.lastIndexOf('ForEach(',end)+8;assert.ok(start>=8);const expression=source.slice(start,end);const file=path.join(__dirname,'../entry/src/main/ets/utils/PlaybackRate.ts');const bindings=fs.existsSync(file)?h.load('utils/PlaybackRate.ts'):{};return Array.from(vm.runInNewContext(expression,bindings));});}
async function system(playbackRoute=h.route(),open=true,autoPiP=()=>false){
 const r=open?await native('sdk',playbackRoute):h.rig({async report(){return trace.call('report',()=>{});}});if(!open)controllers.push(r.c);const api=h.platform.get('@ohos.multimedia.avsession'),create=api.createAVSession;
 api.createAVSession=(...args)=>trace.call('session-create',async()=>{const session=await create(...args);for(const key of ['on','off','setAVMetadata','setAVPlaybackState','setLaunchAbility','activate','deactivate','destroy'])if(typeof session[key]==='function'){const original=session[key].bind(session);session[key]=(...args)=>trace.call('session-'+key,()=>original(...args));}return session;});
 const {SystemPlayback}=h.load('service/SystemPlayback.ets'),errors=[];let s;const priorState=r.c.view.state,priorTime=r.c.view.time;r.c.view.state=value=>{priorState(value);s?.sync(true);};r.c.view.time=(...args)=>{priorTime(...args);s?.sync();};s=new SystemPlayback(h.systemPlatform.context,r.c,{},playbackRoute,{changed(){},error:e=>errors.push(e),next:async()=>{},stopped(){}},autoPiP);systems.push(s);
 try{await s.initialize();await h.settle();return{...r,s,session:h.systemPlatform.sessions.at(-1),errors};}finally{api.createAVSession=create;}
}
async function healthy(){try{await trace.healthy();}catch(error){sawExternalFailure=true;throw error;}}
return {rejectSpeed:()=>{expectedSpeedRejection=true;},assert,h,rows,sdkValues,enumValues,native,engine,createMpv,engineRig,system,choices,trace:()=>trace,run:tests=>common.run(tests,scope,before,after,healthy)};

}
module.exports=make();module.exports.make=make;
