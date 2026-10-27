const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const common = require('./contract-external.cjs'), { fixture } = require('./resource-cache-result.cjs');
let trace, directory;
const nativeFailure = phase => { if (process.argv.includes('--native-' + phase + '-init-failure')) throw Object.assign(Error('injected literal mutation ' + phase + ' failure'), { code: 'EIO', contractInjected: true }); };
const f = { assert, trace: () => trace,
  async execute(source, expected) {
    try {
      // Check the produced bytes before compiling; malformed mutation output
      // must fail its own assertion, rather than masquerading as compiler failure.
      if (source !== expected) return { source };
      const target = path.join(directory, 'case.cjs');
      trace.call('file-write', () => { nativeFailure('write'); fs.writeFileSync(target, source + '\nprocess.stdout.write(JSON.stringify(module.exports));\n'); });
      const output = trace.call('node-child', () => {
        nativeFailure('node'); const result = spawnSync(process.execPath, [target], { encoding: 'utf8', timeout: 5000 });
        if (result.error || result.signal || result.status !== 0) throw Object.assign(Error('literal mutation child failed', { cause: result.error }), { code: 'EIO' });
        return JSON.parse(result.stdout);
      });
      return { source, output };
    } catch (unexpected) { return { source, unexpected }; }
  },
  async target(value) {
    const raw = trace.call('file-read', () => { nativeFailure('read'); return fs.readFileSync(path.join(__dirname, 'literal-mutation-target.cjs'), 'utf8'); });
    const original = "module.exports = 'literal_original';\n", expected = 'module.exports = ' + JSON.stringify(value) + ';\n';
    // A runner that applied different bytes must be invalid, not a killed
    // mutation. Baseline and the one exact recipe payload are the only inputs.
    if (raw !== original) await fixture('literal-payload', () => assert.equal(raw, expected));
    return f.execute(raw, raw);
  },
  run: tests => common.run(tests, 'literal-mutation', () => {
    trace = common.external('literal-mutation', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-literal-'));
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated literal mutation setup failure');
  }, () => fs.rmSync(directory, { recursive: true, force: true }), () => trace.healthy())
};
module.exports = f;
