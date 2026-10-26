// New structural contract: the actual catch reads the SDK enum after its native operation.
const f = require('./asset-error-fixture.cjs'), { assert } = f, tests = [];
for (const operation of ['lock-query', 'lock-remove', 'session-query', 'session-remove']) tests.push({ name: operation + ' consumes SDK NOT_FOUND', action: async check => {
  const state = await f.invoke(operation, 24000002);
  check(() => { assert.ifError(state.error); assert.equal(state.calls['enum-read'], 1); const phase = 'asset-' + (operation.endsWith('query') ? 'query' : 'remove'); assert.ok(state.events.indexOf(phase, state.events.indexOf('entry') + 1) < state.events.indexOf('enum-read')); assert.ok(state.events.indexOf('entry') < state.events.indexOf('enum-read')); });
} });
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
