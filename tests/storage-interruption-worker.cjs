// Each invocation loads fresh production modules. A fsynced file backs the explicit Asset fixture.
// SIGKILL stops inside an Asset operation, so product catch/finally cleanup cannot execute.
const fs=require('node:fs'),crypto=require('node:crypto');
const h=require('./feature-regression.test.cjs');
const {SessionStore}=h.load('service/SessionStore.ets');
const [mode,file,stage]=process.argv.slice(2),root='cineisle.current.session';
const pinAlias='cineisle.app.lock.v1',api=h.platform.get('@ohos.security.asset');
const decode=v=>new TextDecoder().decode(v),rootIndex=()=>JSON.parse(decode(h.assets.get(root)));
if(fs.existsSync(file))for(const [alias,value]of JSON.parse(fs.readFileSync(file,'utf8')))h.assets.set(alias,Buffer.from(value,'base64'));
const oldGeneration=h.assets.has(root)?rootIndex().generation:undefined;
function persist(){
  const fd=fs.openSync(file+'.tmp','w');
  try{fs.writeFileSync(fd,JSON.stringify([...h.assets].map(([alias,value])=>[alias,Buffer.from(value).toString('base64')])));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  fs.renameSync(file+'.tmp',file);
}
function kill(){process.kill(process.pid,'SIGKILL');throw Error('SIGKILL did not terminate the writer')}
const add=api.add,remove=api.remove;let parts=0;
api.add=async attrs=>{
  const alias=decode(attrs.get('alias'));
  if(mode==='interrupt'&&stage==='before-root'&&alias===root)kill();
  await add(attrs);persist();
  if(mode==='interrupt'){
    if(alias.startsWith('cineisle.sessions.')&&++parts===1&&stage==='first-part')kill();
    if(alias===root&&stage==='after-root')kill();
  }
};
api.remove=async attrs=>{
  const alias=decode(attrs.get('alias'));await remove(attrs);persist();
  if(mode==='interrupt'&&stage==='cleanup'&&alias.startsWith(`cineisle.sessions.${oldGeneration}.`))kill();
};
const session=(user,name)=>({server:'https://fixture.invalid',serverId:'server',userId:user,userName:name,token:'fixture-token-'+user,deviceId:'fixture-device-'+user});
(async()=>{
  if(mode==='seed'){
    await SessionStore.save(session('a','old中文😀'.repeat(400)));await SessionStore.save(session('b','other account'));await SessionStore.select('server_a');
    h.assets.set(pinAlias,Buffer.from('unrelated PIN fixture'));persist();
  }else if(mode==='interrupt'){
    await SessionStore.save(session('a','new中文😀'.repeat(400)));throw Error('requested interruption point was not reached');
  }else{
    if(mode==='repair'){const current=await SessionStore.load();await SessionStore.save({...current,userName:'recovered'})}
    const current=await SessionStore.load(),other=await SessionStore.get('server_b'),list=await SessionStore.list();
    console.log(JSON.stringify({userId:current.userId,name:current.userName,tokenHash:crypto.createHash('sha256').update(current.token).digest('hex'),otherName:other.userName,keys:list.map(a=>a.key).sort()}));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
