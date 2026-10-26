// Real Player/Controller/AppService/cache/outbox; native AV and disk failures are explicit API fixtures.
const path = require('node:path'), common = require('./contract-external.cjs');
const helpers = require('./offline-progress.test.cjs'), { h } = helpers, { AppService: A } = h;
const { offlineStopState } = h.load('utils/OfflinePlayback.ts'), io = h.platform.get('@ohos.file.fs'), media = h.platform.get('@ohos.multimedia.media');
const originals = Object.fromEntries(['openSync', 'closeSync', 'writeSync', 'fsyncSync', 'renameSync'].map(k => [k, io[k]])), create = media.createAVPlayer, stop = A.recordOfflineStop;
let trace, pages, names, inStop;
const phase = (name, filename, operation) => inStop && filename === 'experience.json.tmp' ? trace.call(name, operation, { filename }) : operation();
const nativeFailure = (flag, filename) => {
  if (inStop && filename === 'experience.json.tmp' && process.argv.includes('--native-offline-' + flag + '-init-failure')) throw Object.assign(Error('injected offline stop native file ' + flag + ' failure'), { code: 'EIO', contractInjected: true });
};
const observe = fn => { try { return { value: fn() }; } catch (error) { return { error }; } };
function snapshot() {
  const cold = helpers.cold(), positions = cold.pending.positions.find(p => p.id === 'movie'), played = cold.pending.pending.find(p => p.id === 'movie' && p.field === 'played');
  return { ticks: helpers.ticks(), libraryPlayed: cold.library.items.find(p => p.Id === 'movie')?.UserData?.Played, played: played?.value, pairedRevision: played?.revision === positions?.revision, playedRevision: played?.revision, positionRevision: positions?.revision };
}
const f = { assert: require('node:assert/strict'), h, A, helpers, trace: () => trace, offlineStopState, observe, snapshot,
  async invoke(mode, position, duration) {
    if (mode === 'lower') return { result: offlineStopState(position, duration) };
    const { route } = helpers.setup();
    if (mode === 'facade') { const result = observe(() => A.recordOfflineStop(route.item, position, duration)); return { error: result.error, ...snapshot() }; }
    const { p, n } = await helpers.start(route); pages.push(p); n.duration = duration; n.emit('timeUpdate', position); await h.settle();
    const checkpoint = p.controller.snapshot().checkpoint; await helpers.leave(p); return { checkpoint, report: p.reportMessage, ...snapshot() };
  },
  run: tests => common.run(tests, 'offline-stop-contract', async () => {
    h.reset(); h.load('utils/Strings.ets').initializeStrings({ getStringByNameSync: name => name + ':' });
    trace = common.external('offline-stop-contract', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); pages = []; names = new Map(); inStop = false;
    if (process.argv.includes('--fault=setup')) f.assert.fail('unrelated offline stop setup assertion');
    media.createAVPlayer = async () => trace.call('av-create', async () => {
      if (process.argv.includes('--native-init-failure')) throw Object.assign(Error('injected native AV initializer failure'), { code: 'EIO', contractInjected: true }); return create();
    });
    A.recordOfflineStop = (...args) => { trace.call('record-stop', () => {}); const previous = inStop; inStop = true; try { return stop.apply(A, args); } finally { inStop = previous; } };
    io.openSync = (filename, flags) => { const file = originals.openSync(filename, flags); names.set(file.fd, path.basename(filename)); return file; };
    io.closeSync = file => { const value = originals.closeSync(file); names.delete(file.fd); return value; };
    io.writeSync = (...args) => phase('file-write', names.get(args[0]), () => { nativeFailure('write', names.get(args[0])); return originals.writeSync(...args); });
    io.fsyncSync = (...args) => phase('file-sync', names.get(args[0]), () => { nativeFailure('sync', names.get(args[0])); return originals.fsyncSync(...args); });
    io.renameSync = (...args) => phase('file-rename', path.basename(args[0]), () => { nativeFailure('rename', path.basename(args[0])); return originals.renameSync(...args); });
  }, async () => { for (const p of pages) await helpers.leave(p); media.createAVPlayer = create; Object.assign(io, originals); A.recordOfflineStop = stop; }, () => trace.healthy())
};
module.exports = f;
