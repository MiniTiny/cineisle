// Real SDK builder compilation and registered UI callbacks; no native geometry claim.
const assert=require('node:assert/strict');
const {render,flat,button}=require('./brand-forms.test.cjs');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const members=[{Id:'m',Name:'Film',Type:'Movie'},{Id:'s',Name:'Show',Type:'Series'},{Id:'e',Name:'Episode',Type:'Episode'}];
for(const [width,scale]of [[320,1],[320,2],[760,2]])test(`collection ${width}vp/${scale}x groups members in one scrolling grid`,()=>{
 const f=render('Collection',{item:{Id:'box',Name:'A collection',Type:'BoxSet'},items:members,loaded:true,viewportWidth:width},scale),nodes=flat(f.roots);
 assert.deepEqual(f.events.filter(e=>e[0]==='card').map(e=>e[1]),['m','s','e']);assert.equal(nodes.filter(n=>n.type==='Grid').length,1);assert.ok(nodes.filter(n=>n.type==='Text').some(n=>n.args[0]==='app.string.media_episode'));
 assert.equal(button(f,'play'),undefined);assert.equal(button(f,'download'),undefined);button(f,'back').attrs.onClick[0]();assert.deepEqual(f.events.at(-1),['back']);
});
test('collection loading/error never renders a false empty success; empty response does',()=>{
 for(const state of [{busy:true},{message:'network_failed'}]){const f=render('Collection',{...state,loaded:false});assert.ok(!flat(f.roots).some(n=>n.type==='Text'&&n.args[0]==='app.string.collection_empty'));}
 assert.ok(flat(render('Collection',{loaded:true}).roots).some(n=>n.type==='Text'&&n.args[0]==='app.string.collection_empty'));
});
test('network settings native controls enforce roaming dependency and persist both values',()=>{
 const f=render('Settings');f.view.ownerClient=f.AppService.client;const checks=flat(f.roots).filter(n=>n.type==='Checkbox'),find=key=>checks.find(c=>c.attrs.accessibilityText[0]==='app.string.'+key);
 assert.equal(find('download_roaming').attrs.enabled[0],false);find('download_mobile').attrs.onChange[0](true);find('download_roaming').attrs.onChange[0](true);assert.equal(f.settings.downloadMobile,true);assert.equal(f.settings.downloadRoaming,true);find('download_mobile').attrs.onChange[0](false);assert.equal(f.settings.downloadRoaming,false);
});
function player(){const calls=[];const f=render('Player',{alive:true,visible:true,route:{item:{Id:'a',Name:'Film',Type:'Movie'},sources:[]},state:'playing',duration:60000,playbackPosition:20000,controller:{seek:v=>calls.push(['seek',v]),setSpeed:v=>calls.push(['speed',v])},system:{sync:()=>{}}});return {...f,calls};}
test('SDK registers exclusive one-finger pan and commits only on release',()=>{
 const f=player(),pan=f.gestures.find(g=>g.type==='PanGesture');assert.equal(pan.args[0].fingers,1);pan.callbacks.onActionStart({fingerList:[{localX:130,localY:100}],offsetX:30});pan.callbacks.onActionUpdate({offsetX:60});assert.equal(f.calls.length,0);pan.callbacks.onActionEnd();assert.deepEqual(f.calls,[['seek',35000]]);
 const cancelled=player(),p=cancelled.gestures.find(g=>g.type==='PanGesture');p.callbacks.onActionStart({fingerList:[{localX:130,localY:100}],offsetX:30});p.callbacks.onActionCancel();p.callbacks.onActionEnd();assert.equal(cancelled.calls.length,0);
});
test('SDK long-press cancellation and lock restore speed; double-tap and pinch reach actual methods',()=>{
 const f=player(),hold=f.gestures.find(g=>g.type==='LongPressGesture');hold.callbacks.onAction({fingerList:[{localX:100,localY:100}]});assert.equal(f.view.speed,2);hold.callbacks.onActionCancel();assert.equal(f.view.speed,1);
 const tap=f.gestures.find(g=>g.type==='TapGesture');assert.equal(tap.args[0].count,2);tap.callbacks.onAction({fingerList:[{localX:300,localY:100}]});assert.deepEqual(f.calls.at(-1),['seek',35000]);
 const pinch=f.gestures.find(g=>g.type==='PinchGesture');assert.equal(pinch.args[0].fingers,2);pinch.callbacks.onActionUpdate({scale:1.3});assert.equal(f.view.zoomed,true);hold.callbacks.onAction({fingerList:[{localX:100,localY:100}]});button(f,'controls_lock').attrs.onClick[0]();assert.equal(f.view.speed,1);assert.equal(f.view.controlsLocked,true);
});
(async()=>{for(const [n,f]of tests){await f();console.log('PASS '+n);}console.log(`${tests.length} other parity UI regressions passed. SDK callback fixtures do not prove physical gestures or native geometry.`);})().catch(e=>{console.error(e);process.exitCode=1;});
