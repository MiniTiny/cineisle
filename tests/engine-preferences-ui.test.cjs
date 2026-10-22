// Actual SDK Settings builders/callbacks; native geometry remains a separate acceptance gate.
const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 4; ++i) await new Promise(setImmediate); };
function page(props = {}, scale = 1) {
  const f = render('Settings', { deviceVisible: true, engineKnown: true, engineChoice: 'native', mpvOffered: true, ...props }, scale);
  f.view.ownerClient = f.AppService.client; return f;
}
const cases = [], test = (name, fn) => cases.push([name, fn]);
for (const [width, height, scale] of [[320, 700, 1], [320, 700, 2], [760, 360, 1], [760, 360, 2]]) test(`engine choices retain the shared scroll at ${width}x${height}/${scale}x`, () => {
  const f = page({ viewportWidth: width, viewportHeight: height }, scale), nodes = flat(f.roots);
  assert.equal(nodes.filter(n => n.type === 'Scroll').length, 1);
  for (const key of ['engine_native', 'engine_mpv']) assert.equal(button(f, key).attrs.enabled[0], true);
  assert.ok(nodes.some(n => n.type === 'Text' && n.args[0] === 'engine_current'));
});
test('MPV callback validates availability before saving an app-level engine choice', async () => {
  const f = page(); await button(f, 'engine_mpv').attrs.onClick[0]();
  assert.deepEqual(f.events.filter(e => ['validateEngine', 'saveEngine'].includes(e[0])), [['validateEngine', 'mpv'], ['saveEngine', 'mpv']]);
  assert.equal(f.view.engineChoice, 'mpv'); assert.equal(f.view.engineMessage, 'engine_saved'); assert.ok(!f.events.some(e => e[0] === 'save'));
});
test('saved current engine changes only after the durable save resolves', async () => {
  const gate = deferred(); let current = 'native'; const f = page({ engineStore: { issue: '', known: () => true, snapshot: () => current,
    async save(value, allowed) { await gate.promise; if (!allowed()) throw Error('engine_cancelled'); current = value; return value; } } });
  const saving = button(f, 'engine_mpv').attrs.onClick[0](); await settle(); assert.equal(f.view.engineChoice, 'native'); assert.equal(f.view.engineBusy, true);
  gate.resolve(); await saving; assert.equal(f.view.engineChoice, 'mpv'); assert.equal(f.view.engineBusy, false);
});
test('unavailable backend leaves the saved choice intact and displays an error', async () => {
  const f = page({ engineValidate: async () => { throw Error('engine_mpv_unavailable'); } }); await button(f, 'engine_mpv').attrs.onClick[0]();
  assert.equal(f.view.engineChoice, 'native'); assert.equal(f.view.engineMessage, 'engine_mpv_unavailable'); assert.ok(!f.events.some(e => e[0] === 'saveEngine'));
});
test('failed durable save retains the previous choice and permits retry', async () => {
  let fail = true; const f = page({ engineStore: { issue: '', known: () => true, snapshot: () => 'native', async save() { if (fail) throw Error('engine_save_failed'); return 'mpv'; } } });
  await button(f, 'engine_mpv').attrs.onClick[0](); assert.equal(f.view.engineChoice, 'native'); assert.equal(f.view.engineMessage, 'engine_save_failed');
  fail = false; await button(f, 'engine_mpv').attrs.onClick[0](); assert.equal(f.view.engineChoice, 'mpv'); assert.equal(f.view.engineMessage, 'engine_saved');
});
for (const mode of ['hidden', 'locked', 'account']) test(mode + ' while probing a backend cancels the save without stale success', async () => {
  const gate = deferred(); const f = page({ engineValidate: async () => gate.promise }); const saving = button(f, 'engine_mpv').attrs.onClick[0](); await settle();
  if (mode === 'hidden') f.view.onPageHide(); if (mode === 'locked') { f.view.locked = true; f.view.deviceLockChanged(); } if (mode === 'account') f.AppService.client = {};
  gate.resolve(); await saving; assert.equal(f.view.engineChoice, 'native'); assert.notEqual(f.view.engineMessage, 'engine_saved'); assert.ok(!f.events.some(e => e[0] === 'saveEngine'));
});
test('unsupported OS disables MPV while preserving an explicit native recovery action', async () => {
  const f = page({ mpvOffered: false, engineChoice: 'mpv' }); assert.equal(button(f, 'engine_mpv').attrs.enabled[0], false); assert.equal(button(f, 'engine_native').attrs.enabled[0], true);
  await button(f, 'engine_mpv').attrs.onClick[0](); assert.ok(!f.events.some(e => e[0] === 'saveEngine'));
  await button(f, 'engine_native').attrs.onClick[0](); assert.equal(f.view.engineChoice, 'native');
});
test('unknown preference remains visibly unknown until an explicit successful repair', async () => {
  const f = page({ engineKnown: false, engineMessage: 'engine_invalid' }); assert.ok(flat(f.roots).some(n => n.type === 'Text' && n.args[0] === 'engine_unknown'));
  await button(f, 'engine_native').attrs.onClick[0](); assert.equal(f.view.engineKnown, true); assert.equal(f.view.engineMessage, 'engine_saved');
});
test('busy engine controls cannot start a second preference transaction', async () => {
  const f = page({ engineBusy: true }); for (const key of ['engine_native', 'engine_mpv']) { assert.equal(button(f, key).attrs.enabled[0], false); await button(f, key).attrs.onClick[0](); }
  assert.ok(!f.events.some(e => e[0] === 'saveEngine'));
});
(async () => { for (const [name, fn] of cases) { await fn(); console.log('PASS', name); } console.log(`${cases.length} engine settings UI cases passed. SDK tree and explicit storage/capability fixtures; no native geometry claim.`); })().catch(e => { console.error(e); process.exitCode = 1; });
