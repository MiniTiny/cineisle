// Converts actual MPV plain-track ASS event packets; authored ASS remains native.
const assert = require('node:assert/strict');
const { load } = require('./player-regression.test.cjs');
const { mpvTextSubtitle } = load('utils/MpvTextSubtitle.ts');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const event = text => 'Dialogue: 0,0:00:00.50,0:00:03.50,Default,,0,0,0,,' + text;
const parse = text => mpvTextSubtitle('subrip', event(text), 55, false);
test('real FFmpeg SRT packet preserves emphasis and zero-padded BGR color', () => {
  const value = parse('{\\b1}Native Bold{\\b0} {\\i1}Italic{\\i0} {\\c&HFF00&}Green 字幕{\\c}');
  assert.equal(value.text, 'Native Bold Italic Green 字幕'); assert.ok(value.runs.some(r => r.bold && r.text === 'Native Bold'));
  assert.ok(value.runs.some(r => r.italic && r.text === 'Italic')); assert.ok(value.runs.some(r => r.color === '#FF00FF00' && r.text === 'Green 字幕'));
});
for (const record of require('./fixtures/mpv-subtitle-packets.json').cases) test('captured native packet dispatch for ' + record.codec, () => {
  const value = mpvTextSubtitle(record.codec, record.events, record.fontSize, record.overflow);
  if (record.expectedShared) { assert.equal(value.text, record.expectedPlain); assert.ok(value.runs.some(r => r.bold)); assert.ok(value.runs.some(r => r.italic)); assert.ok(value.runs.some(r => r.color === '#FF00FF00')); }
  else { assert.equal(value, undefined); }
});
test('underline,strike,color reset,font and relative font size survive conversion', () => {
  const value = parse('{\\u1\\s1\\fnserif\\fs110\\c&HFF&}Red{\\r}Plain'); const first = value.runs[0];
  assert.equal(first.underline, true); assert.equal(first.strike, true); assert.equal(first.family, 'serif'); assert.equal(first.sizeScale, 2); assert.equal(first.color, '#FFFF0000');
  const last = value.runs.at(-1); assert.equal(last.text, 'Plain'); assert.equal(last.color, ''); assert.equal(last.underline, false);
});
test('line breaks,hard spaces,literal braces,commas and literal markup remain text', () => {
  const value = parse('Line\\NNext\\hword \\{literal\\}, <b>literal</b>');
  assert.equal(value.text, 'Line\nNext\u00a0word {literal}, <b>literal</b>');
});
for (let alignment = 1; alignment <= 9; ++alignment) test('native SRT alignment ' + alignment + ' becomes an independently positioned cue', () => {
  const value = parse('{\\an' + alignment + '}Position'); assert.equal(value.flowText, ''); assert.equal(value.positioned[0].alignment, alignment); assert.equal(value.positioned[0].text, 'Position');
});
test('overlapping full events keep independent positions and flow', () => {
  const events = event('Flow') + '\n' + event('{\\an7}Top') + '\n' + event('{\\an3}Bottom');
  const value = mpvTextSubtitle('subrip', events, 55, false); assert.equal(value.flowText, 'Flow'); assert.equal(value.text, 'Flow\nTop\nBottom'); assert.deepEqual(value.positioned.map(p => p.alignment), [7, 3]);
});
test('conflicting alignment or a reset with alignment retains native authoring', () => {
  assert.equal(parse('{\\an7}Top{\\an3}Bottom'), undefined);
  assert.equal(parse('{\\an7}Top{\\r}Reset'), undefined);
  const repeated = parse('{\\an7}Top{\\an7}Same');
  assert.equal(repeated.positioned[0].alignment, 7); assert.equal(repeated.text, 'TopSame');
});
for (const codec of ['ass', 'ssa', 'hdmv_pgs_subtitle', 'dvd_subtitle', 'mov_text', 'webvtt', 'unknown']) test('retain native rendering for the unadapted codec ' + codec, () => {
  assert.equal(mpvTextSubtitle(codec, event('Keep authoring'), 55, false), undefined);
});
for (const text of ['{\\move(1,2,3,4)}Move', '{\\pos(10,20)}Position', '{\\t(0,500,\\fs80)}Animate', '{\\p1}m 0 0', '{\\alpha&H80&}Alpha', '{\\b700}Weight', '{\\rOther}Style', '{\\fscx150}Stretch']) test('unsupported authoring falls back intact: ' + text, () => {
  assert.equal(parse(text), undefined);
});
test('empty active event window is an explicit clear cue', () => {
  const value = mpvTextSubtitle('subrip', '', 55, false); assert.equal(value.text, ''); assert.deepEqual(value.positioned, []);
});
test('overflow,excessive events,malformed input and non-default metadata never produce a partial overlay', () => {
  assert.equal(mpvTextSubtitle('subrip', event('Long'), 55, true), undefined); assert.equal(mpvTextSubtitle('subrip', event('x'.repeat(65537)), 55, false), undefined);
  assert.equal(mpvTextSubtitle('subrip', Array(65).fill(event('x')).join('\n'), 55, false), undefined);
  for (const value of ['Broken', event('{\\b1'), event('Margin').replace(',0,0,0,,', ',30,0,0,,'), event('Style').replace(',Default,', ',Custom,'), event('Layer').replace('Dialogue: 0,', 'Dialogue: 2,')]) assert.equal(mpvTextSubtitle('subrip', value, 55, false), undefined);
  assert.equal(mpvTextSubtitle('subrip', event('Size'), NaN, false), undefined);
});
for (const [name, fn] of tests) { fn(); console.log('PASS', name); } console.log(`${tests.length} MPV subtitle conversion tests passed. Plain-track packet fixtures;no native font or decoder claim.`);
