// A failed test is not automatically a killed mutation. Fixture and process
// failures are invalid evidence, even when they contain an AssertionError.
const prefix = 'MPV_CASE_RESULT ';
async function fixture(phase, action) {
  try { return await action(); }
  catch (cause) {
    const error = new Error(`MPV fixture ${phase} failed`, { cause });
    error.code = 'ERR_MPV_FIXTURE'; error.fixturePhase = phase; throw error;
  }
}
async function runCase(name, action, { before = () => {}, after = () => {} } = {}) {
  let phase = 'expectation';
  try {
    phase = 'setup'; await fixture(phase, before);
    phase = 'expectation'; await action();
    phase = 'cleanup'; await fixture(phase, after);
    console.log(prefix + JSON.stringify({ version: 1, name, status: 'passed' }));
  } catch (error) {
    const record = { version: 1, name, status: 'failed', phase: error?.code === 'ERR_MPV_FIXTURE' ? 'fixture' : phase,
      fixturePhase: error?.fixturePhase,
      error: { name: error?.name, code: error?.code, message: String(error?.message || error).slice(0, 240),
        cause: error?.cause && { name: error.cause.name, code: error.cause.code, message: String(error.cause.message || error.cause).slice(0, 240) } } };
    console.error(prefix + JSON.stringify(record)); console.error('FAIL ' + name); throw error;
  }
}
function classify(result, expected) {
  const invalid = (reason, caseResult) => ({ status: 'invalid', detected: false, reason, caseResult });
  if (result.error || result.signal || result.status === null) return invalid('process failure');
  const lines = ((result.stdout || '') + '\n' + (result.stderr || '')).split('\n').filter(line => line.startsWith(prefix));
  let records;
  try { records = lines.map(line => JSON.parse(line.slice(prefix.length))); }
  catch (_) { return invalid('malformed outcome'); }
  if (records.length !== 1 || records[0].version !== 1 || records[0].name !== expected.name) return invalid('missing, ambiguous or wrong case');
  const record = records[0];
  if (result.status === 0 && record.status === 'passed') return { status: 'survived', detected: false, caseResult: record };
  if (result.status !== 1 || record.status !== 'failed' || record.phase !== 'expectation') return invalid('fixture or non-expectation failure', record);
  if (!expected.error || !Object.keys(expected.error).length) return invalid('missing expected failure signature');
  if (!Object.entries(expected.error).every(([key, value]) => record.error?.[key] === value)) return invalid('unexpected failure signature', record);
  return { status: 'detected', detected: true, caseResult: record };
}
module.exports = { fixture, runCase, classify };
