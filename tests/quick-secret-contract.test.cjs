const f = require('./quick-secret-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
function verify(check, result, mode, value, accepted) {
  check(() => {
    if (mode === 'facade') { if (accepted) { assert.ifError(result.error); assert.ifError(result.pollError); } else assert.equal(result.error?.message, 'api_response_invalid'); }
    else { assert.equal(result.message, accepted ? '' : 'api_response_invalid:'); assert.equal(result.busy, false); }
    assert.equal(result.code, accepted ? 'ABC123' : mode === 'facade' ? undefined : ''); assert.equal(result.storedLength, accepted ? value.length : 0);
    assert.equal(result.requests.length, accepted ? 4 : 3); assert.ok(result.requests.every(r => !r.tokenHeader));
    assert.deepEqual(result.requests.map(r => r.path.split('/').at(-1)), accepted ? ['Public', 'Enabled', 'Initiate', 'Connect'] : ['Public', 'Enabled', 'Initiate']);
    if (accepted) assert.equal(result.requests.at(-1).secretMatches, true); assert.equal(result.bound, false); assert.equal(result.assets, 0); assert.deepEqual(result.requests.map(r => r.method), accepted ? ['GET','GET','POST','GET'] : ['GET','GET','POST']);
  });
}
for (const mode of ['facade', 'page']) {
  for (const encoding of ['ascii', 'unicode']) for (const n of [511, 512, 513]) test(`${mode} QuickConnect secret ${encoding} ${n}`, async check => {
    const value = encoding === 'ascii' ? 's'.repeat(n) : '😀'.repeat(Math.floor(n / 2)) + '字'.repeat(n % 2); assert.equal(value.length, n);
    verify(check, await f.invoke(mode, value, n <= 512), mode, value, n <= 512);
  });
  for (const n of [511, 512, 513]) test(`${mode} QuickConnect secret raw spaces ${n}`, async check => {
    const value = ' '.repeat(n - 1) + 'x'; verify(check, await f.invoke(mode, value, n <= 512), mode, value, n <= 512);
  });
  for (const [label, value, accepted] of [['empty', '', false], ['opaque controls', ' \n token\t ', true]]) test(`${mode} QuickConnect secret ${label}`, async check => verify(check, await f.invoke(mode, value, accepted), mode, value, accepted));
  test(`${mode} QuickConnect cancelled before initiate response retains no secret`, async check => {
    const gate = f.h.deferred(); f.initGate(gate); const pending = f.start(mode, 's'.repeat(512)); await f.settle(); f.cancel(mode);
    gate.resolve(f.response({ Code: 'ABC123', Secret: 's'.repeat(512), Authenticated: false })); const result = await pending; await f.settle(); const stats = f.stats();
    check(() => { if (mode === 'facade') assert.equal(result.error?.message, 'quick_connect_cancelled'); else assert.equal(result.value, ''); assert.equal(stats.storedLength, 0); assert.equal(stats.bound, false); assert.equal(stats.assets, 0); assert.equal(stats.requests.length, 3); });
  });
}
test('facade legacy QuickConnect retains anonymous GET initiate', async check => { f.version('10.8.9'); const result = await f.invoke('facade', 's'.repeat(512), true); check(() => { assert.ifError(result.error); assert.equal(result.code, 'ABC123'); assert.deepEqual(result.requests.map(r=>r.method), ['GET','GET','GET','GET']); assert.ok(result.requests.every(r=>!r.tokenHeader)); assert.equal(result.requests.at(-1).secretMatches, true); }); });
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
