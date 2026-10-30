// Isolated production mutations. Assertion failures alone never establish a detection.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {classify}=require('./resource-cache-result.cjs'),{verifyExternalFailure}=require('./contract-external.cjs');
const {replaceLiteral}=require('./literal-mutation.cjs'),{recipes}=require('./dialog-layout-fault-cases.cjs');
const root=path.resolve(__dirname,'..'),scopes=['entry/src/main/ets','entry/src/main/resources/base','tests','config'];
function fingerprint(base){const result={};const walk=p=>{for(const e of fs.readdirSync(path.join(base,p),{withFileTypes:true})){const f=path.join(p,e.name);if(e.name==='__pycache__')continue;if(e.isDirectory())walk(f);else if(e.isFile())result[f]=crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex');}};scopes.forEach(walk);return result;}
function mutate(source,r){
 if(!r.line)return replaceLiteral(source,r.old,r.replacement,r.id);
 const lines=source.split('\n'),matches=lines.map((text,i)=>text.includes(r.line)?i:-1).filter(i=>i>=0);assert.equal(matches.length,1,r.id+' ambiguous consumer');
 lines[matches[0]]=replaceLiteral(lines[matches[0]],r.old,r.replacement,r.id);return lines.join('\n');
}
// Independent, fixed review contract: removing a recipe cannot shrink the required set.
const requiredProbeIds = Object.freeze([
  "dialog-button-index-drift",
  "height-drift",
  "height-compare",
  "wide-drift",
  "wide-compare",
  "width-drift",
  "insets-drift",
  "height-ratio-drift",
  "width-cap-removed",
  "dispatch-compare",
  "dispatch-native-only",
  "dispatch-custom-only",
  "dispatch-nan-complement",
  "render-width-drift",
  "render-height-drift",
  "single-action-guard-removed",
  "wide-message-branch-removed",
  "repeated-action-guard-removed",
  "retired-action-guard-removed",
  "index-integer-guard-removed",
  "index-range-guard-removed",
  "dispose-once-guard-removed",
  "action-before-close",
  "release-before-close",
  "open-error-presentation-drift",
  "close-error-presentation-drift",
  "account-remove-width",
  "account-remove-height",
  "server-remove-width",
  "server-remove-height",
  "accounts-reset-width",
  "accounts-reset-height",
  "detail-download-width",
  "detail-download-height",
  "detail-delete-width",
  "detail-delete-height",
  "detail-batch-width",
  "detail-batch-height",
  "downloads-remove-width",
  "downloads-remove-height",
  "favorites-remove-width",
  "favorites-remove-height",
  "posters-clear-width",
  "posters-clear-height",
  "index-reason-width",
  "index-reason-height",
  "index-remove-width",
  "index-remove-height",
  "index-logout-width",
  "index-logout-height",
  "account-remove-pending-close-action-lost",
  "server-remove-pending-close-action-lost",
  "accounts-reset-pending-close-action-lost",
  "detail-download-pending-close-action-lost",
  "detail-delete-pending-close-action-lost",
  "detail-batch-pending-close-action-lost",
  "downloads-remove-pending-close-action-lost",
  "favorites-remove-pending-close-action-lost",
  "posters-clear-pending-close-action-lost",
  "index-remove-pending-close-action-lost",
  "index-logout-pending-close-action-lost",
  "bottom-pending-close-action-lost",
  "bottom-pending-close-action-duplicated",
  "bottom-pending-close-dispose-guard-removed"
]);
function validateRecipes(value) {
 const fail = reason => { throw Object.assign(new Error('Invalid dialog probe profile: '+reason), {code:'ERR_DIALOG_PROBE_PROFILE'}); };
 if (!Array.isArray(value) || value.length === 0) fail('expected a non-empty recipe array');
 const ids = new Set();
 for (const r of value) {
  if (!r || typeof r.id !== 'string' || !r.id || ids.has(r.id)) fail('missing or duplicate recipe id');
  ids.add(r.id);
  if (['file','old','name','phase'].some(key => typeof r[key] !== 'string' || !r[key]) || typeof r.replacement !== 'string') fail('malformed recipe '+r.id);
 }
 if (ids.size !== requiredProbeIds.length || requiredProbeIds.some(id => !ids.has(id))) fail('required recipe ids do not match');
 return true;
}
function run(output=path.join(root,'.local/test-results/dialog-layout-probes')){
 const frozen=fingerprint(root),temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'cineisle-dialog-probes-'))),evidence={source:frozen,complete:false,baselines:[],probes:[],controls:[],selfFaults:[]};
 fs.mkdirSync(output,{recursive:true});const save=()=>fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2));
 const child=(name,flag)=>spawnSync(process.execPath,['tests/dialog-layout-contract.test.cjs',name,...(flag?[flag]:[])],{cwd:temp,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
 const record=(id,raw)=>fs.writeFileSync(path.join(output,id+'.json'),JSON.stringify(raw,null,2));
 const verify=(raw,name,phase)=>{
  const value=classify(raw,name);assert.equal(value.status,'invalid',name+' unrelated failure');assert.equal(value.record.fixturePhase,'dialog-layout-external');assert.equal(value.record.error.cause.code,'EIO');
  const requiredCalls={'page-render':1,[name.startsWith('bottom ')?'dialog-entry':'page-entry']:1};
  if(phase==='content-create')requiredCalls['prompt-init']=1;
  if(phase==='dialog-open')requiredCalls['content-create']=1;
  const checkpoint=verifyExternalFailure(raw,{scope:'dialog-layout',phase,requiredCalls},false);
  const native=((raw.stderr||'')+'\n'+(raw.stdout||'')).split('\n').filter(s=>s.startsWith('DIALOG_NATIVE_ENTRY ')).map(s=>JSON.parse(s.slice('DIALOG_NATIVE_ENTRY '.length)));
  assert.ok(native.some(v=>v.phase===phase&&v.call===1&&v.failed===true),'Native failure must originate inside the actual stand-in API body');return {...value,checkpoint};
 };
 try{
  validateRecipes(recipes);
  for(const scope of scopes)fs.cpSync(path.join(root,scope),path.join(temp,scope),{recursive:true});
  const seen=new Set(),normalControls=new Set();
  for(const r of recipes){
   if(!seen.has(r.name)){const raw=child(r.name);record(r.id+'-baseline',raw);const result=classify(raw,r.name);assert.equal(result.status,'survived',r.id+' invalid healthy baseline');evidence.baselines.push({name:r.name,...result});seen.add(r.name);}
   const key=r.name+'|'+r.phase;
   if(!normalControls.has(key)){const raw=child(r.name,'--native-failure='+r.phase);record(r.id+'-normal-control',raw);evidence.controls.push({id:r.id,variant:'normal',...verify(raw,r.name,r.phase)});normalControls.add(key);}
   const p=path.join(temp,r.file),original=fs.readFileSync(p,'utf8');
   try{
    fs.writeFileSync(p,mutate(original,r));
    const raw=child(r.name);record(r.id,raw);const result=classify(raw,r.name);assert.equal(result.status,'detected',r.id+' protection/parameter mutation not detected');
    const negative=child(r.name,'--native-failure='+r.phase);record(r.id+'-mutant-control',negative);evidence.controls.push({id:r.id,variant:'detected-mutant',...verify(negative,r.name,r.phase)});
    evidence.probes.push({id:r.id,file:r.file,name:r.name,...result});console.log('DETECTED '+r.id);save();
   }finally{fs.writeFileSync(p,original);}
  }
  const name='entry account-remove';
  const setup=child(name,'--unrelated-setup-failure');record('unrelated-setup',setup);assert.equal(classify(setup,name).status,'invalid');assert.equal(classify(setup,name).record.fixturePhase,'setup');evidence.controls.push({id:'setup',...classify(setup,name)});
  const swallowed=child(name,'--native-failure=dialog-open');record('swallowed-open-normal-control',swallowed);
  evidence.controls.push({id:'swallowed-open-normal',...verify(swallowed,name,'dialog-open')});save();
  const p=path.join(temp,'tests/dialog-layout-fixture.cjs'),original=fs.readFileSync(p,'utf8');
  try{
   // The real open rejection is swallowed by production after showing a toast. Without
   // external health, its layout assertions still pass: a useful detector negative control.
   fs.writeFileSync(p,replaceLiteral(original,'() => trace.healthy()','async () => {}'));
   const raw=child(name,'--native-failure=dialog-open');record('self-fault-external-health',raw);const result=classify(raw,name);assert.equal(result.status,'survived');
   assert.throws(()=>verify(raw,name,'dialog-open'));evidence.selfFaults.push({id:'external-health-removed',rejected:true,result});
  }finally{fs.writeFileSync(p,original);}
  assert.deepEqual(fingerprint(root),frozen);assert.deepEqual(fingerprint(temp),frozen);
  evidence.complete=true;evidence.allDetected=evidence.probes.length===recipes.length&&evidence.probes.every(p=>p.detected);save();return evidence;
 }catch(error){evidence.error=error.stack;evidence.errorCode=error.code;save();throw error;}finally{fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={run,mutate,validateRecipes};
if(require.main===module){const e=run(process.argv[2]&&path.resolve(process.argv[2]));console.log(`${e.probes.length} dialog layout fault probes passed; allDetected=${e.allDetected}`);}
