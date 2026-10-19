const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
const tests = [], test = (name, fn) => tests.push([name, fn]);
function page(props = {}, scale = 1) {
  const f = render('Settings', { deviceVisible: true, deviceLoaded: true, deviceSaved: 'Old room', deviceDraft: 'New room', ...props }, scale);
  f.view.ownerClient = f.AppService.client; f.AppService.client.session.deviceId = 'device'; return f;
}
const field = f => flat(f.roots).find(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.device_name_label');
for (const [width, height, scale] of [[320, 700, 1], [320, 700, 2], [760, 360, 1], [760, 360, 2]]) test(`device settings ${width}x${height}vp/${scale}x scroll with existing settings`, () => {
  const f = page({ viewportWidth: width, viewportHeight: height }, scale); const nodes = flat(f.roots);
  assert.equal(nodes.filter(n => n.type === 'Scroll').length, 1); assert.equal(field(f).attrs.maxLength[0], 64); assert.equal(field(f).attrs.type[0], 0);
  for (const key of ['device_name_refresh', 'device_name_save', 'lock_save', 'player_save_steps']) assert.ok(button(f, key));
  assert.ok(nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.device_name_label'));
});
test('save callback runs guarded POST then confirmation without saving account preferences', async () => {
  const f = page(); const calls = [];
  f.AppService.client.updateDeviceName = async (name, admit) => { assert.equal(admit(), true); calls.push(['POST', name]); };
  f.AppService.client.deviceName = async admit => { assert.equal(admit(), true); calls.push(['GET']); return 'New room'; };
  await button(f, 'device_name_save').attrs.onClick[0](); assert.deepEqual(calls, [['POST', 'New room'], ['GET']]);
  assert.equal(f.view.deviceLoaded, true); assert.equal(f.view.deviceSaved, 'New room'); assert.equal(f.view.deviceMessage, 'device_name_saved');
  assert.ok(!f.events.some(e => e[0] === 'save'));
});
test('refresh callback replaces the draft only with a confirmed remote value', async () => {
  const f = page({ deviceLoaded: false }); f.AppService.client.deviceName = async () => 'Remote room';
  await button(f, 'device_name_refresh').attrs.onClick[0](); assert.equal(f.view.deviceDraft, 'Remote room'); assert.equal(f.view.deviceLoaded, true);
});
for (const props of [{ deviceBusy: true }, { offline: true }, { deviceLoaded: false }]) test('write and input are disabled for ' + JSON.stringify(props), () => {
  const f = page(props); assert.equal(field(f).attrs.enabled[0], false); assert.equal(button(f, 'device_name_save').attrs.enabled[0], false);
});
test('a failed or unconfirmed request never presents a confirmed-current-name label', () => {
  const f = page({ deviceLoaded: false, deviceMessage: 'permission_denied' }); const nodes = flat(f.roots);
  assert.ok(nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.device_name_unknown'));
  assert.ok(!nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.device_name_current'));
  assert.equal(button(f, 'device_name_refresh').attrs.enabled[0], true);
});
test('offline preference callback invalidates a pending device response', () => {
  const f = page({ deviceBusy: true }); const revision = f.view.deviceRevision;
  flat(f.roots).find(n => n.type === 'Checkbox' && n.attrs.accessibilityText[0] === 'app.string.offline_mode').attrs.onChange[0](true);
  assert.equal(f.view.deviceLoaded, false); assert.equal(f.view.deviceBusy, false); assert.ok(f.view.deviceRevision > revision);
});
(async () => { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} device name UI regressions passed. SDK callbacks do not prove native layout or actual server authorization.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
