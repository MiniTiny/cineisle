// Execute the real runner: two native initializer ordinals share a phase and case name.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { run } = require('./contract-fault-probes.cjs');
const { classify } = require('./resource-cache-result.cjs');
const { verifyExternalFailure } = require('./contract-external.cjs');
const output = path.resolve(process.env.CINEISLE_TEST_OUTPUT_DIR || '.local/test-results', 'contract-evidence');
function verify() {
  const evidence = run('public-user', output);
  assert.equal(evidence.complete, true); assert.equal(evidence.allDetected, true);
  assert.equal(evidence.controls.length, 6);
  const files = evidence.controls.flatMap(control => Object.values(control.artifacts));
  assert.equal(new Set(files).size, 12, 'Each control must retain its own healthy and failure process output');
  for (const control of evidence.controls) {
    const positive = JSON.parse(fs.readFileSync(path.join(output, control.artifacts.positive), 'utf8'));
    const negative = JSON.parse(fs.readFileSync(path.join(output, control.artifacts.negative), 'utf8'));
    assert.deepEqual(classify(positive, control.name), control.normal);
    assert.deepEqual(classify(negative, control.name), control.failed);
    if (control.phase !== 'setup') assert.deepEqual(verifyExternalFailure(negative, control), control.checkpoint);
  }
  const native = evidence.controls.filter(control => control.phase === 'http-create');
  assert.deepEqual(native.map(control => control.nativeInit), [2, 1]);
  assert.equal(native[0].checkpoint.calls['http-create'], 2); assert.equal(native[0].checkpoint.calls.version, 1);
  assert.equal(native[1].checkpoint.calls['http-create'], 1); assert.equal(native[1].checkpoint.calls.version, undefined);
  console.log('PASS actual runner retains separate native initializer control outputs');
  console.log('1 contract evidence regression passed. Platform fixtures do not prove native HTTP behavior.');
}
try { verify(); } catch (error) { console.error(error); process.exitCode = 1; }
