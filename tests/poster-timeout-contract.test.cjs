const f=require('./resource-timeout-fixture.cjs').make('poster-timeout');
const {assert,h,client}=f,tests=[],test=(name,action)=>tests.push({name,action}),target={id:'one',width:480,backdrop:false};
const jpeg=()=>new Uint8Array([255,216,255]).buffer;
function pending(ticket){let state={settled:false};ticket.result.then(value=>{state={settled:true,value};},error=>{state={settled:true,error};});return ()=>state;}
for(const at of [9999,10000,10001])test('poster timeout actual '+at,async(check,time)=>{
 const c=client(),gate=h.deferred();f.provider(()=>gate.promise);const t=c.poster(target,()=>true),state=pending(t);time.tick(at);await f.settle();const captured=state(),destroyed=f.destroyed(),schedule=[...time.scheduled];t.cancel();gate.resolve({responseCode:200,result:jpeg()});await f.settle();check(()=>{assert.deepEqual(schedule,[{kind:'timeout',ms:10000}]);assert.equal(captured.settled,at>=10000);if(at>=10000)assert.equal(captured.error.message,'poster_unavailable');assert.equal(destroyed,at>=10000?1:0);assert.equal(f.destroyed(),1);assert.equal(time.pending.size,0);});
});
for(const policy of ['default','lower','higher'])test('poster timeout options independent '+policy,async(check,time)=>{
 const c=client();if(policy!=='default')f.NetworkPolicy.publish({requestMs:policy==='lower'?1000:120000,connectMs:policy==='lower'?1000:120000,readMs:policy==='lower'?1000:120000,autoCache:true});f.provider(()=>({responseCode:200,result:jpeg()}));const result=await f.observed(c.poster(target,()=>true).result);check(()=>{assert.ifError(result.error);const options=f.requests()[0].options;assert.equal(options.connectTimeout,5000);assert.equal(options.readTimeout,8000);assert.deepEqual(time.scheduled,[{kind:'timeout',ms:10000}]);assert.equal(time.pending.size,0);assert.equal(f.destroyed(),1);});
});
test('poster timeout cancel and late response preserve cancellation',async(check,time)=>{
 const c=client(),gate=h.deferred();f.provider(()=>gate.promise);const t=c.poster(target,()=>true),state=pending(t);t.cancel();await f.settle();gate.resolve({responseCode:200,result:jpeg()});await f.settle();time.tick(10001);check(()=>{assert.equal(state().error.message,'poster_cancelled');assert.equal(f.destroyed(),1);assert.equal(time.pending.size,0);});
});
for(const [status,message]of [[401,'poster_denied'],[403,'poster_denied'],[404,'poster_missing'],[500,'poster_unavailable']])test('poster timeout error '+status,async(check,time)=>{
 const c=client();f.provider(()=>({responseCode:status,result:jpeg()}));const result=await f.observed(c.poster(target,()=>true).result);check(()=>{assert.equal(result.error.message,message);assert.equal(f.destroyed(),1);assert.equal(time.pending.size,0);});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
