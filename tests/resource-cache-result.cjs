// Resource mutation evidence must identify the selected boundary assertion.
const prefix = 'RESOURCE_CASE_RESULT ';
async function fixture(phase, action) {
  try { return await action(); } catch (cause) {
    const error = new Error(`Resource fixture ${phase} failed`, { cause });
    error.code = 'ERR_RESOURCE_FIXTURE'; error.fixturePhase = phase; throw error;
  }
}
function check(name, action) {
  try { return action(); } catch (error) {
    if (error.code === 'ERR_ASSERTION') { error.code = 'ERR_RESOURCE_BOUNDARY'; error.boundary = name; }
    throw error;
  }
}
async function runCase(name, action, before, after) {
  let failure;
  try { await fixture('setup', before); await action(fn => check(name, fn)); } catch (error) { failure = error; }
  try { await fixture('cleanup', after); } catch (error) { failure = error; }
  if (!failure) { console.log(prefix + JSON.stringify({ version: 1, name, status: 'passed' })); return; }
  const error = failure;
  console.error(prefix + JSON.stringify({ version: 1, name, status: 'failed',
    phase: error.code === 'ERR_RESOURCE_FIXTURE' ? 'fixture' : 'expectation', fixturePhase: error.fixturePhase,
    boundary: error.boundary, error: { code: error.code, message: String(error.message).slice(0, 240),
      cause: error.cause && { code: error.cause.code, message: String(error.cause.message).slice(0, 240) } } }));
  throw error;
}
function classify(result, name) {
  const invalid = (reason, record) => ({ status: 'invalid', detected: false, reason, record });
  if (result.error || result.signal || result.status === null) return invalid('process failure');
  let rows;
  try { rows = ((result.stdout || '') + '\n' + (result.stderr || '')).split('\n').filter(s => s.startsWith(prefix)).map(s => JSON.parse(s.slice(prefix.length))); }
  catch (_) { return invalid('malformed result'); }
  if (rows.length !== 1 || rows[0].version !== 1 || rows[0].name !== name) return invalid('missing, ambiguous or wrong case');
  const record = rows[0];
  if (result.status === 0 && record.status === 'passed') return { status: 'survived', detected: false, record };
  if (result.status !== 1 || record.status !== 'failed' || record.phase !== 'expectation' ||
      record.error?.code !== 'ERR_RESOURCE_BOUNDARY' || record.boundary !== name) return invalid('fixture or unrelated failure', record);
  return { status: 'detected', detected: true, record };
}
module.exports = { fixture, check, runCase, classify };
