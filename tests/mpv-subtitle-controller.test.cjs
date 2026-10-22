// Real controller/wrapper event chain with explicit subtitle events; no native decoding claim.
const assert = require('node:assert/strict');
const h = require('./player-regression.test.cjs');
const { mpvTextSubtitle } = h.load('utils/MpvTextSubtitle.ts');
const event = body => 'Dialogue: 0,0:00:00.50,0:00:03.50,Default,,0,0,0,,' + body;
const rich = body => mpvTextSubtitle('subrip', event(body), 55, false);
const tests = [], test = (name, fn) => tests.push([name, fn]);
async function open() {
  const r = h.rig(); const captions = []; r.c.view.caption = value => captions.push(value);
  const player = new h.NativePlayer(); player.selected = [5, 12]; h.nativeQueue.push(player); await r.c.open(h.route(), 'surface'); await h.settle();
  player.emit('timeUpdate', 1500); return { ...r, player, captions };
}
function emit(r, content) { r.player.emit('subtitleUpdate', { text: content.text, startTime: 500, duration: 3000, content }); }
test('rich native cue preserves styling and separate positioning through the controller', async () => {
  const r = await open(); emit(r, rich('{\\an9}{\\b1}Positioned'));
  const value = r.captions.at(-1); assert.equal(value.flowText, ''); assert.equal(value.positioned[0].alignment, 9); assert.equal(value.positioned[0].runs[0].bold, true); await r.c.close();
});
test('same text with changed inline color publishes the new runs', async () => {
  const r = await open(); emit(r, rich('{\\c&HFF&}Same')); const red = r.captions.at(-1); emit(r, rich('{\\c&HFF00&}Same')); const green = r.captions.at(-1);
  assert.equal(red.text, green.text); assert.equal(red.runs[0].color, '#FFFF0000'); assert.equal(green.runs[0].color, '#FF00FF00'); await r.c.close();
});
test('a subsequent ordinary SDK cue cannot inherit old rich formatting', async () => {
  const r = await open(); emit(r, rich('{\\b1}Bold')); r.player.emit('subtitleUpdate', { text: 'Plain', startTime: 500, duration: 3000 });
  assert.equal(r.captions.at(-1).text, 'Plain'); assert.equal(r.captions.at(-1).runs.length, 0); await r.c.close();
});
test('seek clears the prior rich cue before a new native window arrives', async () => {
  const r = await open(); emit(r, rich('Old')); r.c.seek(6000); assert.equal(r.captions.at(-1).text, ''); await r.c.close();
});
test('off prevents native cues from republishing a shared caption', async () => {
  const r = await open(); emit(r, rich('Visible')); await r.c.selectSubtitle(''); emit(r, rich('Hidden'));
  assert.equal(r.captions.at(-1).text, ''); await r.c.close();
});
test('late native cue after release cannot restore a caption', async () => {
  const r = await open(); emit(r, rich('Visible')); await r.c.close(); const before = r.captions.length; emit(r, rich('Late'));
  assert.equal(r.captions.length, before); assert.equal(r.captions.at(-1).text, '');
});
(async () => { for (const [name, fn] of tests) { h.reset(); await fn(); console.log('PASS', name); } console.log(`${tests.length} native rich subtitle controller tests passed. Explicit AVPlayer events;no decoder or UI claim.`); })().catch(e => { console.error(e); process.exitCode = 1; });
