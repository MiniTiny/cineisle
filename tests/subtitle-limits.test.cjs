const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const h = require('./feature-regression.test.cjs');
const {SubtitleTransferLimits,SubtitleDocumentLimits,CaptionRenderLimits,AssRenderLimits}=h.load('utils/SubtitleLimits.ts');
const {SubtitleParagraphLimits}=h.load('utils/SubtitleParagraph.ts');
const {validAssDocument,parseSubtitles}=h.load('utils/Playback.ts');
const {OfflineSubtitles}=h.load('service/OfflineSubtitles.ets');
const {DownloadSpace}=h.load('service/DownloadSpace.ets');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('paragraph span count has independent per-cue and active budgets',()=>{
 assert.equal(SubtitleParagraphLimits.maximumSpansPerCue,4096);assert.equal(SubtitleParagraphLimits.maximumActiveSpans,4096);
});
test('decoded, wire, complexity and geometry budgets retain distinct units',()=>{
 assert.equal(SubtitleTransferLimits.maxBytes,4194304);assert.equal(SubtitleDocumentLimits.maxCodeUnits,1048576);
 assert.deepEqual([CaptionRenderLimits.maxRunsPerCue,CaptionRenderLimits.maxSimultaneousRunWeight,CaptionRenderLimits.maxPositionedCues,CaptionRenderLimits.maxLines,CaptionRenderLimits.maxRasterPixels],[4096,4096,256,1000,2073600]);
 assert.deepEqual([AssRenderLimits.targetWidthPx,AssRenderLimits.targetHeightPx,AssRenderLimits.maxSourceDimensionPx],[1920,1080,32768]);
});
const ass='[Script Info]\n[Events]\nFormat: Layer, Start, End, Text\nDialogue: 0,0:00:01.00,0:00:02.00,text\n';
for(const character of ['中','😀'])for(const [count,valid]of [[1048575,true],[1048576,true],[1048577,false]])test('ASS code-unit boundary '+character+' '+count,()=>{
 const remaining=count-ass.length-1;
 const source=ass+';'+character.repeat(Math.floor(remaining/character.length))+'x'.repeat(remaining%character.length);
 assert.equal(source.length,count);assert.ok(Buffer.byteLength(source)>source.length);
 assert.equal(validAssDocument(source),valid);
});
for(const [runs,valid]of [[4094,true],[4095,true],[4096,false]])test('simultaneous rich cue weight '+(runs+1),()=>{
 const body=Array.from({length:runs},(_,i)=>i%2?'<i>x</i>':'<b>x</b>').join('');
 const source='1\n00:00:01,000 --> 00:00:02,000\n'+body;
 if(valid)assert.equal(parseSubtitles(source)[0].runs.length,runs);else assert.throws(()=>parseSubtitles(source),/subtitle_failed/);
});
for(const [size,valid]of [[4194303,true],[4194304,true],[4194305,false]])test('legacy cached SRT byte boundary '+size,()=>{
 const header='1\n00:00:01,000 --> 00:00:02,000\n',source=header+'a'.repeat(size-header.length);
 const file=path.join(h.directory,'cached.srt');fs.writeFileSync(file,source);
 const sub={path:file,format:'srt'};
 if(valid)assert.equal(OfflineSubtitles.document(sub).length,size);else assert.throws(()=>OfflineSubtitles.document(sub),/offline_subtitle_failed/);
 // Existing cached SRT accepts more than the new-download document bound. Do not add a stricter guard here.
});
for(const [count,valid]of [[255,true],[256,true],[257,false]])test('simultaneous positioned cue boundary '+count,()=>{
 const source=Array.from({length:count},(_,i)=>`${i+1}\n00:00:01,000 --> 00:00:02,000\n{\\an1}text\n`).join('\n');
 if(valid)assert.equal(parseSubtitles(source).length,count);else assert.throws(()=>parseSubtitles(source),/subtitle_failed/);
});
test('download admission retains the four-MiB subtitle reservation plus eight-MiB safety margin',async()=>{
 const record={state:'complete'},api=h.platform.get('@ohos.file.statvfs'),original=api.getFreeSize;
 const release=DownloadSpace.reserveSubtitles(record,1);
 try{
  api.getFreeSize=async()=>12582912;await DownloadSpace.checkOptional(h.directory,0,[record]);
  api.getFreeSize=async()=>12582911;await assert.rejects(DownloadSpace.checkOptional(h.directory,0,[record]),/download_space_check_failed/);
  release();api.getFreeSize=async()=>8388608;await DownloadSpace.checkOptional(h.directory,0,[record]);
 }finally{release();api.getFreeSize=original}
});
test('native header compiles against frozen boundary values independently of the ArkTS implementation',()=>{
 const golden={kMaxAssDocumentUtf8Bytes:4194304,kMaxCaptionTextUtf8Bytes:4194304,kMaxAssCanvasDimensionPx:4096,kMaxVideoDimensionPx:32768,kMaxAssFramePixels:2073600,kMaxCaptionFramePixels:2073600,kMaxAssImages:100000,kMaxAssGlyphCacheEntries:1000,kMaxAssBitmapCacheMiB:16,kMaxAssFontPathBytes:4096,kMaxAssFamilyBytes:512,kMaxAssConfigPathBytes:4096,kMaxCaptionRuns:4096,kMaxCaptionParagraphSpans:4096,kMaxCaptionLines:1000,kMaxCaptionLayoutWidthPx:8192,kMaxCaptionFontSizePx:8192,kMaxCaptionFrameHeightPx:32768,kMaxCaptionLineBoxes:16384,kMaxCaptionFamilyBytes:128,kMaxCaptionShadows:4,kMaxCaptionBaselineOffsetPx:1000000,kMaxShadowOffsetPx:128,kMaxShadowRadiusPx:128};
 const source='#include "caption/SubtitleLimits.h"\nusing namespace cineisle::subtitle_limits;\n'+Object.entries(golden).map(([name,value])=>`static_assert(${name} == ${value}, "${name}");`).join('\n');
 const result=spawnSync(process.env.CXX||'clang++',['-std=c++17','-fsyntax-only','-x','c++','-I'+path.resolve(__dirname,'../entry/src/main/cpp'),'-'],{input:source,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.error?.message);
});
(async()=>{for(const[name,fn]of tests){h.reset();await fn();console.log('PASS '+name)}console.log(`${tests.length} subtitle limit tests passed. Header compilation and fixtures do not prove device rendering.`)})().catch(e=>{console.error(e);process.exitCode=1});
