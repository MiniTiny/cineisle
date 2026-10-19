// Actual SDK builders and registered callbacks; native layouts and touch remain separate gates.
const assert=require('node:assert/strict');
const {render,flat,button}=require('./brand-forms.test.cjs');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
for(const [width,scale]of [[320,1],[320,2],[760,2]])test(`settings ${width}vp/${scale}x retains controls in a scroll container`,()=>{
 const f=render('Settings',{viewportWidth:width},scale),nodes=flat(f.roots);assert.equal(nodes.filter(n=>n.type==='Scroll').length,1);
 for(const key of ['player_gestures_enabled','player_seek_gesture','player_zoom_gesture','player_start_maximized','player_auto_pip'])assert.ok(nodes.some(n=>n.type==='Checkbox'&&n.attrs.accessibilityText[0]==='app.string.'+key));
 for(const key of ['player_back_seconds','player_forward_seconds']){const n=nodes.find(n=>n.type==='TextInput'&&n.attrs.accessibilityText?.[0]==='app.string.'+key);assert.equal(n.attrs.type[0],3);assert.equal(n.attrs.maxLength[0],3)}
 assert.ok(button(f,'player_save_steps'));assert.ok(button(f,'lock_save'));
});
test('settings native callbacks persist switches and validated seconds',()=>{
 const f=render('Settings');f.view.ownerClient=f.AppService.client;const nodes=flat(f.roots),check=key=>nodes.find(n=>n.type==='Checkbox'&&n.attrs.accessibilityText[0]==='app.string.'+key);
 check('player_auto_pip').attrs.onChange[0](true);assert.equal(f.settings.playerUi.autoPiP,true);check('player_gestures_enabled').attrs.onChange[0](false);assert.equal(f.settings.playerUi.gestures,false);
 const input=key=>nodes.find(n=>n.type==='TextInput'&&n.attrs.accessibilityText?.[0]==='app.string.'+key);input('player_back_seconds').attrs.onChange[0]('10');input('player_forward_seconds').attrs.onChange[0]('25');button(f,'player_save_steps').attrs.onClick[0]();assert.equal(f.settings.playerUi.back,10000);assert.equal(f.settings.playerUi.forward,25000);
});
test('gesture subcontrols disable when the global gesture preference is off',()=>{
 const f=render('Settings',{playerUi:{gestures:false,seek:true,zoom:true,startMaximized:false,autoPiP:false,back:5000,forward:15000}});for(const key of ['player_seek_gesture','player_zoom_gesture'])assert.equal(flat(f.roots).find(n=>n.type==='Checkbox'&&n.attrs.accessibilityText[0]==='app.string.'+key).attrs.enabled[0],false);
});
for(const [name,props]of [['Index',{ready:true,signedIn:false,server:'https://one.invalid'}],['Accounts',{adding:true,server:'https://one.invalid'}]])test(name+' public user click only fills username and clears password',()=>{
 const f=render(name,{...props,username:'old',password:'old-password'});const picker=[];const publicView=render('PublicUserPicker',{server:'https://one.invalid',users:[{id:'u',name:'User'}],onSelect:name=>picker.push(name),alive:true,loaded:true});const buttons=flat(publicView.roots).filter(n=>n.type==='Button');assert.equal(buttons.length,2);buttons.at(-1).attrs.onClick[0]();assert.deepEqual(picker,['User']);
 // The parent's compiled picker callback is exercised through its rendered child.
 const child=f.childViews.find(v=>v.constructor.name==='PublicUserPicker');assert.ok(child);child.onSelect('User');assert.equal(f.view.username,'User');assert.equal(f.view.password,'');assert.ok(f.events.some(e=>e[0]==='focus'&&e[1].endsWith('login-password')));assert.ok(button(f,'login'));
});
test('public picker async success/empty/error are distinct and leave password authentication untouched',async()=>{
 for(const response of [[{id:'u',name:'User'}],[],Error('permission_denied')]){const f=render('PublicUserPicker',{server:'https://one.invalid',publicRequest:async()=>{if(response instanceof Error)throw response;return response}});f.view.aboutToAppear();await f.view.load();if(response instanceof Error){assert.equal(f.view.loaded,false);assert.equal(f.view.message,'permission_denied')}else{assert.equal(f.view.loaded,true);assert.equal(f.view.users.length,response.length)}}
});
for(const action of ['server','leave'])test('late public list after '+action+' cannot publish old identities',async()=>{
 let resolve;const wait=new Promise(r=>resolve=r);const f=render('PublicUserPicker',{server:'https://one.invalid',publicRequest:()=>wait});f.view.aboutToAppear();const loading=f.view.load();if(action==='server'){f.view.server='https://other.invalid';f.view.serverChanged()}else f.view.aboutToDisappear();resolve([{id:'old',name:'Old'}]);await loading;assert.equal(f.view.users.length,0);assert.equal(f.view.loaded,false);assert.equal(f.view.busy,false);
});
test('disabled public picker does not request or choose a username',async()=>{
 let calls=0;const f=render('PublicUserPicker',{server:'https://one.invalid',available:false,users:[{id:'u',name:'User'}],publicRequest:async()=>{calls++;return[]},onSelect:()=>{calls++}});f.view.aboutToAppear();await f.view.load();for(const b of flat(f.roots).filter(n=>n.type==='Button')){assert.equal(b.attrs.enabled[0],false);b.attrs.onClick[0]()}assert.equal(calls,0);
});
if(require.main===module)(async()=>{for(const[name,fn]of tests){await fn();console.log('PASS '+name)}console.log(`${tests.length} remaining parity UI regressions passed. SDK fixtures do not prove native geometry or physical gestures.`)})().catch(e=>{console.error(e);process.exitCode=1});
