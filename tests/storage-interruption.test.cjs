// Cold child processes + abrupt SIGKILL; the persisted Asset fixture is not Harmony Asset durability.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cineisle-storage-interruption-'));
process.on('exit',()=>fs.rmSync(directory,{recursive:true,force:true}));
const worker=path.join(__dirname,'storage-interruption-worker.cjs'),root='cineisle.current.session',pinAlias='cineisle.app.lock.v1';
const read=file=>new Map(JSON.parse(fs.readFileSync(file,'utf8')).map(([alias,value])=>[alias,Buffer.from(value,'base64')]));
const index=values=>JSON.parse(values.get(root).toString());
function child(mode,file,stage){
  const result=spawnSync(process.execPath,[worker,mode,file,stage||''],{encoding:'utf8',timeout:20000});
  if(mode==='interrupt'){assert.equal(result.signal,'SIGKILL',result.stderr||'writer did not stop at the requested boundary');assert.equal(result.status,null)}
  else {assert.equal(result.status,0,result.stderr||result.error?.message);assert.equal(result.signal,null)}
  return result.stdout.trim()?JSON.parse(result.stdout):undefined;
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
for(const stage of ['first-part','before-root','after-root','cleanup'])test('cold recovery after SIGKILL at '+stage,()=>{
  const file=path.join(directory,stage+'.json');child('seed',file);
  const before=read(file),old=index(before),oldPrefix=`cineisle.sessions.${old.generation}.`;
  assert.ok(old.parts>2,'fixture needs multiple blocks to distinguish partial cleanup');
  child('interrupt',file,stage);
  const interrupted=read(file),committed=index(interrupted),oldKeys=[...interrupted.keys()].filter(k=>k.startsWith(oldPrefix));
  const beforeCommit=stage==='first-part'||stage==='before-root';
  if(beforeCommit){
    assert.deepEqual(committed,old);assert.equal(oldKeys.length,old.parts);
    const orphaned=[...interrupted.keys()].filter(k=>k.startsWith('cineisle.sessions.')&&!k.startsWith(oldPrefix));
    if(stage==='first-part')assert.equal(orphaned.length,1);else assert.ok(orphaned.length>2);
  }else{
    assert.notEqual(committed.generation,old.generation);
    assert.equal(oldKeys.length,old.parts-(stage==='cleanup'?1:0));
    for(let i=0;i<committed.parts;i++)assert.ok(interrupted.has(`cineisle.sessions.${committed.generation}.${i}`));
  }
  const snapshot=fs.readFileSync(file),cold=child('inspect',file);
  assert.equal(cold.userId,'a');assert.equal(cold.name,(beforeCommit?'old中文😀':'new中文😀').repeat(400));
  assert.equal(cold.tokenHash,crypto.createHash('sha256').update('fixture-token-a').digest('hex'));
  assert.equal(cold.otherName,'other account');assert.deepEqual(cold.keys,['server_a','server_b']);
  assert.deepEqual(fs.readFileSync(file),snapshot,'cold read must ignore orphan blocks without rewriting credentials');
  assert.deepEqual(read(file).get(pinAlias),before.get(pinAlias));
  // A fresh process can write again, then another fresh process sees the new committed value.
  assert.equal(child('repair',file).name,'recovered');assert.equal(child('inspect',file).name,'recovered');
  assert.deepEqual(read(file).get(pinAlias),before.get(pinAlias));
});
for(const[name,fn]of tests){fn();console.log('PASS '+name)}
console.log(`${tests.length} storage interruption tests passed. Real child termination with a durable fixture does not prove native Asset persistence.`);
