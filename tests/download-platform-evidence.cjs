// Validate where a negative control actually failed, independently of its product assertion.
const assert = require('node:assert/strict');
function verifyPlatformFailure(raw, control) {
  const prefix = 'DOWNLOAD_PLATFORM_STATE ';
  const records = ((raw.stdout || '') + '\n' + (raw.stderr || '')).split('\n').filter(s => s.startsWith(prefix)).map(s => JSON.parse(s.slice(prefix.length)));
  assert.equal(records.length, 1, 'Missing or ambiguous platform checkpoint'); const state = records[0];
  assert.equal(state.version, 1); assert.equal(state.phase, control.phase); assert.equal(state.injected, true);
  assert.ok(state.calls[control.phase] >= 1, 'Selected platform operation was not called');
  if (control.phase.startsWith('file-')) {
    assert.ok(state.createdTasks > 0, 'File fault did not reach a created task');
    assert.match(state.target || state.filename || '', /^downloads\.json(?:\.tmp)?$/);
    if (control.ioStage) assert.equal(state.stage, control.ioStage, 'File fault occurred before its selected save stage');
    if (control.startedMin) assert.ok(state.startedTasks >= control.startedMin, 'Agent was not started before the save fault');
    if (control.requiredCall) assert.ok(state.calls[control.requiredCall] >= 1, 'Restore/poll did not reach its platform query');
  }
  return state;
}
function writeControls(backend, stage) {
  return ['file-open', 'file-write', 'file-rename'].map(phase => ({
    name: `write ${backend} ${stage}`, phase, suite: 'download-write-boundaries.test.cjs', ioStage: `${backend}-${stage}`,
    startedMin: backend === 'agent' && stage !== 'initial' ? 1 : 0,
    requiredCall: stage === 'restore' || stage === 'poll' ? backend === 'agent' ? 'agent-show' : 'legacy-info' : undefined
  }));
}
module.exports = { verifyPlatformFailure, writeControls };
