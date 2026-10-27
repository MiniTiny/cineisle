// Real controller/probe and freshly SDK-compiled worker; threads, UDP and clocks are external fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const f=require('./resource-timeout-fixture.cjs').make('server-discovery'),{h}=f;
h.platform.set('@ohos.url',{URL});h.platform.get('@ohos.util').TextDecoder=class{constructor(encoding,options){this.decoder=new TextDecoder(encoding,options);}decodeToString(bytes){return this.decoder.decode(bytes);}};
const workerAPI={};h.platform.set('@ohos.worker',workerAPI);const {ServerDiscovery}=h.load('service/ServerDiscovery.ets'),{DiscoveryProbe}=h.load('service/DiscoveryProbe.ets'),parser=h.load('utils/ServerDiscovery.ts');
const candidate={id:'server',name:'Server',address:'https://example.invalid/jellyfin'};
let threads=[];
function worker(time){
 const messages=[],calls=[],handlers={},trace=f.trace(),port={postMessage:value=>trace.call('port-post',()=>messages.push(value))};
 const udp={on:(event,fn)=>trace.call('udp-on',()=>{handlers[event]=fn;}),off:event=>trace.call('udp-off',()=>{delete handlers[event];})};
 for(const method of ['bind','setExtraOptions','send','close'])udp[method]=async value=>trace.call('udp-'+method,()=>{calls.push([method,value]);});
 const source=trace.call('worker-source',()=>fs.readFileSync(path.join(__dirname,'../entry/src/main/ets/workers/ServerDiscoveryWorker.ets'),'utf8'));
 const js=trace.call('worker-compile',()=>{const compiled=h.ts.transpileModule(source,{compilerOptions:{module:h.ts.ModuleKind.CommonJS,esModuleInterop:true,target:h.ts.ScriptTarget.ES2020},reportDiagnostics:true});if(compiled.diagnostics.some(d=>d.category===h.ts.DiagnosticCategory.Error))throw Error('worker compiler diagnostic');return compiled.outputText;});
 trace.call('worker-execute',()=>vm.runInNewContext(js,{exports:{},setTimeout,clearTimeout,require:id=>{if(id==='@ohos.worker')return{workerPort:port};if(id==='@ohos.net.socket')return{constructUDPSocketInstance:()=>trace.call('udp-create',()=>udp)};if(id.endsWith('/ServerDiscovery'))return parser;throw Error('unexpected worker dependency');}}));
 return {messages,calls,start:async()=>{port.onmessage({data:{type:'start'}});await f.settle();},cancel:async()=>{port.onmessage({data:{type:'cancel'}});await f.settle();},receive:async bytes=>{handlers.message?.({message:bytes});await f.settle();}};
}
module.exports={...f,ServerDiscovery,DiscoveryProbe,parser,candidate,worker,threads:()=>threads,run:tests=>f.run(tests.map(test=>({...test,async action(check,time){
 threads=[];workerAPI.ThreadWorker=class {constructor(){f.trace().call('host-worker-create',()=>{this.sent=[];this.terminated=0;threads.push(this);});}postMessage(value){return f.trace().call('host-post',()=>this.sent.push(value));}terminate(){return f.trace().call('host-terminate',()=>{this.terminated++;});}emit(data){this.onmessage?.({data});}};
 await test.action(check,time);
}})))};
