// Host compile of production entrypoints. No production source rewriting or copied validation logic.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
exports.build=({core=false,captionLayout=false}={})=>{
  const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'cineisle-native-entry-'));
  const cleanup=()=>fs.rmSync(directory,{recursive:true,force:true});
  process.on('exit',cleanup);
  const sdk=process.env.DEVECO_CONTENTS||'/Applications/DevEco-Studio.app/Contents';
  const nodeCandidates=[process.env.CINEISLE_NODE_INCLUDE,path.resolve(process.execPath,'../../include/node'),path.join(sdk,'tools/node/include/node')].filter(Boolean);
  const nodeInclude=nodeCandidates.find(p=>fs.existsSync(path.join(p,'node_api.h')));
  assert.ok(nodeInclude,'Node N-API headers required; set CINEISLE_NODE_INCLUDE');
  const prefix=process.env.CINEISLE_ASS_DEPS||fs.readFileSync(path.join(root,'.local/native-ass/active-prefix.txt'),'utf8').trim();
  assert.ok(fs.existsSync(path.join(prefix,'include/ass/ass.h')),'Prepare the pinned native ASS headers with scripts/build.sh');
  const include=path.join(directory,'include');fs.mkdirSync(path.join(include,'napi'),{recursive:true});
  fs.writeFileSync(path.join(include,'napi/native_api.h'),'#include <node_api.h>\n');
  for(const name of ['native_drawing','info'])fs.symlinkSync(path.join(sdk,'sdk/default/openharmony/native/sysroot/usr/include',name),path.join(include,name),'dir');
  const compiler=process.env.CXX||'clang++';
  const common=['-std=c++17','-fPIC','-I'+include,'-I'+nodeInclude,'-I'+path.join(prefix,'include')];
  const run=(command,args)=>{
    const result=spawnSync(command,args,{cwd:root,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr||result.error?.message||command+' failed');return result.stdout;
  };
  const sources=['entry/src/main/cpp/ass/NapiAssRenderer.cpp','entry/src/main/cpp/ass/AssRenderer.cpp',
    captionLayout?'tests/native-entry-fixture/caption-layout.cpp':'tests/native-entry-fixture/caption.cpp','tests/native-entry-fixture/ass-engine.cpp'];
  if(captionLayout)sources.push('tests/native-entry-fixture/drawing-layout.cpp');
  const objects=sources.map((source,i)=>{
    const object=path.join(directory,i+'.o');run(compiler,[...common,'-c',source,'-o',object]);return object;
  });
  // SDK drawing/fribidi dependencies must never run on the host. Supply fail-fast link traps,
  // not successful drawing stubs. Actual input parsing and ASS frame checks run unchanged.
  const undefinedSymbols=run(process.env.NM||'nm',['-u',objects[2]]);
  const implemented=captionLayout?new Set([...run(process.env.NM||'nm',['-g',objects[4]]).matchAll(/\bT\s+_?((?:OH_Drawing_|fribidi_)[A-Za-z0-9_]+)/g)].map(m=>m[1])):new Set();
  const names=[...new Set([...undefinedSymbols.matchAll(/\b_?((?:OH_Drawing_|fribidi_)[A-Za-z0-9_]+)/g)].map(m=>m[1]))].filter(name=>!implemented.has(name));
  assert.ok(names.length>0,'Expected explicit unexecuted drawing dependencies');
  const traps=path.join(directory,'drawing-traps.cpp');
  fs.writeFileSync(traps,'#include <cstdlib>\n'+names.map(name=>`extern "C" void ${name}() { std::abort(); }`).join('\n'));
  const output=path.join(directory,'entry.node');
  const linking=process.platform==='darwin'?['-bundle','-undefined','dynamic_lookup']:['-shared'];
  run(compiler,[...common,...linking,...objects,traps,'-o',output]);
  let coreExecutable;
  if(core){
    coreExecutable=path.join(directory,'ass-core');
    run(compiler,[...common,'tests/native-entry-fixture/ass-core.cpp','entry/src/main/cpp/ass/AssRenderer.cpp',
      'tests/native-entry-fixture/ass-engine.cpp','-o',coreExecutable]);
  }
  return {native:require(output),directory,cleanup,coreExecutable};
};
