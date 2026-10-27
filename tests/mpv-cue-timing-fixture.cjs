// Real adapter first-open and timer polling; libmpv bridge is an explicit native API fixture.
const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
let trace, rig, player, engines;
const observed = promise => Promise.resolve(promise).then(value => ({ value }), error => ({ error }));
const f = { assert, trace: () => trace,
  rig() {
    if (rig) return rig;
    rig = trace.call('rig-create', () => require('./mpv-engine.test.cjs').rig());
    const create = rig.Engine.create.bind(rig.Engine);
    rig.Engine.create = async (...args) => { const engine = await create(...args); engines.push(engine); return engine; };
    for (const [key, phase] of [['create', 'native-create'], ['snapshot', 'native-snapshot'], ['command', 'native-command']]) {
      const original = rig.bridge[key].bind(rig.bridge);
      rig.bridge[key] = async (...args) => trace.call(phase, async () => {
        if ((key === 'create' && process.argv.includes('--native-mpv-cue-init-failure')) || (key === 'snapshot' && process.argv.includes('--native-mpv-cue-snapshot-init-failure'))) throw Object.assign(Error('injected native MPV cue ' + key + ' failure'), { code: 'EIO', contractInjected: true });
        return original(...args);
      });
    }
    return rig;
  },
  async open(start, end, position = 2500.49) {
    const r = this.rig(); Object.assign(r.value, { subtitleEvents: 'Dialogue: 0,0:00:00.00,0:00:04.00,Default,,0,0,0,,cue', subtitleFontSize: 8, subtitleOverflow: false, subtitleStart: start, subtitleEnd: end, position });
    r.value.tracks.find(t => t.kind === 'sub').codec = 'subrip';
    const result = await observed(r.open()); player = result.value; return { ...result, state: player?.state };
  },
  snapshot() { const r = this.rig(); return { packet: r.events.filter(e => e[0] === 'subtitle').at(-1)?.[1], count: r.events.filter(e => e[0] === 'subtitle').length, errors: r.events.filter(e => e[0] === 'error'), creates: r.calls.filter(c => c[0] === 'create').length, reads: r.calls.filter(c => c[0] === 'snapshot').length }; },
  run: tests => common.run(tests.map(test => ({ ...test, async action(check) { try { await test.action(check); } finally { for (const engine of engines) await engine.release(); } } })), 'mpv-cue-timing',
    async () => { trace = common.external('mpv-cue-timing', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); rig = player = undefined; engines = []; if (process.argv.includes('--fault=setup')) assert.fail('unrelated cue timing setup assertion'); }, async () => {}, () => trace.healthy())
};
module.exports = f;
