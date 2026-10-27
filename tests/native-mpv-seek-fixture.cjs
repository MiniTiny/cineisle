// Host compilation runs the production bridge. Only libmpv is controlled here.
const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
exports.host = file => {
  const built = require('./native-mpv-build.cjs').build();
  try {
    const raw = require('node:child_process').spawnSync(process.execPath, [file, process.argv[2] || '', ...process.argv.slice(3), '--child', built.addon], {
      cwd: built.root, encoding: 'utf8', timeout: 45000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, UV_THREADPOOL_SIZE: '32', DYLD_LIBRARY_PATH: built.directory, LD_LIBRARY_PATH: built.directory }
    });
    process.stdout.write(raw.stdout || ''); process.stderr.write(raw.stderr || '');
    if (raw.error || raw.signal || raw.status === null) throw raw.error || Error('native seek child process failed: ' + raw.signal);
    process.exitCode = raw.status;
  } finally { built.cleanup(); }
};
exports.make = () => {
  const n = require(process.argv[process.argv.indexOf('--child') + 1]);
  const initFailure = process.argv.includes('--native-init-failure'), commandFailure = process.argv.includes('--native-seek-command-init-failure');
  let trace, handles;
  const configure = options => n.configure({ failInitialize: initFailure, failSeekCommand: commandFailure, ...options });
  const native = async (phase, operation, expected) => trace.call(phase, async () => {
    try { return await operation(); }
    catch (error) {
      // The flag makes the actual libmpv function return failure. Annotation is
      // independent of this observer and only accepts that native error identity.
      if (expected && error.message === expected) throw Object.assign(Error(error.message, { cause: error }), { code: 'EIO', contractInjected: true });
      throw error;
    }
  });
  const f = { assert, trace: () => trace,
    async scenario(layer, action) {
      try {
        const handle = await native('native-create', () => n.create({ api: 15, source: 'fixture://movie', surface: '1' }), initFailure && 'mpv_initialize_failed'); handles.push(handle);
        const seek = value => native('native-command', () => layer === 'core' ? n.coreSeek(handle, value) : n.command(handle, { type: 'seek', value }), commandFailure && 'mpv_command_failed');
        const snapshot = () => native('native-snapshot', () => layer === 'core' ? n.coreSnapshot(handle) : n.snapshot(handle));
        await seek(5000);
        return { value: await action({ seek, snapshot, configure, inspect: () => n.inspect() }) };
      } catch (error) { return { error }; }
    },
    run: tests => common.run(tests, 'native-mpv-seek', () => {
      trace = common.external('native-mpv-seek', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); handles = []; n.reset(); configure({});
      if (process.argv.includes('--fault=setup')) assert.fail('unrelated native seek setup failure');
    }, async () => { for (const handle of handles) await n.release(handle); assert.equal(n.inspect().active, 0); assert.equal(n.inspect().live, 0); }, () => trace.healthy())
  };
  return f;
};
