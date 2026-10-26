const f=require('./playback-rate-fixture.cjs'),{assert,h}=f,tests=[],test=(name,action)=>tests.push({name,action});
test('playback rates actual UI expression',async check=>{const values=f.choices();check(()=>assert.deepEqual(values,[0.5,0.75,1,1.25,1.5,1.75,2]));});
for(const mode of ['sdk','synthetic'])for(const [rate,symbol]of f.rows)test(`playback rate actual page AV ${mode} ${rate}`,async check=>{
 const r=await f.native(mode),p=new h.Player();p.controller=r.c;p.changeSpeed(rate);await h.settle();const calls=h.nativePlayers.at(-1).calls;check(()=>{assert.equal(p.speed,rate);assert.equal(r.c.rate,rate);assert.equal(calls.filter(c=>c[0]==='speed').at(-1)[1],f.enumValues(mode)[symbol]);});
});
for(const value of [0,0.49,0.50001,2.01,3,NaN,Infinity,-Infinity])test('playback rate invalid normalizes '+String(value),async check=>{
 const r=await f.native();r.c.setSpeed(value);check(()=>{assert.equal(r.c.rate,1);assert.equal(h.nativePlayers.at(-1).calls.filter(c=>c[0]==='speed').at(-1)[1],f.sdkValues().SPEED_FORWARD_1_00_X);});
});
for(const mode of ['sdk','synthetic'])for(const [rate,symbol]of f.rows)test(`playback rate actual MPV ${mode} ${rate}`,async check=>{
 const r=await f.engine(mode);let error;try{r.player.setSpeed(f.enumValues(mode)[symbol]);}catch(e){error=e;}await h.settle();check(()=>{assert.ifError(error);assert.deepEqual(Array.from(r.calls.filter(c=>c[0]==='speed').at(-1)),['speed',rate]);});
});
for(const value of [0.25,0.5,7,100,NaN,Infinity])test('playback rate MPV invalid enum '+String(value),async check=>{
 const r=await f.engine(),before=r.calls.filter(c=>c[0]==='speed').length;let error;try{r.player.setSpeed(value);}catch(e){error=e;}await h.settle();check(()=>{assert.equal(error?.message,'mpv_speed_invalid');assert.equal(r.calls.filter(c=>c[0]==='speed').length,before);});
});
test('playback rate native rejection retains error display',async check=>{const r=await f.native();f.rejectSpeed();r.c.setSpeed(2);check(()=>assert.deepEqual(r.values.errors,['speed_failed:']));});
test('playback rate actual hold restores selected speed',async check=>{const r=await f.native(),p=new h.Player();Object.assign(p,{controller:r.c,alive:true,visible:true,locked:false,state:'playing',surfaceWidth:1000,surfaceHeight:1000,speed:1.25});p.holdSpeed(500,500);const held=p.speed,command=h.nativePlayers.at(-1).calls.filter(c=>c[0]==='speed').at(-1)[1];p.cancelGesture();check(()=>{assert.equal(held,2);assert.equal(command,f.sdkValues().SPEED_FORWARD_2_00_X);assert.equal(p.speed,1.25);assert.equal(h.nativePlayers.at(-1).calls.filter(c=>c[0]==='speed').at(-1)[1],f.sdkValues().SPEED_FORWARD_1_25_X);});});
for(const [rate,symbol]of f.rows)test('playback rate actual AVSession '+rate,async check=>{const r=await f.system();await r.session.emit('setSpeed',rate);await h.settle();check(()=>{assert.deepEqual(r.errors,[]);assert.equal(r.c.rate,rate);assert.equal(h.nativePlayers.at(-1).calls.filter(c=>c[0]==='speed').at(-1)[1],f.sdkValues()[symbol]);});});
for(const rate of [0.25,3,NaN,Infinity])test('playback rate AVSession rejects '+String(rate),async check=>{const r=await f.system(),before=h.nativePlayers.at(-1).calls.filter(c=>c[0]==='speed').length;await r.session.emit('setSpeed',rate);await h.settle();check(()=>{assert.deepEqual(r.errors,['speed_failed:']);assert.equal(h.nativePlayers.at(-1).calls.filter(c=>c[0]==='speed').length,before);});});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
