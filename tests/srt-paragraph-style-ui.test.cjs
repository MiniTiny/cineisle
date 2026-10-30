const assert = require('node:assert/strict');
const { render, flat } = require('./brand-forms.test.cjs');
const p = require('./player-regression.test.cjs');
const { rasterFixture, frame } = require('./caption-raster-fixture.cjs');
const { metricFixture } = require('./subtitle-metrics-fixture.cjs');
const { parseSubtitles } = p.load('utils/Playback.ts');
const { PiPSubtitleController } = p.load('components/PiPSubtitle.ets');
const tests = [], test = (name, run) => tests.push([name, run]);
const plain = value => JSON.parse(JSON.stringify(value));
const cue = body => parseSubtitles('1\n00:00 --> 00:10\n' + body + '\n')[0];
const style = { foreground: '#FFFFFFFF', family: 'serif', edge: 'none' };
const context = { vp2px: value => value, fp2px: value => value };
test('real RichCaption and NativeCaption adapters preserve independent paragraph ranges', () => {
  const value = cue('<blockquote><li>A</li></blockquote>B'), calls = [];
  const f = render('RichCaption', { runs: value.runs, paragraphs: value.paragraphs, identifier: 'paragraph-style',
    captionRaster: { render: request => { calls.push(request); return new Promise(() => {}); } } });
  const child = f.childViews.find(value => typeof value.schedule === 'function'); assert.ok(child);
  try {
    child.aboutToAppear();
    flat(f.roots).find(value => value.attrs.onAreaChange && value.attrs.id?.[0] === 'paragraph-style').attrs.onAreaChange[0]({}, { width: 300 });
    assert.deepEqual(plain(calls[0].paragraphs), [{ start: 0, end: 2, kind: 'bullet' }, { start: 0, end: 2, kind: 'quote' }]);
    assert.equal(calls[0].runs.map(value => value.text).join(''), 'A\n\nB');
    assert.equal(flat(f.roots).filter(value => value.type === 'Span').length, 0);
  } finally { child.aboutToDisappear(); }
});
test('positioned captions pass metadata with their own cue and native width', () => {
  const value = cue('{\\an7}<blockquote>A</blockquote>'), calls = [];
  const f = render('PositionedCaption', { cue: value.placement, canvasWidth: 320, canvasHeight: 200, identifier: 'positioned-paragraph',
    captionRaster: { render: request => { calls.push(request); return new Promise(() => {}); } } });
  const child = f.childViews.find(value => typeof value.schedule === 'function'); assert.ok(child);
  try {
    child.aboutToAppear();
    assert.deepEqual(plain(calls[0].paragraphs), [{ start: 0, end: 2, kind: 'quote' }]);
    assert.ok(calls[0].intrinsic && calls[0].width > 0 && calls[0].width < 320);
  } finally { child.aboutToDisappear(); }
});
test('main player surface forwards flow paragraph metadata to the production caption builder', () => {
  const value = cue('<p style="text-align:end">A</p>');
  const f = render('Player', { alive: true, visible: true, frameReady: true, state: 'paused', immersive: true,
    controlsVisible: true, subtitle: value.text, subtitleRuns: value.runs, subtitleParagraphs: value.paragraphs,
    surfaceWidth: 760, surfaceHeight: 280, viewportWidth: 760, viewportHeight: 280,
    route: { item: { Id: 'movie', Name: 'SRT', Type: 'Movie' }, sources: [] } });
  const child = f.childViews.find(value => typeof value.schedule === 'function'); assert.ok(child);
  assert.deepEqual(plain(child.paragraphs), [{ start: 0, end: 2, kind: 'end' }]);
});
test('PiP updates on paragraph-only changes and preserves metadata across reconstruction', () => {
  p.reset(); const controller = new PiPSubtitleController(() => assert.fail());
  const value = cue('<p style="text-align:start">A</p>');
  const start = value.paragraphs, end = [{ start: 0, end: 2, kind: 'end' }], positioned = [];
  try {
    controller.setText(value.text, value.runs, positioned, 'same', start);
    let node = controller.makeNode(p.systemPlatform.uiContext()).builderNode;
    assert.deepEqual(plain(node.params.paragraphs), [{ start: 0, end: 2, kind: 'start' }]);
    controller.setText(value.text, value.runs, positioned, 'same', end);
    assert.deepEqual(plain(node.params.paragraphs), end);
    controller.aboutToResize({ width: 240, height: 160 }); controller.aboutToDisappear();
    node = controller.makeNode(p.systemPlatform.uiContext()).builderNode;
    assert.deepEqual(plain(node.params.paragraphs), end);
    controller.setText('plain'); assert.deepEqual(plain(node.params.paragraphs), []);
  } finally { controller.dispose(); }
  assert.deepEqual(plain(controller.paragraphs), []);
});
test('bridge rejects unknown kinds,nonintegral/outside ranges and nonparagraph boundaries', () => {
  const { captionRequest } = rasterFixture(), { SubtitleMetrics } = metricFixture();
  const runs = cue('<blockquote>😀</blockquote>A').runs;
  const request = paragraphs => captionRequest(runs, style, 20, 300, 4, false, context, new SubtitleMetrics(), 1, 'same', paragraphs);
  assert.deepEqual(plain(request([{ start: 0, end: 3, kind: 'quote' }]).paragraphs), [{ start: 0, end: 3, kind: 'quote' }]);
  for (const bad of [null, { start: NaN, end: 3, kind: 'quote' }, { start: -1, end: 3, kind: 'quote' },
    { start: 0, end: 999, kind: 'quote' }, { start: 0, end: 0, kind: 'quote' }, { start: 1, end: 3, kind: 'quote' },
    { start: 0, end: 1, kind: 'quote' }, { start: 0, end: 3, kind: 'unknown' }]) assert.throws(() => request([bad]), /subtitle_failed/);
  assert.throws(() => request(Array.from({ length: 4097 }, () => ({ start: 0, end: 3, kind: 'quote' }))), /subtitle_failed/);
  assert.equal(Object.hasOwn(request([]), 'paragraphs'), false);
});
test('paragraph-only request changes trigger a fresh native job with unchanged text and runs', async () => {
  let count = 0; const { CaptionRasterizer, captionRequest } = rasterFixture({ render: async () => { count++; return frame(); } });
  const { SubtitleMetrics } = metricFixture(), raster = new CaptionRasterizer(() => {}, () => assert.fail());
  try {
    for (const kind of ['start', 'end']) {
      const value = cue('<p>A</p>');
      raster.request(captionRequest(value.runs, style, 20, 300, 4, false, context, new SubtitleMetrics(), 1, 'same', [{ start: 0, end: 2, kind }]));
      for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise(setImmediate);
    }
    assert.equal(count, 2);
  } finally { raster.close(); }
});
test('paragraph base size and marker color remain independent of authored font styles', () => {
  const { captionRequest } = rasterFixture(), { SubtitleMetrics } = metricFixture();
  const value = cue('<blockquote><big><font color="red">A</font></big></blockquote>');
  const q = captionRequest(value.runs, style, 20, 300, 4, false, context, new SubtitleMetrics(), 2, 'same', value.paragraphs);
  assert.equal(q.runs[0].size, 50); assert.equal(q.runs[0].color, 0xffff0000);
  assert.deepEqual(plain(q.paragraphStyle), { size: 40, color: 0xffffffff });
});
(async () => {
  for (const [name, run] of tests) { await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} SRT paragraph style UI regressions passed. Native fixtures validate forwarding only;actual geometry,pixels and PiP require independent acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
