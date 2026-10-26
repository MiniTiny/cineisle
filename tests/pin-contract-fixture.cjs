const assert = require('node:assert/strict'), crypto = require('node:crypto'), common = require('./contract-external.cjs');
const h = require('./feature-regression.test.cjs'), { AppLock: A } = h.load('service/AppLock.ets'), policy = h.load('utils/LockPolicy.ts').AppLockPolicy;
const api = h.platform.get('@ohos.security.cryptoFramework'), asset = h.platform.get('@ohos.security.asset');
const original = { random: api.createRandom, kdf: api.createKdf, add: asset.add, query: asset.query, remove: asset.remove, configure: A.configure, unlock: A.unlock };
const alias = 'cineisle.app.lock.v1'; let trace, specs;
const nativeFailure = phase => { if (process.argv.includes('--native-' + phase + '-init-failure')) throw Object.assign(Error('injected native ' + phase + ' failure'), { code: 'EIO', contractInjected: true }); };
const observe = async action => { try { return { value: await action() }; } catch (error) { return { error }; } };
async function legacy(pin = '123456') {
  const salt = Buffer.from(Array.from({ length: 16 }, (_, i) => i));
  h.assets.set(alias, new TextEncoder().encode(JSON.stringify({ version: 1, iterations: 210000, salt: [...salt], hash: [...crypto.pbkdf2Sync(pin, salt, 210000, 32, 'sha256')] })));
  await A.initialize();
}
function snapshot() { return { enabled: A.enabled, locked: A.locked, stored: h.assets.has(alias) ? JSON.parse(new TextDecoder().decode(h.assets.get(alias))) : undefined, specs: [...specs], calls: { ...trace.calls }, events: [...trace.events] }; }
const f = { assert, h, A, policy, trace: () => trace, legacy, snapshot,
  async invoke(mode, pin, old = '123456') {
    try {
      if (mode === 'policy') return { accepted: policy.pinPattern.test(pin) };
      if (mode === 'facade') return { ...await observe(() => A.configure('', pin)), ...snapshot() };
      await legacy(old);
      const ui = trace.call('ui-compile', () => require('./brand-forms.test.cjs'));
      const strings = h.load('utils/Strings.ets');
      if (mode === 'settings') {
        const form = ui.render('Settings', { appLock: A, strings, protected: true, currentPin: old, nextPin: pin, confirmation: pin });
        const fields = ui.flat(form.roots).filter(n => n.type === 'TextInput' && n.attrs.type?.[0] === 2);
        const save = ui.button(form, 'lock_save'), available = save.attrs.enabled[0]; save.attrs.onClick[0]();
        const end = Date.now() + 4000; while (form.view.busy) { assert.ok(Date.now() < end, 'SDK settings callback did not finish'); await new Promise(setImmediate); }
        return { ...snapshot(), message: form.view.message, available, busy: form.view.busy, cleared: [form.view.currentPin, form.view.nextPin, form.view.confirmation], limits: fields.map(n => n.attrs.maxLength[0]) };
      }
      const form = ui.render('PinGate', { appLock: A, strings, pin }), field = ui.flat(form.roots).find(n => n.type === 'TextInput'), button = ui.button(form, 'lock_unlock');
      const available = button.attrs.enabled[0]; await field.attrs.onSubmit[0]();
      return { ...snapshot(), message: form.view.message, busy: form.view.busy, pin: form.view.pin, available, limit: field.attrs.maxLength[0] };
    } catch (unexpected) { return { unexpected }; }
  },
  run: tests => common.run(tests, 'pin-contract', () => {
    h.reset(); A.secret = undefined; A.failures = 0; A.blockedUntil = 0; A.backgroundAt = 0; A.initialization = undefined;
    h.load('utils/Strings.ets').initializeStrings(h.context.resourceManager);
    trace = common.external('pin-contract', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); specs = [];
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated PIN setup assertion');
    api.createRandom = () => trace.call('random-create', () => { nativeFailure('random-create'); const random = original.random(); return { generateRandom: size => trace.call('random-generate', () => random.generateRandom(size)) }; });
    api.createKdf = algorithm => trace.call('kdf-create', () => { nativeFailure('kdf-create'); const kdf = original.kdf(algorithm); return { generateSecret: spec => trace.call('kdf-secret', () => { specs.push({ algorithm, ...spec, salt: [...spec.salt] }); return kdf.generateSecret(spec); }) }; });
    asset.add = attrs => trace.call('asset-add', () => { nativeFailure('asset-add'); return original.add(attrs); });
    asset.query = attrs => trace.call('asset-query', () => { nativeFailure('asset-query'); return original.query(attrs); });
    asset.remove = attrs => trace.call('asset-remove', () => original.remove(attrs));
    A.configure = (...args) => { trace.call('configure', () => {}); return original.configure.apply(A, args); };
    A.unlock = (...args) => { trace.call('unlock', () => {}); return original.unlock.apply(A, args); };
  }, () => { api.createRandom = original.random; api.createKdf = original.kdf; asset.add = original.add; asset.query = original.query; asset.remove = original.remove; A.configure = original.configure; A.unlock = original.unlock; }, () => trace.healthy())
};
module.exports = f;
