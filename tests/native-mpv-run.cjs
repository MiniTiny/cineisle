const path = require('node:path'), { spawnSync } = require('node:child_process');
exports.run = (built, { mode = 'behavior', name = '', pool = '32', timeout = 12000 } = {}) => spawnSync(process.execPath,
  [path.join(built.root, 'tests/native-mpv-cases.cjs'), built.addon, mode, name], {
    cwd: built.root, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024,
    // More than four workers let the fifth Execute run while four actual opens
    // wait on the libmpv barrier; this does not change production budgets.
    env: { ...process.env, UV_THREADPOOL_SIZE: pool, DYLD_LIBRARY_PATH: built.directory, LD_LIBRARY_PATH: built.directory }
  });
