const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), common = require('./contract-external.cjs');
exports.make = () => {
  const built = require('./native-entry-build.cjs').build({ assTimestamp: true }), n = built.native, font = path.join(built.directory, 'font.fixture'); fs.writeFileSync(font, 'explicit font-file API fixture');
  const initFailure = process.argv.includes('--native-init-failure'), readFailure = process.argv.includes('--native-read-init-failure'); let trace, handles;
  const attempt = async (operation, details = {}) => {
    let result;
    try { result = { value: await operation() }; } catch (error) { result = { error: error.message }; }
    const state = n.timestampState();
    Object.assign(details, { reads: state.reads, numberFailures: state.numberFailures, libraryFailures: state.libraryFailures, actualError: result.error || '' });
    if ((initFailure && state.libraryFailures > 0) || (readFailure && state.numberFailures > 0)) {
      // The independent API body observation remains invalid even if a product
      // guard is removed and the unrelated dependency failure is swallowed.
      throw Object.assign(Error('actual ASS API failure: ' + (result.error || 'status swallowed')), { code: 'EIO', contractInjected: true });
    }
    return result;
  };
  const f = { assert, trace: () => trace,
    async invoke(layer, value) {
      try {
        trace.call('entry', () => {});
        const details = {};
        if (layer === 'lower') return { result: await trace.call('core-integer', () => attempt(() => n.coreTimestamp(value), details), details), inspection: n.timestampState() };
        const creation = {};
        const created = await trace.call('native-create', () => attempt(() => n.create('doc', font, ''), creation), creation);
        if (created.error) throw Error('unexpected create failure: ' + created.error); handles.push(created.value);
        const result = await trace.call('native-render', () => attempt(() => n.render(created.value, value, 1, 1, 1, 1), details), details);
        return { result, inspection: n.timestampState() };
      } catch (unexpected) { return { unexpected }; }
    },
    run: tests => common.run(tests, 'ass-timestamp', () => {
      trace = common.external('ass-timestamp', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); handles = []; n.configureTimestamp(initFailure, readFailure);
      if (process.argv.includes('--fault=setup')) assert.fail('unrelated ASS timestamp setup failure');
    }, () => { for (const handle of handles) n.close(handle); }, () => trace.healthy()).finally(() => built.cleanup())
  };
  return f;
};
