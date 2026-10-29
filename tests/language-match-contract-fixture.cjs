// Real normalization, Preferences persistence and PlaybackController; platform APIs are explicit fixtures.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const common = require('./contract-external.cjs'), h = require('./player-regression.test.cjs');
const ts = require(path.join(require('./deveco-runtime.cjs').contents, 'tools/hvigor/hvigor/node_modules/typescript'));
const rules = h.load('utils/PlaybackPreferences.ts'), { PlaybackPreferenceStore } = h.load('service/PlaybackPreferenceStore.ets');
const { PlaybackController } = h.load('service/PlaybackController.ets'), pref = h.preferencesPlatform;
const media = h.platform.get('@ohos.multimedia.media'), originalCreate = media.createAVPlayer, originalOpen = pref.api.getPreferences;
let trace, privateScore;
function compileScore() {
  return trace.call('score-compile', () => {
    const source = fs.readFileSync('entry/src/main/ets/utils/PlaybackPreferences.ts', 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    // Observe the real private function without changing product visibility or its body.
    const module = { exports: {} };
    vm.runInThisContext('(function(module,exports){' + js + '\nexports.score = languageScore;})')(module, module.exports);
    return module.exports.score;
  });
}
async function before() {
  media.createAVPlayer = originalCreate; pref.api.getPreferences = originalOpen;
  h.reset(); pref.reset();
  const fault = (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8);
  trace = common.external('language-match', fault);
  if (fault === 'setup') assert.fail('unrelated language fixture initialization assertion');
  privateScore = undefined;
  pref.api.getPreferences = (...args) => trace.call('preferences-open', async () => {
    if (process.argv.includes('--native-preferences-init-failure')) throw Object.assign(Error('injected native Preferences initializer failure'), { code: 'EIO', contractInjected: true });
    if (process.argv.includes('--native-preferences-open-failure')) pref.state.failOpen = true;
    const instance = await originalOpen(...args);
    if (process.argv.includes('--native-preferences-read-failure')) pref.state.failGet = true;
    for (const [method, phase] of [['get', 'preferences-get'], ['put', 'preferences-put'], ['flush', 'preferences-flush']]) {
      const original = instance[method].bind(instance);
      instance[method] = (...values) => trace.call(phase, () => {
        if (method === 'flush' && process.argv.includes('--native-preferences-flush-failure')) pref.state.failFlush = 1;
        return original(...values);
      });
    }
    return instance;
  });
  media.createAVPlayer = () => trace.call('native-player-create', async () => {
    if (process.argv.includes('--native-player-init-failure')) throw Object.assign(Error('injected native player initializer failure'), { code: 'EIO', contractInjected: true });
    const player = await originalCreate(), select = player.selectTrack.bind(player);
    player.selectTrack = index => trace.call('native-track-select', () => select(index));
    return player;
  });
}
async function after() { media.createAVPlayer = originalCreate; pref.api.getPreferences = originalOpen; }
const fixture = {
  ui: () => trace.call('ui-compile', () => require('./brand-forms.test.cjs')),
  h, assert, rules, pref, PlaybackPreferenceStore, trace: () => trace, score: (...args) => privateScore(...args),
  observed: promise => Promise.resolve(promise).then(value => ({ value }), error => ({ error })),
  async store() { const s = new PlaybackPreferenceStore(); await s.load({ filesDir: h.directory }); return s; },
  async playing(language, tracks, selected = []) {
    const native = new h.NativePlayer(tracks.map((language, i) => ({ track_index: i + 11, track_type: 0, language }))); native.selected = selected;
    const { c: unused, values } = h.rig(), c = new PlaybackController(unused.client, unused.view, () => ({ version: 1, audioLanguage: language, subtitleLanguage: '', subtitlesOff: false }));
    h.nativeQueue.push(native);
    try { await c.open(h.route(), 'surface'); await h.settle(); return { values: { ...values }, calls: native.calls.map(c => [...c]), state: native.state }; }
    finally { await c.close(); }
  },
  run: tests => common.run(tests.map(test => ({ ...test, async action(check) { try { privateScore = compileScore(); await test.action(check); } finally { await h.settle(); } } })), 'language-match', before, after, () => trace.healthy())
};
module.exports = fixture;
