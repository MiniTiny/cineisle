// Real NativeHttpTransport public entries and JellyfinClient -> generated API.
const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
const h = require('./feature-regression.test.cjs'), { NativeHttpTransport: Transport } = h.load('api/NativeHttpTransport.ets'), { JellyfinClient } = h.load('service/JellyfinClient.ets'), strings = h.load('utils/Strings.ets');
const api = h.platform.get('@ohos.net.http'), original = api.createHttp;
let trace, requests, routes, endpoints, recovery, input, expected;
const nativeFailure = phase => { if (process.argv.includes('--native-' + phase + '-init-failure')) throw Object.assign(Error('injected HTTP ' + phase + ' body failure'), { code: 'EIO', contractInjected: true }); };
const f = { assert, trace: () => trace,
  async invoke(entry, code, recoveryMode = '') {
    recovery = recoveryMode;
    input = code; expected = Error('expected native request failure'); if (code !== undefined) expected.code = code;
    const session = { server: 'https://fixture.invalid', serverId: '', token: '', userId: '', deviceId: 'fixture-device', addresses: ['https://fixture.invalid'] };
    if (recovery) { session.server = 'https://primary.invalid'; session.serverId = 'same'; session.token = 'fixture-recovery-token'; session.addresses = ['https://primary.invalid', 'https://backup.invalid']; }
    const transport = new Transport(session); transport.endpointChanged = address => endpoints.push(address); trace.call('entry', () => {}); let error, value;
    try { if (entry === 'client') value = await new JellyfinClient(session).publicUsers(); else if (entry === 'text') value = await transport.text('/Users/Public', 'GET', [], ''); else value = await transport.request(recovery ? '/Items/movie' : '/Users/Public', entry === 'write' ? 'POST' : 'GET', [], ''); } catch (e) { error = e; }
    return { error, same: error === expected, value, message: error && strings.errorText(error), calls: { ...trace.calls }, requests: [...requests], routes: [...routes], endpoints: [...endpoints], server: session.server };
  },
  run: tests => common.run(tests, 'native-http-error', () => {
    h.reset(); const network = h.load('utils/NetworkOptions.ts'); network.NetworkPolicy.publish(new network.NetworkOptions()); network.NetworkPolicy.networkAvailable = () => true; requests = []; routes = []; endpoints = []; recovery = ''; input = undefined; expected = undefined;
    const resources = Object.fromEntries(require('../entry/src/main/resources/base/element/string.json').string.map(v => [v.name, v.value])); strings.initializeStrings({ getStringByNameSync: name => resources[name] });
    trace = common.external('native-http-error', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8));
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated HTTP error fixture setup');
    api.createHttp = () => trace.call('http-create', () => {
      nativeFailure('create'); return {
        async request(url, options) {
          const reply = await trace.call('http-request', () => { nativeFailure('request'); const parsed = new URL(url); requests.push({ path: parsed.pathname, method: options.method }); routes.push(parsed.origin + parsed.pathname + ':' + options.method); if (recovery && parsed.origin === 'https://backup.invalid') return { response: { responseCode: 200, result: parsed.pathname === '/System/Info/Public' ? JSON.stringify({ Id: recovery === 'wrong' ? 'other' : 'same' }) : '[]' } }; return input === 'success' ? { response: { responseCode: 200, result: '[]' } } : { expected }; });
          // A deliberate SDK business error is outside unrelated API-failure tracking.
          if (reply.expected) throw reply.expected; return reply.response;
        },
        destroy: () => trace.call('http-destroy', () => { nativeFailure('destroy'); })
      };
    });
  }, () => { api.createHttp = original; }, () => trace.healthy())
};
module.exports = f;
