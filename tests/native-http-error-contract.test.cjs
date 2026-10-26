const f = require('./native-http-error-fixture.cjs'), { assert } = f, tests = [];
const cases = [
  ['below lower', 2299999, false], ['at lower', 2300000, true], ['above lower', 2300001, true],
  ['below upper', 2399999, true], ['at upper', 2400000, false], ['above upper', 2400001, false],
  ['negative', -1, false], ['zero', 0, false], ['NaN', NaN, false], ['Infinity', Infinity, false], ['missing', undefined, false], ['null', null, false],
  ['string lower', '2300000', true], ['string upper minus one', '2399999', true], ['string upper', '2400000', false], ['non numeric string', 'fixture', false], ['success', 'success', false]
];
for (const entry of ['request', 'text', 'client']) for (const [label, value, network] of cases) tests.push({ name: entry + ' native code ' + label, action: async check => {
  const r = await f.invoke(entry, value);
  check(() => {
    assert.equal(r.calls['http-create'], 1); assert.equal(r.calls['http-request'], 1); assert.equal(r.calls['http-destroy'], 1);
    assert.deepEqual(r.requests, [{ path: '/Users/Public', method: 'GET' }]);
    if (value === 'success') { assert.ifError(r.error); assert.deepEqual(r.value, entry === 'text' ? '[]' : []); return; }
    assert.ok(r.error);
    if (network) { assert.equal(r.same, false); assert.equal(r.error.failureCode, 'network_failed'); assert.equal(r.error.category, 'network'); assert.equal(r.error.message, 'network_failed'); assert.equal(r.message, '网络连接失败，请稍后重试'); }
    else { assert.equal(r.same, true); assert.equal(r.error.failureCode, undefined); assert.equal(r.message, 'expected native request failure'); }
  });
} });
for (const code of [2300000, 2399999]) tests.push({ name: 'GET recovery uses mapped network identity ' + code, action: async check => {
  const r = await f.invoke('request', code, 'matching');
  check(() => { assert.ifError(r.error); assert.deepEqual(r.value, []); assert.deepEqual(r.routes, ['https://primary.invalid/Items/movie:GET', 'https://backup.invalid/System/Info/Public:GET', 'https://backup.invalid/Items/movie:GET']); assert.deepEqual(r.endpoints, ['https://backup.invalid']); assert.equal(r.server, 'https://backup.invalid'); assert.equal(r.calls['http-destroy'], 3); });
} });
tests.push({ name: 'upper native code preserves original error without recovery', action: async check => {
  const r = await f.invoke('request', 2400000, 'matching');
  check(() => { assert.equal(r.same, true); assert.deepEqual(r.routes, ['https://primary.invalid/Items/movie:GET']); assert.deepEqual(r.endpoints, []); assert.equal(r.server, 'https://primary.invalid'); assert.equal(r.calls['http-destroy'], 1); });
} });
tests.push({ name: 'mapped write recovery verifies backup without replaying write', action: async check => {
  const r = await f.invoke('write', 2300000, 'matching');
  check(() => { assert.equal(r.error?.failureCode, 'network_failed'); assert.equal(r.message, '网络连接失败，请稍后重试'); assert.deepEqual(r.routes, ['https://primary.invalid/Items/movie:POST', 'https://backup.invalid/System/Info/Public:GET']); assert.deepEqual(r.endpoints, ['https://backup.invalid']); assert.equal(r.server, 'https://backup.invalid'); assert.equal(r.calls['http-destroy'], 2); });
} });
tests.push({ name: 'mapped network recovery rejects different server identity', action: async check => {
  const r = await f.invoke('request', 2300000, 'wrong');
  check(() => { assert.equal(r.error?.failureCode, 'network_failed'); assert.deepEqual(r.routes, ['https://primary.invalid/Items/movie:GET', 'https://backup.invalid/System/Info/Public:GET']); assert.deepEqual(r.endpoints, []); assert.equal(r.server, 'https://primary.invalid'); assert.equal(r.calls['http-destroy'], 2); });
} });
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
