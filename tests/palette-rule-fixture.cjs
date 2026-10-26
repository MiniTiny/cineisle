// Public production paths stay real. Private loop-budget tests use an explicitly bounded contrast oracle.
const f = require('./wallpaper-contract-fixture.cjs'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require(path.join(require('./deveco-runtime.cjs').etsLoader, 'node_modules/typescript'));
const { wallpaperPalette } = f.h.load('utils/DynamicPalette.ts');
global.ColorFilter ??= class { constructor(matrix) { this.matrix = matrix; } };
let privateModule, observation;
function compile() {
  return f.trace().call('palette-compile', () => {
    let source = fs.readFileSync('entry/src/main/ets/utils/DynamicPalette.ts', 'utf8');
    for (const [old, replacement] of [
      ['function blend(a: string, b: string, weight: number): string {', 'function blend(a: string, b: string, weight: number): string { __observation.blends.push({target:b,weight});'],
      ['colorContrast(value, background)', '__readableContrast(value, background)'],
      ['colorContrast(fg, action)', '__actionContrast(fg, action)']
    ]) { f.assert.equal(source.split(old).length, 2, 'Private observation anchor must be unique'); source = source.replace(old, replacement); }
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} };
    // 34 failing comparisons followed by a passing comparison keeps a removed 32-step guard finite.
    const hook = "\nfunction __readableContrast(a,b){++__observation.readableComparisons;return __observation.forceReadable?(__observation.readableComparisons<=34?1:21):colorContrast(a,b);}" +
      "\nfunction __actionContrast(a,b){++__observation.actionComparisons;return __observation.forceAction?(__observation.actionComparisons<=34?1:21):colorContrast(a,b);}\nexports.privateReadable=readable;";
    vm.runInThisContext('(function(module,exports,__observation){' + js + hook + '\n})')(module, module.exports, observation);
    return module.exports;
  });
}
function resetObservation(options = {}) { Object.assign(observation, { blends: [], readableComparisons: 0, actionComparisons: 0, forceReadable: false, forceAction: false }, options); }
module.exports = { ...f, palette: wallpaperPalette,
  readable(color, force = false) { resetObservation({ forceReadable: force }); const value = privateModule.privateReadable(color, [force ? '#FFFFFF' : '#000000']); return { value, blends: observation.blends.map(b => ({ ...b })), comparisons: observation.readableComparisons }; },
  actionCap() { resetObservation({ forceAction: true }); privateModule.wallpaperPalette(f.colors()); return { blends: observation.blends.filter(b => b.target === '#000000').map(b => ({ ...b })), comparisons: observation.actionComparisons }; },
  ui: () => f.trace().call('ui-compile', () => require('./brand-forms.test.cjs')),
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) { observation = {}; resetObservation(); privateModule = compile(); await test.action(check); } })))
};
