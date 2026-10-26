// Host N-API execution of production NapiMpv.cpp, with only libmpv as a fixture.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
exports.build = () => {
  const root = path.resolve(__dirname, '..'), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-mpv-entry-'));
  const cleanup = () => fs.rmSync(directory, { recursive: true, force: true });
  process.on('exit', cleanup);
  const sdk = require('./deveco-runtime.cjs').contents;
  const candidates = [process.env.CINEISLE_NODE_INCLUDE, path.resolve(process.execPath, '../../include/node'), path.join(sdk, 'tools/node/include/node')].filter(Boolean);
  const nodeInclude = candidates.find(p => fs.existsSync(path.join(p, 'node_api.h')));
  assert.ok(nodeInclude, 'Node N-API headers required; set CINEISLE_NODE_INCLUDE');
  const include = path.join(directory, 'include'); fs.mkdirSync(path.join(include, 'napi'), { recursive: true });
  fs.writeFileSync(path.join(include, 'napi/native_api.h'), '#include <node_api.h>\n');
  const compiler = process.env.CXX || 'clang++';
  const common = ['-std=c++17', '-pthread', '-fPIC', '-I' + include, '-I' + nodeInclude, '-I' + path.join(root, 'entry/src/main/cpp/mpv/include')];
  const run = args => {
    const result = spawnSync(compiler, [...common, ...args], { cwd: root, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message || 'Native MPV fixture compile failed');
  };
  const engine = path.join(directory, 'libmpv.so'), addon = path.join(directory, 'entry.node');
  run([...(process.platform === 'darwin' ? ['-dynamiclib', '-Wl,-install_name,' + engine] : ['-shared']), 'tests/native-mpv-fixture/engine.cpp', '-o', engine]);
  run([...(process.platform === 'darwin' ? ['-bundle', '-undefined', 'dynamic_lookup'] : ['-shared']), 'tests/native-mpv-fixture/entry.cpp', engine, ...(process.platform === 'darwin' ? [] : ['-ldl']), '-o', addon]);
  return { root, directory, addon, cleanup };
};
