const f = require('./caption-min-font-fixture.cjs').make(), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
for (const layer of ['lower', 'N-API']) for (const [label, size, accepted] of [['below', .0099, false], ['at', .01, true], ['above', .0101, true], ['zero', 0, false], ['negative', -1, false], ['NaN', NaN, false], ['Infinity', Infinity, false], ['string', '.01', false], ['missing', undefined, false]]) test(`${layer} caption font ${label}`, async check => {
  const r = await f.invoke(layer, f.request(size));
  check(() => { assert.ifError(r.unexpected); assert.equal(r.inspection.unexpectedNumberFailures, 0); if (!accepted) { assert.equal(r.result.error, 'caption_argument_invalid'); assert.equal(r.result.value, undefined); } else if (layer === 'lower') { assert.equal(r.result.error, undefined); assert.equal(r.result.value, size); } else { assert.equal(r.result.error, 'caption_fixture_budget_admitted'); } if (accepted) { assert.equal(r.inspection.invalidReads, 0); assert.ok(r.inspection.readValues.includes(size)); } });
});
for (const layer of ['lower', 'N-API']) test(`${layer} caption validates a later run independently`, async check => {
  const request = f.request(.01); request.runs.push({ ...request.runs[0], size: .0099 }); const r = await f.invoke(layer, request);
  check(() => { assert.ifError(r.unexpected); assert.equal(r.inspection.unexpectedNumberFailures, 0); assert.equal(r.result.error, 'caption_argument_invalid'); assert.ok(r.inspection.readValues.includes(.01)); assert.ok(r.inspection.readValues.includes(.0099)); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
