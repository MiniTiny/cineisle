// The child starts with a controlled dynamic-library path. No device ABI/decode claim.
const assert = require('node:assert/strict'), path = require('node:path'), { spawnSync } = require('node:child_process');
const built = require('./native-mpv-build.cjs').build();
let total = 0;
try {
  for (const mode of ['behavior', 'api-major', 'api-minor']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'native-mpv-cases.cjs'), built.addon, mode], {
      cwd: built.root, encoding: 'utf8', timeout: 45000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, UV_THREADPOOL_SIZE: '32', DYLD_LIBRARY_PATH: built.directory, LD_LIBRARY_PATH: built.directory }
    });
    process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
    assert.equal(result.status, 0, result.error?.message || `Native MPV ${mode} failed (${result.signal})`);
    const match = result.stdout.match(/^(\d+) native MPV fixture cases passed/m);
    assert.ok(match, 'Native child reported no executed cases'); total += Number(match[1]);
  }
  console.log(`${total} native MPV entry cases passed. Production callbacks/Session/Execute executed; host N-API and libmpv fixture do not prove Harmony ABI, rendering, decoding or audio.`);
} finally { built.cleanup(); }
