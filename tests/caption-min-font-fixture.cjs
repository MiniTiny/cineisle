const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
exports.make = () => {
  const built = require('./native-entry-build.cjs').build({ captionLayout: true, captionInput: true }), n = built.native;
  let trace; const readFailure = process.argv.includes('--native-read-init-failure'), fontFailure = process.argv.includes('--native-font-init-failure'), styleFailure = process.argv.includes('--native-style-init-failure');
  const f = { assert, trace: () => trace,
    request(size) { return { width: 100, maxLines: 2, intrinsic: false, runs: [{ text: 'M', family: '', size, baseline: 0, color: 0xffffffff, bold: false, italic: false, underline: false, strike: false }], shadows: [] }; },
    async invoke(layer, request) {
      try {
        trace.call('entry', () => {}); const details = {};
        return await trace.call(layer === 'lower' ? 'core-read' : 'native-caption', async () => {
          let result; try { result = { value: await (layer === 'lower' ? n.readCaptionInput(request) : n.renderCaption(request)) }; } catch (error) { result = { error: error.message }; }
          const inspection = n.captionInputState(); Object.assign(details, { invalidReads: inspection.invalidReads,
            unexpectedNumberFailures: inspection.unexpectedNumberFailures, originalNumberReads: inspection.originalNumberReads, actualError: result.error || '' });
          if (inspection.fontFailures > 0) trace.call('font-collection', () => {
            throw Object.assign(Error('actual drawing font collection initialization failed'), { code: 'EIO', contractInjected: fontFailure });
          }, { fontCalls: inspection.fontCalls, fontFailures: inspection.fontFailures, actualError: result.error || '' });
          if (inspection.unexpectedNumberFailures > 0) throw Object.assign(Error('actual caption N-API number read failed'), { code: 'EIO', contractInjected: readFailure });
          // Only argument rejection and the intentional end-of-budget sentinel
          // are business outcomes in these fixed, otherwise valid requests.
          if (result.error && !['caption_argument_invalid', 'caption_fixture_budget_admitted'].includes(result.error)) trace.call('drawing-result', () => {
            throw Object.assign(Error('unexpected caption drawing dependency failure'), { code: 'EIO', contractInjected: styleFailure && inspection.styleFailures > 0 });
          }, { fontCalls: inspection.fontCalls, fontFailures: inspection.fontFailures, styleCalls: inspection.styleCalls, styleFailures: inspection.styleFailures, actualError: result.error });
          return { result, inspection };
        }, details);
      } catch (unexpected) { return { unexpected }; }
    },
    run: tests => common.run(tests, 'caption-min-font', () => {
      trace = common.external('caption-min-font', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); n.configureCaptionInput(readFailure, fontFailure, styleFailure);
      if (process.argv.includes('--fault=setup')) assert.fail('unrelated caption font setup');
    }, () => {}, () => trace.healthy()).finally(() => built.cleanup())
  };
  return f;
};
