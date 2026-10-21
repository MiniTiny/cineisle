// Actual controller/session handoff. Record every OS metadata submission, including invalid empty identities.
const assert=require('node:assert/strict');
const h=require('./player-regression.test.cjs');
const {SystemPlayback}=h.load('service/SystemPlayback.ets');
const sdk=h.systemPlatform,api=h.platform.get('@ohos.multimedia.avsession');
const owners=[],tests=[],test=(name,fn)=>tests.push([name,fn]);
const originalCreate=api.createAVSession;
function fixture(item=h.route()){
 const rig=h.rig(),values={errors:[],states:[],attempts:[]};
 const system=new SystemPlayback(sdk.context,rig.c,{},item,{changed:state=>values.states.push(state),error:message=>values.errors.push(message),next:async()=>{},stopped(){}});
 rig.c.view.state=()=>system.sync(true);rig.c.view.time=()=>system.sync();rig.c.view.beforePlay=()=>system.permitPlay();owners.push(system);
 return {system,controller:rig.c,values,item};
}
function recordMetadata(values){
 api.createAVSession=async(...args)=>{
  const session=await originalCreate(...args),save=session.setAVMetadata.bind(session);
  session.setAVMetadata=async metadata=>{
   values.attempts.push({...metadata});
   return save(metadata);
  };
  return session;
 };
}
test('a ready system session keeps the requested item while the video surface has not opened',async()=>{
 const r=fixture();recordMetadata(r.values);await r.system.initialize();await h.settle();
 assert.equal(r.values.states.at(-1).ready,true);assert.deepEqual(r.values.errors,[]);
 assert.ok(r.values.attempts.every(value=>value.assetId===r.item.item.Id));assert.equal(sdk.sessions[0].metadata.at(-1).title,r.item.item.Name);
 await r.controller.open(r.item,'surface');await h.settle();r.controller.seek(12000);r.system.sync(true);await h.settle();
 assert.equal(sdk.sessions[0].states.at(-1).position.elapsedTime,12000);assert.equal(r.values.errors.length,0);
});
test('a pre-open sync during asynchronous initialization cannot replace the pending identity or disable PiP',async()=>{
 const r=fixture(),want=h.platform.get('@ohos.app.ability.wantAgent'),original=want.getWantAgent,gate=h.deferred();recordMetadata(r.values);
 want.getWantAgent=async info=>{await gate.promise;return original(info);};
 const init=r.system.initialize();await h.settle();for(let i=0;i<4;i++)r.system.sync(true);gate.resolve();
 try{await init;await h.settle();}finally{want.getWantAgent=original;}
 assert.deepEqual(r.values.errors,[]);assert.equal(r.values.states.at(-1).ready,true);assert.ok(r.values.attempts.every(value=>value.assetId===r.item.item.Id));
 await r.controller.open(r.item,'surface');await h.settle();await r.system.startPiP();assert.equal(sdk.windows[0].started,1);
});
test('consecutive playback owners publish their own requested item before either surface loads',async()=>{
 const first=fixture();recordMetadata(first.values);await first.system.initialize();await h.settle();await first.system.dispose();
 const second=fixture(h.route(h.episode('e2',1,2)));recordMetadata(second.values);await second.system.initialize();await h.settle();
 assert.deepEqual(second.values.errors,[]);assert.equal(second.values.states.at(-1).ready,true);assert.ok(second.values.attempts.every(value=>value.assetId==='e2'));assert.equal(sdk.sessions[0].destroyed,1);
});
test('a real native metadata failure with a known media identity remains visible and releases its session',async()=>{
 const r=fixture();api.createAVSession=async(...args)=>{const session=await originalCreate(...args);session.setAVMetadata=async()=>{throw Object.assign(Error('service failure'),{code:6600101});};return session;};
 await r.system.initialize();assert.equal(r.values.states.at(-1).ready,false);assert.ok(r.values.errors.includes('session_unavailable'));assert.equal(sdk.sessions[0].destroyed,1);
});
(async()=>{for(const[name,fn]of tests){h.reset();SystemPlayback.current=undefined;try{await fn();await h.settle();console.log('PASS '+name);}finally{api.createAVSession=originalCreate;for(const owner of owners.splice(0))await owner.dispose();}}console.log(tests.length+' session recreation regression tests passed. Explicit SDK fixtures do not prove native PiP/session behavior.');})().catch(error=>{console.error(error);process.exitCode=1;});
