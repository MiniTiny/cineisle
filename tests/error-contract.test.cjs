// Frozen behavior expectations; execute real adapters with explicit HTTP/OS fixtures.
const assert = require('node:assert/strict');
const h = require('./feature-regression.test.cjs');
const { AppFailure, connectionFailure, authorizationFailure, endpointRecoveryFailure, failureCode } = h.load('utils/Failures.ts');
const strings = h.load('utils/Strings.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);

for (const [message, network, auth, recover] of [
  ['network_failed', true, false, true], ['timeout', true, false, false],
  ['ECONNRESET', true, false, false], ['offline', true, false, false],
  ['fetch failed', true, false, false], ['login_expired', false, true, false],
  ['permission_denied', false, true, false], ['request 401 failed', false, true, false],
  ['network 403 failed', false, true, false], ['http_408', false, false, false],
  ['HTTP 408', true, false, false], ['http_500', true, false, false],
  ['api_response_invalid', false, false, false], ['poster_cancelled', false, false, false],
  ['disk_full', false, false, false], ['sync_cache_write_failed', false, false, false]
]) test('legacy classification: ' + message, () => {
  const error = Error(message);
  assert.deepEqual([connectionFailure(error), authorizationFailure(error), endpointRecoveryFailure(error)], [network, auth, recover]);
});
for (const [status, network, recover] of [
  [400,false,false], [401,false,false], [403,false,false], [408,true,true],
  [429,false,false], [500,true,false], [501,true,false], [502,true,true],
  [503,true,true], [504,true,true], [599,true,false], [600,false,false]
]) test('HTTP status ' + status + ' retains distinct offline/recovery rules', () => {
  const error = Object.assign(Error('localized server response'), {status});
  assert.equal(connectionFailure(error), network);
  assert.equal(endpointRecoveryFailure(error), recover);
  // Plain errors historically use their message for auth, not status alone.
  assert.equal(authorizationFailure(error), false);
});
test('explicit status still takes precedence over a legacy network message', () => {
  assert.equal(connectionFailure(Object.assign(Error('network_failed'), {status:403})), false);
});
test('structured classification is independent of translated messages', () => {
  for (const message of ['network 403', '认证失败', 'hors ligne']) {
    const error = new AppFailure('network_failed','network',message);
    assert.equal(connectionFailure(error),true); assert.equal(authorizationFailure(error),false);
    assert.equal(endpointRecoveryFailure(error),true); assert.equal(error.message,message);
  }
  const storage = new AppFailure('sync_cache_write_failed','storage','network timeout');
  assert.equal(connectionFailure(storage),false); assert.equal(failureCode(storage),'sync_cache_write_failed');
  assert.equal(authorizationFailure(new AppFailure('permission_denied','authorization','Forbidden')),true);
});
test('presentation keeps resource parameters without using translations as identity', () => {
  strings.initializeStrings({getStringByNameSync:(key,...args)=>key+':'+args.join(',')});
  const error = new AppFailure('http_failed','response','http_failed:503',[503],503);
  assert.equal(strings.errorText(error),'http_failed:503'); assert.equal(error.message,'http_failed:503');
  assert.equal(strings.errorText(Error('disk_full')),'disk_full:');
  assert.equal(strings.errorText(Error('free-form message')),'free-form message');
});
for (const status of [401,403,500,503]) test('actual HTTP adapter keeps legacy message and stable identity: '+status, async () => {
  strings.initializeStrings({getStringByNameSync:(key,...args)=>key+':'+args.join(',')});
  const client = h.activate(); h.queue.push({responseCode:status,result:''});
  await assert.rejects(client.request('/probe'),error=>{
    assert.ok(error instanceof AppFailure);
    const code=status===401?'login_expired':status===403?'permission_denied':'http_failed';
    assert.equal(error.failureCode,code);
    assert.equal(error.message,status===401||status===403?code:'http_failed:'+status);
    return true;
  });
  assert.equal(h.requests.length,1);
});
for (const method of ['GET','POST']) test('verified endpoint recovery '+(method==='GET'?'retries read':'never replays unknown write'), async () => {
  const client = h.activate(); client.session.addresses=[client.session.server,'https://backup.invalid/jellyfin'];
  h.queue.push({responseCode:503,result:''},h.response({Id:'server'}));
  if(method==='GET')h.queue.push(h.response({ok:true}));
  const work=client.request('/probe',[],method);
  if(method==='GET')assert.equal((await work).ok,true);else await assert.rejects(work,/http_failed/);
  assert.equal(h.requests.length,method==='GET'?3:2);
  assert.equal(h.requests[1].options.header.Authorization.includes('Token='),false);
  assert.equal(h.requests.filter(r=>r.options.method==='POST').length,method==='POST'?1:0);
});
test('SDK network failure retains identity and never acquires a platform numeric code',async()=>{
  const client=h.activate(); h.queue.push(Object.assign(Error('SDK failure'),{code:2300001}));
  await assert.rejects(client.request('/probe'),e=>e instanceof AppFailure&&e.failureCode==='network_failed'&&e.message==='network_failed'&&e.code===undefined);
});
(async()=>{for(const [name,fn]of tests){h.reset();await fn();console.log('PASS '+name)}console.log(`${tests.length} error contract tests passed. Native HTTP/OS remain explicit fixtures.`)})().catch(e=>{console.error(e);process.exitCode=1});
