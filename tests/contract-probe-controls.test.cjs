const assert = require('node:assert/strict');
const { runCase } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs');
const name = 'contract checkpoint requires operation scope and preceding calls';
runCase(name, check => {
  const control = { scope: 'example', phase: 'request', requiredCalls: { create: 1 }, details: { pathname: '/expected' } };
  const state = { version: 1, scope: 'example', phase: 'request', injected: true, calls: { request: 1, create: 1 }, pathname: '/expected' };
  const raw = value => ({ stdout: 'CONTRACT_EXTERNAL_STATE ' + JSON.stringify(value), stderr: '' });
  check(() => {
    assert.deepEqual(verifyExternalFailure(raw(state), control), state);
    for (const changed of [{ ...state, version: 2 }, { ...state, scope: 'other' }, { ...state, phase: 'create' }, { ...state, injected: false }, { ...state, calls: { create: 1 } }, { ...state, calls: { request: 1 } }, { ...state, pathname: '/wrong' }]) assert.throws(() => verifyExternalFailure(raw(changed), control), { code: 'ERR_ASSERTION' });
    assert.throws(() => verifyExternalFailure({ stdout: '', stderr: '' }, control), { code: 'ERR_ASSERTION' });
    assert.throws(() => verifyExternalFailure({ stdout: raw(state).stdout + '\n' + raw(state).stdout, stderr: '' }, control), { code: 'ERR_ASSERTION' });
  });
}, () => {}, () => {}).then(() => console.log('1 contract probe control tests passed.')).catch(error => { console.error(error); process.exitCode = 1; });
