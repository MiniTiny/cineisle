// SDK-compiled actual Player builders; device geometry and PixelMap lifetime are separate evidence.
const assert=require('node:assert/strict');
const {render,flat}=require('./brand-forms.test.cjs');
const tests=[],test=(n,f)=>tests.push([n,f]);
const frame={bitmap:{nativeFixture:true},canvasWidth:640,canvasHeight:360,left:40,top:60,width:160,height:28};
function player(overrides={}){return render('Player',{route:{item:{Id:'movie',Name:'ASS',Type:'Movie'},sources:[]},alive:true,visible:true,state:'paused',frameReady:true,styledFrame:frame,surfaceWidth:360,surfaceHeight:360,...overrides});}
for(const zoomed of [false,true])test('ASS image follows '+(zoomed?'cover':'contain')+' geometry and is clipped independently of subtitle text styles',()=>{
 const f=player({zoomed}),nodes=flat(f.roots),image=nodes.find(n=>n.type==='Image'&&n.attrs.id?.[0]==='playbackAssSubtitle');assert.ok(image);assert.equal(image.args[0],frame.bitmap);
 assert.equal(image.attrs.width[0],zoomed?160:90);assert.equal(image.attrs.height[0],zoomed?28:15.75);
 assert.deepEqual({...image.attrs.position[0]},zoomed?{x:-100,y:60}:{x:22.5,y:112.5});
 assert.ok(nodes.some(n=>n.type==='Stack'&&n.attrs.clip?.[0]===true&&n.attrs.hitTestBehavior?.[0]===1&&flat(n.children).includes(image)));
});
for(const props of [{styledFrame:undefined},{frameReady:false},{pipActive:true},{locked:true}])test('ASS page image is absent for '+JSON.stringify(props),()=>{const f=player(props);assert.equal(flat(f.roots).some(n=>n.type==='Image'&&n.attrs.id?.[0]==='playbackAssSubtitle'),false);});
(async()=>{for(const[n,f]of tests){await f();console.log('PASS '+n);}console.log(tests.length+' ASS UI regression tests passed. SDK trees do not prove pixels or native GPU lifetime.');})().catch(e=>{console.error(e);process.exitCode=1;});
