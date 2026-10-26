const assert = require('node:assert/strict');
function verifyExternalFailure(raw, control) {
  const prefix = 'REWATCH_EXTERNAL_STATE ';
  const records = ((raw.stdout || '') + '\n' + (raw.stderr || '')).split('\n').filter(s => s.startsWith(prefix)).map(s => JSON.parse(s.slice(prefix.length)));
  assert.equal(records.length, 1, 'Missing or ambiguous rewatch checkpoint');
  const state = records[0];
  assert.equal(state.version, 1); assert.equal(state.phase, control.phase); assert.equal(state.injected, true);
  assert.ok(state.calls[control.phase] >= 1, 'Selected external operation was not called');
  if (control.pathname) assert.equal(state.pathname, control.pathname);
  for (const [phase, min] of Object.entries(control.requiredCalls || {})) assert.ok(state.calls[phase] >= min, 'Rewatch fault occurred before required ' + phase);
  return state;
}
module.exports = { verifyExternalFailure };
