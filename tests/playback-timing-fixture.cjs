// Physical files and real production callbacks; clock, AV, window and render APIs are explicit fixtures.
const fs=require('node:fs'),path=require('node:path'),f=require('./playback-rate-fixture.cjs').make('playback-timing'),{h}=f;
const {clock}=require('./resource-timeout-fixture.cjs');let pages,restorers,stage='business',sequence=0;
function wrap(object,key,phase){if(typeof object[key]!=='function')return;const original=object[key];object[key]=(...args)=>f.trace().call(phase,()=>original.apply(object,args));restorers.push(()=>{object[key]=original;});}
function disk(){
 const io=h.platform.get('@ohos.file.fs'),original={...io},names=new Map();
 Object.assign(io,{OpenMode:{...io.OpenMode,CREATE:fs.constants.O_CREAT,WRITE_ONLY:fs.constants.O_WRONLY,TRUNC:fs.constants.O_TRUNC},openSync:(p,flags)=>({fd:fs.openSync(p,flags)}),closeSync:file=>fs.closeSync(file.fd),mkdirSync:fs.mkdirSync,accessSync:fs.existsSync,readTextSync:p=>fs.readFileSync(p,'utf8'),writeSync:fs.writeSync,fsyncSync:fs.fsyncSync,renameSync:fs.renameSync,unlinkSync:fs.unlinkSync,statSync:fs.statSync});
 require('./sync-platform.cjs').files(io);const operations={...io};
 const call=(phase,filename,action)=>f.trace().call(stage==='time-event'&&filename==='experience.json.tmp'?phase:'disk-'+phase,action,{filename,stage});
 io.openSync=(p,flags)=>call('file-open',path.basename(p),()=>{const file=operations.openSync(p,flags);names.set(file.fd,path.basename(p));for(const key of ['lock','tryLock']){const method=file[key].bind(file);file[key]=(...args)=>call('file-'+key,names.get(file.fd),()=>method(...args));}return file;});
 for(const key of ['writeSync','fsyncSync'])io[key]=(...args)=>call(key==='writeSync'?'file-write':'file-sync',names.get(args[0]),()=>operations[key](...args));
 io.closeSync=file=>call('file-close',names.get(file.fd),()=>{operations.closeSync(file);names.delete(file.fd);});
 for(const [key,phase]of [['renameSync','file-rename'],['readTextSync','file-read'],['mkdirSync','file-mkdir'],['accessSync','file-access'],['statSync','file-stat'],['unlinkSync','file-unlink']])io[key]=(...args)=>call(phase,path.basename(args[key==='renameSync'?1:0]),()=>operations[key](...args));
 restorers.push(()=>{for(const key of Object.keys(io))if(!(key in original))delete io[key];Object.assign(io,original);});
}
async function offlinePage(){
 disk();stage='account-init';const A=h.AppService,{JellyfinClient}=h.load('service/JellyfinClient.ets');A.context=h.systemPlatform.context;
 A.useClient(new JellyfinClient({server:'https://example.invalid/jellyfin',serverId:'server',userId:'timing-'+(++sequence),deviceId:'device',token:'fixture-token'},'10.10.0'));
 stage='business';const file=path.join(A.local.directory,'video.mp4');fs.writeFileSync(file,'fixture');const route={...h.route({Id:'one',Name:'Offline',Type:'Movie'}),offline:true,filePath:file};h.setRoute(route);
 const sessionAPI=h.platform.get('@ohos.multimedia.avsession');wrap(sessionAPI,'createAVSession','page-session-create');
 const p=new h.Player();pages.push(p);p.aboutToAppear();await p.system.initialize();p.surfaceId='surface';await p.controller.open(p.route,'surface');await h.settle();return{p,player:h.nativePlayers.at(-1),store:A.experience};
}
function observed(promise){let state={settled:false};promise.then(value=>{state={settled:true,value};},error=>{state={settled:true,error};});return()=>state;}
module.exports={...f,offlinePage,observed,run:tests=>f.run(tests.map(test=>({...test,async action(check){
 pages=[];restorers=[];stage='business';const time=clock(f.trace()),now=Date.now;Date.now=()=>100000+time.now();
 const av=h.platform.get('@ohos.multimedia.media'),create=av.createAVPlayer;av.createAVPlayer=async()=>{const player=await create(),emit=player.emit.bind(player);player.emit=(event,...args)=>{const prior=stage;if(event==='timeUpdate'){stage='time-event';f.trace().call('time-event',()=>{});}try{return emit(event,...args);}finally{stage=prior;}};return player;};restorers.push(()=>{av.createAVPlayer=create;});
 const want=h.platform.get('@ohos.app.ability.wantAgent'),background=h.platform.get('@ohos.resourceschedule.backgroundTaskManager');wrap(want,'getWantAgent','want-agent');wrap(background,'startBackgroundRunning','task-start');wrap(background,'stopBackgroundRunning','task-stop');
 const pip=h.platform.get('@ohos.PiPWindow'),pipCreate=pip.create;pip.create=async(...args)=>{const value=await f.trace().call('pip-create',async()=>{try{if(process.argv.includes('--native-pip-init-failure'))throw Object.assign(Error('injected PiP initializer failure'),{code:'EIO',contractInjected:true});return{window:await pipCreate(...args)};}catch(error){if(h.systemPlatform.failCreatePiP&&error.code===401)return{expected:error};throw error;}});if(value.expected)throw value.expected;for(const key of ['on','off','setAutoStartEnabled','updateContentSize','updatePiPControlStatus','setPiPControlEnabled','startPiP','stopPiP'])wrap(value.window,key,'pip-'+key);return value.window;};restorers.push(()=>{pip.create=pipCreate;});
 try{await test.action(check,time);}finally{for(const p of pages){p.aboutToDisappear();await p.system?.dispose();await p.controller?.close();}await h.settle();for(const restore of restorers.reverse())restore();Date.now=now;time.restore();}
}})))};
