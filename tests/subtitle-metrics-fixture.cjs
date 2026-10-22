// Explicit native Paragraph boundary. Product metric computation is executed unchanged.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript');
function metricFixture(ascent=(style)=>style.fontSize*.9,events=[]){
 const graphics={FontCollection:{getGlobalInstance:()=>({})},FontWeight:{W400:400,W700:700},FontStyle:{NORMAL:0,ITALIC:1},ParagraphBuilder:class{
  constructor(){this.style={}}pushStyle(style){this.style=style}addText(text){this.text=text}popStyle(){}build(){const style=this.style;return {layoutSync(width){events.push(['metricMeasure',style,width])},getLineMetrics(){return [{runMetrics:new Map([[0,{fontMetrics:{ascent:-ascent(style)}}]])}]}}}
 }};
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../entry/src/main/ets/utils/SubtitleMetrics.ets'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:id=>{if(id==='@ohos.graphics.text')return graphics;throw Error('Unmocked metric import '+id)}});return module.exports;
}
module.exports={metricFixture};
