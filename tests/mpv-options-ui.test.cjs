// Real SDK Settings/Player builders; geometry and actual backend use remain native acceptance.
const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 4; ++i) await new Promise(setImmediate); };
const cases = [], test = (name, fn) => cases.push([name, fn]);
function page(props = {}, scale = 1) {
 const f = render('Settings', { deviceVisible: true, locked: false, engineKnown: true, engineChoice: 'mpv', mpvOffered: true, mpvOptionsKnown: true, ...props }, scale);
 f.view.ownerClient = f.AppService.client; return f;
}
const selects = f => flat(f.roots).filter(n => n.type === 'Select' && ['app.string.mpv_hardware_label', 'app.string.mpv_video_label'].includes(n.attrs.accessibilityText?.[0]));
for (const scale of [1, 2]) test('MPV choices share the scroll and retained save action at ' + scale + 'x', () => {
 const f = page({}, scale); assert.equal(flat(f.roots).filter(n => n.type === 'Scroll').length, 1); assert.equal(selects(f).length, 2); assert.equal(button(f, 'mpv_options_save').attrs.enabled[0], true);
});
test('native choice and unsupported API omit optional MPV controls', () => {
 assert.equal(button(page({ engineChoice: 'native' }), 'mpv_options_save'), undefined);
 assert.equal(button(page({ mpvOffered: false }), 'mpv_options_save'), undefined);
});
test('select callbacks change drafts; only explicit save publishes both durable options', async () => {
 const f = page(), [hardware, video] = selects(f); hardware.attrs.onSelect[0](2); video.attrs.onSelect[0](1);
 assert.equal(f.view.mpvHardware, 'ohcodec-copy'); assert.equal(f.view.mpvVideo, 'gpu'); assert.equal(f.view.mpvSavedHardware, 'ohcodec');
 assert.equal(f.events.filter(e => e[0] === 'saveMpvOptions').length, 0); await button(f, 'mpv_options_save').attrs.onClick[0]();
 assert.deepEqual(f.events.find(e => e[0] === 'saveMpvOptions'), ['saveMpvOptions', { hwdec: 'ohcodec-copy', vo: 'gpu' }]);
 assert.equal(f.view.mpvSavedHardware, 'ohcodec-copy'); assert.equal(f.view.mpvOptionsMessage, 'mpv_options_saved'); assert.equal(f.view.engineChoice, 'mpv');
});
test('invalid native Select indices never alter an accepted draft', () => {
 const f = page(), [hardware, video] = selects(f);
 for (const index of [-1, 1.5, 99, NaN]) { hardware.attrs.onSelect[0](index); video.attrs.onSelect[0](index); }
 assert.equal(f.view.mpvHardware, 'ohcodec'); assert.equal(f.view.mpvVideo, 'gpu-next');
});
test('saving and locked states disable both selectors and the save action', () => {
 for (const props of [{ mpvOptionsBusy: true }, { engineBusy: true }]) { const f = page(props); assert.ok(selects(f).every(n => n.attrs.enabled[0] === false)); assert.equal(button(f, 'mpv_options_save').attrs.enabled[0], false); }
});
test('PIN-locked Settings does not expose the MPV controls', () => { assert.equal(button(page({ locked: true }), 'mpv_options_save'), undefined); });
test('saved description changes only after the durable save completes', async () => {
 const gate = deferred(); const f = page({ mpvHardware: 'no', mpvVideo: 'gpu', mpvStore: { known: () => true, async save(value, allowed) { await gate.promise; if (!allowed()) throw Error('mpv_options_cancelled'); return value; } } });
 const saving = button(f, 'mpv_options_save').attrs.onClick[0](); await settle(); assert.equal(f.view.mpvSavedHardware, 'ohcodec'); assert.equal(f.view.mpvOptionsBusy, true);
 gate.resolve(); await saving; assert.equal(f.view.mpvSavedHardware, 'no'); assert.equal(f.view.mpvSavedVideo, 'gpu'); assert.equal(f.view.mpvOptionsBusy, false);
});
test('page hide cancels a pending save and prevents late UI success', async () => {
 const gate = deferred(); const f = page({ mpvHardware: 'no', mpvStore: { known: () => true, async save(value, allowed) { await gate.promise; if (!allowed()) throw Error('mpv_options_cancelled'); return value; } } });
 const saving = button(f, 'mpv_options_save').attrs.onClick[0](); await settle(); f.view.onPageHide(); gate.resolve(); await saving;
 assert.equal(f.view.mpvSavedHardware, 'ohcodec'); assert.notEqual(f.view.mpvOptionsMessage, 'mpv_options_saved'); assert.equal(f.view.mpvOptionsBusy, false);
});
test('a stale account load cannot republish another page draft', async () => {
 const gate = deferred(); const f = page({ mpvOptionsKnown: false, mpvStore: { async load() { await gate.promise; }, requireOptions: () => ({ hwdec: 'no', vo: 'gpu' }) } });
 const loading = f.view.loadMpvOptions(); await settle(); f.AppService.client = { session: { userId: 'other' } }; gate.resolve(); await loading;
 assert.equal(f.view.mpvHardware, 'ohcodec'); assert.equal(f.view.mpvOptionsKnown, false);
});
test('read failure remains visible and repair requires an explicit save', async () => {
 const f = page({ mpvOptionsKnown: false, mpvStore: { known: () => false, async load() { throw Error('mpv_options_invalid'); }, async save(value, allowed) { assert.ok(allowed()); return value; } } });
 await f.view.loadMpvOptions(); assert.equal(f.view.mpvOptionsKnown, false); assert.equal(f.view.mpvOptionsMessage, 'mpv_options_invalid'); assert.equal(f.view.mpvSavedHardware, 'ohcodec');
 await button(f, 'mpv_options_save').attrs.onClick[0](); assert.equal(f.view.mpvOptionsKnown, true); assert.equal(f.view.mpvOptionsMessage, 'mpv_options_saved');
});
test('failed save retains the saved description while leaving the draft available for retry', async () => {
 const f = page({ mpvHardware: 'no', mpvStore: { known: () => true, async save() { throw Error('mpv_options_save_failed'); } } });
 await button(f, 'mpv_options_save').attrs.onClick[0](); assert.equal(f.view.mpvSavedHardware, 'ohcodec'); assert.equal(f.view.mpvHardware, 'no'); assert.equal(f.view.mpvOptionsMessage, 'mpv_options_save_failed');
});
test('Player actual backend data is independent of requested options and cleared for an error', () => {
 const f = render('Player'); f.view.syncBackend({ state: 'playing', backend: { hardwareDecoder: 'no', videoOutput: 'gpu', audioOutput: 'ohaudio' } });
 assert.equal(f.view.backendKnown, true); assert.equal(f.view.backendHardware, 'no'); assert.equal(f.view.backendVideo, 'gpu');
 f.view.syncBackend({ state: 'error', backend: { hardwareDecoder: 'ohcodec', videoOutput: 'gpu-next', audioOutput: 'ohaudio' } }); assert.equal(f.view.backendKnown, false);
 f.view.syncBackend({ state: 'playing' }); assert.equal(f.view.backendKnown, false);
});
(async () => { for (const [name, fn] of cases) { await fn(); console.log('PASS', name); } console.log(`${cases.length} MPV options UI cases passed. Actual SDK builders; not native geometry or hardware playback.`); })().catch(error => { console.error(error); process.exitCode = 1; });
