const f = require('./device-contract-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
async function read(mode) {
  if (mode === 'client') return f.observed(f.client().deviceName(() => true));
  const page = f.page({ deviceLoaded: false });
  await page.button('device_name_refresh').attrs.onClick[0]();
  return { page };
}
function verify(check, mode, result, accepted, expected = '') {
  const requests = f.requests().map(r => ({ method: r.options.method, pathname: r.url.pathname, id: r.url.searchParams.get('id') }));
  if (mode === 'page') result.page.view.initialRender();
  check(() => {
    assert.equal(requests.length, 2);
    assert.equal(requests[0].pathname.endsWith('/System/Info/Public'), true);
    assert.equal(requests[1].pathname.endsWith('/Devices/Options'), true);
    assert.deepEqual(requests.map(r => r.method), ['GET', 'GET']);
    assert.equal(requests[1].id, f.client().session.deviceId);
    if (mode === 'client') {
      if (accepted) { assert.ifError(result.error); assert.equal(result.value, expected); }
      else assert.equal(result.error?.message, 'api_response_invalid');
      return;
    }
    const v = result.page.view;
    assert.equal(v.deviceLoaded, accepted); assert.equal(v.deviceBusy, false);
    assert.equal(v.deviceSaved, accepted ? expected : 'Old');
    assert.equal(v.deviceDraft, accepted ? expected : 'Draft');
    assert.equal(v.deviceMessage, accepted ? '' : 'api_response_invalid:');
    const field = f.ui().flat(result.page.roots).filter(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.device_name_label').at(-1);
    assert.equal(field.args[0].text, accepted ? expected : 'Draft');
    assert.equal(field.attrs.maxLength[0], 64);
  });
}
for (const mode of ['client', 'page']) {
  for (const encoding of ['ascii', 'unicode']) for (const n of [1023, 1024, 1025]) test(`${mode} device response ${encoding} ${n}`, async check => {
    const value = encoding === 'ascii' ? 'a'.repeat(n) : '😀'.repeat(Math.floor(n / 2)) + '字'.repeat(n % 2);
    assert.equal(value.length, n);
    f.remote({ DeviceId: f.client().session.deviceId, CustomName: value });
    verify(check, mode, await read(mode), n <= 1024, value);
  });
  for (const n of [1023, 1024, 1025]) test(`${mode} device response raw whitespace ${n}`, async check => {
    const value = ' '.repeat(n - 1) + 'x'; f.remote({ CustomName: value });
    verify(check, mode, await read(mode), n <= 1024, value);
  });
  for (const [label, dto, accepted, expected] of [
    ['missing name', {}, true, ''], ['null name', { CustomName: null }, true, ''],
    ['null id', { DeviceId: null, CustomName: ' room ' }, true, ' room '],
    ['empty name', { CustomName: '' }, true, ''], ['escaped', { CustomName: ' 房间 "A" \\ ' }, true, ' 房间 "A" \\ '],
    ['foreign id', { DeviceId: 'foreign', CustomName: 'room' }, false],
    ['numeric name', { CustomName: 1 }, false], ['object name', { CustomName: {} }, false],
    ['newline', { CustomName: 'a\nb' }, false], ['NUL', { CustomName: 'a\0b' }, false], ['DEL', { CustomName: 'a\u007fb' }, false],
    ['array DTO', [], false], ['null DTO', null, false], ['string DTO', 'room', false]
  ]) test(`${mode} device response ${label}`, async check => { f.remote(dto); verify(check, mode, await read(mode), accepted, expected); });
}
test('cold response cancellation during version negotiation makes no device GET', async check => {
  const gate = f.h.deferred(); f.versionGate(gate); let allowed = true;
  const running = f.observed(f.client().deviceName(() => allowed)); await f.settle(); allowed = false;
  gate.resolve(f.response({ Id: f.client().session.serverId, Version: '10.10.0' })); const result = await running;
  check(() => { assert.equal(result.error?.message, 'device_name_cancelled'); assert.equal(f.requests().length, 1); });
});
test('client retains original response semantics after admission during a pending GET', async check => {
  const gate = f.h.deferred(); f.readGate(gate); let allowed = true;
  const work = f.observed(f.client().deviceName(() => allowed)); await f.settle(); allowed = false;
  gate.resolve(f.response({ CustomName: ' late ' })); const result = await work;
  check(() => { assert.ifError(result.error); assert.equal(result.value, ' late '); assert.equal(f.requests().length, 2); });
});
test('SDK refresh after page hide discards an otherwise valid server response', async check => {
  const gate = f.h.deferred(); f.readGate(gate); const page = f.page({ deviceLoaded: false });
  const work = page.button('device_name_refresh').attrs.onClick[0](); await f.settle(); const pending = page.view.deviceBusy;
  page.view.onPageHide(); gate.resolve(f.response({ CustomName: ' late ' })); await work;
  check(() => { assert.equal(pending, true); assert.equal(page.view.deviceSaved, 'Old'); assert.equal(page.view.deviceDraft, 'Draft'); assert.equal(page.view.deviceLoaded, false); assert.equal(f.requests().length, 2); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
