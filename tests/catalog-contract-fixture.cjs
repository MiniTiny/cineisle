// REST and LocalStore stay real; HTTP/file adapters and ArkUI scrolling are explicit fixtures.
const assert=require('node:assert/strict'),path=require('node:path');
global.Scroller ??= class { scrollTo() {} };
const h=require('./feature-regression.test.cjs'),common=require('./contract-external.cjs');
const {AppService:A}=h.load('service/AppService.ets'),{JellyfinClient}=h.load('service/JellyfinClient.ets'),strings=h.load('utils/Strings.ets');
const http=h.platform.get('@ohos.net.http'),originalCreate=http.createHttp,io=h.platform.get('@ohos.file.fs');
const originalIO=Object.fromEntries(['openSync','writeSync','renameSync','readTextSync','fsyncSync','closeSync','accessSync','statSync','mkdirSync','unlinkSync'].filter(key=>typeof io[key]==='function').map(key=>[key,io[key]]));
function make(scope){
 let trace,requests,provider,stage,targets,opened;
 async function before(){
  Object.assign(io,originalIO);h.reset();strings.initializeStrings(h.context.resourceManager);stage='account-init';targets=()=>true;opened=new Map();requests=[];
  const fault=(process.argv.find(a=>a.startsWith('--fault='))||'').slice(8);trace=common.external(scope,fault);
  if(fault==='setup')assert.fail('unrelated '+scope+' initialization assertion');
  provider=()=>{throw Error('Missing catalog HTTP fixture');};
  http.createHttp=()=>trace.call('http-create',()=>{
   if(process.argv.includes('--native-init-failure'))throw Object.assign(Error('injected native HTTP initializer failure'),{code:'EIO',contractInjected:true});
   const connection=originalCreate();return {...connection,async request(address,options){
    const url=trace.call('parse-url',()=>new URL(address)),phase=url.pathname.endsWith('/System/Info/Public')?'version':'request';requests.push({url,options,phase});
    return trace.call(phase,()=>provider(url,options),{pathname:url.pathname});
   }};
  });
  const file=(phase,filename,operation)=>stage==='account-init'?operation():trace.call(targets(filename,phase)?phase:'other-'+phase,operation,{filename,stage});
  io.openSync=(...args)=>{const filename=path.basename(args[0]),value=file('file-open',filename,()=>originalIO.openSync(...args));opened.set(value.fd,filename);for(const method of ['tryLock','lock'])if(typeof value[method]==='function'){const original=value[method].bind(value);value[method]=(...args)=>file('file-'+method,filename,()=>original(...args));}return value;};
  io.writeSync=(...args)=>file('file-write',opened.get(args[0]),()=>originalIO.writeSync(...args));
  io.renameSync=(...args)=>file('file-rename',path.basename(args[1]),()=>originalIO.renameSync(...args));
  io.readTextSync=(...args)=>file('file-read',path.basename(args[0]),()=>originalIO.readTextSync(...args));
  io.closeSync=handle=>{const value=file('file-close',opened.get(handle.fd),()=>originalIO.closeSync(handle));opened.delete(handle.fd);return value;};
  for(const [key,phase]of [['fsyncSync','file-sync'],['accessSync','file-access'],['statSync','file-stat'],['mkdirSync','file-mkdir'],['unlinkSync','file-unlink']])if(originalIO[key])io[key]=(...args)=>file(phase,typeof args[0]==='string'?path.basename(args[0]):opened.get(args[0]),()=>originalIO[key](...args));
 }
 async function after(){http.createHttp=originalCreate;Object.assign(io,originalIO);for(const fd of opened.keys()){try{originalIO.closeSync({fd});}catch(error){if(error.code!=='EBADF')throw error;}}}
 function client(version='10.10.0',cold=false){
  const active = h.activate();
  const c=new JellyfinClient({...active.session},cold?'':version);A.useClient(c);stage='business';return c;
 }
 const response=(value,status=200)=>({responseCode:status,result:JSON.stringify(value)}),page=(items,total=items.length)=>({Items:items,TotalRecordCount:total});
 const observed=promise=>Promise.resolve(promise).then(value=>({value}),error=>({error}));
 return {assert,h,A,strings,client,response,page,observed,movie:(id,extra={})=>({...h.film(String(id)),...extra}),
  provider:fn=>{provider=fn;},requests:()=>requests,trace:()=>trace,stage:value=>{stage=value;},fileTargets:fn=>{targets=fn;},
  settle:async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);},
  run:tests=>common.run(tests,scope,before,after,()=>trace.healthy())};
}
module.exports={make};
