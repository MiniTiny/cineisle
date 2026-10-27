// Actual resolvers/SDK compiler/build driver. The driver boundary uses explicit generator/SDK fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),{spawnSync}=require('node:child_process'),common=require('./contract-external.cjs');
const root=path.resolve(__dirname,'..');let trace,dirs;
const fresh=()=>{const dir=trace.call('temp-create',()=>fs.mkdtempSync(path.join(os.tmpdir(),'cineisle-toolchain-')));dirs.push(dir);return dir;};
const runtime=()=>trace.call('runtime-load',()=>require('./deveco-runtime.cjs'));
function python(env,legacy=false,introspect=false){
 const bad=process.argv.includes('--native-toolchain-init-failure'),details={operation:'python-spawn'};
 return trace.call('python-runtime',()=>{
  const command=bad?path.join(fresh(),'missing-python'):(process.env.PYTHON||'python3'),args=introspect?['-c','import sys; print(sys.executable)']:[path.join(root,'scripts/deveco-runtime.py'),...(legacy?['--legacy-empty']:[])],result=spawnSync(command,args,{env:env?{PATH:process.env.PATH,...env}:process.env,encoding:'utf8'});
  if(result.error||result.status!==0){details.originalCode=result.error?.code;details.originalExit=result.status;throw Object.assign(Error('toolchain process initialization failed'),{code:'EIO',contractInjected:bad});}
  return introspect?result.stdout.trim():JSON.parse(result.stdout);
 },details);
}
function sdk(){
 const dir=fresh(),before=runtime(),contents=path.join(dir,"IDE ' with spaces"),sdkHome=path.join(dir,'SDK with spaces'),missing=process.argv.includes('--native-sdk-init-failure');
 fs.symlinkSync(before.contents,contents,'dir');if(!missing)fs.symlinkSync(before.sdkHome,sdkHome,'dir');
 const previous={DEVECO_CONTENTS:process.env.DEVECO_CONTENTS,DEVECO_SDK_HOME:process.env.DEVECO_SDK_HOME,compiler:process.env.compiler},load=Module._load,requests=[],details={requested:false};
 Object.assign(process.env,{DEVECO_CONTENTS:contents,DEVECO_SDK_HOME:sdkHome});delete require.cache[require.resolve('./deveco-runtime.cjs')];delete require.cache[require.resolve('./brand-forms.test.cjs')];
 Module._load=function(request,...args){if(typeof request==='string'&&request.includes('ets-loader')){requests.push(request);details.requested=true;}return load.call(this,request,...args);};
 try{runtime();const ui=trace.call('sdk-compile',()=>{try{return require('./brand-forms.test.cjs');}catch(error){details.originalCode=error.code;throw Object.assign(Error('SDK compiler initialization failed'),{code:'EIO',contractInjected:missing});}},details),r=ui.render('BrandHeader',{label:'Compiler fixture'}),text=ui.flat(r.roots).find(n=>n.type==='Text'&&n.args[0]==='Compiler fixture');return{requests,expected:path.join(sdkHome,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'),text:text?.attrs.fontSize?.[0]};}
 finally{Module._load=load;for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}delete require.cache[require.resolve('./deveco-runtime.cjs')];delete require.cache[require.resolve('./brand-forms.test.cjs')];}
}
function driver(){
 const dir=fresh(),repo=path.join(dir,'repo'),bin=path.join(dir,'bin'),contents=path.join(dir,"IDE ' $HOME with spaces"),sdkHome=path.join(dir,'SDK override'),nodeHome=path.join(dir,'Node override'),capture=path.join(dir,'capture'),calls=path.join(dir,'calls'),nativeFailure=process.argv.includes('--native-driver-init-failure');
 for(const d of [path.join(repo,'scripts'),path.join(repo,'config'),bin,path.join(contents,'tools/hvigor/bin')])fs.mkdirSync(d,{recursive:true});
 for(const file of ['scripts/build.sh','scripts/deveco-runtime.py','config/deveco.json'])fs.copyFileSync(path.join(root,file),path.join(repo,file));
 const executable=python(undefined,false,true);
 fs.writeFileSync(path.join(bin,'python3'),'#!/bin/sh\ncase "$1" in */deveco-runtime.py) exec "$CINEISLE_TEST_PYTHON" "$@";; *) printf "%s\\0" "$@" >> "$CINEISLE_TEST_CALLS";; esac\n',{mode:0o755});
 if(!nativeFailure)fs.writeFileSync(path.join(contents,'tools/hvigor/bin/hvigorw'),'#!/bin/sh\nprintf "%s\\0" "$NODE_HOME" "$DEVECO_SDK_HOME" "$@" > "$CINEISLE_TEST_CAPTURE"\n',{mode:0o755});
 const details={operation:'build-driver'},extra='--fixture=two words';
 return trace.call('build-driver',()=>{const result=spawnSync('/bin/bash',[path.join(repo,'scripts/build.sh'),extra],{encoding:'utf8',env:{...process.env,LC_ALL:'C',PATH:bin+path.delimiter+process.env.PATH,DEVECO_CONTENTS:contents,DEVECO_SDK_HOME:sdkHome,NODE_HOME:nodeHome,CINEISLE_TEST_PYTHON:executable,CINEISLE_TEST_CAPTURE:capture,CINEISLE_TEST_CALLS:calls}});
  if(result.error||result.status!==0){details.originalExit=result.status;details.originalMessage=result.stderr.trim();details.missingTool=result.stderr.includes(path.join(contents,'tools/hvigor/bin/hvigorw'))&&result.stderr.includes('No such file or directory');details.originalCode=result.error?.code;throw Object.assign(Error('build driver native entry failed'),{code:'EIO',contractInjected:nativeFailure});}
  const split=file=>fs.readFileSync(file,'utf8').split('\0').slice(0,-1);return{captured:split(capture),calls:split(calls).map(s=>s.startsWith(repo)?s.slice(repo.length+1):s),expected:[nodeHome,sdkHome,'--mode','module','-p','product=default','-p','module=entry@default','-p','buildMode=debug','assembleHap','--no-daemon',extra]};
 },details);
}
async function before(){trace=common.external('toolchain-runtime',(process.argv.find(a=>a.startsWith('--fault='))||'').slice(8));dirs=[];if(process.argv.includes('--fault=setup'))assert.fail('unrelated toolchain fixture initialization');}
async function after(){for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true});}
module.exports={assert,runtime,python,sdk,driver,trace:()=>trace,run:tests=>common.run(tests.map(test=>({...test,async action(check){await test.action(check);}})),'toolchain-runtime',before,after,()=>trace.healthy())};
