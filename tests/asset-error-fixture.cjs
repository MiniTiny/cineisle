// Actual AppLock/SessionStore public operations. Asset is an explicit OS fixture.
const assert = require('node:assert/strict'), crypto = require('node:crypto'), common = require('./contract-external.cjs');
const { fixture } = require('./resource-cache-result.cjs');
const h = require('./feature-regression.test.cjs'), { AppLock: L } = h.load('service/AppLock.ets'), { SessionStore: S } = h.load('service/SessionStore.ets');
const api = h.platform.get('@ohos.security.asset'), strings = h.load('utils/Strings.ets');
const original = { query: api.query, remove: api.remove, errorCode: Object.getOwnPropertyDescriptor(api, 'ErrorCode') };
const root = 'cineisle.current.session', pin = 'cineisle.app.lock.v1', part = 'cineisle.sessions.asset-fixture.0', encode = value => new TextEncoder().encode(JSON.stringify(value));
const salt = Buffer.from(Array.from({ length: 16 }, (_, i) => i)), secret = { version: 1, iterations: 210000, salt: [...salt], hash: [...crypto.pbkdf2Sync('123456', salt, 210000, 32, 'sha256')] };
const session = { server: 'https://fixture.invalid', serverId: 'server', userId: 'user', userName: 'Fixture', token: 'fixture-token', deviceId: 'fixture-device' };
let trace, armed, target, targetAlias, scenario;
const nativeFailure = phase => { if (armed && process.argv.includes('--native-' + phase + '-init-failure')) throw Object.assign(Error('injected Asset ' + phase + ' body failure'), { code: 'EIO', contractInjected: true }); };
const bytes = () => [...h.assets].map(([key, value]) => [key, Buffer.from(value).toString('base64')]);
const f = { assert, trace: () => trace,
  async invoke(operation, value) {
    target = operation.endsWith('query') ? 'query' : 'remove'; scenario = value;
    const alias = operation.startsWith('lock') ? pin : root; targetAlias = alias;
    await fixture('asset-precondition', async () => {
      if (operation.startsWith('lock')) { h.assets.set(pin, encode(secret)); await L.initialize(); assert.equal(L.enabled, true); assert.equal(L.locked, true); }
      else { h.assets.set(root, encode({ version: 2, generation: 'asset-fixture', parts: 1 })); h.assets.set(part, encode({ version: 2, accounts: [session], servers: [{ id: 'server', name: '', addresses: [session.server], preferred: session.server }], active: 'server_user' })); }
    });
    const before = bytes(); trace.call('entry', () => {}); armed = true; let result, error;
    try {
      if (operation === 'lock-query') result = await L.initialize();
      else if (operation === 'lock-remove') result = await L.configure('123456', '');
      else if (operation === 'session-query') result = await S.load();
      else result = await S.reset();
    } catch (e) { if (e?.code === 'ERR_RESOURCE_FIXTURE') throw e; error = e; }
    return { result, error, message: error && strings.errorText(error), before, after: bytes(), alias, calls: { ...trace.calls }, events: [...trace.events], locked: L.locked, enabled: L.enabled, fault: L.fault, initialized: L.initialized, stored: h.assets.has(alias), partStored: h.assets.has(part) };
  },
  run: tests => common.run(tests, 'asset-error', () => {
    h.reset(); L.secret = undefined; L.initialization = undefined; L.failures = 0; L.blockedUntil = 0; S.work = Promise.resolve(); armed = false; target = undefined; scenario = undefined;
    const resources = Object.fromEntries(require('../entry/src/main/resources/base/element/string.json').string.map(v => [v.name, v.value])); strings.initializeStrings({ getStringByNameSync: name => resources[name] });
    trace = common.external('asset-error', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8));
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated Asset fixture setup');
    for (const phase of ['query', 'remove']) api[phase] = async attrs => {
      const alias = new TextDecoder().decode(attrs.get('alias'));
      const response = await trace.call('asset-' + phase, async () => {
        if (armed && target === phase && alias === targetAlias) nativeFailure(phase);
        if (armed && target === phase && alias === targetAlias && scenario !== 'success') {
          // Expected native business errors are delivered outside the unrelated-failure observer.
          if (phase === 'remove' && scenario === 24000002) h.assets.delete(alias);
          return { expected: scenario === 'missing-code' ? Error('expected missing code') : scenario === 'general' ? Object.assign(Error('expected general failure'), { code: 'EIO' }) : Object.assign(Error('expected Asset business error'), { code: scenario }) };
        }
        return { result: await original[phase](attrs) };
      }, { alias });
      if (response.expected) throw response.expected;
      return response.result;
    };
    Object.defineProperty(api, 'ErrorCode', { configurable: true, value: Object.defineProperty({}, 'NOT_FOUND', { get: () => trace.call('enum-read', () => { nativeFailure('enum'); return 24000002; }, { value: 24000002 }) }) });
  }, () => { api.query = original.query; api.remove = original.remove; if (original.errorCode) Object.defineProperty(api, 'ErrorCode', original.errorCode); else delete api.ErrorCode; }, () => trace.healthy())
};
module.exports = f;
