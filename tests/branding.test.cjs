// Resource/config checks and real adapter/session/store execution with explicit native fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const h = require('./player-regression.test.cjs');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const app = json('AppScope/app.json5').app;
const moduleConfig = json('entry/src/main/module.json5').module;
const appStrings = json('AppScope/resources/base/element/string.json').string;
const entryStrings = json('entry/src/main/resources/base/element/string.json').string;
const strings = new Map([...appStrings, ...entryStrings].map(s => [s.name, s.value]));
const { ProductIdentity } = h.load('utils/ProductIdentity.ts');
const { NativeHttpTransport } = h.load('api/NativeHttpTransport.ets');
const { SessionStore } = h.load('service/SessionStore.ets');
const { SystemPlayback } = h.load('service/SystemPlayback.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const fixture = { server: 'https://example.invalid/jellyfin', userId: 'fixture-user', deviceId: 'fixture-device', token: 'fixture-token' };
const requests = [];
let created = 0, destroyed = 0;
const http = h.platform.get('@ohos.net.http');
http.createHttp = () => { created++; return { async request(url, options) { requests.push({ url, options }); return { responseCode: 200, result: '{"ok":true}' }; }, destroy() { destroyed++; } }; };
Object.assign(h.platform.get('@ohos.util'), {
  TextEncoder: class { encodeInto(value) { return new TextEncoder().encode(value); } },
  TextDecoder: class { decodeToString(value) { return new TextDecoder().decode(value); } }
});
const secrets = new Map(), aliases = [];
const asset = h.platform.get('@ohos.security.asset');
Object.assign(asset, {
  Tag: { ALIAS: 'alias', SECRET: 'secret', RETURN_TYPE: 'return', ACCESSIBILITY: 'access', CONFLICT_RESOLUTION: 'conflict' },
  ReturnType: { ALL: 1 }, Accessibility: { DEVICE_UNLOCKED: 2 }, ConflictResolution: { OVERWRITE: 3 },
  async add(attrs) {
    assert.equal(attrs.get('access'), 2); assert.equal(attrs.get('conflict'), 3);
    const key = new TextDecoder().decode(attrs.get('alias')); aliases.push(key); secrets.set(key, attrs.get('secret'));
  },
  async query(attrs) {
    const key = new TextDecoder().decode(attrs.get('alias')); aliases.push(key);
    return secrets.has(key) ? [new Map([['secret', secrets.get(key)]])] : [];
  },
  async remove(attrs) {
    const key = new TextDecoder().decode(attrs.get('alias')); aliases.push(key);
    if (!secrets.delete(key)) throw Object.assign(new Error('not found'), { code: 24000002 });
  }
});
test('launcher name and product description are resource-backed and independently branded', () => {
  assert.equal(app.bundleName, 'com.cineisle.app'); assert.equal(app.vendor, 'CineIsle');
  assert.equal(app.label, '$string:app_name'); assert.equal(strings.get('app_name'), '映屿 · CineIsle');
  assert.match(strings.get('module_desc'), /映屿.*CineIsle/); assert.match(strings.get('version'), /映屿.*CineIsle/);
});
test('shared app name is defined once across scopes to prevent an inconsistent launcher/login label', () => {
  assert.equal([...appStrings, ...entryStrings].filter(s => s.name === 'app_name').length, 1);
  assert.equal(new Set(entryStrings.map(s => s.name)).size, entryStrings.length);
});
test('ability, launcher and starting window all resolve the current brand resources', () => {
  assert.equal(app.icon, '$media:app_icon');
  for (const ability of moduleConfig.abilities) {
    assert.equal(ability.label, app.label); assert.equal(ability.icon, app.icon); assert.equal(ability.startWindowIcon, app.icon);
  }
  assert.ok(fs.existsSync(path.join(root, 'AppScope/resources/base/media/app_icon.svg')));
});
test('machine identity and package version agree with the application manifest', () => {
  assert.equal(json('oh-package.json5').name, 'cineisle');
  assert.equal(ProductIdentity.CLIENT_NAME, 'CineIsle');
  assert.equal(ProductIdentity.VERSION, app.versionName); assert.equal(json('oh-package.json5').version, app.versionName);
});
test('shipping source/config/resources contain no legacy brand strings', () => {
  const files = ['AppScope/app.json5', 'oh-package.json5'];
  function collect(dir) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(next); else files.push(next);
    }
  }
  collect('AppScope/resources'); collect('entry/src/main');
  for (const file of files) assert.doesNotMatch(read(file), /findroid|dev\.jdtech/i, file);
});
test('logo is self-contained SVG with valid references and no executable/external/font assets', () => {
  const probe = spawnSync('python3', ['-c', `
import xml.etree.ElementTree as E,sys
root=E.parse(sys.argv[1]).getroot();ns='{http://www.w3.org/2000/svg}'
assert root.tag==ns+'svg' and root.attrib['viewBox']=='0 0 108 108'
ids={n.attrib['id'] for n in root.iter() if 'id' in n.attrib}
assert len(list(root.iter(ns+'path')))>=1
for n in root.iter():
 assert n.tag in {ns+x for x in ['svg','defs','linearGradient','stop','rect','path','circle']}
 for k,v in n.attrib.items():
  assert not k.lower().startswith('on') and 'href' not in k and 'http' not in v
  if v.startswith('url('): assert v.startswith('url(#') and v[5:-1] in ids
`, path.join(root, 'AppScope/resources/base/media/app_icon.svg')], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
});
test('authenticated native HTTP request advertises CineIsle while preserving authentication and proxy paths', async () => {
  const result = await new NativeHttpTransport(fixture).request('/Items', 'GET', [{ key: 'userId', value: fixture.userId }], '');
  assert.equal(result.ok, true); assert.equal(requests.at(-1).url, 'https://example.invalid/jellyfin/Items?userId=fixture-user');
  const header = requests.at(-1).options.header.Authorization;
  assert.equal(header, 'MediaBrowser Client="CineIsle", Device="HarmonyOS Phone", DeviceId="fixture-device", Version="0.1.0", Token="fixture-token"');
  assert.equal(destroyed, created); assert.match(header, /^[\x20-\x7e]+$/);
});
test('unauthenticated login requests identify the new client and omit the token', async () => {
  await new NativeHttpTransport({ ...fixture, token: '' }).request('/System/Info/Public', 'GET', [], '');
  const header = requests.at(-1).options.header.Authorization;
  assert.match(header, /Client="CineIsle"/); assert.doesNotMatch(header, /Token=/);
});
test('branding preserves header injection protection before a native connection is created', async () => {
  const before = created;
  await assert.rejects(new NativeHttpTransport({ ...fixture, deviceId: 'bad\r\nheader' }).request('/Items', 'GET', [], ''), /api_session_invalid/);
  assert.equal(created, before);
});
test('native media session uses new identity and lock-screen launch targets the actual new bundle', async () => {
  h.systemPlatform.reset();
  assert.equal(h.systemPlatform.context.abilityInfo.bundleName, app.bundleName);
  let paused = 0;
  const route = h.route();
  const controller = { snapshot: () => ({ route, state: 'paused', position: 0, duration: 60000, speed: 1, width: 1920, height: 1080 }),
    async pausePlayback() { paused++; return true; }, async close() {}, seek() {}, show() {}, async hide() { return true; } };
  const errors = [];
  const system = new SystemPlayback(h.systemPlatform.context, controller, {}, route, { changed() {}, error: e => errors.push(e), next: async () => {}, stopped() {} });
  try {
    await system.initialize(); await h.settle();
    const session = h.systemPlatform.sessions.at(-1);
    assert.equal(session.tag, 'CineIsle'); assert.equal(session.context, h.systemPlatform.context);
    assert.equal(h.systemPlatform.want.wants[0].bundleName, app.bundleName);
    assert.equal(h.systemPlatform.want.wants[0].abilityName, 'EntryAbility');
    assert.equal(session.metadata[0].title, route.item.Name);
    await session.emit('pause'); assert.equal(paused, 1); assert.deepEqual(errors, []);
  } finally { await system.dispose(); }
});
test('session save/load/clear share the CineIsle alias and preserve secret access settings', async () => {
  await SessionStore.save(fixture); assert.deepEqual(await SessionStore.load(), fixture);
  await SessionStore.clear(); assert.equal(await SessionStore.load(), undefined);
  assert.ok(aliases.length >= 4); assert.deepEqual([...new Set(aliases)], ['cineisle.current.session']);
});
test('repeated sign-out treats a missing CineIsle asset as already cleared', async () => {
  await SessionStore.clear(); await SessionStore.clear(); assert.equal(secrets.size, 0);
});
(async () => { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} branding regression tests passed. Native HTTP/Asset/AVSession fixtures do not prove device UI or server identification.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
