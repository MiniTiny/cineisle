// Production Session/N-API plus the real ArkTS polling/conversion path.
const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
exports.host = require('./native-mpv-seek-fixture.cjs').host;
exports.make = () => {
  const n = require(process.argv[process.argv.indexOf('--child') + 1]), { rig } = require('./mpv-engine.test.cjs');
  let trace, handles, players;
  const initFailure = process.argv.includes('--native-init-failure'), readFailure = process.argv.includes('--native-snapshot-init-failure');
  const packet = 'Dialogue: 0,0:00:00.50,0:00:03.50,Default,,0,0,0,,{\\fs110}Font';
  const configure = options => n.configure({ eventIds: [8, 21], positionSeconds: 1, trackCount: 1, subtitleTracks: true, codec: 'subrip', full: packet,
    subtitleStartSeconds: .5, subtitleEndSeconds: 3.5, failInitialize: initFailure, ...options });
  const native = (phase, action) => trace.call(phase, async () => {
    try { return await action(); }
    catch (cause) {
      if ((initFailure && phase === 'native-create' && cause.message === 'mpv_initialize_failed') ||
          (readFailure && phase === 'native-snapshot' && ['mpv_argument_invalid', 'mpv_closed'].includes(cause.message))) {
        throw Object.assign(Error('actual native font API failure: ' + cause.message, { cause }), { code: 'EIO', contractInjected: true });
      }
      throw cause;
    }
  });
  const release = async handle => { if (handles.delete(handle)) await n.release(handle); };
  const snapshot = (handle, layer) => native('native-snapshot', () => layer === 'core' ? n.coreSnapshot(readFailure ? {} : handle) : n.snapshot(readFailure ? {} : handle));
  const f = { assert, n, configure, trace: () => trace,
    async scenario(layer, options, action) {
      try {
        configure(options);
        const handle = await native('native-create', () => n.create({ api: 15, source: 'fixture://font', surface: '1' })); handles.add(handle);
        return { value: await action({ snapshot: () => snapshot(handle, layer), inspect: () => n.inspect(), configure }) };
      } catch (error) { return { error }; }
    },
    async engine(options, action) {
      try {
        configure(options); const r = rig(), snapshots = [];
        r.bridge.capability = api => native('native-capability', () => n.capability(api));
        r.bridge.create = request => native('native-create', async () => { const h = await n.create(request); handles.add(h); return h; });
        r.bridge.snapshot = async h => { const value = await snapshot(h, 'N-API'); snapshots.push(value); return value; };
        r.bridge.command = (h, value) => native('native-command', () => n.command(h, value));
        r.bridge.release = release;
        const p = await r.Engine.create('/cache'); players.push(p); p.bind(r.eventSink); p.url = 'fixture://font';
        await require('./mpv-engine.test.cjs').settle(); p.surfaceId = '1'; await p.prepare();
        return { value: await action({ r, p, snapshots, configure, inspect: () => n.inspect() }) };
      } catch (error) { return { error }; }
    },
    initialEngine: async () => { const r = rig(), p = await r.Engine.create('/cache'); players.push(p); return p; },
    run: tests => common.run(tests, 'native-mpv-font', () => {
      trace = common.external('native-mpv-font', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); handles = new Set(); players = []; n.reset();
      if (process.argv.includes('--fault=setup')) assert.fail('unrelated font fixture setup');
    }, async () => { for (const p of players) await p.release(); for (const h of [...handles]) await release(h); assert.equal(n.inspect().live, 0); assert.equal(n.inspect().active, 0); }, () => trace.healthy())
  };
  return f;
};
