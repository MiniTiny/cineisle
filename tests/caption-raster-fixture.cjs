// Executes the production adapter. Native rendering/decoding are explicit boundaries, not pixel evidence.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript');
function rasterFixture(options={},events=[]){
 const p=require('./player-regression.test.cjs'),module={exports:{}};
 const native={renderCaption:options.render||(()=>Promise.reject(Error('explicit native caption fixture required')))};
 const image={PixelMapFormat:{RGBA_8888:1},AlphaType:{PREMUL:1},createPixelMap:options.decode||async function(bytes,config){events.push(['captionDecode',bytes.byteLength,config]);return {fixture:true,release:async()=>events.push(['captionDiscard'])}}};
 const request=id=>{if(id==='libcineisle_ass.so')return native;if(id==='@ohos.multimedia.image')return image;if(id==='./CaptionStyle')return p.load('utils/CaptionStyle.ts');if(id==='./CaptionUI')return p.load('utils/CaptionUI.ets');if(id==='./SubtitleLimits')return p.load('utils/SubtitleLimits.ts');throw Error('Unmocked raster dependency '+id)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../entry/src/main/ets/utils/CaptionRasterizer.ets'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:request});return module.exports;
}
const frame=(w=100,h=30,halo=2)=>({width:w+halo*2,height:h+halo*2,layoutWidth:w,layoutHeight:h,halo,rgba:new ArrayBuffer((w+halo*2)*(h+halo*2)*4)});
module.exports={rasterFixture,frame};
