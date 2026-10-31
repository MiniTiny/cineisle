const assert = require('node:assert/strict');
const { render, flat } = require('./brand-forms.test.cjs');
const p = require('./player-regression.test.cjs');
const { rasterFixture, frame } = require('./caption-raster-fixture.cjs');
const { metricFixture } = require('./subtitle-metrics-fixture.cjs');
const { parseSubtitles } = p.load('utils/Playback.ts');
const { PiPSubtitleController } = p.load('components/PiPSubtitle.ets');
const tests = [], test = (name, run) => tests.push([name, run]);
const cue = body => parseSubtitles('1\n00:00 --> 00:10\n' + body + '\n')[0];
const style = { foreground: '#FFFFFF00', family: 'serif', edge: 'none' };
const context = { vp2px: value => value, fp2px: value => value };
test('simple anchors retain the existing Span path with explicit color and underline', () => {
  const value = cue('<a href="x">A</a><font color="red"><a href="y">B</a></font>');
  const f = render('RichCaption', { runs: value.runs });
  const spans = flat(f.roots).filter(value => value.type === 'Span');
  assert.deepEqual(Array.from(spans, s => [s.args[0], s.attrs.fontColor[0], s.attrs.decoration[0].type]),
    [['A', '#00000000', 1], ['B', '#FFFF0000', 1]]);
  assert.equal(f.childViews.length, 0);
});
test('paragraph anchors forward transparent color and underline to native drawing', () => {
  const value = cue('<blockquote><a href="x">A</a><font color="red"><a href="y">B</a></font></blockquote>'), calls = [];
  const f = render('RichCaption', { runs: value.runs, identifier: 'link-style',
    captionRaster: { render: request => { calls.push(request); return new Promise(() => {}); } } });
  const child = f.childViews.find(value => typeof value.schedule === 'function'); assert.ok(child);
  try {
    child.aboutToAppear();
    flat(f.roots).find(value => value.attrs.onAreaChange && value.attrs.id?.[0] === 'link-style')
      .attrs.onAreaChange[0]({}, { width: 300 });
    assert.deepEqual(Array.from(calls[0].runs, r => [r.text, r.color, r.underline]),
      [['A', 0, true], ['B', 0xffff0000, true], ['\n\n', 0xffffffff, false]]);
    assert.equal(flat(f.roots).filter(value => value.type === 'Span').length, 0);
  } finally { child.aboutToDisappear(); }
});
test('positioned anchors keep their own width and transparent native run', () => {
  const value = cue('{\\an7}<blockquote><a href="x">A</a></blockquote>'), calls = [];
  const f = render('PositionedCaption', { cue: value.placement, canvasWidth: 320, canvasHeight: 200,
    identifier: 'positioned-link', captionRaster: { render: request => { calls.push(request); return new Promise(() => {}); } } });
  const child = f.childViews.find(value => typeof value.schedule === 'function'); assert.ok(child);
  try {
    child.aboutToAppear(); assert.equal(calls[0].runs[0].color, 0); assert.equal(calls[0].runs[0].underline, true);
    assert.ok(calls[0].intrinsic && calls[0].width > 0 && calls[0].width < 320);
  } finally { child.aboutToDisappear(); }
});
test('main Player surface forwards simple anchor runs to literal Span drawing', () => {
  const value = cue('<a href="x">A</a>');
  const f = render('Player', { alive: true, visible: true, frameReady: true, state: 'paused', immersive: true,
    controlsVisible: true, subtitle: value.text, subtitleRuns: value.runs, surfaceWidth: 760, surfaceHeight: 280,
    viewportWidth: 760, viewportHeight: 280, route: { item: { Id: 'movie', Name: 'SRT', Type: 'Movie' }, sources: [] } });
  const span = flat(f.roots).find(value => value.type === 'Span' && value.args[0] === 'A'); assert.ok(span);
  assert.equal(span.attrs.fontColor[0], '#00000000'); assert.equal(span.attrs.decoration[0].type, 1);
});
test('PiP retains same-text link changes through updates and reconstruction', () => {
  p.reset(); const controller = new PiPSubtitleController(() => assert.fail());
  const transparent = cue('<a href="x">same</a>'), colored = cue('<font color="red"><a href="x">same</a></font>');
  try {
    controller.setText(transparent.text, transparent.runs, [], 'same');
    let node = controller.makeNode(p.systemPlatform.uiContext()).builderNode;
    assert.equal(node.params.runs[0].color, '#00000000'); assert.equal(node.params.runs[0].underline, true);
    controller.setText(colored.text, colored.runs, [], 'same'); assert.equal(node.params.runs[0].color, '#FFFF0000');
    controller.aboutToResize({ width: 240, height: 160 }); controller.aboutToDisappear();
    node = controller.makeNode(p.systemPlatform.uiContext()).builderNode;
    assert.equal(node.params.runs[0].color, '#FFFF0000'); assert.equal(node.params.runs[0].underline, true);
    controller.setText('plain'); assert.equal(node.params.runs.length, 0);
  } finally { controller.dispose(); }
});
test('native request keeps ARGB zero instead of substituting the user foreground', () => {
  const { captionRequest } = rasterFixture(), { SubtitleMetrics } = metricFixture();
  const value = cue('<a href="x">A</a><font color="red"><a href="y">B</a></font>C');
  const request = captionRequest(value.runs, style, 20, 300, 4, false, context, new SubtitleMetrics(), 1);
  assert.deepEqual(Array.from(request.runs, r => [r.text, r.color, r.underline]),
    [['A', 0, true], ['B', 0xffff0000, true], ['C', 0xffffff00, false]]);
});
test('same-text transparent-to-colored changes schedule a fresh raster job', async () => {
  let count = 0; const { CaptionRasterizer, captionRequest } = rasterFixture({ render: async () => { count++; return frame(); } });
  const { SubtitleMetrics } = metricFixture(), raster = new CaptionRasterizer(() => {}, () => assert.fail());
  try {
    for (const source of ['<a href="x">same</a>', '<font color="red"><a href="x">same</a></font>']) {
      const value = cue(source);
      raster.request(captionRequest(value.runs, style, 20, 300, 4, false, context, new SubtitleMetrics(), 1, 'same'));
      for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise(setImmediate);
    }
    assert.equal(count, 2);
  } finally { raster.close(); }
});
(async () => {
  for (const [name, run] of tests) { await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} SRT link style UI regressions passed. Real native pixels and Player/PiP remain separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
