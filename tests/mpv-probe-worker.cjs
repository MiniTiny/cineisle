// A fresh compiler/child process per mutation prevents library/module caches from
// changing which production source is exercised. No mutation is made here.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const options = JSON.parse(process.argv[2]), output = process.argv[3];
let built, result;
try {
  if (options.kind === 'native') {
    built = require('./native-mpv-build.cjs').build(); result = require('./native-mpv-run.cjs').run(built, options);
  } else {
    const file = { adapter: 'mpv-engine.test.cjs', factory: 'engine-preferences.test.cjs' }[options.kind];
    if (!file) throw Error('Unknown MPV probe kind');
    result = spawnSync(process.execPath, [path.join(__dirname, file), options.name], {
      cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024
    });
  }
} catch (error) { result = { status: 1, error: { code: 'MPV_PROBE_BUILD_FAILED', message: error.message }, stdout: '', stderr: error.stack }; }
finally { built?.cleanup(); }
fs.writeFileSync(output, JSON.stringify({ status: result.status, signal: result.signal,
  error: result.error ? { code: result.error.code, message: result.error.message } : undefined,
  stdout: result.stdout || '', stderr: result.stderr || '' }, null, 2) + '\n');
