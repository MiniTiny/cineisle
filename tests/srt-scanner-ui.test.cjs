const assert = require('node:assert/strict');
const { render, flat } = require('./brand-forms.test.cjs');
const p = require('./player-regression.test.cjs');
const { parseSubtitles } = p.load('utils/Playback.ts');
const { PiPSubtitleController } = p.load('components/PiPSubtitle.ets');
const tests = [], test = (name, run) => tests.push([name, run]);
const cue = body => parseSubtitles('1\n00:00 --> 00:10\n' + body + '\n')[0];
test('CDATA stays literal inside a bold Span without applying its apparent italic tag', () => {
  const value = cue('<b><![CDATA[<i>x</i>&copy;]]></b>');
  const f = render('RichCaption', { runs: value.runs });
  const spans = flat(f.roots).filter(n => n.type === 'Span');
  assert.equal(spans.length, 1); assert.equal(spans[0].args[0], '<i>x</i>&copy;');
  assert.equal(spans[0].attrs.fontWeight[0], 700); assert.equal(spans[0].attrs.fontStyle[0], 0);
});
test('paragraph drawing receives raw script characters and no hidden comment text', () => {
  const value = cue('<blockquote>A<!-- > hidden --><script><i>x</i></script>B</blockquote>'), calls = [];
  const f = render('RichCaption', { runs: value.runs, identifier: 'scanner-paragraph',
    captionRaster: { render: request => { calls.push(request); return new Promise(() => {}); } } });
  const child = f.childViews.find(n => typeof n.schedule === 'function'); assert.ok(child);
  try {
    child.aboutToAppear();
    flat(f.roots).find(n => n.attrs.onAreaChange && n.attrs.id?.[0] === 'scanner-paragraph')
      .attrs.onAreaChange[0]({}, { width: 400 });
    assert.equal(Array.from(calls[0].runs, r => r.text).join(''), 'A<i>x</i>B\n\n');
    assert.equal(calls[0].runs.some(r => r.italic), false);
  } finally { child.aboutToDisappear(); }
});
test('Player displays apparent script markup as plain literal caption characters', () => {
  const value = cue('A<script><b>x</b></script>B');
  const f = render('Player', { alive: true, visible: true, frameReady: true, state: 'paused', immersive: true,
    controlsVisible: true, subtitle: value.text, subtitleRuns: [], surfaceWidth: 760, surfaceHeight: 280,
    viewportWidth: 760, viewportHeight: 280, route: { item: { Id: 'movie', Name: 'SRT', Type: 'Movie' }, sources: [] } });
  assert.ok(flat(f.roots).some(n => n.type === 'Text' && n.args[0] === 'A<b>x</b>B'));
});
test('PiP reconstruction retains literal CDATA and clears same-text style changes', () => {
  p.reset(); const controller = new PiPSubtitleController(() => assert.fail());
  const rich = cue('<b><![CDATA[<i>x</i>]]></b>'), plain = cue('<script><i>x</i></script>');
  try {
    controller.setText(rich.text, rich.runs, [], 'scanner');
    let node = controller.makeNode(p.systemPlatform.uiContext()).builderNode;
    assert.equal(node.params.runs[0].text, '<i>x</i>'); assert.equal(node.params.runs[0].bold, true);
    controller.setText(plain.text, [], [], 'scanner'); assert.equal(node.params.runs.length, 0);
    controller.aboutToResize({ width: 240, height: 160 }); controller.aboutToDisappear();
    node = controller.makeNode(p.systemPlatform.uiContext()).builderNode;
    assert.equal(node.params.text, '<i>x</i>'); assert.equal(node.params.runs.length, 0);
  } finally { controller.dispose(); }
});
(async () => {
  for (const [name, run] of tests) { await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} SRT scanner UI regressions passed. Native Harmony pixels and Player/PiP remain separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
