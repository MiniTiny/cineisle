const assert = require('node:assert/strict');
const h = require('./feature-regression.test.cjs');
const { SyncRetryPolicy, SyncSchedule } = h.load('utils/SyncPolicy.ts');
const { ExperienceState, validExperience } = h.load('utils/Experience.ts');
const { PendingSync } = h.load('service/PendingSync.ets');
const { SessionStore } = h.load('service/SessionStore.ets');
const { AppService } = h.load('service/AppService.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);

test('frozen timing contract distinguishes OS cadence from replay backoff', () => {
  assert.deepEqual([SyncRetryPolicy.maxAttempts, SyncRetryPolicy.initialDelayMs, SyncRetryPolicy.maxDelayMs], [5,30000,1200000]);
  assert.deepEqual([SyncSchedule.wakeDebounceMs, SyncSchedule.executionBudgetMs, SyncSchedule.continuationDelayMs, SyncSchedule.repeatCycleMs], [500,80000,1000,1200000]);
});
test('attempt progression and exponential waits retain the original bounds', () => {
  let attempt;
  const waits = [];
  for (let i=0;i<5;i++) { attempt=SyncRetryPolicy.nextAttempt(attempt); assert.equal(attempt,i+1); waits.push(SyncRetryPolicy.nextRetryAt(1000000,attempt)-1000000); }
  assert.deepEqual(waits,[30000,60000,120000,240000,480000]);
  assert.equal(SyncRetryPolicy.nextAttempt(5),5);
  assert.equal(SyncRetryPolicy.nextRetryAt(1000000,7),2200000);
});
for (const value of [undefined,0,1,2,3,4,5]) test('legacy persisted attempt remains readable: '+value,()=>{
  const state=new ExperienceState(); if(value!==undefined)state.syncAttempts=value;
  assert.equal(validExperience(state),true);
});
for (const value of [-1,6,1.5,NaN,Infinity,'1']) test('invalid persisted attempt remains rejected: '+value,()=>{
  assert.equal(validExperience(Object.assign(new ExperienceState(),{syncAttempts:value})),false);
});
test('foreground write failure retains the first retry time without acknowledging intent',async()=>{
  const client=h.activate(),item=h.film('movie'); client.favorite=async()=>{throw Error('network_failed')};
  const original=Date.now;Date.now=()=>1000000;
  try {
    assert.equal(await AppService.edit(item,true,true),true);
    const state=AppService.local.experience();
    assert.equal(state.syncAttempts,0);assert.equal(state.syncNextAt,1030000);assert.equal(state.syncBlocked,false);assert.equal(state.pending.length,1);
  } finally {Date.now=original}
});
test('automatic replay waits at the exact boundary and stops at five failures',async()=>{
  const client=h.activate();await SessionStore.save(client.session);client.validateAccount=async()=>{};
  let calls=0;client.favorite=async()=>{calls++;throw Error('network_failed')};
  AppService.experience.update(s=>{s.pending=[{id:'movie',field:'favorite',value:true,revision:1,item:h.film('movie')}]});
  h.context.applicationInfo={name:'com.cineisle.fixture'};
  h.capabilities.add('SystemCapability.ResourceSchedule.WorkScheduler');
  PendingSync.configure(h.context,()=>({client,local:AppService.local,store:AppService.experience}));PendingSync.interactive=false;
  const original=Date.now;let now=1000000;Date.now=()=>now;
  try {
    for(const [index,delay]of [30000,60000,120000,240000,480000].entries()) {
      await PendingSync.run();const state=AppService.local.experience();
      assert.equal(calls,index+1);assert.equal(state.syncAttempts,index+1);assert.equal(state.syncNextAt,now+delay);assert.equal(state.pending.length,1);
      now=state.syncNextAt-1;await PendingSync.run();assert.equal(calls,index+1);now++;
    }
    await PendingSync.run();assert.equal(calls,5);assert.equal(PendingSync.issue,'sync_retry_exhausted');
  } finally {Date.now=original;await PendingSync.jobs}
});
(async()=>{for(const [name,fn]of tests){h.reset();await fn();console.log('PASS '+name)}console.log(`${tests.length} sync policy tests passed. OS scheduling and HTTP remain explicit fixtures.`)})().catch(e=>{console.error(e);process.exitCode=1});
