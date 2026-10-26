const assert = require('node:assert/strict');
const { fixture, runCase } = require('./resource-cache-result.cjs');
const prefix = 'CONTRACT_EXTERNAL_STATE ';
function external(scope, fault) {
  const errors = [], states = new Map(), calls = {}, events = []; let published = false;
  const snapshot = (phase, injected, details) => ({ version: 1, scope, phase, injected, calls: { ...calls }, ...details });
  return {
    calls, events,
    call(phase, operation, details = {}) {
      calls[phase] = (calls[phase] || 0) + 1; events.push(phase);
      if (fault === phase) {
        const error = Object.assign(Error('injected ' + scope + ' external failure: ' + phase), { code: 'EIO' });
        states.set(error, snapshot(phase, true, details));
        errors.push(error); throw error;
      }
      const failed = error => {
        // A propagated failure must keep the first observation in this tracker.
        if (!states.has(error)) { states.set(error, snapshot(phase, error?.contractInjected === true, details)); errors.push(error); }
        throw error;
      };
      try { const value = operation(); return value?.then ? value.catch(failed) : value; } catch (error) { return failed(error); }
    },
    async healthy() { await fixture(scope + '-external', () => {
      if (!errors.length) return;
      if (!published) { console.error(prefix + JSON.stringify(states.get(errors[0]))); published = true; }
      throw errors[0];
    }); }
  };
}
function verifyExternalFailure(raw, control) {
  const rows = ((raw.stdout || '') + '\n' + (raw.stderr || '')).split('\n').filter(line => line.startsWith(prefix)).map(line => JSON.parse(line.slice(prefix.length)));
  assert.equal(rows.length, 1, 'Missing or ambiguous contract checkpoint'); const state = rows[0];
  assert.equal(state.version, 1); assert.equal(state.scope, control.scope); assert.equal(state.phase, control.phase); assert.equal(state.injected, true);
  assert.ok(state.calls[control.phase] >= 1, 'Selected external operation was not called');
  for (const [phase, min] of Object.entries(control.requiredCalls || {})) assert.ok(state.calls[phase] >= min, 'Contract fault occurred before required ' + phase);
  for (const [key, value] of Object.entries(control.details || {})) assert.equal(state[key], value, 'Wrong checkpoint ' + key);
  return state;
}
async function run(tests, label, before, after, healthy) {
  const selected = process.argv[2], cases = selected ? tests.filter(t => t.name === selected) : tests;
  assert.ok(cases.length, 'No selected contract cases');
  for (const { name, action } of cases) {
    await runCase(name, async check => {
      const expectations = []; let failure;
      try { await action(fn => expectations.push(fn)); } catch (error) { failure = error; }
      await healthy(); if (failure) throw failure;
      assert.ok(expectations.length, 'No contract boundary reached');
      try { for (const expectation of expectations) check(expectation); } finally { await healthy(); }
    }, before, after);
    console.log('PASS ' + name);
  }
  console.log(`${cases.length} ${label} contract tests passed. Platform fixtures do not prove device or real-service acceptance.`);
}
module.exports = { external, verifyExternalFailure, run };
