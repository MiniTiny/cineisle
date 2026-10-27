// Execute real presentation policy; this does not fetch artwork or render ArkUI pixels.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.join(require('./deveco-runtime.cjs').contents, 'tools/hvigor/hvigor/node_modules/typescript'));
const source = fs.readFileSync(path.resolve(__dirname, '../entry/src/main/ets/utils/MediaPresentation.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const moduleOutput = { exports: {} };
vm.runInThisContext(`(function(module,exports){${code}\n})`)(moduleOutput, moduleOutput.exports);
const { posterTarget, playbackPercent } = moduleOutput.exports;
const movie = extra => ({ Id: 'movie', Name: 'Movie', Type: 'Movie', ...extra });
const tests = [
  ['missing image tags still attempt the item primary image', () => {
    assert.deepEqual(posterTarget(movie()), { id: 'movie', tag: '', backdrop: false });
  }],
  ['movie poster retains the server cache tag', () => {
    assert.equal(posterTarget(movie({ ImageTags: { Primary: 'tag' } })).tag, 'tag');
  }],
  ['episode poster uses its series without reusing the episode image tag', () => {
    assert.deepEqual(posterTarget(movie({ Type: 'Episode', SeriesId: 'show', ImageTags: { Primary: 'episode-tag' } })), { id: 'show', tag: '', backdrop: false });
  }],
  ['season with its own image keeps the season poster', () => {
    assert.equal(posterTarget(movie({ Type: 'Season', SeriesId: 'show', ImageTags: { Primary: 'season-tag' } })).id, 'movie');
  }],
  ['season without a poster uses the series', () => {
    assert.equal(posterTarget(movie({ Type: 'Season', SeriesId: 'show' })).id, 'show');
  }],
  ['episode without a series ID keeps a valid item image target', () => {
    assert.equal(posterTarget(movie({ Type: 'Episode' })).id, 'movie');
  }],
  ['wide movie resume cards use the movie backdrop and backdrop tag', () => {
    assert.deepEqual(posterTarget(movie({ ImageTags: { Primary: 'primary' }, BackdropImageTags: ['back'] }), true), { id: 'movie', tag: 'back', backdrop: true });
  }],
  ['wide episode cards use the episode image instead of the series poster', () => {
    assert.deepEqual(posterTarget(movie({ Type: 'Episode', SeriesId: 'show', ImageTags: { Primary: 'episode-tag' } }), true), { id: 'movie', tag: 'episode-tag', backdrop: false });
  }],
  ['resume progress scales ticks and clamps negative or overflowing positions', () => {
    const progress = position => playbackPercent(movie({ RunTimeTicks: 1000, UserData: { PlaybackPositionTicks: position } }));
    assert.equal(progress(250), 25); assert.equal(progress(-1), 0); assert.equal(progress(1500), 100);
  }],
  ['missing zero or non-finite runtime never produces NaN progress', () => {
    for (const runtime of [undefined, 0, -1, Infinity, NaN]) assert.equal(playbackPercent(movie({ RunTimeTicks: runtime, UserData: { PlaybackPositionTicks: 123 } })), 0);
    assert.equal(playbackPercent(movie({ RunTimeTicks: 100, UserData: { PlaybackPositionTicks: NaN } })), 0);
  }]
];
for (const [name, fn] of tests) { fn(); console.log('PASS ' + name); }
console.log(`${tests.length} media presentation regressions passed. No real artwork/device pixel proof.`);
