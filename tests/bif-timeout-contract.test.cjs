const f=require('./resource-timeout-fixture.cjs').make('bif-timeout'),{assert,h,client}=f,tests=[],test=(name,action)=>tests.push({name,action});
const manifest={responseCode:200,result:JSON.stringify({Version:'1',WidthResolutions:[640]})};
function stateOf(ticket){let value={settled:false};ticket.result.then(result=>{value={settled:true,result};});return ()=>value;}
for(const phase of ['manifest','binary'])for(const policy of ['default','lower','higher'])for(const delta of [-1,0,1])test(`bif timeout ${phase} ${policy} ${delta}`,async(check,time)=>{
 f.phaseFor(url=>url.pathname.endsWith('/GetBIF')?'binary-request':'request');const c=client();if(policy!=='default')f.NetworkPolicy.publish({requestMs:policy==='lower'?1000:120000,connectMs:policy==='lower'?1000:120000,readMs:policy==='lower'?1000:120000,autoCache:true});const gate=h.deferred();f.provider(url=>phase==='binary'&&url.pathname.endsWith('/GetManifest')?manifest:gate.promise);const t=c.trickplay('one',()=>true),state=stateOf(t);await f.settle();const deadline=policy==='lower'?1000:phase==='manifest'?3000:8000;time.tick(deadline+delta);await f.settle();const captured=state(),destroyed=f.destroyed(),scheduled=[...time.scheduled];t.cancel();gate.resolve({responseCode:200,result:phase==='binary'?new ArrayBuffer(76):manifest.result});await f.settle();check(()=>{
  assert.equal(captured.settled,delta>=0);if(delta>=0)assert.equal(captured.result,undefined);assert.equal(destroyed,(phase==='binary'?1:0)+(delta>=0?1:0));assert.equal(f.destroyed(),phase==='binary'?2:1);assert.equal(time.pending.size,0);
  assert.deepEqual(scheduled.filter(s=>s.kind==='timeout').map(s=>s.ms),phase==='binary'?[policy==='lower'?1000:3000,deadline]:[deadline]);assert.deepEqual(scheduled.filter(s=>s.kind==='interval').map(s=>s.ms),[250]);
  const requests=f.requests();assert.equal(requests.length,phase==='binary'?2:1);for(let i=0;i<requests.length;i++){assert.equal(requests[i].options.connectTimeout,policy==='lower'?1000:3000);assert.equal(requests[i].options.readTimeout,policy==='lower'?1000:i===0?2000:6000);}
 });
});
for(const at of [249,250,251])test('bif timeout owner poll '+at,async(check,time)=>{
 const c=client(),gate=h.deferred();let allowed=true;f.provider(()=>gate.promise);const t=c.trickplay('one',()=>allowed),state=stateOf(t);allowed=false;time.tick(at);await f.settle();const captured=state();t.cancel();gate.resolve(manifest);await f.settle();check(()=>{assert.equal(captured.settled,at>=250);assert.equal(f.requests().length,1);assert.equal(f.destroyed(),1);assert.equal(time.pending.size,0);});
});
test('bif timeout completed stages release both clocks',async(check,time)=>{
 const c=client(),bytes=new ArrayBuffer(76);f.provider(url=>url.pathname.endsWith('/GetManifest')?manifest:{responseCode:200,result:bytes});const result=await c.trickplay('one',()=>true).result;time.tick(8001);check(()=>{assert.strictEqual(result,bytes);assert.equal(time.pending.size,0);assert.equal(f.destroyed(),2);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
