const mpv='entry/src/main/ets/service/MpvPlaybackEngine.ets',controller='entry/src/main/ets/service/PlaybackController.ets',system='entry/src/main/ets/service/SystemPlayback.ets',page='entry/src/main/ets/pages/Player.ets',suite='playback-timing-contract.test.cjs',recipes=[];
const add=(id,file,old,replacement,name)=>recipes.push({id,file,old,replacement,name,suite});
for(const [file,key,value,low,high]of [[mpv,'startupTimeoutMs',30000,'MPV startup 29999','MPV startup 30000'],[mpv,'snapshotIntervalMs',200,'MPV poll 199','MPV poll 200'],[controller,'progressReportIntervalMs',10000,'report 9999','report 10000'],[controller,'styledRenderIntervalMs',50,'ASS render 49','ASS render 50'],[system,'publicationIntervalMs',1000,'session publication 999','session publication 1000'],[system,'autoPiPWaitMs',1200,'native PiP wait 1199','native PiP wait 1200'],[system,'autoPiPRetryMs',30000,'PiP retry 29999','PiP retry 30000'],[page,'offlineProgressSaveIntervalMs',10000,'actual offline save 10000','actual offline save 10001'],[page,'controlsHideDelayMs',3000,'controls hide 2999','controls hide 3000']])for(const delta of [-1,1])add(key+'-'+delta,file,`${key}: number = ${value};`,`${key}: number = ${value+delta};`,'playback timing '+(delta<0?low:high));
for(const [id,file,old,replacement,name]of [
 ['MPV-startup-argument',mpv,'this.fail(); }, MpvPlaybackEngine.startupTimeoutMs)','this.fail(); }, 30001)','MPV startup 30000'],
 ['MPV-poll-argument',mpv,'this.refresh(); }, MpvPlaybackEngine.snapshotIntervalMs)','this.refresh(); }, 201)','MPV poll 200'],
 ['report-argument',controller,'Date.now() - this.lastReport >= PlaybackController.progressReportIntervalMs','Date.now() - this.lastReport >= 10001','report 10000'],
 ['ASS-argument',controller,'this.renderStyled(); }, PlaybackController.styledRenderIntervalMs)','this.renderStyled(); }, 51)','ASS render 50'],
 ['session-argument',system,'Date.now() - this.lastPublication < SystemPlayback.publicationIntervalMs','Date.now() - this.lastPublication < 1001','session publication 1000'],
 ['PiP-wait-argument',system,'setTimeout(resolve, SystemPlayback.autoPiPWaitMs)','setTimeout(resolve, 1201)','native PiP wait 1200'],
 ['PiP-retry-argument',system,'Date.now() + SystemPlayback.autoPiPRetryMs','Date.now() + 30001','PiP retry 30000'],
 ['offline-save-argument',page,'Date.now() - this.lastOfflineSave > offlineProgressSaveIntervalMs','Date.now() - this.lastOfflineSave > 10001','actual offline save 10001'],
 ['controls-argument',page,'}, controlsHideDelayMs)','}, 3001)','controls hide 3000'],
 ['MPV-startup-remove',mpv,'this.timeout = setTimeout(() => { this.fail(); }, MpvPlaybackEngine.startupTimeoutMs);','this.timeout = -1;','MPV startup 30000'],
 ['MPV-poll-remove',mpv,'this.timer = setInterval(() => { this.refresh(); }, MpvPlaybackEngine.snapshotIntervalMs);','this.timer = -1;','MPV poll 200'],
 ['report-remove',controller,'Date.now() - this.lastReport >= PlaybackController.progressReportIntervalMs','true','report 9999'],
 ['report-comparison',controller,'Date.now() - this.lastReport >= PlaybackController.progressReportIntervalMs','Date.now() - this.lastReport > PlaybackController.progressReportIntervalMs','report 10000'],
 ['paused-report-guard',controller,'this.started && !this.paused && Date.now() - this.lastReport','this.started && Date.now() - this.lastReport','paused report stays suppressed'],
 ['ASS-ticker-remove',controller,'this.styledTimer = setInterval(() => { this.renderStyled(); }, PlaybackController.styledRenderIntervalMs);','this.styledTimer = -1;','ASS render 50'],
 ['publication-remove',system,'Date.now() - this.lastPublication < SystemPlayback.publicationIntervalMs','false','session publication 999'],
 ['publication-comparison',system,'Date.now() - this.lastPublication < SystemPlayback.publicationIntervalMs','Date.now() - this.lastPublication <= SystemPlayback.publicationIntervalMs','session publication 1000'],
 ['force-guard',system,'(!force && !changed && Date.now() - this.lastPublication','(!changed && Date.now() - this.lastPublication','forced publication bypasses throttle'],
 ['PiP-wait-remove',system,'timer = setTimeout(resolve, SystemPlayback.autoPiPWaitMs);','timer = -1;','native PiP wait 1200'],
 ['PiP-retry-remove',system,'Date.now() < this.autoRetryAt','false','PiP retry 29999'],
 ['PiP-retry-compare',system,'Date.now() < this.autoRetryAt','Date.now() <= this.autoRetryAt','PiP retry 30000'],
 ['offline-save-remove',page,'Date.now() - this.lastOfflineSave > offlineProgressSaveIntervalMs','true','actual offline save 9999'],
 ['offline-save-compare',page,'Date.now() - this.lastOfflineSave > offlineProgressSaveIntervalMs','Date.now() - this.lastOfflineSave >= offlineProgressSaveIntervalMs','actual offline save 10000']
])add(id,file,old,replacement,'playback timing '+name);
const callback="if (this.alive && this.visible && this.immersive && !this.locked && !this.busy && !this.message && !this.options && !this.controlsLocked && this.state === 'playing')";
for(const [key,old]of [['options',' && !this.options'],['locked',' && !this.locked'],['state'," && this.state === 'playing'"]])add('controls-callback-'+key,page,callback,callback.replace(old,''),'playback timing controls callback guard '+key);
const controls=[
 {name:'playback timing MPV startup 29999',phase:'bridge-create',nativeInit:true,requiredCalls:{'font-prepare':1}},
 {name:'playback timing MPV startup 30000',phase:'timer-set',requiredCalls:{'bridge-capability':1},details:{duration:30000}},
 {name:'playback timing MPV poll 200',phase:'interval-set',requiredCalls:{'bridge-create':1},details:{duration:200}},
 {name:'playback timing report 9999',phase:'av-create',nativeInit:true,requiredCalls:{'sdk-declarations':1}},
 {name:'playback timing report 10000',phase:'report',requiredCalls:{'av-create':1}},
 {name:'playback timing ASS render 50',phase:'ASS-create',nativeInit:'ass',requiredCalls:{'subtitle-http':1}},
 {name:'playback timing ASS render 50',phase:'subtitle-http',requiredCalls:{'av-create':1}},
 {name:'playback timing session publication 1000',phase:'session-setAVPlaybackState',requiredCalls:{'session-create':1}},
 {name:'playback timing native PiP precreation',phase:'pip-create',nativeInit:'pip',requiredCalls:{'session-create':1}},
 {name:'playback timing PiP retry 29999',phase:'pip-create',requiredCalls:{'session-create':1}},
 {name:'playback timing actual offline save 10001',phase:'file-write',requiredCalls:{'time-event':1,'av-create':1,'disk-file-tryLock':1},details:{filename:'experience.json.tmp',stage:'time-event'}},
 {name:'playback timing controls hide 3000',phase:'setup'}
].map(c=>({...c,scope:'playback-timing',suite}));
module.exports={recipes,controls,scope:'playback-timing',fixture:'tests/playback-timing-fixture.cjs',earlyPhase:'file-write',earlyOld:"try{await test.action(check,time);}",earlyReplacement:"try{f.trace().call('file-write',()=>{});await test.action(check,time);}",selfFaults:[{id:'MPV-init-capture',phase:'bridge-create',file:'tests/playback-rate-fixture.cjs',old:"trace.call(phase,()=>{if(key==='create'",replacement:"((phase,operation)=>operation())(phase,()=>{if(key==='create'",status:'detected'},{id:'PiP-init-capture',phase:'pip-create',file:'tests/playback-timing-fixture.cjs',old:"f.trace().call('pip-create',async()=>{",replacement:"((phase,operation)=>operation())('pip-create',async()=>{",status:'detected'},{id:'ASS-init-capture',phase:'ASS-create',file:'tests/playback-timing-contract.test.cjs',old:"f.trace().call('ASS-create',()=>{",replacement:"((phase,operation)=>operation())('ASS-create',()=>{"}]};
