const f=require('./resource-timeout-fixture.cjs').make('intro-timeout'),{assert,h,client}=f,tests=[],test=(name,action)=>tests.push({name,action});
const wire={IntroStart:1,IntroEnd:5,ShowSkipPromptAt:0,HideSkipPromptAt:5},ok={responseCode:200,result:JSON.stringify(wire)};
function stateOf(ticket){let value={settled:false};ticket.result.then(result=>{value={settled:true,result};});return ()=>value;}
for(const policy of ['default','lower','higher'])for(const delta of [-1,0,1])test(`intro timeout ${policy} ${delta}`,async(check,time)=>{
 const c=client();if(policy!=='default')f.NetworkPolicy.publish({requestMs:policy==='lower'?1000:120000,connectMs:policy==='lower'?1000:120000,readMs:policy==='lower'?1000:120000,autoCache:true});const gate=h.deferred();f.provider(()=>gate.promise);const t=c.intro('one',()=>true),state=stateOf(t),deadline=policy==='lower'?1000:3000;time.tick(deadline+delta);await f.settle();const captured=state(),destroyed=f.destroyed(),scheduled=[...time.scheduled];t.cancel();gate.resolve(ok);await f.settle();check(()=>{assert.equal(captured.settled,delta>=0);if(delta>=0)assert.equal(captured.result,undefined);assert.equal(destroyed,delta>=0?1:0);assert.equal(f.destroyed(),1);assert.equal(time.pending.size,0);assert.deepEqual(scheduled,[{kind:'timeout',ms:deadline}]);assert.equal(f.requests()[0].options.connectTimeout,policy==='lower'?1000:2000);assert.equal(f.requests()[0].options.readTimeout,policy==='lower'?1000:2000);});
});
test('intro timeout completed response clears deadline',async(check,time)=>{
 const c=client();f.provider(()=>ok);const result=await c.intro('one',()=>true).result;time.tick(3001);check(()=>{assert.deepEqual(result,{start:1000,end:5000,show:0,hide:5000});assert.equal(time.pending.size,0);assert.equal(f.destroyed(),1);});
});
for(const status of [401,403,404,500])test('intro timeout optional error '+status,async(check,time)=>{
 const c=client();f.provider(()=>({...ok,responseCode:status}));const result=await c.intro('one',()=>true).result;check(()=>{assert.equal(result,undefined);assert.equal(f.destroyed(),1);assert.equal(time.pending.size,0);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
