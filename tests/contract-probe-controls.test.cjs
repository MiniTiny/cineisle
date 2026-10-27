const assert = require('node:assert/strict');
const { runCase, fixture } = require('./resource-cache-result.cjs');
const { external, verifyExternalFailure } = require('./contract-external.cjs');
const tests=[];
tests.push({name:'contract checkpoint requires operation scope and preceding calls',action:check=>{
  const control = { scope: 'example', phase: 'request', requiredCalls: { create: 1 }, details: { pathname: '/expected' } };
  const state = { version: 1, scope: 'example', phase: 'request', injected: true, calls: { request: 1, create: 1 }, pathname: '/expected' };
  const raw = value => ({ stdout: 'CONTRACT_EXTERNAL_STATE ' + JSON.stringify(value), stderr: '' });
  check(() => {
    assert.deepEqual(verifyExternalFailure(raw(state), control), state);
    const unannounced = { ...state, injected: false };
    assert.deepEqual(verifyExternalFailure(raw(unannounced), control, false), unannounced);
    assert.throws(() => verifyExternalFailure(raw(state), control, false), { code: 'ERR_ASSERTION' });
    for (const changed of [{ ...state, version: 2 }, { ...state, scope: 'other' }, { ...state, phase: 'create' }, { ...state, injected: false }, { ...state, calls: { create: 1 } }, { ...state, calls: { request: 1 } }, { ...state, pathname: '/wrong' }]) assert.throws(() => verifyExternalFailure(raw(changed), control), { code: 'ERR_ASSERTION' });
    assert.throws(() => verifyExternalFailure({ stdout: '', stderr: '' }, control), { code: 'ERR_ASSERTION' });
    assert.throws(() => verifyExternalFailure({ stdout: raw(state).stdout + '\n' + raw(state).stdout, stderr: '' }, control), { code: 'ERR_ASSERTION' });
  });
}});
tests.push({name:'contract checkpoint preserves originating nested native failure',action:async check=>{
 for(const mode of ['sync','async'])for(const injected of [false,true]){
  const raw=await fixture('origin-scenario',async()=>{
   if(process.argv.includes('--origin-scenario-failure'))assert.fail('unrelated origin scenario failure');
   const trace=external('origin-proof',injected?'native':''),error=Object.assign(Error('native initializer EIO'),{code:'EIO',contractInjected:true});
   try{await trace.call('outer',()=>trace.call('native',()=>mode==='async'?Promise.reject(error):(()=>{throw error;})(),{stage:'initializer'}));}catch(cause){assert.equal(cause.code,'EIO');}
   const rows=[],print=console.error;let failure;console.error=(...args)=>rows.push(args.join(' '));
   try{await trace.healthy();}catch(error){failure=error;}finally{console.error=print;}
   assert.equal(failure?.code,'ERR_RESOURCE_FIXTURE');assert.equal(failure.cause.code,'EIO');return{stdout:'',stderr:rows.join('\n')};
  });
  check(()=>verifyExternalFailure(raw,{scope:'origin-proof',phase:'native',requiredCalls:{outer:1},details:injected?{}:{stage:'initializer'}}));
 }
}});
(async()=>{
 const selected=process.argv[2]?tests.filter(t=>t.name===process.argv[2]):tests;assert.ok(selected.length,'No selected contract checker cases');
 for(const test of selected){await runCase(test.name,test.action,()=>{if(process.argv.includes('--origin-unrelated-failure'))assert.fail('unrelated origin checker setup');},()=>{});console.log('PASS '+test.name);}
 console.log(selected.length+' contract probe control tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
