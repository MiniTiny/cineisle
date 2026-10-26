const f=require('./discovery-contract-fixture.cjs'),{assert,h,ServerDiscovery,DiscoveryProbe,candidate}=f,tests=[],test=(name,action)=>tests.push({name,action});
const info={Id:'server',ServerName:'Verified',Version:'10.10.0'},packet=name=>new TextEncoder().encode(JSON.stringify({Id:'server',Name:name,Address:candidate.address})).buffer;
function stateOf(promise){let result={settled:false};promise.then(value=>{result={settled:true,value};},error=>{result={settled:true,error};});return ()=>result;}
for(const at of [5999,6000,6001])test('discovery probe actual deadline '+at,async(check,time)=>{
 const gate=h.deferred();f.provider(()=>gate.promise);const finder=new ServerDiscovery(),state=stateOf(finder.verify(candidate));await f.settle();time.tick(at);await f.settle();const captured=state(),destroyed=f.destroyed();finder.cancel();gate.resolve(f.response(info));await f.settle();check(()=>{assert.equal(captured.settled,at>=6000);if(at>=6000)assert.equal(captured.error.message,'discovery_verify_timeout');assert.equal(destroyed,at>=6000?1:0);assert.equal(f.destroyed(),1);assert.equal(time.pending.size,0);const options=f.requests()[0].options;assert.deepEqual(options.header,{Accept:'application/json'});assert.equal(options.connectTimeout,4000);assert.equal(options.readTimeout,4000);assert.equal(options.maxLimit,65536);});
});
for(const size of [65535,65536,65537])test('discovery probe independent code units '+size,async check=>{
 f.provider(()=>({responseCode:200,result:'{}'.padEnd(size,' ')}));const probe=new DiscoveryProbe(candidate.address),result=await f.observed(probe.request('/System/Info/Public','GET',[],''));check(()=>{if(size>65536)assert.equal(result.error?.message,'discovery_verify_failed');else{assert.ifError(result.error);assert.deepEqual(result.value,{});}assert.equal(f.requests()[0].options.maxLimit,65536);});
});
test('discovery probe code units and HTTP bytes remain distinct',async check=>{
 const source=JSON.stringify({name:'岛'.repeat(30000)});f.provider(()=>({responseCode:200,result:source}));const result=await f.observed(new DiscoveryProbe(candidate.address).request('/System/Info/Public','GET',[],''));check(()=>{assert.ok(source.length<65536);assert.ok(Buffer.byteLength(source)>65536);assert.ifError(result.error);assert.equal(result.value.name.length,30000);assert.equal(f.requests()[0].options.maxLimit,65536);});
});
for(const at of [9999,10000,10001])test('discovery controller watchdog '+at,async(check,time)=>{
 const finder=new ServerDiscovery(),state=stateOf(finder.start(()=>{}));await f.settle();const thread=f.threads()[0];time.tick(at);await f.settle();const captured=state(),sent=[...thread.sent];finder.cancel();time.tick(1001);await f.settle();check(()=>{assert.equal(captured.settled,at>=10000);if(at>=10000)assert.equal(captured.error.message,'discovery_failed');assert.equal(sent.some(e=>e.type==='cancel'),at>=10000);assert.equal(thread.terminated,1);assert.equal(time.pending.size,0);});
});
for(const at of [999,1000,1001])test('discovery controller cancel grace '+at,async(check,time)=>{
 const finder=new ServerDiscovery(),pending=f.observed(finder.start(()=>{}));await f.settle();finder.cancel();time.tick(at);await f.settle();const terminated=f.threads()[0].terminated;time.tick(1001);const result=await pending;check(()=>{assert.equal(result.error.message,'discovery_cancelled');assert.equal(terminated,at>=1000?1:0);assert.equal(f.threads()[0].terminated,1);assert.equal(time.pending.size,0);});
});
for(const at of [7999,8000,8001])test('discovery actual worker deadline '+at,async(check,time)=>{
 const w=f.worker(time);await w.start();time.tick(at);await f.settle();const messages=[...w.messages],closed=w.calls.filter(c=>c[0]==='close').length;await w.cancel();check(()=>{assert.equal(messages.length,at>=8000?1:0);if(at>=8000)assert.equal(messages[0].type,'complete');assert.equal(closed,at>=8000?1:0);const send=w.calls.find(c=>c[0]==='send')[1];assert.deepEqual(JSON.parse(JSON.stringify(send)),{data:'who is JellyfinServer?',address:{address:'255.255.255.255',family:1,port:7359}});assert.equal(time.pending.size,0);});
});
for(const count of [63,64,65])test('discovery actual worker packets '+count,async(check,time)=>{
 const w=f.worker(time);await w.start();for(let i=0;i<count;i++)await w.receive(new ArrayBuffer(1));const completion=w.messages.find(m=>m.type==='complete');await w.cancel();check(()=>{assert.equal(!!completion,count>=64);if(completion)assert.equal(completion.limited,true);assert.equal(w.calls.filter(c=>c[0]==='close').length,1);});
});
for(const bytes of [8191,8192,8193])test('discovery datagram byte boundary '+bytes,async check=>{
 const valid=new Uint8Array(packet('Server')),padded=new Uint8Array(bytes).fill(32);padded.set(valid);const result=f.parser.discoveryPacket(padded.buffer);check(()=>assert.equal(result?.id,bytes>8192?undefined:'server'));
});
for(const count of [127,128,129])test('discovery name boundary '+count,async check=>{
 const name='岛'.repeat(count),hint=f.parser.discoveryPacket(packet(name));f.provider(()=>f.response({...info,ServerName:name}));const value=await new ServerDiscovery().verify(candidate);check(()=>{assert.equal(hint.name.length,Math.min(count,128));assert.equal(value.name.length,Math.min(count,128));});
});
for(const size of [2047,2048,2049])test('discovery address boundary '+size,async check=>{
 const prefix='https://example.invalid/',address=prefix+'x'.repeat(size-prefix.length);let result,error;try{result=f.parser.discoveryAddress(address);}catch(e){error=e;}check(()=>{if(size>2048)assert.equal(error?.message,'invalid_server');else{assert.ifError(error);assert.equal(result,address);}});
});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
