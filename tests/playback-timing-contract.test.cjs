const f=require('./playback-timing-fixture.cjs'),{assert,h}=f,{ass}=require('./ass-test-fixture.cjs'),tests=[],test=(name,action)=>tests.push({name,action});
for(const at of [29999,30000,30001])test('playback timing MPV startup '+at,async(check,time)=>{
 const r=await f.createMpv('sdk',time.bindings),gate=h.deferred(),create=r.bridge.create;r.bridge.create=(...args)=>create(...args).then(handle=>gate.promise.then(()=>handle));
 r.player.url='https://example.invalid/synthetic';await h.settle();r.player.surfaceId='123';const pending=r.player.prepare().then(value=>({value}),error=>({error}));await h.settle();time.tick(at);await h.settle();const state=r.player.state,errors=r.events.filter(e=>e[0]==='error').length;const closing=r.player.release();gate.resolve();await closing;await pending;check(()=>{assert.equal(state,at>=30000?'error':'initialized');assert.equal(errors,at>=30000?1:0);assert.equal(time.pending.size,0);});
});
for(const at of [199,200,201])test('playback timing MPV poll '+at,async(check,time)=>{
 const r=await f.engine('sdk',time.bindings),before=r.calls.filter(c=>c[0]==='snapshot').length;time.tick(at);await h.settle();const after=r.calls.filter(c=>c[0]==='snapshot').length;await r.player.release();check(()=>{assert.equal(after-before,at>=200?1:0);assert.equal(time.pending.size,0);});
});
for(const at of [9999,10000,10001])test('playback timing report '+at,async(check,time)=>{
 const r=await f.native(),n=h.nativePlayers.at(-1);n.emit('timeUpdate',1);await h.settle();const before=r.reportCalls.filter(c=>c[0]==='Progress').length;time.tick(at);n.emit('timeUpdate',2);await h.settle();const after=r.reportCalls.filter(c=>c[0]==='Progress').length;await r.c.close();check(()=>{assert.equal(before,1);assert.equal(after-before,at>=10000?1:0);});
});
test('playback timing paused report stays suppressed',async(check,time)=>{
 const r=await f.native(),n=h.nativePlayers.at(-1);n.emit('timeUpdate',1);await h.settle();await r.c.pausePlayback();const before=r.reportCalls.filter(c=>c[0]==='Progress').length;time.tick(20000);n.emit('timeUpdate',2);await h.settle();check(()=>assert.equal(r.reportCalls.filter(c=>c[0]==='Progress').length,before));
});
async function styled(){const r=await f.native('sdk',h.route(),{subtitle:async()=>f.trace().call('subtitle-http',()=>ass)});let session;r.c.view.createStyledSubtitle=async()=>f.trace().call('ASS-create',()=>{if(process.argv.includes('--native-ass-init-failure'))throw Object.assign(Error('injected ASS initializer failure'),{code:'EIO',contractInjected:true});session={calls:[],render(...args){f.trace().call('ASS-render',()=>{this.calls.push(args);});},clear(){},close(){}};return session;});await r.c.selectSubtitle('server:21');await h.settle();return{...r,session};}
for(const at of [49,50,51])test('playback timing ASS render '+at,async(check,time)=>{
 const r=await styled(),before=r.session.calls.length;time.tick(at);await h.settle();const after=r.session.calls.length;await r.c.close();check(()=>{assert.equal(r.values.subtitleKey,'server:21');assert.equal(after-before,at>=50?1:0);assert.equal(time.pending.size,0);});
});
test('playback timing ASS pause clears ticker',async(check,time)=>{const r=await styled();await r.c.pausePlayback();const count=r.session.calls.length;time.tick(500);await h.settle();check(()=>assert.equal(r.session.calls.length,count));});
for(const at of [999,1000,1001])test('playback timing session publication '+at,async(check,time)=>{
 const r=await f.system(),before=r.session.states.length;time.tick(at);h.nativePlayers.at(-1).emit('timeUpdate',2);r.s.sync();await h.settle();const after=r.session.states.length,last=r.session.states.at(-1);await r.s.dispose();check(()=>{assert.equal(after-before,at>=1000?1:0);if(at>=1000)assert.equal(last.position.elapsedTime,2);});
});
test('playback timing forced publication bypasses throttle',async check=>{const r=await f.system(),before=r.session.states.length;r.s.sync(true);await h.settle();check(()=>assert.equal(r.session.states.length,before+1));});
for(const at of [1199,1200,1201])test('playback timing native PiP wait '+at,async(check,time)=>{
 const r=await f.system(h.route(),true,()=>true);assert.equal(r.s.autoArmed,true);const pending=r.s.background(),state=f.observed(pending);await h.settle();time.tick(at);await h.settle();const captured=state(),playing=h.nativePlayers.at(-1).state,error=r.errors.includes('auto_pip_failed:');r.s.foreground();await pending;await h.settle();await r.s.dispose();check(()=>{assert.equal(captured.settled,at>=1200);assert.equal(playing,at>=1200?'paused':'playing');assert.equal(error,at>=1200);assert.equal(time.pending.size,0);});
});
for(const at of [29999,30000,30001])test('playback timing PiP retry '+at,async(check,time)=>{
 h.systemPlatform.failCreatePiP=true;const r=await f.system(h.route(),true,()=>true),before=h.systemPlatform.calls.filter(c=>c[0]==='pipCreate').length;time.tick(at);r.s.refreshAutoPiP();await h.settle();const after=h.systemPlatform.calls.filter(c=>c[0]==='pipCreate').length;await r.s.dispose();check(()=>{assert.equal(before,1);assert.equal(after-before,at>=30000?1:0);});
});
for(const at of [2999,3000,3001])test('playback timing controls hide '+at,async(check,time)=>{
 const p=new h.Player();Object.assign(p,{alive:true,visible:true,immersive:true,locked:false,busy:false,state:'playing',options:false});p.showControls();time.tick(at);const visible=p.controlsVisible;p.clearHide();check(()=>{assert.equal(visible,at<3000);assert.equal(time.pending.size,0);});
});
for(const [key,value]of [['options',true],['locked',true],['state','paused']])test('playback timing controls callback guard '+key,async(check,time)=>{
 const p=new h.Player();Object.assign(p,{alive:true,visible:true,immersive:true,locked:false,busy:false,state:'playing',options:false});p.showControls();p[key]=value;time.tick(3000);const visible=p.controlsVisible;p.clearHide();check(()=>assert.equal(visible,true));
});
for(const at of [9999,10000,10001])test('playback timing actual offline save '+at,async(check,time)=>{
 const r=await f.offlinePage();r.player.emit('timeUpdate',1);await h.settle();const before=r.store.snapshot().positions.find(p=>p.id==='one')?.ticks;time.tick(at);r.player.emit('timeUpdate',2);await h.settle();const after=r.store.snapshot().positions.find(p=>p.id==='one')?.ticks;check(()=>{assert.equal(before,10000);assert.equal(after,at>10000?20000:10000);});
});
test('playback timing native PiP precreation',async check=>{const r=await f.system(h.route(),true,()=>true),armed=r.s.autoArmed,count=h.systemPlatform.windows.length;await r.s.dispose();check(()=>{assert.equal(armed,true);assert.equal(count,1);});});
if(require.main===module)f.run(tests).catch(error=>{console.error(error);process.exitCode=1;});module.exports=tests;
