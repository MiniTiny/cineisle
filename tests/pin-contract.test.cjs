const f = require('./pin-contract-fixture.cjs'), { assert } = f, crypto = require('node:crypto');
const tests = [], test = (name, action) => tests.push({ name, action });
const cases = [[5, false], [6, true], [7, true], [11, true], [12, true], [13, false]].map(([n, accepted]) => ['digits ' + n, '1'.repeat(n), accepted]);
cases.push(['mixed', '12345a', false], ['wide', '１２３４５６', false], ['emoji', '😀😀😀', false], ['newline', '123456\n', false], ['nul', '12345\0', false]);
for (const [label, pin] of cases) { if (label === 'newline') { assert.equal(pin.length, 7); assert.equal(pin.charCodeAt(6), 10); } if (label === 'nul') { assert.equal(pin.length, 6); assert.equal(pin.charCodeAt(5), 0); } if (label === 'emoji') { assert.equal(pin.length, 6); assert.equal(Array.from(pin).length, 3); } }
function saved(result, pin) {
  assert.deepEqual(Object.keys(result.stored), ['version', 'iterations', 'salt', 'hash']); assert.equal(result.stored.version, 1); assert.equal(result.stored.iterations, 210000); assert.equal(result.stored.salt.length, 16); assert.equal(result.stored.hash.length, 32);
  assert.deepEqual(result.stored.hash, [...crypto.pbkdf2Sync(pin, Buffer.from(result.stored.salt), 210000, 32, 'sha256')]);
  const spec = result.specs.at(-1); assert.equal(spec.algorithm, 'PBKDF2|SHA256'); assert.equal(spec.algName, 'PBKDF2'); assert.equal(spec.password, pin); assert.equal(spec.iterations, 210000); assert.equal(spec.keySize, 32); assert.deepEqual(spec.salt, result.stored.salt);
}
for (const mode of ['policy', 'facade', 'settings', 'gate']) for (const [label, pin, accepted] of cases) test(`${mode} PIN ${label}`, async check => {
  const result = await f.invoke(mode, pin);
  check(() => {
    assert.ifError(result.unexpected);
    if (mode === 'policy') { assert.equal(result.accepted, accepted); return; }
    if (mode === 'facade') { assert.equal(result.error?.message, accepted ? undefined : 'lock_pin_format'); assert.equal(result.specs.length, accepted ? 1 : 0); assert.equal(result.calls['asset-add'] || 0, accepted ? 1 : 0); if (accepted) saved(result, pin); else assert.equal(result.stored, undefined); return; }
    if (mode === 'settings') { assert.deepEqual(result.limits, [12, 12, 12]); assert.equal(result.available, pin.length >= 6); assert.equal(result.message, accepted ? '' : 'lock_pin_format:'); assert.equal(result.busy, false); assert.deepEqual(result.cleared, ['', '', '']); assert.equal(result.specs.length, accepted ? 2 : 1); assert.equal(result.calls['asset-add'] || 0, accepted ? 1 : 0); assert.ok(result.events.indexOf('kdf-secret') < result.events.indexOf('random-create') || !accepted); if (accepted) saved(result, pin); return; }
    const eligible = pin.length >= 6; assert.equal(result.available, eligible); assert.equal(result.limit, 12); assert.equal(result.pin, eligible ? '' : pin); assert.equal(result.specs.length, eligible ? 1 : 0); assert.equal(result.calls.unlock || 0, eligible ? 1 : 0); assert.equal(result.message, eligible ? 'lock_pin_wrong' : ''); assert.equal(result.busy, false); assert.equal(result.locked, true);
  });
});
for (const pin of ['123456', '123456789012', '1234567890123']) test('gate legacy PIN length ' + pin.length, async check => {
  const result = await f.invoke('gate', pin, pin);
  check(() => { assert.ifError(result.unexpected); assert.equal(result.available, true); assert.equal(result.limit, 12); assert.equal(result.locked, false); assert.equal(result.message, ''); assert.equal(result.specs.length, 1); assert.equal(result.pin, ''); });
});
test('settings empty next preserves disable and clears all drafts', async check => {
  const result = await f.invoke('settings', '');
  check(() => { assert.ifError(result.unexpected); assert.equal(result.enabled, false); assert.equal(result.stored, undefined); assert.equal(result.calls['asset-remove'], 1); assert.equal(result.calls['asset-add'] || 0, 0); assert.equal(result.specs.length, 1); assert.equal(result.message, ''); assert.deepEqual(result.cleared, ['', '', '']); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
