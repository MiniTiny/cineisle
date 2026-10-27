const f = require('./ass-timestamp-fixture.cjs').make(), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
for (const layer of ['lower', 'N-API']) {
  for (const value of [0, 1, 9007199254740990, 9007199254740991]) test(`${layer} exact timestamp ${value}`, async check => {
    const r = await f.invoke(layer, value);
    check(() => { assert.ifError(r.unexpected); assert.equal(r.inspection.unexpectedNumberFailures, 0); assert.equal(r.result.error, undefined); assert.equal(r.inspection.numberFailures, 0); assert.equal(r.inspection.libraryFailures, 0); if (layer === 'lower') { assert.equal(r.result.value, value); assert.deepEqual(r.inspection.times, []); assert.equal(r.inspection.reads, 1); } else { assert.deepEqual(r.inspection.times, [value]); assert.equal(r.inspection.reads, 5); assert.equal(r.result.value.width, 0); assert.equal(r.result.value.height, 0); } });
  });
  for (const [label, value] of [['above', 9007199254740992], ['far above', 18014398509481984], ['negative', -1], ['fraction', .5], ['NaN', NaN], ['Infinity', Infinity], ['negative Infinity', -Infinity], ['string', '1'], ['undefined', undefined], ['null', null]]) test(`${layer} rejects timestamp ${label}`, async check => {
    const r = await f.invoke(layer, value);
    check(() => { assert.ifError(r.unexpected); assert.equal(r.inspection.unexpectedNumberFailures, 0); assert.equal(r.result.error, 'ass_argument_invalid'); assert.deepEqual(r.inspection.times, []); assert.equal(r.inspection.reads, 1); assert.equal(r.inspection.numberFailures, ['string', 'undefined', 'null'].includes(label) ? 1 : 0); });
  });
}
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
