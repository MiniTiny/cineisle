// Controlled clock and HTTP adapters execute real transport deadlines; no wall-clock sleeps.
const catalog=require('./catalog-contract-fixture.cjs');
function clock(trace){
 const native={setTimeout,clearTimeout,setInterval,clearInterval},pending=new Map(),scheduled=[];let now=0,next=0;
 const set=(kind,callback,ms)=>trace.call(kind==='interval'?'interval-set':'timer-set',()=>{const id=++next;scheduled.push({kind,ms});pending.set(id,{callback,at:now+ms,repeat:kind==='interval'?ms:0});return id;},{duration:ms});
 global.setTimeout=(fn,ms)=>set('timeout',fn,ms);global.setInterval=(fn,ms)=>set('interval',fn,ms);
 global.clearTimeout=global.clearInterval=id=>{pending.delete(id);};
 return {scheduled,pending,tick(ms){const target=now+ms;let safety=0;while(true){const ordered=[...pending].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);if(!ordered.length)break;if(++safety>10000)throw Error('non-progressing test clock');const [id,value]=ordered[0];now=value.at;if(value.repeat)value.at+=value.repeat;else pending.delete(id);trace.call('timer-fire',value.callback);}now=target;},restore(){Object.assign(global,native);pending.clear();}};
}
function make(scope){
 const f=catalog.make(scope),{NetworkPolicy,NetworkOptions}=f.h.load('utils/NetworkOptions.ts');let destroyed=0;
 return {...f,NetworkPolicy,NetworkOptions,destroyed:()=>destroyed,run:tests=>f.run(tests.map(test=>({...test,async action(check){
  NetworkPolicy.publish(new NetworkOptions());NetworkPolicy.networkAvailable=undefined;destroyed=0;const http=f.h.platform.get('@ohos.net.http'),create=http.createHttp;
  http.createHttp=()=>{const request=create();return {...request,destroy(){return f.trace().call('http-destroy',()=>{destroyed++;request.destroy();});}};};
  const time=clock(f.trace());try{await test.action(check,time);}finally{time.restore();http.createHttp=create;NetworkPolicy.publish(new NetworkOptions());NetworkPolicy.networkAvailable=undefined;}
 }})))};
}
module.exports={make};
