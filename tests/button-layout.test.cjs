// Actual ArkUI compiler + construction tree: verifies icon/label share the hit target.
// Native geometry is separately checked over captured layouts, not inferred here.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),loader='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(loader+'/node_modules/typescript'),ui=require(loader+'/lib/process_ui_syntax'),main=require(loader+'/main'),utils=require(loader+'/lib/utils'),validation=require(loader+'/lib/validate_ui_syntax'),pre=require(loader+'/lib/pre_define');
const options={...JSON.parse(fs.readFileSync(loader+'/tsconfig.json')).compilerOptions,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS};
const file=path.join(root,'entry/src/main/ets/pages/Index.ets'),src=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const page=src.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text==='Index'),method=page.members.find(n=>n.name?.getText(src)==='morePanel').getText(src);
const helpers=['menuAction','menuHeading','statusPanel'].map(name=>page.members.find(n=>n.name?.getText(src)===name).getText(src)).join('\n');
function compile(builder,detail=false){
 process.env.compiler=pre.BUILD_ON;main.projectConfig.projectPath=root;main.projectConfig.compileMode='jsbundle';main.partialUpdateConfig.partialUpdateMode=true;
 for(const type of ['string','color'])main.resources.app[type]=Object.fromEntries(JSON.parse(fs.readFileSync(`entry/src/main/resources/base/element/${type}.json`))[type].map((v,i)=>[v.name,i+1]));
 main.resources.app.media=Object.fromEntries(fs.readdirSync('entry/src/main/resources/base/media').filter(n=>n.endsWith('.svg')).map((n,i)=>[n.slice(0,-4),10000+i]));main.resources.app.media.app_icon=11000;utils.storedFileInfo.setCurrentArkTsFile();validation.resetValidateUiSyntax();ui.resetLog();validation.componentCollection.customComponents.add('BrandState');
 const code=`@Component struct LayoutProbe { @State fontScale: number = 1; @State viewportWidth: number = 360; @State viewportHeight: number = 800; @State tab: number = 4; @State syncing: boolean = false; @State pendingCount: number = 0; @State lastSyncedAt: number = 0; @State speed: number = 1; @State busy: boolean = false; @State message: string = ''; @State cacheMessage: string = ''; @State syncMessage: string = ''; ${helpers}\n ${builder}\n build(){this.morePanel()} }`;
 const actualCode=detail ? fs.readFileSync('entry/src/main/ets/components/DetailAction.ets','utf8').replace('export struct DetailAction','struct DetailAction') : code;
 const input=ts.createSourceFile(root+'/LayoutProbe.ets',actualCode,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(input.parseDiagnostics.length,0);
 const output=ts.transform(input,[ui.processUISyntax(null,true)],options);assert.deepEqual(ui.transformLog.errors.filter(e=>e.type==='ERROR'),[]);
 const printed=ts.createPrinter().printFile(output.transformed[0]);output.dispose();return ts.transpileModule(printed,{compilerOptions:options}).outputText;
}
function render(builder,detail=false,scale=1,syncing=false,width=360){
 const roots=[],stack=[],last={};roots.events=[];
 const resourceName=id=>{for(const type of ['string','media','color']){const name=Object.keys(main.resources.app[type]).find(k=>main.resources.app[type][k]===id);if(name)return 'app.'+type+'.'+name;}return id;};
 const component=name=>new Proxy({}, {get:(_,action)=>(...args)=>{
  if(['create','createWithLabel','createWithChild'].includes(action)){const normalized=args.map(a=>a&&typeof a==='object'&&'id' in a ? resourceName(a.id) : a);const n={type:name,args:normalized,attrs:{},children:[]};(stack.at(-1)?.children||roots).push(n);last[name]=n;if(!['Image','Blank'].includes(name))stack.push(n);}
  else if(action==='pop'){if(stack.at(-1)?.type===name)stack.pop();}
  else if(last[name])last[name].attrs[action]=args.map(a=>a&&typeof a==='object'&&'id' in a ? resourceName(a.id) : a);
 }});
 class View{constructor(){}createStorageLink(){return new Observed(1)}finalizeConstruction(){}observeComponentCreation2(fn){fn(1,true)}ifElseBranchUpdateFunction(_,fn){fn()}forEachUpdateFunction(_,items,fn){items.forEach(fn)}updateDirtyElements(){}}
 class Observed{constructor(v){this.v=v}get(){return this.v}set(v){this.v=v}purgeDependencyOnElmtId(){}aboutToBeDeleted(){}}
 const c={exports:{}, require:id=>{assert.equal(id,'../utils/UiLayout');return require('./ui-layout-fixture.cjs')}, UiLayout:require('./ui-layout-fixture.cjs').UiLayout, ObservedObject:{GetRawObject:v=>v},ViewPU:View,ObservedPropertySimplePU:Observed,ObservedPropertyObjectPU:Observed,SynchedPropertyObjectOneWayPU:Observed,SynchedPropertySimpleOneWayPU:Observed,ViewStackProcessor:component('ViewStackProcessor'),...Object.fromEntries(['Scroll','Column','Row','Stack','Button','Text','Image','Blank','If','Flex','ForEach'].map(n=>[n,component(n)])),$r:id=>id,router:{pushUrl:v=>roots.events.push(v)},showBrandDialog:(_context,v)=>roots.events.push(require('./dialog-fixture.cjs').dialogFixture(v)),AlertDialog:{show:v=>roots.events.push(require('./dialog-fixture.cjs').dialogFixture(v))},getContext:()=>({resourceManager:{getStringSync:()=>''}}),AppService:{client:{session:{userName:'fixture',server:''}},cancelSync:()=>roots.events.push('cancel'),flushPending:async()=>roots.events.push('flush'),experience:{snapshot:()=>({pending:[],positions:[]})}},BlurStyle:{NONE:0},DialogButtonDirection:{VERTICAL:1,HORIZONTAL:2},ButtonType:{Capsule:1,Normal:2},FlexAlign:{Center:1,SpaceBetween:2},HorizontalAlign:{Start:1},Alignment:{Center:1,TopStart:2},TextAlign:{Center:1,Start:2},HitTestMode:{None:1},FontWeight:{Medium:500},TextOverflow:{Ellipsis:1,Clip:2},FlexWrap:{Wrap:1}};
 vm.createContext(c);vm.runInContext(compile(builder,detail)+'\nthis.Probe='+ (detail?'DetailAction':'LayoutProbe')+';',c);const view=new c.Probe(undefined,detail?{label:'app.string.server_delete',icon:'fixture-icon'}:{});view.fontScale=scale;view.viewportWidth=width;view.syncing=syncing;view.load=()=>roots.events.push({tab:view.tab,mode:view.mode});view.sync=()=>roots.events.push('sync');view.logout=async()=>roots.events.push('logout');view.initialRender();return roots;
}
function flat(nodes){return nodes.flatMap(n=>[n,...flat(n.children)])}
function libraryButton(tree){return flat(tree).find(n=>n.type==='Button'&&(n.args.includes('app.string.tab_library')||flat(n.children).some(v=>v.type==='Text'&&v.args.includes('app.string.tab_library'))))}
const tests=[],test=(n,f)=>tests.push([n,f]);
test('every menu action has an original leading symbol and chevron inside its full-width target',()=>{
 const nodes=flat(render(method)),buttons=nodes.filter(n=>n.type==='Button');assert.equal(buttons.length,8);
 for(const b of buttons){assert.equal(b.attrs.width[0],'100%');const images=flat(b.children).filter(n=>n.type==='Image');assert.equal(images.length,2);assert.equal(images[1].args[0],'app.media.menu_chevron');assert.ok(b.attrs.onClick);assert.equal(flat(b.children).filter(n=>n.type==='Text').length,1);}
});
test('all decorative images share the row hit target and do not create accessibility targets',()=>{
 for(const b of flat(render(method)).filter(n=>n.type==='Button')){const children=flat(b.children);for(const im of children.filter(n=>n.type==='Image'))assert.equal(im.attrs.accessibilityLevel[0],'no');assert.equal(children.find(n=>n.type==='Row').attrs.hitTestBehavior[0],1);assert.ok(b.attrs.accessibilityText[0]);}
});
test('menu captions align consistently after the leading badge and have expandable two-line space',()=>{
 for(const b of flat(render(method)).filter(n=>n.type==='Button')){const t=flat(b.children).find(n=>n.type==='Text');assert.equal(t.attrs.layoutWeight[0],1);assert.equal(t.attrs.textAlign[0],2);assert.equal(t.attrs.maxLines[0],2);const row=flat(b.children).find(n=>n.type==='Row');assert.equal(row.attrs.constraintSize[0].minHeight,36);}
});
test('custom menu captions use medium weight and 16fp',()=>{const t=flat(libraryButton(render(method)).children).find(n=>n.type==='Text');assert.equal(t.attrs.fontWeight[0],500);assert.equal(t.attrs.fontSize[0],16)});
test('each menu destination retains a distinct semantic symbol and its click handler',()=>{
 const expected={favorites:'detail_heart',downloads:'detail_download',tab_library:'nav_library_active',settings:'menu_settings',sync_library:'menu_sync',flush_changes:'menu_upload',accounts_servers:'menu_accounts',change_account:'menu_logout'};
 const buttons=flat(render(method)).filter(n=>n.type==='Button');for(const [label,icon]of Object.entries(expected)){const b=buttons.find(n=>n.attrs.accessibilityText[0]==='app.string.'+label);assert.ok(b,label);assert.equal(flat(b.children).find(n=>n.type==='Image').args[0],'app.media.'+icon);assert.equal(typeof b.attrs.onClick[0],'function');}
});
test('logout retains its confirmation and syncing disables destructive or duplicate operations',()=>{
 const nodes=flat(render(method)),b=nodes.find(n=>n.type==='Button'&&n.attrs.accessibilityText[0]==='app.string.change_account');assert.match(String(b.attrs.onClick[0]),/showBrandDialog/);assert.match(String(b.attrs.onClick[0]),/await this.logout/);const busy=flat(render(method,false,1,true));assert.equal(busy.find(n=>n.type==='Button'&&n.attrs.accessibilityText[0]==='app.string.syncing').attrs.enabled[0],false);assert.equal(busy.find(n=>n.type==='Button'&&n.attrs.accessibilityText[0]==='app.string.change_account').attrs.enabled[0],false);assert.ok(busy.find(n=>n.type==='Button'&&n.attrs.accessibilityText[0]==='app.string.cancel_sync'));
});
test('icon-bearing controls invoke their real routes and sync actions; logout still requires dialog confirmation',async()=>{
 const roots=render(method),nodes=flat(roots),find=label=>nodes.find(n=>n.type==='Button'&&n.attrs.accessibilityText[0]==='app.string.'+label);
 for(const [label,page]of [['favorites','Favorites'],['downloads','Downloads'],['settings','Settings'],['accounts_servers','Accounts']]){find(label).attrs.onClick[0]();assert.equal(roots.events.at(-1).url,'pages/'+page)}
 find('tab_library').attrs.onClick[0]();assert.equal(roots.events.at(-1).tab,2);assert.equal(roots.events.at(-1).mode,'');find('sync_library').attrs.onClick[0]();assert.equal(roots.events.at(-1),'sync');await find('flush_changes').attrs.onClick[0]();assert.ok(roots.events.includes('flush'));
 find('change_account').attrs.onClick[0]();const dialog=roots.events.at(-1);assert.equal(dialog.message.id,main.resources.app.string.logout_confirm);assert.ok(!roots.events.includes('logout'));await dialog.secondaryButton.action();assert.equal(roots.events.at(-1),'logout');
});
for(const [width,scale,expected]of [[360,1,'48%'],[320,1,'100%'],[360,2,'100%']])test(`home shortcuts preserve icons and wrap at ${width}vp and ${scale}x`,()=>{
 const home=page.members.find(n=>n.name?.getText(src)==='homePanel').getText(src),block=home.slice(home.indexOf('Flex({ wrap: FlexWrap.Wrap'),home.indexOf('    if (this.usingCache)'));
 const nodes=flat(render('@Builder morePanel(){'+block+'}',false,scale,false,width));assert.equal(nodes.find(n=>n.type==='Flex').args[0].wrap,1);const columns=nodes.filter(n=>n.type==='Column');assert.equal(columns.length,2);for(const col of columns)assert.equal(col.attrs.width[0],expected);for(const b of nodes.filter(n=>n.type==='Button')){assert.equal(flat(b.children).filter(n=>n.type==='Image').length,1);assert.ok(b.attrs.onClick)}
});
test('detail action uses shared icon/text button with expandable left-aligned caption',()=>{const {render,flat}=require('./brand-forms.test.cjs'),f=render('DetailAction',{label:'app.string.server_delete',icon:'fixture-icon'},2),nodes=flat(f.roots),b=nodes.find(n=>n.type==='Button'),t=nodes.find(n=>n.type==='Text');assert.equal(b.attrs.width[0],'100%');assert.equal(b.attrs.constraintSize[0].minHeight,80);assert.equal(t.attrs.textAlign[0],1);assert.equal(t.attrs.maxLines[0],2);assert.equal(t.attrs.height,undefined);assert.equal(flat(b.children).filter(n=>n.type==='Image').length,1)});
test('all seven speed controls are retained in a full-width wrapping container',()=>{const playerTree=require('./brand-forms.test.cjs'),f=playerTree.render('Player',{options:true,route:{item:{Name:'Fixture',Type:'Movie'},sources:[],offline:true}}),nodes=playerTree.flat(f.roots),speeds=nodes.filter(n=>n.type==='Button'&&n.attrs.accessibilityText?.[0]?.endsWith('×')),wrap=nodes.find(n=>n.type==='Flex'&&n.args[0].wrap===1&&playerTree.flat(n.children).includes(speeds[0]));assert.equal(wrap.attrs.width[0],'100%');assert.equal(wrap.args[0].wrap,1);assert.deepEqual(speeds.map(n=>n.args[0]),['0.5×','0.75×','1×','1.25×','1.5×','1.75×','2×'])});
test('short menu scroll content remains anchored below its header',()=>{const s=flat(render(method)).find(n=>n.type==='Scroll');assert.equal(s.attrs.align[0],2)});
test('negative control catches an orphan icon outside the menu button',()=>{const bad=method.replace(/this.menuAction\(\$r\('app.string.tab_library'\)[^\n]+/, "Row() { Image($r('app.media.nav_library_active')); Button($r('app.string.tab_library')).onClick(() => {}) }");assert.notEqual(bad,method);const b=libraryButton(render(bad));assert.equal(flat(b.children).filter(n=>n.type==='Image').length,0);assert.equal(b.attrs.width,undefined)});
module.exports={render,flat,libraryButton,method};
if(require.main===module){(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name)}console.log(`${tests.length} button layout regressions passed. SDK tree construction is not native geometry.`);})().catch(e=>{console.error(e);process.exitCode=1})}
