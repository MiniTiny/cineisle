const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const candidate = { id: 'island', name: 'Island', address: 'http://192.168.1.20:8096' };
const settle = async () => { for (let n = 0; n < 4; n++) await new Promise(setImmediate); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const picker = f => f.childViews.find(v => v.constructor.name === 'ServerDiscoveryPicker');
for (const [width, height, scale] of [[320, 700, 1], [320, 700, 2], [760, 360, 1], [760, 360, 2]]) for (const name of ['Index', 'Accounts']) test(`${name} includes a bounded picker inside its scroll at ${width}x${height}/${scale}x`, () => {
 const f = render(name, { ready: true, adding: true, discoveryVisible: true, viewportWidth: width, viewportHeight: height }, scale); const ns = flat(f.roots);
 assert.ok(ns.some(n => n.type === 'Scroll')); assert.ok(picker(f)); assert.ok(button(f, 'discovery_start')); assert.ok(button(f, 'login')); assert.equal(button(f, 'discovery_start').attrs.width[0], '100%');
});
test('automatic scan runs once per visible activation and honors page/lock/offline admission', async () => {
 const gate = deferred(), f = render('ServerDiscoveryPicker', { active: true, discoveryMock: { start: () => gate.promise } });
 f.view.aboutToAppear(); f.view.maybeStart(); await settle(); assert.equal(f.events.filter(e => e[0] === 'discoveryStart').length, 1);
 f.view.active = false; f.view.visibilityChanged(); gate.resolve({ servers: [candidate], limited: false }); await settle(); assert.equal(f.view.servers.length, 0); assert.equal(f.view.scanning, false);
 f.view.active = true; f.view.locked = true; f.view.visibilityChanged(); assert.equal(f.events.filter(e => e[0] === 'discoveryStart').length, 1);
 f.view.locked = false; f.settings.offline = true; f.view.lockChanged(); assert.equal(f.events.filter(e => e[0] === 'discoveryStart').length, 1);
});
test('scan streams rows but candidate selection alone performs verification', async () => {
 const gate = deferred(); let progress; const chosen = []; const f = render('ServerDiscoveryPicker', { active: true, onSelect: s => chosen.push(s), discoveryMock: { start: update => { progress = update; return gate.promise; }, verify: async s => ({ ...s, name: 'Verified' }) } });
 f.view.aboutToAppear(); progress([candidate]); assert.equal(f.view.servers.length, 1); assert.equal(chosen.length, 0); assert.ok(!f.events.some(e => e[0] === 'discoveryVerify'));
 await f.view.choose(candidate); assert.equal(chosen[0].name, 'Verified'); gate.resolve({ servers: [], limited: false }); await settle(); assert.equal(f.view.servers.length, 1);
});
for (const invalidate of ['stop', 'visibilityChanged', 'addressChanged', 'lockChanged', 'aboutToDisappear']) test(invalidate + ' invalidates late verification', async () => {
 const gate = deferred(), chosen = [], f = render('ServerDiscoveryPicker', { active: true, onSelect: s => chosen.push(s), discoveryMock: { verify: () => gate.promise } });
 f.view.owner = f.AppService.client; f.view.alive = true; f.view.servers = [candidate]; const pending = f.view.choose(candidate);
 if (invalidate === 'visibilityChanged') f.view.active = false; if (invalidate === 'lockChanged') f.view.locked = true;
 f.view[invalidate](); gate.resolve(candidate); await pending; assert.equal(chosen.length, 0); assert.equal(f.view.verifying, false);
});
test('account replacement also prevents late selection', async () => {
 const gate = deferred(), chosen = [], f = render('ServerDiscoveryPicker', { active: true, onSelect: s => chosen.push(s), discoveryMock: { verify: () => gate.promise } });
 f.view.owner = f.AppService.client; f.view.alive = true; f.view.servers = [candidate]; const pending = f.view.choose(candidate); f.AppService.client = { session: { userId: 'other' } }; gate.resolve(candidate); await pending; assert.equal(chosen.length, 0);
});
test('empty, limited, failure, stopped and verifying states retain explicit feedback/actions', () => {
 for (const [props, expected] of [[{ loaded: true }, 'discovery_empty'], [{ scanning: true }, 'discovery_scanning'], [{ verifying: true }, 'discovery_verifying']]) {
  const f = render('ServerDiscoveryPicker', { active: true, ...props }); assert.ok(flat(f.roots).some(n => n.type === 'Text' && n.args[0] === 'app.string.' + expected));
  assert.ok(button(f, props.scanning || props.verifying ? 'discovery_stop' : 'discovery_start'));
 }
 for (const message of ['discovery_failed', 'discovery_limit_reached', 'discovery_stopped']) { const f = render('ServerDiscoveryPicker', { active: true, message }); assert.ok(flat(f.roots).some(n => n.type === 'Text' && n.args[0] === message)); }
});
for (const name of ['Index', 'Accounts']) test(name + ' verified selection fills address, clears credentials and manual edit drops identity', () => {
 const f = render(name, { ready: true, adding: true, discoveryVisible: true, username: 'old', password: 'private' });
 picker(f).onSelect(candidate); assert.equal(f.view.server, candidate.address); assert.equal(f.view.discoveredId, candidate.id); assert.equal(f.view.username, ''); assert.equal(f.view.password, ''); assert.ok(!f.events.some(e => ['login', 'saveServer', 'route'].includes(e[0])));
 const input = flat(f.roots).find(n => n.type === 'TextInput');
 input.attrs.onChange[0](candidate.address); assert.equal(f.view.discoveredId, candidate.id);
 input.attrs.onChange[0]('https://manual.invalid'); assert.equal(f.view.discoveredId, '');
});
test('Quick Connect navigation preserves verified identity while manual path retains original route', () => {
 const f = render('Index', { ready: true, discoveryVisible: true }); picker(f).onSelect(candidate); button(f, 'quick_connect_login').attrs.onClick[0](); assert.equal(f.events.at(-1)[2].expectedServerId, candidate.id);
 f.view.changeServer('https://manual.invalid'); f.view.openQuick(); assert.equal(f.events.at(-1)[2].expectedServerId, undefined);
});
test('parent page hide disables discovery even when the page is cached', () => {
 const f = render('Accounts', { adding: true }); f.view.onPageHide(); assert.equal(f.view.visible, false);
 const index = render('Index', { ready: true, discoveryVisible: true }); index.AppService.unsubscribeDownloads = index.AppService.unsubscribeAccount = () => {}; index.view.onPageHide(); assert.equal(index.view.discoveryVisible, false);
});
test('expired saved account opens its login form without remaining busy or keeping stale discovery identity', async () => {
 const f = render('Accounts', { discoveredId: 'stale', password: 'old' }); f.AppService.switchAccount = async () => { throw Error('login_expired'); };
 await f.view.select({ key: 'saved', address: candidate.address, userName: 'Fixture' }); assert.equal(f.view.busy, false); assert.equal(f.view.adding, true); assert.equal(f.view.server, candidate.address); assert.equal(f.view.discoveredId, ''); assert.equal(f.view.password, '');
});
(async () => { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); } console.log(`${tests.length} discovery UI regressions passed. SDK callbacks do not prove native geometry or real LAN routing.`); })().catch(e => { console.error(e); process.exitCode = 1; });
