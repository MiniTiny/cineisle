// Actual async N-API -> Execute -> Rasterize -> Complete. Only external layout results are controlled.
const assert=require('node:assert/strict');
const {native:n}=require('./native-entry-build.cjs').build({captionLayout:true});
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const run=()=>({text:'a',family:'',size:20,baseline:0,color:0xffffffff,bold:false,italic:false,underline:false,strike:false});
const request=()=>({width:100,maxLines:2,intrinsic:false,runs:[run()],shadows:[]});
async function check(q,{height=20,boxes='1',longest=100}={},code='caption_fixture_budget_admitted'){
  const values={CINEISLE_LAYOUT_HEIGHT:String(height),CINEISLE_LAYOUT_BOXES:boxes,CINEISLE_LAYOUT_LONGEST:String(longest)};
  const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
  Object.assign(process.env,values);
  try{await assert.rejects(n.renderCaption(q),e=>e.message===code)}finally{
    for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
}
for(const [height,valid]of [[0,false],[0.1,true],[32767,true],[32767.1,true],[32768,true],[32768.1,false],[32769,false],[-1,false],[NaN,false],[Infinity,false]])test('caption post-layout height '+height,async()=>{
  const q=request();q.width=1;await check(q,{height},valid?'caption_fixture_budget_admitted':'caption_frame_too_large');
});
// Integer frame dimensions cannot represent area 2073601 within the native dimensions.
// Use an exact N-1 area, exact N, and the next tested valid integer geometry above N.
for(const [width,height,area,valid]of [[1435,1437,2073599,true],[1436,1436,2073600,true],[1437,1436,2075040,false]])test('caption pixels including base halo '+area,async()=>{
  assert.equal((width+4)*(height+4),area);const q=request();q.width=width;
  await check(q,{height},valid?'caption_fixture_budget_admitted':'caption_frame_too_large');
});
for(const [width,valid]of [[1435,true],[1435.1,true],[1436.1,false]])test('caption width ceiling before pixel admission '+width,async()=>{
  const q=request();q.width=width;await check(q,{height:1436},valid?'caption_fixture_budget_admitted':'caption_frame_too_large');
});
for(const [width,valid]of [[1425,true],[1426,true],[1427,false]])test('caption shadow halo participates in final area '+width,async()=>{
  const q=request();q.width=width;q.shadows=[{color:0,x:2,y:0,radius:1}];
  // Production halo is ceil(1*3+2)+2=7, so 1426+2*7 is exactly 1440.
  await check(q,{height:1426},valid?'caption_fixture_budget_admitted':'caption_frame_too_large');
});
for(const [longest,valid]of [[1436,true],[1437,false]])test('caption intrinsic re-layout width budget '+longest,async()=>{
  const q=request();q.width=3000;q.intrinsic=true;
  await check(q,{height:1436,longest},valid?'caption_fixture_budget_admitted':'caption_frame_too_large');
});
for(const count of [16383,16384,16385])test('caption one-run line boxes '+count,async()=>{
  const q=request();q.runs[0].underline=true;
  await check(q,{boxes:String(count)},count>16384?'caption_frame_too_complex':'caption_fixture_budget_admitted');
});
for(const [counts,valid]of [['8192,8191',true],['8192,8192',true],['8192,8193',false]])test('caption cumulative line boxes '+counts,async()=>{
  const q=request();q.runs=[{...run(),underline:true},{...run(),underline:true}];
  await check(q,{boxes:counts},valid?'caption_fixture_budget_admitted':'caption_frame_too_complex');
});
test('non-underlined runs do not consume the underline box budget',async()=>{
  await check(request(),{boxes:'99999'});
});
(async()=>{for(const[name,fn]of tests){await fn();console.log('PASS '+name)}console.log(`${tests.length} native caption budget tests passed. Actual production budget path with controlled layout; no font/paint/ABI acceptance.`)})().catch(e=>{console.error(e);process.exitCode=1});
