// Exercise the actual runner and show that bypassing literal replacement cannot
// turn an incorrect payload into a detected mutation. Only a copied tree changes.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-literal-runner-'));
try {
  const intact = require('./contract-fault-probes.cjs').run('literal-mutation', path.join(directory, 'intact'));
  assert.equal(intact.complete, true); assert.equal(intact.allDetected, true); assert.equal(intact.probes.length, 13); assert.equal(intact.controls.length, 4);
  console.log('PASS actual runner preserves literal payloads and detects helper guard failures');
  const copy = path.join(directory, 'copy');
  for (const scope of ['entry/src/main/ets', 'tests', 'config']) fs.cpSync(path.join(root, scope), path.join(copy, scope), { recursive: true });
  const file = path.join(copy, 'tests/contract-fault-probes.cjs'), original = fs.readFileSync(file, 'utf8');
  const old = "mutated = replaceLiteral(original, old, replacement, 'Stale or ambiguous mutation: ' + file)";
  assert.equal(original.split(old).length, 2);
  fs.writeFileSync(file, original.replace(old, () => 'mutated = original.replace(old, replacement)'));
  const output = path.join(directory, 'bypassed'), result = spawnSync(process.execPath, [path.join(copy, 'tests/contract-fault-probes.cjs'), 'literal-mutation', output], { cwd: copy, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.signal, null); assert.equal(result.status, 1);
  const evidence = JSON.parse(fs.readFileSync(path.join(output, 'evidence.json'), 'utf8'));
  assert.equal(evidence.complete, true); assert.equal(evidence.allDetected, false); assert.equal(evidence.runnerError, undefined);
  const badPayloads = evidence.probes.filter(p => ['runner-literal-match', 'runner-literal-prefix', 'runner-literal-suffix', 'runner-literal-dollar'].includes(p.id));
  assert.equal(badPayloads.length, 4);
  for (const probe of badPayloads) { assert.equal(probe.status, 'invalid'); assert.equal(probe.record.fixturePhase, 'literal-payload'); assert.equal(probe.record.error.cause.code, 'ERR_ASSERTION'); }
  assert.equal(evidence.probes.find(p => p.id === 'runner-literal-unicode').status, 'detected');
  // The parent source remains exactly the frozen source used by the intact run.
  const crypto = require('node:crypto');
  for (const [file, digest] of Object.entries(intact.source)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), digest, file);
  console.log('PASS bypassed runner rejects all four incorrect special-token payloads as invalid');
  console.log('2 literal mutation runner regressions passed. Temporary process/file fixtures do not prove device acceptance.');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
