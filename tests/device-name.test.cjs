// Product client and settings methods with explicit native HTTP/account/PIN fixtures.
const assert = require('node:assert/strict');
const h = require('./feature-regression.test.cjs');
const { AppService } = h.load('service/AppService.ets');
const { Settings } = h.load('pages/Settings.ets');
const { JellyfinClient } = h.load('service/JellyfinClient.ets');
const { AppLock } = h.load('service/AppLock.ets');
const { deviceNameValue } = h.load('utils/DeviceOptions.ts');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const ok = name => h.response({ DeviceId: 'mock-device', CustomName: name });
const ack = () => ({ responseCode: 204, result: '' });
function page(props = {}) {
  const client = h.activate(); const p = new Settings(); p.aboutToAppear();
  Object.assign(p, { locked: false, deviceVisible: true, deviceLoaded: true, deviceSaved: 'Old room', deviceDraft: 'New room', ...props });
  return { p, client };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
test('name boundaries allow Unicode, escaped JSON text and clearing, reject controls and overlength', () => {
  assert.equal(deviceNameValue(' 房间 "A" \\ One '), '房间 "A" \\ One'); assert.equal(deviceNameValue('  '), '');
  assert.equal(deviceNameValue('岛'.repeat(64)).length, 64);
  for (const value of ['a'.repeat(65), 'room\n1', 'room\r1', 'a\u0000b', '\troom', 12, null]) assert.throws(() => deviceNameValue(value), /device_name_invalid/);
});
test('GET accepts a default name but rejects malformed or another device response', async () => {
  const client = h.activate(); for (const name of [null, '', 'Room']) { h.queue.push(ok(name)); assert.equal(await client.deviceName(() => true), name || ''); }
  for (const value of [null, [], 'room', 42, { CustomName: 3 }, { CustomName: 'a\nb' }, { DeviceId: 'another-device', CustomName: 'Room' }]) {
    h.queue.push(h.response(value)); await assert.rejects(client.deviceName(() => true), /api_response_invalid/);
  }
});
test('write admission after version negotiation prevents a cancelled POST', async () => {
  const active = h.activate(); const client = new JellyfinClient({ ...active.session }); const gate = h.deferred(); let permitted = true;
  h.queue.push(gate.promise); const request = client.updateDeviceName('Room', () => permitted); await settle();
  permitted = false; gate.resolve(h.response({ Id: 'server', Version: '10.10.0' }));
  await assert.rejects(request, /device_name_cancelled/); assert.equal(h.requests.length, 1); assert.equal(h.requests[0].options.method, 'GET');
});
test('stable device ID is captured before negotiation and cannot silently change', async () => {
  const active = h.activate(); const client = new JellyfinClient({ ...active.session }); const gate = h.deferred();
  h.queue.push(gate.promise); const request = client.updateDeviceName('Room', () => true); await settle();
  client.session.deviceId = 'replaced'; gate.resolve(h.response({ Id: 'server', Version: '10.10.0' }));
  await assert.rejects(request, /device_name_cancelled/); assert.equal(h.requests.length, 1);
});
test('name is confirmed only after POST acknowledgement and matching GET', async () => {
  const { p, client } = page(); h.queue.push(ack(), ok('New room')); await p.saveDeviceName();
  assert.equal(p.deviceSaved, 'New room'); assert.equal(p.deviceDraft, 'New room'); assert.equal(p.deviceLoaded, true);
  assert.equal(p.deviceBusy, false); assert.match(p.deviceMessage, /device_name_saved/); assert.equal(client.session.deviceId, 'mock-device');
  assert.deepEqual(h.requests.map(r => r.options.method), ['POST', 'GET']);
  assert.deepEqual(JSON.parse(h.requests[0].options.extraData), { CustomName: 'New room' });
});
test('empty draft resets the remote custom name without changing stable identity', async () => {
  const { p, client } = page({ deviceDraft: '  ' }); h.queue.push(ack(), ok(null)); await p.saveDeviceName();
  assert.equal(p.deviceDraft, ''); assert.equal(p.deviceSaved, ''); assert.equal(p.deviceLoaded, true); assert.equal(client.session.deviceId, 'mock-device');
  assert.deepEqual(JSON.parse(h.requests[0].options.extraData), { CustomName: '' });
});
for (const status of [401, 403, 503]) test('HTTP ' + status + ' cannot fake save success or immediately replay the write', async () => {
  const { p } = page(); h.queue.push({ responseCode: status, result: '' }); await p.saveDeviceName();
  assert.equal(p.deviceSaved, 'Old room'); assert.equal(p.deviceDraft, 'New room'); assert.equal(p.deviceLoaded, false);
  assert.ok(p.deviceMessage); assert.ok(!p.deviceMessage.includes('device_name_saved')); assert.equal(p.deviceBusy, false);
  await p.saveDeviceName(); assert.equal(h.requests.length, 1);
});
test('unknown write outcome is resolved by explicit refresh, not an automatic second POST', async () => {
  const { p } = page(); h.queue.push(new Error('network_failed')); await p.saveDeviceName();
  assert.equal(p.deviceLoaded, false); h.queue.push(ok('New room')); await p.loadDeviceName();
  assert.equal(p.deviceSaved, 'New room'); assert.equal(p.deviceLoaded, true);
  assert.deepEqual(h.requests.map(r => r.options.method), ['POST', 'GET']);
});
test('confirmation mismatch and failed read both require a fresh read before another write', async () => {
  for (const result of [ok('Someone else'), new Error('network_failed')]) {
    h.reset(); const { p } = page(); h.queue.push(ack(), result); await p.saveDeviceName();
    assert.equal(p.deviceLoaded, false); assert.equal(p.deviceDraft, 'New room'); assert.equal(p.deviceSaved, 'Old room');
    assert.ok(!p.deviceMessage.includes('device_name_saved')); assert.equal(h.requests.length, 2);
  }
});
for (const props of [{ offline: true }, { locked: true }, { deviceBusy: true }, { deviceLoaded: false }, { deviceVisible: false }]) test('settings gate blocks writes: ' + JSON.stringify(props), async () => {
  const { p } = page(props); await p.saveDeviceName(); assert.equal(h.requests.length, 0);
});
test('actual PIN gate blocks writes before the UI StorageLink updates', async () => {
  const { p } = page(); AppLock.locked = true; await p.saveDeviceName(); assert.equal(h.requests.length, 0);
});
for (const phase of ['load', 'post', 'confirm']) for (const action of ['hide', 'account', 'PIN', 'offline']) test(phase + ' late response cannot publish after ' + action, async () => {
  const { p } = page(); const gate = h.deferred();
  if (phase === 'load') h.queue.push(gate.promise);
  else if (phase === 'post') h.queue.push(gate.promise);
  else h.queue.push(ack(), gate.promise);
  const running = phase === 'load' ? p.loadDeviceName() : p.saveDeviceName(); await settle();
  if (action === 'hide') p.onPageHide();
  else if (action === 'account') h.activate('other');
  else if (action === 'PIN') { AppLock.locked = true; p.locked = true; p.deviceLockChanged(); }
  else { p.offline = true; p.invalidateDevice(); }
  gate.resolve(phase === 'post' ? ack() : ok('New room')); await running;
  assert.equal(p.deviceLoaded, false); assert.equal(p.deviceSaved, 'Old room'); assert.ok(!p.deviceMessage.includes('device_name_saved'));
  assert.equal(h.requests.length, phase === 'confirm' ? 2 : 1);
});
test('a previous load cannot overwrite a new page show or clear its busy state', async () => {
  const { p } = page(); const old = h.deferred(), current = h.deferred(); h.queue.push(old.promise);
  const first = p.loadDeviceName(); await settle(); p.onPageHide(); h.queue.push(current.promise); p.onPageShow(); await settle();
  old.resolve(ok('Stale')); await first; assert.equal(p.deviceBusy, true); assert.equal(p.deviceLoaded, false);
  current.resolve(ok('Current')); await settle(); assert.equal(p.deviceDraft, 'Current'); assert.equal(p.deviceBusy, false);
});
if (require.main === module) (async () => {
  for (const [name, fn] of tests) { h.reset(); await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} device name regressions passed. HTTP/PIN/account fixtures do not prove real-server permissions or native UI.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
