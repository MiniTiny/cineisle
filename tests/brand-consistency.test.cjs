// Actual SDK component trees and real confirmation callbacks; pixel geometry is separate.
const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const index = (props = {}, scale = 1) => render('Index', { ready: true, signedIn: true, load: () => {}, ...props }, scale);
const text = (f, label) => flat(f.roots).find(n => n.type === 'Text' && n.args[0] === 'app.string.' + label);
const image = (f, label) => flat(f.roots).find(n => n.type === 'Image' && n.args[0] === 'app.media.' + label);
for (const [width, height, scale, land] of [[320,640,1,false],[360,740,2,false],[760,280,1,true],[760,280,2,true]]) {
  test(`all primary browsing feedback remains in its native scroll at ${width}/${scale}x`, () => {
    for (const props of [{ tab:1 },{ tab:0 },{ tab:2 },{ tab:3 },{ tab:4 },{ tab:2,mode:'library' },{ mode:'search',searchExpanded:true }]) {
      const f=index({ ...props,viewportWidth:width,viewportHeight:height,landscape:land,busy:true,message:'long failure',cacheMessage:'cached response' },scale);
      const scroll=flat(f.roots).find(n => ['Grid','List','Scroll'].includes(n.type));
      assert.ok(scroll); assert.ok(flat(scroll.children).includes(text(f,'loading')));
      assert.ok(flat(scroll.children).some(n=>n.type==='Text'&&n.args[0]==='long failure'));
      assert.equal(flat(f.roots).find(n=>n.type==='LoadingProgress').attrs.color[0],'app.color.brand_accent');
      assert.equal(text(f,'no_items'),undefined);
    }
  });
}
test('home, recommendation, library and search empties use their own original semantic icons', () => {
  for (const [props,icon] of [[{tab:1},'nav_home_active'],[{tab:0},'nav_star_active'],[{tab:2},'nav_library_active'],[{mode:'library',tab:2},'nav_library_active'],[{mode:'search',searchExpanded:true},'nav_search_active']]) {
    const f=index(props); assert.ok(text(f,'no_items'));assert.ok(image(f,icon));
    const content=flat(f.roots).find(n=>['Grid','List'].includes(n.type)); assert.ok(flat(content.children).includes(text(f,'no_items')));
  }
});
test('actor credits show a real filtered empty only after loading stops', () => {
  for(const busy of [true,false]){const f=render('Actor',{person:{Id:'p',Name:'Person'},busy,works:[]});assert.equal(!!text(f,'no_items'),!busy);assert.equal(text(f,'no_filter_matches'),undefined);}
  const f=index({tab:3,syncedAt:1,profiles:[]});assert.ok(image(f,'nav_user_active'));assert.ok(text(f,'no_filter_matches'));
});
test('saved account/server, download and favorite empty states share the original card treatment', () => {
  for(const [page,props,label,icon] of [['Accounts',{},'no_saved_accounts','menu_accounts'],['Downloads',{},'no_downloads','menu_offline'],['Favorites',{all:[],visibleItems:[]},'no_favorites','detail_heart']]) {
    const f=render(page,props,2);assert.ok(text(f,label));assert.ok(image(f,icon));assert.equal(text(f,label).attrs.maxLines,undefined);
  }
  assert.ok(text(render('Accounts'),'no_saved_servers'));
});
test('native loading is a labeled muted row with a decorative teal indicator', () => {
  const f=render('BrandState',{label:'waiting',loading:true}),ns=flat(f.roots),spinner=ns.find(n=>n.type==='LoadingProgress');
  assert.equal(spinner.attrs.color[0],'app.color.brand_accent');assert.equal(spinner.attrs.accessibilityLevel[0],'no');
  assert.equal(ns.find(n=>n.type==='Text').attrs.fontColor[0],'app.color.brand_muted');
  assert.equal(ns.find(n=>n.type==='Row').attrs.backgroundColor[0],'app.color.brand_surface_raised');
});
test('all three favorites popup choices have persistent captions, brand colors and guarded invalid indices', () => {
  const f=render('Favorites',{genres:['Crime'],preview:false}),ns=flat(f.roots),selects=ns.filter(n=>n.type==='Select');
  for (const label of ['favorite_type','favorite_genre','favorite_order'])assert.ok(text(f,label));
  for(const s of selects){assert.equal(s.attrs.optionBgColor[0],'app.color.brand_surface');assert.equal(s.attrs.selectedOptionFontColor[0],'app.color.brand_accent');s.attrs.onSelect[0](-1);s.attrs.onSelect[0](999);}
  assert.equal(f.view.category,'');assert.equal(f.view.genre,'');assert.equal(f.view.order,'name');assert.equal(f.events.filter(e=>e[0]==='save').length,0);
  const empty=render('Favorites');assert.equal(flat(empty.roots).filter(n=>n.type==='Select')[1].attrs.enabled[0],false);
});
const cases = [
 ['account removal',()=>{const f=render('Accounts',{accounts:[{key:'a',userName:'A'}]});button(f,'remove_saved_account').attrs.onClick[0]();return f;}],
 ['server removal',()=>{const f=render('Accounts',{editingId:'server'});button(f,'remove_saved_server').attrs.onClick[0]();return f;}],
 ['credential reset',()=>{const f=render('Accounts');button(f,'reset_saved_accounts').attrs.onClick[0]();return f;}],
 ['favorite removal',()=>{const f=render('Favorites',{all:[{Id:'a'}],selection:true,selected:['a']});button(f,'batch_unfavorite').attrs.onClick[0]();return f;}],
 ['download removal',()=>{const f=render('Downloads',{category:'complete',records:[{id:'a',item:{Id:'a',Name:'A'},state:'complete'}]});button(f,'remove_download').attrs.onClick[0]();return f;}],
 ['logout',()=>{const f=index({tab:4});button(f,'change_account').attrs.onClick[0]();return f;}],
 ['server delete',()=>{const f=render('Detail',{busy:false,loaded:true,usingCache:false,item:{Id:'a',Name:'A',Type:'Movie',CanDelete:true}});f.view.deleteMedia();return f;}],
 ['download confirmation',()=>{const f=render('Detail',{busy:false,loaded:true,usingCache:false,item:{Id:'a',Name:'A',Type:'Movie',CanDownload:true,MediaSources:[{Id:'s'}]}});f.view.download();return f;}],
 ['batch download',()=>{const f=render('Detail',{busy:false,item:{Id:'s',Name:'S',Type:'Season'},children:[{Id:'a',Name:'A'}],selectedEpisodes:['a']});f.view.batchEpisodes();return f;}],
];
for (const [name,create] of cases) test(name+' retains native confirmation, palette and cancellation without writes',async()=>{
  const f=create(),d=f.events.find(e=>e[0]==='dialog')?.[1];assert.ok(d);assert.equal(d.nativeOptions.buttons.length,2);assert.equal(d.nativeOptions.primaryButton,undefined);assert.equal(d.nativeOptions.buttons[0].defaultFocus,true);
  assert.equal(f.normalize(d.backgroundColor),'app.color.brand_surface_raised');assert.equal(d.backgroundBlurStyle,0);assert.equal(d.cornerRadius,20);assert.equal(d.buttonDirection,1);
  assert.equal(f.normalize(d.primaryButton.fontColor),'app.color.brand_accent');
  assert.equal(f.normalize(d.secondaryButton.fontColor),['download confirmation','batch download'].includes(name)?'app.color.brand_accent':'app.color.brand_danger');
  await d.primaryButton.action();assert.ok(!f.events.some(e=>['edit','remove','removeServer','reset','removeDownload','deleteMedia','download','batchDownload','login'].includes(e[0])));
});
test('recommendation explanation keeps its actual reason and a themed native acknowledgment',()=>{
  const f=index({tab:0,discoveries:[{item:{Id:'a'},actors:['Actor'],genres:['Crime']}]});f.view.reason({Id:'a'});const d=f.events.at(-1)[1];assert.equal(d.message,'Actor · Crime');assert.equal(f.normalize(d.confirm.fontColor),'app.color.brand_accent');assert.equal(f.normalize(d.backgroundColor),'app.color.brand_surface_raised');
});
test('PIN gate uses original icon, persistent masked caption, scalable full action and guarded keyboard submit',async()=>{
  const f=render('PinGate',{pin:'12'},2);assert.ok(image(f,'menu_unlock'));assert.ok(text(f,'lock_pin'));assert.equal(button(f,'lock_unlock').attrs.enabled[0],false);
  const input=flat(f.roots).find(n=>n.type==='TextInput');assert.equal(input.attrs.type[0],2);assert.equal(input.attrs.maxLength[0],12);await input.attrs.onSubmit[0]();assert.equal(f.events.filter(e=>e[0]==='unlock').length,0);
  f.view.pin='123456';await input.attrs.onSubmit[0]();assert.deepEqual(f.events.find(e=>e[0]==='unlock'),['unlock','123456']);assert.equal(f.view.pin,'');assert.equal(f.view.busy,false);
});
test('PIN failure/busy keeps feedback in the scroll and blocks duplicate unlocks',async()=>{
  const f=render('PinGate',{pin:'123456',busy:true,message:'failure'},2);assert.ok(flat(f.roots).find(n=>n.type==='Scroll'));assert.equal(button(f,'lock_unlock').attrs.enabled[0],false);assert.ok(text(f,'loading'));await f.view.unlock();assert.equal(f.events.filter(e=>e[0]==='unlock').length,0);
  const wrong=render('PinGate',{pin:'123456'});wrong.AppLock.unlock=async()=>false;await wrong.view.unlock();assert.equal(wrong.view.message,'lock_pin_wrong');assert.equal(wrong.view.pin,'');
});
test('library pagination is contained in a full-span grid row and retains append semantics',()=>{
  let append;const f=index({tab:2,mode:'library',total:60,load:v=>append=v},2),g=flat(f.roots).find(n=>n.type==='Grid');assert.ok(flat(g.children).includes(button(f,'load_more')));button(f,'load_more').attrs.onClick[0]();assert.equal(append,true);
});
test('local file removal and server deletion have distinct original semantic shapes',()=>{
  const record={id:'a',state:'complete',item:{Id:'a'},mediaSourceId:'s'};
  const f=render('Detail',{busy:false,loaded:true,item:{Id:'a',Name:'A',Type:'Movie',CanDelete:true},records:[record]});
  const local=button(f,'remove_download'),remote=button(f,'server_delete');
  assert.equal(flat(local.children).find(n=>n.type==='Image').args[0],'app.media.detail_remove');
  assert.equal(flat(remote.children).find(n=>n.type==='Image').args[0],'app.media.detail_trash');
});
test('settings, retries and preference saves show a real busy indicator with disabled actions',()=>{
  for(const [page,props,action]of [['Settings',{busy:true,nextPin:'123456'},'lock_save'],['Downloads',{busy:true,category:'failed',records:[{id:'a',item:{Id:'a'},state:'failed'}]},'retry'],['Player',{settingsBusy:true,options:true,state:'prepared'},'save_playback_preferences']]){
    const f=render(page,props,2);assert.ok(text(f,'loading'));assert.equal(button(f,action).attrs.enabled[0],false);
  }
});
test('empty season/series children display only after successful loading, never during a fetch',()=>{
  for(const type of ['Series','Season'])for(const busy of [false,true]){
    const f=render('Detail',{busy,loaded:true,item:{Id:'a',Name:'A',Type:type},children:[]});assert.equal(!!text(f,type==='Series'?'no_seasons':'no_episodes'),!busy);
  }
});
test('short-window prompts use the actual API12 ComponentContent and safe close-before-action flow',async()=>{
  const f=index({tab:4,viewportHeight:280,viewportWidth:760});button(f,'change_account').attrs.onClick[0]();
  const e=f.events.find(e=>e[0]==='customDialog');assert.ok(e);assert.equal(e[1].data.width,760);assert.equal(e[1].data.height,280);assert.equal(e[2].autoCancel,true);
  let calls=0;e[1].data.actions[1].action=()=>calls++;e[1].data.choose(1);e[1].data.choose(1);await Promise.resolve();assert.equal(calls,1);assert.equal(f.events.filter(e=>e[0]==='closeCustomDialog').length,1);
  const normal=index({tab:4,viewportHeight:640});button(normal,'change_account').attrs.onClick[0]();assert.ok(normal.events.find(e=>e[0]==='dialog'));assert.equal(normal.events.find(e=>e[0]==='customDialog'),undefined);
});
test('short popup keeps heading and actions fixed with a separate readable native body scroll',()=>{
  const f=render('CompactDialog',{data:{title:'Full title',message:'Long body',width:760,height:280,actions:[{value:'Cancel'},{value:'Confirm'}],choose:()=>{},release:()=>{}}},2),ns=flat(f.roots),scroll=ns.find(n=>n.type==='Scroll');
  assert.equal(scroll.attrs.layoutWeight[0],1);assert.equal(ns.find(n=>n.type==='Column'&&n.attrs.id).attrs.height[0],252);
  const bs=ns.filter(n=>n.type==='Button');assert.equal(bs.length,2);for(const b of bs)assert.equal(flat(scroll.children).includes(b),false);assert.equal(bs[0].attrs.defaultFocus[0],true);
});
test('narrow short popup scrolls all text and controls instead of trapping them in a tiny body',()=>{
  const f=render('CompactDialog',{data:{title:'Title',message:'Body',width:320,height:280,actions:[{value:'Cancel'},{value:'Confirm'}],choose:()=>{},release:()=>{}}},2),ns=flat(f.roots),scroll=ns.find(n=>n.type==='Scroll');
  for(const b of ns.filter(n=>n.type==='Button'))assert.ok(flat(scroll.children).includes(b));
});

test('dismissed compact popup cannot perform a late action',()=>{
  const f=index({tab:4,viewportHeight:280,viewportWidth:760});button(f,'change_account').attrs.onClick[0]();const data=f.events.find(e=>e[0]==='customDialog')[1].data;data.release();data.choose(1);assert.equal(f.events.filter(e=>e[0]==='closeCustomDialog').length,0);
});

(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name)}console.log(`${tests.length} brand consistency regressions passed. SDK callbacks do not prove native pixels or service mutations.`)})().catch(e=>{console.error(e);process.exitCode=1});
