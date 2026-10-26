const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), common = require('./contract-external.cjs');
exports.make = () => {
  const built = require('./native-entry-build.cjs').build({ assErrors: true }), n = built.native, font = path.join(built.directory, 'font.fixture'); fs.writeFileSync(font, 'explicit fixture, not a font');
  const initFailure = process.argv.includes('--native-init-failure'); let trace, handles;
  const configure = (mode, message) => trace.call('error-configure', () => n.configureError(mode, message, initFailure));
  const attempt = async operation => {
    try { return { value: await operation() }; }
    catch (error) {
      if (initFailure && error.message === 'ass_memory_unavailable') throw Object.assign(Error(error.message, { cause: error }), { code: 'EIO', contractInjected: true });
      return { error: error.message };
    }
  };
  const f = { assert, trace: () => trace,
    async invoke(mode, message) {
      let handle;
      try {
        const create = async () => {
          const result = await attempt(() => n.create('doc', font, '')); if (result.value) handles.push(result.value); return result;
        };
        if (mode === 'lower') return { result: await trace.call('core-code', () => n.coreErrorCode(message)) };
        if (mode === 'sync-render' || mode === 'sync-close' || mode === 'async-render') {
          const created = await trace.call('native-create', create); if (created.error) throw Error('unexpected setup create: ' + created.error); handle = created.value;
        }
        configure(mode, message);
        let result;
        if (mode.endsWith('create')) result = await trace.call('native-create', create);
        else if (mode.endsWith('render')) result = await trace.call('native-render', () => attempt(() => n.render(handle, 0, 1, 1, 1, 1)));
        else result = await trace.call('native-close', () => attempt(() => n.close(handle)));
        return { result: result.error, inspection: n.inspectError() };
      } catch (unexpected) { return { unexpected }; }
    },
    run: tests => common.run(tests, 'ass-error-contract', () => {
      trace = common.external('ass-error-contract', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); handles = []; n.configureError('', '', initFailure);
      if (process.argv.includes('--fault=setup')) assert.fail('unrelated ASS error setup assertion');
    }, () => { n.configureError('', '', false); for (const handle of handles) n.close(handle); }, () => trace.healthy()).finally(() => built.cleanup())
  };
  return f;
};
