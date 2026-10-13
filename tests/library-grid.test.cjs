// Compile the actual mediaGrid builder with the installed ArkUI compiler, then execute
// its generated observer callbacks. Dependency/diff fixtures verify refresh, not pixels.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sdk = process.env.DEVECO_CONTENTS || '/Applications/DevEco-Studio.app/Contents';
const loader = path.join(sdk, 'sdk/default/openharmony/ets/build-tools/ets-loader');
const ts = require(path.join(loader, 'node_modules/typescript'));
const ui = require(path.join(loader, 'lib/process_ui_syntax'));
const main = require(path.join(loader, 'main'));
const utils = require(path.join(loader, 'lib/utils'));
const validation = require(path.join(loader, 'lib/validate_ui_syntax'));
const pre = require(path.join(loader, 'lib/pre_define'));
const options = { ...JSON.parse(fs.readFileSync(path.join(loader, 'tsconfig.json'))).compilerOptions,
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS };
const sourceFile = path.join(root, 'entry/src/main/ets/pages/Index.ets');
const source = ts.createSourceFile(sourceFile, fs.readFileSync(sourceFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const page = source.statements.find(node => ts.isStructDeclaration(node) && node.name.text === 'Index');
const builder = page.members.find(node => node.name?.getText(source) === 'mediaGrid');
const calls = [];
function collect(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'this.mediaGrid') calls.push(node.getText(source));
  ts.forEachChild(node, collect);
}
collect(page.members.find(node => node.name?.getText(source) === 'build'));
assert.equal(calls.length, 1);
function compile(method, call, home = false, detail = false) {
  process.env.compiler = pre.BUILD_ON;
  main.projectConfig.projectPath = root;
  main.resources.app.string = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, 'entry/src/main/resources/base/element/string.json'))).string.map((value, index) => [value.name, index + 1]));
  main.resources.app.media = Object.fromEntries(fs.readdirSync(path.join(root,'entry/src/main/resources/base/media')).filter(n=>n.endsWith('.svg')).map((n,i)=>[n.slice(0,-4),10000+i]));
  main.resources.app.color = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, 'entry/src/main/resources/base/element/color.json'))).color.map((value, index) => [value.name, index + 1000]));
  main.projectConfig.compileMode = 'jsbundle';
  main.partialUpdateConfig.partialUpdateMode = true;
  utils.storedFileInfo.setCurrentArkTsFile();
  validation.resetValidateUiSyntax(); ui.resetLog();
  validation.componentCollection.customComponents.add('MediaCard');
  validation.componentCollection.customComponents.add('HomeShelf');
  const state = detail ? "@State children: MediaItem[] = [];\n@State item: MediaItem = { Id: 'show', Type: 'Series' };" : home ? '@State homeSections: HomeSection[] = []; @State homeFailures: Object[] = []; @State usingCache: boolean = false;\n@State busy: boolean = false;' : '@State items: MediaItem[] = [];';
  const text = `interface HomeSection { id: string; items: MediaItem[] }\ninterface MediaItem { Id: string; Type?: string; Name?: string; UserData?: Object }\n@Component\nstruct GridProbe {\n@State fontScale: number = 1; @State viewportWidth: number = 360; @State viewportHeight: number = 800;\n@State tab: number = 1; @State mode: string = ''; @State landscape: boolean = false; @State discover: boolean = true;\n${state}\n${page.members.filter(n=>['menuAction','menuHeading'].includes(n.name?.getText(source))).map(n=>n.getText(source)).join('\n')}\n${method}\n${page.members.find(n=>n.name?.getText(source)==='recommendFilters').getText(source)}\nprivate open(item: MediaItem): void {}\nprivate openChild(item: MediaItem): void {}\nprivate openLibrary(section: HomeSection): void {}\nbuild() { ${call} }\n}`;
  const input = ts.createSourceFile(path.join(root, 'GridProbe.ets'), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(input.parseDiagnostics.length, 0);
  const transformed = ts.transform(input, [ui.processUISyntax(null, true)], options);
  assert.deepEqual(ui.transformLog.errors.filter(e => e.type === 'ERROR'), []);
  const printed = ts.createPrinter().printFile(transformed.transformed[0]); transformed.dispose();
  return ts.transpileModule(printed, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
}
const detailSource = ts.createSourceFile(path.join(root, 'entry/src/main/ets/pages/Detail.ets'), fs.readFileSync(path.join(root, 'entry/src/main/ets/pages/Detail.ets'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const detailPage = detailSource.statements.find(node => ts.isStructDeclaration(node) && node.name.text === 'Detail');
const detail = compile(detailPage.members.find(node => node.name?.getText(detailSource) === 'childrenPanel').getText(detailSource), 'this.childrenPanel()', false, true);
const current = compile(builder.getText(source), calls[0]);
const control = compile(builder.getText(source).replace('mediaGrid()', 'mediaGrid(data: MediaItem[])')
  .replace('ForEach(this.items,', 'ForEach(data,'), 'this.mediaGrid(this.items)');
const home = compile(page.members.find(node => node.name?.getText(source) === 'homePanel').getText(source), 'this.homePanel()', true);
function fixture(code) {
  let active;
  const created = [], spans = [];
  const gridItem = new Proxy({}, {get:(_,name)=>(...args)=>{if(name==='create')spans.push({});else if(spans.length)spans.at(-1)[name]=args[0]}});
  class View {
    constructor() { this.callbacks = new Map(); this.dirty = new Set(); this.lists = new Map(); this.nextId = 1; this.branches = new Map(); }
    finalizeConstruction() {}
    observeComponentCreation2(fn) {
      const id = this.nextId++; this.callbacks.set(id, fn); this.observe(id, true);
    }
    observe(id, initial) { const previous = active; active = { owner: this, id }; try { this.callbacks.get(id)?.(id, initial); } finally { active = previous; } }
    forEachUpdateFunction(id, items, generate, key) {
      const before = new Set(this.lists.get(id) || []), next = items.map(key);
      assert.equal(new Set(next).size, next.length); this.lists.set(id, next);
      items.forEach(item => { if (!before.has(key(item))) generate(item); });
    }
    updateDirtyElements() { const dirty = [...this.dirty]; this.dirty.clear(); dirty.forEach(id => this.observe(id, false)); }
    ifElseBranchUpdateFunction(branch, build) {
      const id = active.id, before = this.branches.get(id);
      if (before?.branch === branch) return;
      if (before) for (const child of before.children) { this.callbacks.delete(child); this.dirty.delete(child); this.lists.delete(child); }
      const start = this.nextId; build(); this.branches.set(id, { branch, children: Array.from({ length: this.nextId - start }, (_, n) => start + n) });
    }
    updateStateVarsOfChildByElmtId() {}
    static create(card) { created.push(card.item?.Id ?? card.section.id); }
  }
  class Observed {
    constructor(value, owner) { this.value = value; this.owner = owner; this.dependencies = new Set(); }
    get() { if (active?.owner === this.owner) this.dependencies.add(active.id); return this.value; }
    set(value) { this.value = value; this.dependencies.forEach(id => this.owner.dirty.add(id)); }
    purgeDependencyOnElmtId(id) { this.dependencies.delete(id); }
    aboutToBeDeleted() {}
  }
  const component = new Proxy({}, { get: () => () => {} });
  let renderingListItem = false;
  const listItem = new Proxy({}, { get: (target, name) => name === 'create' ? (render) => {
    if (typeof render === 'function' && !renderingListItem) { renderingListItem = true; try { render(active.id, true); } finally { renderingListItem = false; } }
  } : () => {} });
  const context = { UiLayout: require('./ui-layout-fixture.cjs').UiLayout, ViewStackProcessor: component, __Common__: component, ViewPU: View, ObservedPropertyObjectPU: Observed, ObservedObject: { GetRawObject: value => value }, Column:component, Row: component, Flex:component, Button: component, Checkbox: component, Grid: component, GridItem: gridItem, ForEach: component, List: component, ListItem: listItem, Text: component, If: component,
    FlexWrap: { Wrap:1 }, TextOverflow:{Clip:2,Ellipsis:1},ButtonType:{Normal:1},FontWeight:{Medium:500},FlexAlign:{Center:1,SpaceBetween:2},TextAlign:{Start:1},HitTestMode:{None:1},Image:component, Axis: { Horizontal: 0 }, BarState: { Off: 0 }, ObservedPropertySimplePU: Observed, $r: id => ({ id }),
    MediaCard: class { constructor(parent, params) { this.item = params.item; } },
    HomeShelf: class { constructor(parent, params) { this.section = params.section; } } };
  vm.createContext(context); vm.runInContext(code + '\nthis.Probe = GridProbe;', context);
  const view = new context.Probe(undefined, {}); view.initialRender();
  return { view, created, spans, visible: () => [...view.lists.values()].flat().map(key => key.split('|')[0]), update(items) { if ('children' in view) view.children = items; else if ('homeSections' in view) view.homeSections = items; else view.items = items; view.rerender(); } };
}
const movies = (count, prefix = 'movie') => Array.from({ length: count }, (_, n) => ({ Id: `${prefix}-${n}`, Name: `Movie ${n}`, Type: 'Movie' }));
const tests = [
  ['async movie library renders all 23 cards after an initially empty builder', () => {
    const f = fixture(current); assert.deepEqual(f.visible(), []); f.update(movies(23));
    assert.deepEqual(f.visible(), movies(23).map(i => i.Id)); assert.equal(f.created.length, 23);
  }],
  ['refresh replaces identities instead of keeping the first captured array', () => {
    const f = fixture(current); f.update(movies(23)); f.update(movies(2, 'refresh'));
    assert.deepEqual(f.visible(), ['refresh-0', 'refresh-1']);
  }],
  ['pagination appends cards and keeps existing stable IDs', () => {
    const f = fixture(current); f.update(movies(60)); f.update(movies(83));
    assert.deepEqual(f.visible(), movies(83).map(i => i.Id)); assert.equal(f.created.length, 83);
  }],
  ['empty results and account clearing remove the rendered list', () => {
    const f = fixture(current); f.update(movies(23)); f.update([]); assert.deepEqual(f.visible(), []);
    f.update(movies(1, 'account-b')); assert.deepEqual(f.visible(), ['account-b-0']);
  }],
  ['offline snapshot publication refreshes the same media builder', () => {
    const f = fixture(current); f.update(movies(23, 'cached')); assert.equal(f.visible().length, 23);
    f.update(movies(3, 'online')); assert.deepEqual(f.visible(), ['online-0', 'online-1', 'online-2']);
  }],
  ['negative control reproduces the previous by-value builder staying empty', () => {
    const f = fixture(control); f.update(movies(23)); assert.deepEqual(f.visible(), []);
    assert.equal(f.created.length, 0); assert.equal(f.view.items.length, 23);
  }]
];
tests.push(['short landscape recommendation controls occupy one complete grid row', () => {
 const f=fixture(current);f.view.tab=0;f.view.landscape=true;f.view.viewportHeight=280;f.view.viewportWidth=760;f.view.fontScale=2;f.view.rerender();assert.ok(f.spans.some(s=>s.columnStart===0&&s.columnEnd===2));f.update(movies(2));assert.equal(f.created.length,2);
}]);
tests.push(['keyboard-like portrait height changes retain the separate filter mode', () => {
 const f=fixture(current);f.view.tab=0;f.view.viewportHeight=280;f.view.landscape=false;f.view.rerender();assert.equal(f.spans.filter(s=>s.columnStart===0).length,0);
}]);
module.exports = { createGrid: () => fixture(current), createHome: () => fixture(home), createDetail: () => fixture(detail) };
tests.push(['same movie identity republishes changed watched/metadata into a new card', () => { const f = fixture(current); const first = movies(1); f.update(first); f.update([{ ...first[0], Name: 'Changed', UserData: { Played: true } }]); assert.deepEqual(f.visible(), ['movie-0']); assert.equal(f.created.length, 2); }]);
const sections = ids => ids.map(id => ({ id, kind: 'latest', name: id, libraryId: id, items: movies(1, id) }));
tests.push(
  ['home SDK observer renders shelves from an initially empty state', () => {
    const f = fixture(home); f.update(sections(['resume', 'nextup', 'library-films']));
    assert.deepEqual(f.visible(), ['resume', 'nextup', 'library-films']);
  }],
  ['home SDK observer replaces refreshed shelves and removes empty ones', () => {
    const f = fixture(home); f.update(sections(['library-a', 'library-b'])); f.update(sections(['library-b', 'library-c']));
    assert.deepEqual(f.visible(), ['library-b', 'library-c']);
  }],
  ['home SDK observer removes shelves on logout and accepts an offline publication', () => {
    const f = fixture(home); f.update(sections(['private-a'])); f.update([]); assert.deepEqual(f.visible(), []);
    f.update(sections(['cached-b'])); assert.deepEqual(f.visible(), ['cached-b']);
  }]
);
const seasons = (count, prefix = 'season') => movies(count, prefix).map((item, n) => ({ ...item, Type: 'Season', IndexNumber: n }));
tests.push(
  ['detail SDK observer publishes async seasons from initially empty children', () => {
    const f = fixture(detail); f.update(seasons(3)); assert.equal(f.visible().length, 3); assert.equal(f.created.length, 3);
  }],
  ['detail SDK observer replaces refreshed seasons and removes hidden child lists', () => {
    const f = fixture(detail); f.update(seasons(2)); f.update(seasons(1, 'new')); assert.equal(f.visible().length, 1); assert.match(f.visible()[0], /new/);
    f.update([]); assert.deepEqual(f.visible(), []);
  }],
  ['detail SDK observer updates episode children after season selection', () => {
    const f = fixture(detail); f.view.item = { Id: 'selected', Type: 'Season' }; f.update(movies(2, 'episode'));
    assert.equal(f.visible().length, 2); assert.match(f.visible()[0], /episode/); f.update([]); assert.deepEqual(f.visible(), []);
  }]
);
tests.push(['detail refresh with the same identity updates played status and poster tag', () => {
  const f = fixture(detail); const before = seasons(1); f.update(before); const first = f.visible()[0];
  f.update(before.map(item => ({ ...item, UserData: { Played: true }, ImageTags: { Primary: 'new-tag' } })));
  assert.notEqual(f.visible()[0], first); assert.match(f.visible()[0], /true:new-tag/); assert.equal(f.created.length, 2);
}]);
if (require.main === module) {
  for (const [name, test] of tests) { test(); console.log('PASS ' + name); }
  console.log(`${tests.length} library grid regressions passed. Actual SDK builder transform; observer/diff fixtures do not prove device pixels or native layout.`);
}
