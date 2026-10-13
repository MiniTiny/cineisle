// Reproducible local gate. Each suite has its own process and explicit evidence boundary.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), audit = path.resolve(root, process.env.CINEISLE_TEST_OUTPUT_DIR || '.local/test-results/regression');
const suites = ['protocol', 'feature-regression', 'player-regression', 'system-playback', 'pip-subtitle', 'language-preferences', 'openapi-regression', 'media-presentation', 'detail-regression', 'branding', 'window-theme', 'library-grid', 'actor-baseline', 'accounts-regression', 'button-layout', 'responsive-layout', 'brand-forms','brand-library','brand-player'].map(name => ({ name, command: process.execPath, file: `tests/${name}.test.cjs` }));
suites.push(...['original-icons', 'brand-package'].map(name => ({ name, command: process.env.PYTHON || 'python3', file: `tests/${name}.test.py` })));
const results = [];
for (const suite of suites) {
  const started = Date.now(), result = spawnSync(suite.command, [suite.file], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const output = (result.stdout || '') + (result.stderr || '');
  const log = `logs/actor-${suite.name}.log`; fs.mkdirSync(path.join(audit, 'logs'), { recursive: true }); fs.writeFileSync(path.join(audit, log), output);
  const final = output.trim().split('\n').findLast(line => /^\d+ .*passed/.test(line)); const match = final?.match(/^(\d+)/) || output.match(/Ran (\d+) tests/);
  results.push({ name: suite.name, file: suite.file, exitCode: result.status, count: match ? Number(match[1]) : 0, durationMs: Date.now() - started, log, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, suite.file))).digest('hex') });
  console.log(`${suite.name}: ${result.status === 0 ? 'PASS' : 'FAIL'} (${results.at(-1).count})`);
  if (result.status !== 0) { console.error(output.slice(-3000)); break; }
}
const evidence = { baseline: '225fba7cb5ad68865986a96e4b62d883c1d987a0', date: new Date().toISOString(), suites: results, count: results.reduce((sum, r) => sum + r.count, 0), allPassed: results.length === suites.length && results.every(r => r.exitCode === 0), boundaries: 'Node uses SDK fixtures; UI builders use the actual SDK compiler. Python checks SVG/HAP. None proves native playback, OS survival or real-server mutation.' };
fs.writeFileSync(path.join(audit, 'evidence-actor-tests.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`Total: ${evidence.count}; allPassed=${evidence.allPassed}`); if (!evidence.allPassed) process.exitCode = 1;
