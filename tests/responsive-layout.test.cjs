// Responsive policy and actual SDK-generated button trees. Native sizes are a separate gate.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {UiLayout:L}=require('./ui-layout-fixture.cjs'),tree=require('./button-layout.test.cjs');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
for(const [width,scale,count] of [[320,1,2],[366,1,3],[760,1,6],[320,2,1],[366,2,1],[760,2,3]])
 test(`grid adapts to ${width}vp at ${scale}x`,()=>assert.equal(L.columns(width,scale).split(' ').length,count));
test('unknown width and malformed font configuration have safe defaults',()=>{assert.equal(L.columns(NaN,NaN),'1fr 1fr 1fr');for(const value of [undefined,NaN,Infinity,-1,0])assert.equal(L.scale(value),1);assert.equal(L.scale(9),3.2)});
for(const height of [280,320,640,800])for(const scale of [1,2])
 test(`filters reserve media space at ${height}vp and ${scale}x`,()=>{const remaining=height-L.headerHeight(scale)-L.navHeight(scale)-48-L.filters(height,scale);assert.ok(remaining>=18,`remaining ${remaining}`)});
test('player options preserve a video region in short landscape',()=>{for(const scale of [1,2]){assert.ok(280-L.headerHeight(scale)-36-L.playerControls(280,scale,true)>=60)}});
test('shelves reserve scaled title and episode subtitle height',()=>{for(const wide of [false,true]){const width=L.shelfWidth(260,wide);assert.ok(width<=220);assert.ok(L.shelfHeight(260,2,wide)-width*(wide?9/16:3/2)>=128)}});
test('two-times font menu hit target grows without separating its icon',()=>{const b=tree.libraryButton(tree.render(tree.method,false,2));assert.equal(b.attrs.constraintSize[0].minHeight,80);assert.equal(tree.flat(b.children).filter(n=>n.type==='Image').length,2)});
test('two-times font detail caption retains two lines inside an enlarged button',()=>{const nodes=tree.flat(tree.render('',true,2));assert.equal(nodes.find(n=>n.type==='Text').attrs.height[0],56);const b=nodes.find(n=>n.type==='Button');assert.equal(b.attrs.height[0],92);assert.equal(b.attrs.width[0],144)});
test('font follow-system is declared using the app configuration profile',()=>{const app=JSON.parse(fs.readFileSync('AppScope/app.json5'));assert.equal(app.app.configuration,'$profile:configuration');const config=JSON.parse(fs.readFileSync('AppScope/resources/base/profile/configuration.json'));assert.equal(config.configuration.fontSizeScale,'followSystem');assert.equal(config.configuration.fontSizeMaxScale,'3.2')});
test('negative controls expose the original fixed grids and fixed label height',()=>{assert.notEqual('1fr 1fr 1fr',L.columns(320,2));const bad=tree.flat(tree.render('',true,2));assert.notEqual(bad.find(n=>n.type==='Text').attrs.height[0],28)});
test('short landscape filters scroll with media instead of clipping an 80vp field inside 44vp',()=>{assert.equal(L.separateFilters(280,true),false);assert.equal(L.separateFilters(640,false),true);assert.equal(L.separateFilters(280,false),true);assert.equal(L.separateFilters(700,true),true)});
for(const [name,fn] of tests){fn();console.log('PASS '+name)}console.log(`${tests.length} responsive layout regressions passed. SDK fixtures do not prove native geometry.`);
