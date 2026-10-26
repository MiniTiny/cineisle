const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), common = require('./contract-external.cjs');
const h = require('./feature-regression.test.cjs'), metadata = h.load('utils/DetailPresentation.ets').detailMetadata, strings = h.load('utils/Strings.ets');
const originalRead = fs.readFileSync; let trace, directories;
function ui() { const details = {}; return trace.call('ui-compile', () => {
  const injected = process.argv.includes('--native-sdk-init-failure'), before = process.env.DEVECO_SDK_HOME;
  if (injected) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-missing-sdk-')); directories.push(directory); process.env.DEVECO_SDK_HOME = path.join(directory, 'not-installed'); delete require.cache[require.resolve('./deveco-runtime.cjs')]; delete require.cache[require.resolve('./brand-forms.test.cjs')]; }
  try { return require('./brand-forms.test.cjs'); } catch (cause) { if (!injected) throw cause; details.originalCode = cause.code; throw Object.assign(Error('actual SDK initialization failed'), { code: 'EIO', contractInjected: true, cause }); }
  finally { if (injected) { if (before === undefined) delete process.env.DEVECO_SDK_HOME; else process.env.DEVECO_SDK_HOME = before; delete require.cache[require.resolve('./deveco-runtime.cjs')]; delete require.cache[require.resolve('./brand-forms.test.cjs')]; } }
}, details); }
const item = (width = 1, height = 1, size, ticks) => ({ Id: 'movie', Name: 'Fixture movie', Type: 'Movie', RunTimeTicks: ticks, MediaSources: [{ Id: 'source', Size: size, MediaStreams: [{ Type: 'Video', Width: width, Height: height }] }] });
const f = { assert, h, item,
  invoke(mode, value, sourceId = 'source') { try {
    trace.call('entry', () => {});
    if (mode === 'helper') { const result = metadata(value, sourceId); return { value: { chips: result.chips, summary: result.summary, rows: result.rows, actors: result.actors } }; }
    const compiled = ui(), form = trace.call('ui-render', () => compiled.render(mode === 'panel' ? 'DetailMetadataPanel' : 'Detail', { item: value, sourceId, extraInfo: true, sources: value.MediaSources || [] })), nodes = compiled.flat(form.roots);
    const chips = nodes.filter(n => n.type === 'Text' && n.attrs.fontSize?.[0] === 12 && n.attrs.padding?.[0]?.left === 12 && n.attrs.padding?.[0]?.top === 6).map(n => n.args[0]);
    const rows = nodes.filter(n => n.type === 'Flex' && n.children.some(c => c.type === 'Text' && typeof c.args[0] === 'string' && c.args[0].startsWith('detail_'))).map(n => { const text = n.children.filter(c => c.type === 'Text'); return { key: text[0].args[0].slice(7), value: text[1]?.args[0] }; });
    return { value: { chips, summary: nodes.filter(n => n.type === 'Text' && typeof n.args[0] === 'string' && n.args[0].startsWith('runtime_minutes:')).map(n => n.args[0]).join(''), rows, message: form.view.message, events: form.events } };
  } catch (unexpected) { return { unexpected }; } },
  run: tests => common.run(tests, 'detail-presentation', () => {
    h.reset(); strings.initializeStrings({ getStringByNameSync: (key, ...args) => [key, ...args].join(':') }); directories = []; trace = common.external('detail-presentation', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8));
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated metadata setup');
    fs.readFileSync = (...args) => { if (typeof args[0] !== 'string' || !args[0].endsWith('/utils/JellyfinTime.ts')) return originalRead(...args); const details = {}; return trace.call('unit-read', () => { const injected = process.argv.includes('--native-unit-init-failure'); let actual = args; if (injected) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-unit-read-')); directories.push(directory); actual = [directory, ...args.slice(1)]; } try { return originalRead(...actual); } catch (cause) { if (!injected) throw cause; details.originalCode = cause.code; throw Object.assign(Error('actual time unit module read failed'), { code: 'EIO', contractInjected: true, cause }); } }, details); };
  }, () => { fs.readFileSync = originalRead; for (const directory of directories) fs.rmSync(directory, { recursive: true, force: true }); }, () => trace.healthy())
};
module.exports = f;
