const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
const h = require('./feature-regression.test.cjs'), { BackgroundLease: B } = h.load('service/BackgroundLease.ets'), strings = h.load('utils/Strings.ets');
const bg = h.platform.get('@ohos.resourceschedule.backgroundTaskManager'), wa = h.platform.get('@ohos.app.ability.wantAgent');
const original = { ...bg }, originalWA = { ...wa };
let trace, calls, agents, gates, pending, failure, hold;
const settle = async () => { for (let i = 0; i < 12; ++i) await new Promise(setImmediate); };
const nativeFailure = phase => { if (process.argv.includes('--native-' + phase + '-init-failure')) throw Object.assign(Error('injected background ' + phase + ' API body failure'), { code: 'EIO', contractInjected: true }); };
async function response(phase) { nativeFailure(phase); if (hold?.phase === phase) { const gate = hold.gate; hold = undefined; await gate.promise; } if (failure === phase) { failure = undefined; return { expected: Error('expected background ' + phase + ' failure') }; } return {}; }
const context = suffix => ({ abilityInfo: { bundleName: 'fixture.bundle.' + suffix, name: 'FixtureAbility' + suffix } });
const f = { assert, B, context, settle, calls: () => calls, agents: () => agents, trace: () => trace, fail: phase => { failure = phase; },
  gate(phase) { const gate = h.deferred(); gates.push(gate); hold = { phase, gate }; return gate; },
  set(ctx, mode, enabled) { trace.call('entry', () => {}); const promise = B.set(ctx, mode, enabled).then(value => ({ value }), error => ({ error, message: strings.errorText(error) })); pending.push(promise); return promise; },
  snapshot() { return { modes: [...B.modes], calls: calls.map(c => ({ ...c, info: c.info && JSON.parse(JSON.stringify(c.info)), mode: Array.isArray(c.mode) ? [...c.mode] : c.mode })), events: [...trace.events] }; },
  run: tests => common.run(tests, 'background-lease', () => {
    h.reset(); B.modes = new Set(); B.operations = Promise.resolve(); calls = []; agents = []; gates = []; pending = []; failure = undefined; hold = undefined;
    const resources = Object.fromEntries(require('../entry/src/main/resources/base/element/string.json').string.map(v => [v.name, v.value])); strings.initializeStrings({ getStringByNameSync: name => resources[name] });
    trace = common.external('background-lease', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8));
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated background lease setup');
    bg.BackgroundMode = { AUDIO_PLAYBACK: 2, DATA_TRANSFER: 1 }; wa.OperationType = { START_ABILITY: 1 }; wa.WantAgentFlags = { UPDATE_PRESENT_FLAG: 4 };
    wa.getWantAgent = async info => {
      const result = await trace.call('want-agent', async () => { calls.push({ phase: 'want', info }); const reply = await response('want'); if (reply.expected) return reply; const agent = { fixtureAgent: agents.length }; agents.push(agent); return { agent }; }, { requestCode: info.requestCode });
      if (result.expected) throw result.expected; return result.agent;
    };
    bg.startBackgroundRunning = async (ctx, mode, agent) => { const result = await trace.call('background-start', async () => { calls.push({ phase: 'start', ctx, mode, agent }); return response('start'); }); if (result.expected) throw result.expected; };
    bg.stopBackgroundRunning = async ctx => { const result = await trace.call('background-stop', async () => { calls.push({ phase: 'stop', ctx }); return response('stop'); }); if (result.expected) throw result.expected; };
  }, async () => { for (const gate of gates) gate.resolve(); await Promise.allSettled(pending); for (const key of Object.keys(bg)) if (!(key in original)) delete bg[key]; Object.assign(bg, original); for (const key of Object.keys(wa)) if (!(key in originalWA)) delete wa[key]; Object.assign(wa, originalWA); B.modes.clear(); B.operations = Promise.resolve(); }, () => trace.healthy())
};
module.exports = f;
