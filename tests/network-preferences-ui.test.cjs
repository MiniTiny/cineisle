const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const field = (f, name) => flat(f.roots).find(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.' + name);
function page(props = {}, scale = 1) { const f = render('Settings', { deviceVisible: true, requestSeconds: '8', connectSeconds: '2', readSeconds: '3', autoCache: false, ...props }, scale); f.view.ownerClient = f.AppService.client; return f; }
for (const [width, height, scale] of [[320,700,1], [320,700,2], [760,360,1], [760,360,2]]) test(`network group stays in shared scroll at ${width}x${height}/${scale}x`, () => {
 const f = page({ viewportWidth: width, viewportHeight: height }, scale); assert.equal(flat(f.roots).filter(n => n.type === 'Scroll').length, 1);
 for (const label of ['network_request_seconds','network_connect_seconds','network_read_seconds']) { assert.equal(field(f,label).attrs.type[0], 3); assert.equal(field(f,label).attrs.maxLength[0],3); }
 for (const label of ['network_options_save','network_options_reset','device_name_refresh','player_save_steps','lock_save']) assert.ok(button(f,label));
});
test('actual input and checkbox callbacks save one app-level transaction', async () => {
 const f = page(); field(f,'network_request_seconds').attrs.onChange[0]('12'); field(f,'network_connect_seconds').attrs.onChange[0]('4'); field(f,'network_read_seconds').attrs.onChange[0]('5');
 flat(f.roots).find(n => n.type === 'Checkbox' && n.attrs.accessibilityText?.[0] === 'app.string.network_auto_cache').attrs.onChange[0](true);
 assert.ok(!f.events.some(e=>e[0]==='networkSave')); await button(f,'network_options_save').attrs.onClick[0]();
 assert.deepEqual(f.events.find(e=>e[0]==='networkSave')[1], { requestMs:12000, connectMs:4000, readMs:5000, autoCache:true }); assert.equal(f.view.networkMessage,'network_options_saved'); assert.ok(!f.events.some(e=>e[0]==='save'));
});
test('invalid seconds preserve draft and do not invoke preferences', async () => {
 for (const value of ['', '0', '121', '-1', '2.5', '1e2', ' 6']) { const f=page({connectSeconds:value}); await button(f,'network_options_save').attrs.onClick[0](); assert.equal(f.view.networkMessage,'network_options_invalid'); assert.equal(f.view.connectSeconds,value); assert.ok(!f.events.some(e=>e[0]==='networkSave')); }
});
test('save failure retains draft without a success message', async () => {
 const f = page({networkSave:async()=>{throw Error('network_options_save_failed')}}); await button(f,'network_options_save').attrs.onClick[0](); assert.equal(f.view.connectSeconds,'2'); assert.equal(f.view.networkMessage,'network_options_save_failed'); assert.equal(f.view.networkBusy,false);
});
test('reset uses the visible action and restores defaults including cache', async () => {
 const f=page();await button(f,'network_options_reset').attrs.onClick[0]();assert.deepEqual(f.events.find(e=>e[0]==='networkSave')[1],{requestMs:30000,connectMs:6000,readMs:10000,autoCache:true});assert.equal(f.view.requestSeconds,'30');assert.equal(f.view.connectSeconds,'6');assert.equal(f.view.autoCache,true);
});
test('busy controls prevent overlapping changes and remain in visible feedback group', () => {
 const f=page({networkBusy:true});assert.equal(button(f,'network_options_save').attrs.enabled[0],false);assert.equal(button(f,'network_options_reset').attrs.enabled[0],false);assert.equal(field(f,'network_request_seconds').attrs.enabled[0],false);
});
test('cached settings page cannot save after hide or account replacement', async () => {
 const hidden=page();hidden.view.onPageHide();await hidden.view.saveApiNetwork();assert.ok(!hidden.events.some(e=>e[0]==='networkSave'));
 const replaced=page();replaced.AppService.client={session:{userId:'other'}};await replaced.view.saveApiNetwork();assert.ok(!replaced.events.some(e=>e[0]==='networkSave'));
});
(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name)}console.log(`${tests.length} network UI regressions passed. SDK fixtures do not prove native geometry or real timing.`)})().catch(e=>{console.error(e);process.exitCode=1});
