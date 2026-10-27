const probe='entry/src/main/ets/service/DiscoveryProbe.ets',controller='entry/src/main/ets/service/ServerDiscovery.ets',packet='entry/src/main/ets/utils/ServerDiscovery.ts',worker='entry/src/main/ets/workers/ServerDiscoveryWorker.ets',suite='server-discovery-contract.test.cjs',recipes=[];
const add=(id,file,old,replacement,name)=>recipes.push({id,file,old,replacement,name,suite});
for(const [file,key,value,low,high]of [
 [probe,'requestTimeoutMs',6000,'discovery probe actual deadline 5999','discovery probe actual deadline 6000'],
 [probe,'connectTimeoutMs',4000,'discovery probe actual deadline 6000','discovery probe actual deadline 6000'],
 [probe,'readTimeoutMs',4000,'discovery probe actual deadline 6000','discovery probe actual deadline 6000'],
 [probe,'maxResponseBytes',65536,'discovery probe actual deadline 6000','discovery probe actual deadline 6000'],
 [probe,'maxResponseCodeUnits',65536,'discovery probe independent code units 65536','discovery probe independent code units 65537'],
 [controller,'workerCancelGraceMs',1000,'discovery controller cancel grace 999','discovery controller cancel grace 1000'],
 [controller,'workerWatchdogMs',10000,'discovery controller watchdog 9999','discovery controller watchdog 10000'],
 [packet,'maxDatagramBytes',8192,'discovery datagram byte boundary 8192','discovery datagram byte boundary 8193'],
 [packet,'maxAddressCodeUnits',2048,'discovery address boundary 2048','discovery address boundary 2049'],
 [packet,'maxNameCodeUnits',128,'discovery name boundary 128','discovery name boundary 129']
])for(const delta of [-1,1])add(key+'-'+delta,file,`${key}: number = ${value};`,`${key}: number = ${value+delta};`,delta<0?low:high);
add('response-guard-remove',probe,'response.result.length > DiscoveryProbe.maxResponseCodeUnits','false','discovery probe independent code units 65537');
add('response-compare',probe,'response.result.length > DiscoveryProbe.maxResponseCodeUnits','response.result.length >= DiscoveryProbe.maxResponseCodeUnits','discovery probe independent code units 65536');
add('wrong-response-unit',probe,'response.result.length > DiscoveryProbe.maxResponseCodeUnits','new TextEncoder().encode(response.result).byteLength > DiscoveryProbe.maxResponseCodeUnits','discovery probe code units and HTTP bytes remain distinct');
add('actual-probe-argument',probe,'connectTimeout: DiscoveryProbe.connectTimeoutMs','connectTimeout: 3999','discovery probe actual deadline 6000');
add('timer-remove',probe,"timer = setTimeout(() => finish(new Error('discovery_verify_timeout')), DiscoveryProbe.requestTimeoutMs);",'timer = -1;','discovery probe actual deadline 6000');
add('watchdog-remove',controller,"watchdog = setTimeout(() => stop('discovery_failed'), ServerDiscovery.workerWatchdogMs);",'watchdog = -1;','discovery controller watchdog 10000');
add('grace-remove',controller,'grace = setTimeout(release, ServerDiscovery.workerCancelGraceMs);','grace = -1;','discovery controller cancel grace 1000');
add('datagram-remove',packet,'message.byteLength > DiscoveryPacketLimits.maxDatagramBytes','false','discovery datagram byte boundary 8193');
add('datagram-compare',packet,'message.byteLength > DiscoveryPacketLimits.maxDatagramBytes','message.byteLength >= DiscoveryPacketLimits.maxDatagramBytes','discovery datagram byte boundary 8192');
add('actual-verified-name',controller,'.slice(0, DiscoveryPacketLimits.maxNameCodeUnits)','.slice(0, 127)','discovery name boundary 128');
for(const delta of [-1,1])add('worker-duration-'+delta,packet,'discoveryDuration: number = 8000;',`discoveryDuration: number = ${8000+delta};`,'discovery actual worker deadline '+(delta<0?7999:8000));
add('worker-packet-remove',worker,'packets >= discoveryPacketLimit','false','discovery actual worker packets 64');
add('worker-packet-compare',worker,'packets >= discoveryPacketLimit','packets > discoveryPacketLimit','discovery actual worker packets 64');
const controls=[
 {name:'discovery probe actual deadline 6000',phase:'version',requiredCalls:{'http-create':1},details:{pathname:'/jellyfin/System/Info/Public'}},
 {name:'discovery probe actual deadline 6000',phase:'http-create',nativeInit:true},
 {name:'discovery probe actual deadline 6000',phase:'timer-set',requiredCalls:{'http-create':1},details:{duration:6000}},
 {name:'discovery controller watchdog 10000',phase:'host-worker-create'},
 {name:'discovery controller watchdog 10000',phase:'host-post',requiredCalls:{'host-worker-create':1}},
 {name:'discovery actual worker deadline 8000',phase:'udp-create',requiredCalls:{'worker-compile':1}},
 {name:'discovery actual worker deadline 8000',phase:'udp-bind',requiredCalls:{'udp-create':1}},
 {name:'discovery actual worker deadline 8000',phase:'udp-send',requiredCalls:{'udp-bind':1,'udp-setExtraOptions':1}},
 {name:'discovery actual worker deadline 8000',phase:'worker-source'},
 {name:'discovery datagram byte boundary 8192',phase:'setup'}
].map(c=>({...c,scope:'server-discovery',suite}));
module.exports={recipes,controls,scope:'server-discovery',fixture:'tests/discovery-contract-fixture.cjs',earlyPhase:'version',earlyOld:'await test.action(check,time);',earlyReplacement:"f.trace().call('version',()=>{}); await test.action(check,time);",selfFaults:[{id:'native-init-capture',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"trace.call('http-create',()=>{",replacement:"((phase,operation)=>operation())('http-create',()=>{"}]};
