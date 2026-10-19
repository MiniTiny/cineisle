// Reproducible local gate. Discover every supported suite; record failures and skipped work explicitly.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { spawnSync } = require('node:child_process');
const defaultRoot = path.resolve(__dirname, '..');
function discoverInventory(root) {
  const files = fs.readdirSync(path.join(root, 'tests'), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.test\.(cjs|py)$/.test(entry.name)).map(entry => entry.name).sort();
  const captures = file => file.endsWith('-emulator.test.py') || /^emulator-.*\.test\.py$/.test(file);
  return {
    suites: files.filter(file => !captures(file)).map(file => ({ name: file.replace(/\.test\.(cjs|py)$/, ''), command: file.endsWith('.py') ? process.env.PYTHON || 'python3' : process.execPath, file: `tests/${file}` })),
    separateAcceptance: files.filter(captures).map(file => ({ file: `tests/${file}`, reason: 'requires separately captured native layouts/screenshots; not executed by the local gate' }))
  };
}
function discoverSuites(root) { return discoverInventory(root).suites; }
function caseCount(output) {
  const final = output.trim().split('\n').findLast(line => /^\d+ .*passed/.test(line));
  const match = final?.match(/^(\d+)/) || output.match(/Ran (\d+) tests?\b/);
  return match ? Number(match[1]) : 0;
}
function runRegression({ root = defaultRoot, audit = path.resolve(root, process.env.CINEISLE_TEST_OUTPUT_DIR || '.local/test-results/regression'), report = console.log } = {}) {
  const { suites, separateAcceptance } = discoverInventory(root), results = [];
  fs.mkdirSync(path.join(audit, 'logs'), { recursive: true });
  for (const suite of suites) {
    const started = Date.now(), source = fs.readFileSync(path.join(root, suite.file));
    const result = spawnSync(suite.command, [suite.file], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const output = (result.stdout || '') + (result.stderr || ''), count = caseCount(output);
    const log = `logs/actor-${suite.name}.log`; fs.writeFileSync(path.join(audit, log), output);
    const passed = result.status === 0 && !result.error && count > 0;
    results.push({ name: suite.name, file: suite.file, exitCode: result.status, signal: result.signal, errorCode: result.error?.code, count, passed, durationMs: Date.now() - started, log, sha256: crypto.createHash('sha256').update(source).digest('hex') });
    report(`${suite.name}: ${passed ? 'PASS' : 'FAIL'} (${count})`);
    if (!passed) { report(output.slice(-3000)); if (result.status === 0 && count === 0) report('No executed test cases were reported.'); break; }
  }
  const evidence = { baseline: '225fba7cb5ad68865986a96e4b62d883c1d987a0', date: new Date().toISOString(), gateScope: 'local-regression', discovered: suites.map(suite => suite.file), separateAcceptance, suites: results, skipped: suites.slice(results.length).map(suite => suite.file), count: results.reduce((sum, r) => sum + r.count, 0), allPassed: suites.length > 0 && results.length === suites.length && results.every(r => r.passed), boundaries: 'Node uses SDK fixtures; UI builders use the actual SDK compiler. Python checks SVG/HAP. Native capture acceptance is listed separately and is not counted as passed. None proves native playback, OS survival or real-server mutation.' };
  fs.writeFileSync(path.join(audit, 'evidence-actor-tests.json'), JSON.stringify(evidence, null, 2) + '\n');
  report(`Total: ${evidence.count}; allPassed=${evidence.allPassed}`);
  report(`Separate native capture acceptance: ${separateAcceptance.length} (not executed)`);
  return evidence;
}
module.exports = { discoverInventory, discoverSuites, caseCount, runRegression };
if (require.main === module && !runRegression().allPassed) process.exitCode = 1;
