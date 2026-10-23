// Actual N-API callbacks and AssRenderer validation. Host N-API/libass fixtures are not device rendering.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {native:n,directory}=require('./native-entry-build.cjs').build();
const font=path.join(directory,'font.fixture');fs.writeFileSync(font,'explicit fixture, not a font');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const run=()=>({text:'a',family:'',size:20,baseline:0,color:0xffffffff,bold:false,italic:false,underline:false,strike:false});
const caption=()=>({width:100,maxLines:2,intrinsic:false,runs:[run()],shadows:[]});
const admitted=q=>assert.rejects(n.renderCaption(q),/caption_native_unavailable/);
const denied=q=>assert.throws(()=>n.renderCaption(q),/caption_argument_invalid/);
function utf8(size){return '中😀'.repeat(Math.floor(size/7))+'x'.repeat(size%7);}
for(const size of [4194303,4194304,4194305])test('ASS create UTF-8 bytes '+size,async()=>{
  const text=utf8(size);assert.equal(Buffer.byteLength(text),size);assert.ok(text.length<size);
  if(size>4194304)assert.throws(()=>n.create(text,font,''),/ass_argument_invalid/);
  else {const handle=await n.create(text,font,'');assert.equal(handle.native,true);n.close(handle);}
});
for(const [field,maximum]of [['font',4096],['family',512],['configuration',4096]])for(const delta of [-1,0,1])test(`ASS ${field} UTF-8 boundary ${maximum+delta}`,async()=>{
  const text=utf8(maximum+delta),args=['doc',font,'',''];
  args[{font:1,family:2,configuration:3}[field]]=text;
  if(delta===1)assert.throws(()=>n.create(...args),/ass_argument_invalid/);
  else if(field==='family'){const handle=await n.create(...args);n.close(handle);}
  else await assert.rejects(n.create(...args),field==='font'?/ass_font_unavailable/:/ass_font_configuration_unavailable/);
});
test('ASS native core rejects empty/NUL documents and invalid font values',async()=>{
  for(const document of ['','a\u0000b'])await assert.rejects(n.create(document,font,''),/ass_input_invalid/);
  await assert.rejects(n.create('doc','',''),/ass_input_invalid/);
  assert.throws(()=>n.create(7,font,''),/ass_argument_invalid/);
});
for(const [kind,values]of [['canvas',[4095,4096,4097]],['source',[32767,32768,32769]]])for(const value of values)test(`ASS render ${kind} ${value}`,async()=>{
  const handle=await n.create('doc',font,'');
  try{const args=kind==='canvas'?[value,1,1,1]:[1,1,value,value];
    if(value>(kind==='canvas'?4096:32768))assert.throws(()=>n.render(handle,0,...args),/ass_argument_invalid/);
    else assert.equal((await n.render(handle,0,...args)).canvasWidth,args[0]);
  }finally{n.close(handle)}
});
for(const height of [1079,1080,1081])test('ASS native core pixel budget at 1920 x '+height,async()=>{
  const handle=await n.create('doc',font,'');try{
    if(height>1080)await assert.rejects(n.render(handle,0,1920,height,1920,height),/ass_frame_invalid/);
    else assert.equal((await n.render(handle,0,1920,height,1920,height)).canvasHeight,height);
  }finally{n.close(handle)}
});
test('ASS distinguishes binding rejection, core rejection and closed/foreign handles',async()=>{
  const handle=await n.create('doc',font,'');
  for(const time of [-1,0.5,NaN,Infinity,9007199254740992])assert.throws(()=>n.render(handle,time,1,1,1,1),/ass_argument_invalid/);
  await assert.rejects(n.render(handle,0,0,1,1,1),/ass_frame_invalid/);
  assert.throws(()=>n.render({},0,1,1,1,1),/ass_handle_invalid/);
  n.close(handle);assert.throws(()=>n.render(handle,0,1,1,1,1),/ass_renderer_closed/);
});
for(const size of [4194303,4194304,4194305])for(const split of [false,true])test(`caption ${split?'aggregate':'single'} UTF-8 bytes ${size}`,async()=>{
  const q=caption();q.runs[0].text=utf8(split?2097152:size);
  if(split)q.runs.push({...run(),text:utf8(size-2097152)});
  assert.equal(q.runs.reduce((n,r)=>n+Buffer.byteLength(r.text),0),size);
  if(size>4194304)denied(q);else await admitted(q);
});
for(const count of [4095,4096,4097])test('caption run count '+count,async()=>{
  const q=caption();q.runs=Array.from({length:count},run);if(count>4096)denied(q);else await admitted(q);
});
for(const [field,maximum]of [['maxLines',1000],['width',8192],['size',8192],['baseline',1000000]])for(const delta of [-1,0,1])test(`caption ${field} ${maximum+delta}`,async()=>{
  const q=caption();(field==='size'||field==='baseline'?q.runs[0]:q)[field]=maximum+delta;
  if(delta===1)denied(q);else await admitted(q);
});
for(const count of [3,4,5])test('caption shadow count '+count,async()=>{
  const q=caption();q.shadows=Array.from({length:count},()=>({color:0,x:0,y:0,radius:0}));if(count>4)denied(q);else await admitted(q);
});
for(const size of [127,128,129])test('caption family UTF-8 bytes '+size,async()=>{
  const q=caption();q.runs[0].family=utf8(size);if(size>128)denied(q);else await admitted(q);
});
test('caption rejects malformed types, empty/NUL text, fractional lines and shadow offsets',()=>{
  for(const text of ['', '\u0000',7]){const q=caption();q.runs[0].text=text;denied(q)}
  for(const value of [0,1.5,NaN,Infinity]){const q=caption();q.maxLines=value;denied(q)}
  for(const value of [-1000001,Infinity]){const q=caption();q.runs[0].baseline=value;denied(q)}
  for(const [key,value]of [['x',129],['y',-129],['radius',129],['radius',-1]]){const q=caption();q.shadows=[{color:0,x:0,y:0,radius:0,[key]:value}];denied(q)}
});
(async()=>{for(const[name,fn]of tests){await fn();console.log('PASS '+name)}console.log(`${tests.length} native subtitle entry tests passed. Production entry validation executed; host N-API, libass fixture and blocked drawing do not prove Harmony rendering/ABI.`)})().catch(e=>{console.error(e);process.exitCode=1});
