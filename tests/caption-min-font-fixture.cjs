const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
exports.make = () => {
  const built = require('./native-entry-build.cjs').build({ captionLayout: true, captionInput: true }), n = built.native;
  let trace; const readFailure = process.argv.includes('--native-read-init-failure');
  const f = { assert, trace: () => trace,
    request(size) { return { width: 100, maxLines: 2, intrinsic: false, runs: [{ text: 'M', family: '', size, baseline: 0, color: 0xffffffff, bold: false, italic: false, underline: false, strike: false }], shadows: [] }; },
    async invoke(layer, request) {
      try {
        trace.call('entry', () => {}); const details = {};
        return await trace.call(layer === 'lower' ? 'core-read' : 'native-caption', async () => {
          let result; try { result = { value: await (layer === 'lower' ? n.readCaptionInput(request) : n.renderCaption(request)) }; } catch (error) { result = { error: error.message }; }
          const inspection = n.captionInputState(); Object.assign(details, { invalidReads: inspection.invalidReads, actualError: result.error || '' });
          if (readFailure && inspection.invalidReads > 0) throw Object.assign(Error('actual caption N-API number read failed'), { code: 'EIO', contractInjected: true });
          return { result, inspection };
        }, details);
      } catch (unexpected) { return { unexpected }; }
    },
    run: tests => common.run(tests, 'caption-min-font', () => {
      trace = common.external('caption-min-font', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); n.configureCaptionInput(readFailure);
      if (process.argv.includes('--fault=setup')) assert.fail('unrelated caption font setup');
    }, () => {}, () => trace.healthy()).finally(() => built.cleanup())
  };
  return f;
};
