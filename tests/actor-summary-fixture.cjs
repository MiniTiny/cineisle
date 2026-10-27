// Actual SDK Index/Actor builders. Business profiles and refresh stay in production Experience.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), common = require('./contract-external.cjs');
const h = require('./feature-regression.test.cjs'), { AppService: A } = h.load('service/AppService.ets'), { actorProfiles } = h.load('utils/Experience.ts');
const originalRead = fs.readFileSync;
let trace, directories;
function ui() {
  const details = {};
  return trace.call('ui-compile', () => {
    const injected = process.argv.includes('--native-sdk-init-failure'), before = process.env.DEVECO_SDK_HOME;
    if (injected) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-missing-sdk-')); directories.push(directory); process.env.DEVECO_SDK_HOME = path.join(directory, 'not-installed'); delete require.cache[require.resolve('./deveco-runtime.cjs')]; delete require.cache[require.resolve('./brand-forms.test.cjs')]; }
    try { return require('./brand-forms.test.cjs'); }
    catch (cause) { if (!injected) throw cause; details.originalCode = cause.code; throw Object.assign(Error('actual SDK loader initialization failed'), { code: 'EIO', contractInjected: true, cause }); }
    finally { if (injected) { if (before === undefined) delete process.env.DEVECO_SDK_HOME; else process.env.DEVECO_SDK_HOME = before; delete require.cache[require.resolve('./deveco-runtime.cjs')]; delete require.cache[require.resolve('./brand-forms.test.cjs')]; } }
  }, details);
}
const profile = (count, suffix = '') => ({ person: { Id: 'actor' + suffix, Name: 'Actor' + suffix }, works: [], watched: 0, unplayed: 0, favorite: 0, playCount: 0, lastViewed: 0, followed: false, newCount: 0, tags: Array.from({ length: count }, (_, i) => ({ key: 'genre:boundary' + suffix + i, title: 'boundary' + suffix + i, theme: false, works: [] })) });
const f = { assert, h, A, profile, actorProfiles, trace: () => trace,
  invoke(action) { try { return { value: action() }; } catch (unexpected) { if (unexpected?.code === 'ERR_RESOURCE_FIXTURE') throw unexpected; return { unexpected }; } },
  requireProfiles(profiles) { try { assert.equal(profiles.length, 1); assert.deepEqual(profiles[0].tags.map(t => t.key), ['genre:boundary0', 'genre:boundary1', 'genre:boundary2', 'genre:boundary3']); } catch (cause) { throw Object.assign(Error('actual profile fixture is incomplete'), { code: 'ERR_RESOURCE_FIXTURE', fixturePhase: 'actor-profile-seed', cause }); } return profiles; },
  render(name, overrides, scale = 1) { trace.call('entry', () => {}); const compiled = ui(); const form = trace.call('ui-render', () => compiled.render(name, overrides, scale)); return { compiled, form, buttons: compiled.flat(form.roots).filter(n => n.type === 'Button' && typeof n.attrs.accessibilityText?.[0] === 'string' && n.attrs.accessibilityText[0].startsWith('boundary')) }; },
  run: tests => common.run(tests, 'actor-summary', () => { h.reset(); directories = []; trace = common.external('actor-summary', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); if (process.argv.includes('--fault=setup')) assert.fail('unrelated actor summary setup');
    fs.readFileSync = (...args) => {
      if (typeof args[0] !== 'string' || !args[0].endsWith('/utils/ActorProfileRules.ts')) return originalRead(...args);
      const details = {};
      return trace.call('profile-rules-read', () => {
        const injected = process.argv.includes('--native-profile-rules-init-failure'); let actual = args;
        if (injected) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-rule-read-')); directories.push(directory); actual = [directory, ...args.slice(1)]; }
        try { return originalRead(...actual); } catch (cause) { if (!injected) throw cause; details.originalCode = cause.code; throw Object.assign(Error('actual rule module read failed'), { code: 'EIO', contractInjected: true, cause }); }
      }, details);
    };
  }, () => { fs.readFileSync = originalRead; for (const directory of directories) fs.rmSync(directory, { recursive: true, force: true }); }, () => trace.healthy())
};
module.exports = f;
