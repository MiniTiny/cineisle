// Actual ArkUI compiler/tree gate; device pixels are verified independently.
const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
let count = 0;
for (const scale of [1, 2]) {
  const f = render('Player', { locked: false, alive: true, state: 'error', frameReady: false, surfaceId: 'surface', controller: {}, controlsVisible: true, viewportWidth: 800, viewportHeight: 360 }, scale), nodes = flat(f.roots);
  const cover = nodes.find(n => n.attrs.id?.[0] === 'playbackFrameCover'); assert.ok(cover); assert.equal(cover.attrs.backgroundColor[0], '#000000'); assert.equal(cover.attrs.hitTestBehavior[0], 1); assert.equal(nodes.filter(n => n.type === 'XComponent').length, 1); assert.equal(button(f, 'player_retry').attrs.enabled[0], true); assert.ok(button(f, 'playback_options')); assert.ok(nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.player_failure_hint')); assert.ok(!nodes.some(n => n.type === 'Slider')); count++;
}
for (const [state, frameReady] of [['loading', false], ['playing', false], ['playing', true], ['paused', true]]) {
  const f = render('Player', { locked: false, state, frameReady }); const nodes = flat(f.roots); assert.equal(nodes.some(n => n.attrs.id?.[0] === 'playbackFrameCover'), !frameReady); assert.equal(nodes.filter(n => n.type === 'XComponent').length, 1); assert.equal(button(f, 'player_retry'), undefined); count++;
}
const protectedView = render('Player', { locked: true, state: 'error', frameReady: false }); assert.equal(button(protectedView, 'player_retry'), undefined); assert.ok(!flat(protectedView.roots).some(n => n.type === 'XComponent')); count++;
for (const state of ['error', 'loading']) {
  let opened = 0; const f = render('Player', { locked: false, state, controller: { open() { opened++; } } });
  f.view.surface.getXComponentSurfaceId = () => 'recreated-surface';
  flat(f.roots).find(n => n.type === 'XComponent').attrs.onLoad[0]();
  assert.equal(f.view.surfaceId, 'recreated-surface'); assert.equal(opened, state === 'error' ? 0 : 1); count++;
}
console.log(`${count} player error UI regressions passed. SDK tree fixtures do not prove native rendering.`);
