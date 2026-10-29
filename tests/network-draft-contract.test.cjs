const f = require('./network-options-fixture.cjs'), { assert, h, Store, NetworkPolicy, NetworkOptions } = f;
const { NetworkOptionRules } = h.load('utils/NetworkOptions.ts'), { NativeHttpTransport } = h.load('api/NativeHttpTransport.ets');
const tests = [], test = (name, action) => tests.push({ name, action });
const fields = [['requestMs', 'requestSeconds', 'network_request_seconds'], ['connectMs', 'connectSeconds', 'network_connect_seconds'], ['readMs', 'readSeconds', 'network_read_seconds']];
const samples = [['1', true, 1], ['12', true, 12], ['120', true, 120], ['001', true, 1], ['0001', false], ['121', true], ['', false], [' 5', false], ['1.5', false], ['1e2', false], ['0x5', false], ['120\n', false], ['1\r\n', false], ['1\u2028', false]];
for (const [draft, textValid] of samples) test('network draft grammar ' + JSON.stringify(draft), async check => check(() => assert.equal(NetworkOptionRules.validTimeoutDraft(draft), textValid)));
for (const [key, field, label] of fields) for (const [draft, , seconds] of samples) test('network draft actual ' + key + ' ' + JSON.stringify(draft), async (check, time) => {
  const state = f.prefs.state;
  if (process.argv.includes('--unannounced-prefs-open')) state.failOpen = true;
  if (process.argv.includes('--unannounced-prefs-get')) state.failGet = true;
  await Store.load(h.context);
  const { render, flat, button } = f.ui(), r = render('Settings', { deviceVisible: true, networkSave: (value, allowed) => Store.save(value, allowed) }); r.view.ownerClient = r.AppService.client;
  const input = flat(r.roots).find(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.' + label); input.attrs.onChange[0](draft);
  if (process.argv.includes('--unannounced-prefs-flush')) state.failFlush = 1;
  await button(r, 'network_options_save').attrs.onClick[0]();
  const saved = NetworkPolicy.snapshot(), calls = state.calls.slice(); let requests = [], scheduled = [];
  if (seconds !== undefined) {
    const client = f.client(); f.provider(() => f.response({ ok: true }));
    await new NativeHttpTransport(client.session).request('/draft', 'GET', [], ''); requests = f.requests().slice(); scheduled = time.scheduled.slice();
  }
  check(() => {
    assert.equal(input.attrs.maxLength[0], 3); assert.equal(r.view.networkBusy, false);
    if (seconds === undefined) { assert.equal(r.view[field], draft); assert.equal(r.view.networkMessage, 'network_options_invalid'); assert.equal(saved[key], new NetworkOptions()[key]); assert.equal(calls.filter(c => c[0] === 'put').length, 0); }
    else {
      assert.equal(r.view[field], String(seconds)); assert.equal(r.view.networkMessage, 'network_options_saved'); assert.equal(saved[key], seconds * 1000);
      const expected = { requestMs: 30000, connectMs: 6000, readMs: 10000, autoCache: true, [key]: seconds * 1000 };
      const file = JSON.parse(require('node:fs').readFileSync(require('node:path').join(h.directory, 'network_options.fixture.json'), 'utf8')); assert.equal(file.settings_v1, JSON.stringify(expected));
      assert.equal(requests.length, 1); assert.equal(requests[0].options.connectTimeout, expected.connectMs); assert.equal(requests[0].options.readTimeout, expected.readMs); assert.ok(scheduled.some(timer => timer.ms === expected.requestMs));
    }
  });
});
test('network draft reset ignores malformed drafts in production button', async check => {
  await Store.load(h.context); const { render, flat, button } = f.ui(), r = render('Settings', { deviceVisible: true, networkSave: (value, allowed) => Store.save(value, allowed) }); r.view.ownerClient = r.AppService.client;
  for (const [, , label] of fields) flat(r.roots).find(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.' + label).attrs.onChange[0]('0001');
  await button(r, 'network_options_reset').attrs.onClick[0](); check(() => { assert.deepEqual(NetworkPolicy.snapshot(), { requestMs: 30000, connectMs: 6000, readMs: 10000, autoCache: true }); assert.equal(r.view.networkMessage, 'network_options_saved'); });
});
if (require.main === module) f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
