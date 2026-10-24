// Legacy wire fixtures and independent Node crypto; not native Asset/durability evidence.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const h=require('./feature-regression.test.cjs');
const {SessionStore}=h.load('service/SessionStore.ets'),{AppLock}=h.load('service/AppLock.ets');
const {validateVault,addresses}=h.load('utils/Accounts.ts');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const root='cineisle.current.session',pinAlias='cineisle.app.lock.v1';
const encode=v=>new TextEncoder().encode(JSON.stringify(v)),decode=v=>JSON.parse(new TextDecoder().decode(v));
const session=()=>({server:'https://fixture.invalid/jellyfin',serverId:'server',userId:'a',userName:'',token:'fixture-token',deviceId:'fixture-device'});
function vault(s=session()){return {version:2,servers:[{id:'server',name:'',addresses:[s.server],preferred:s.server}],accounts:[s],active:'server_a'}}
function installLegacy(s=session()){
 const bytes=encode(vault(s)),index={version:2,generation:'legacy-generation',parts:Math.ceil(bytes.length/1000)};
 for(let i=0;i<index.parts;i++)h.assets.set(`cineisle.sessions.legacy-generation.${i}`,bytes.slice(i*1000,(i+1)*1000));
 h.assets.set(root,encode(index));return index;
}
function joined(){const index=decode(h.assets.get(root));return Buffer.concat(Array.from({length:index.parts},(_,i)=>Buffer.from(h.assets.get(`cineisle.sessions.${index.generation}.${i}`))));}
for(const [count,valid]of [[20,true],[21,false]])test('server quota '+count,()=>{
 const v={version:2,servers:Array.from({length:count},(_,i)=>({id:'s'+i,name:'',addresses:['https://s'+i+'.invalid'],preferred:'https://s'+i+'.invalid'})),accounts:[],active:''};
 if(valid)assert.doesNotThrow(()=>validateVault(v));else assert.throws(()=>validateVault(v),/session_read_failed/);
});
for(const [count,valid]of [[40,true],[41,false]])test('account quota '+count,()=>{
 const v=vault();v.accounts=Array.from({length:count},(_,i)=>({...session(),userId:'u'+i}));v.active='';
 if(valid)assert.doesNotThrow(()=>validateVault(v));else assert.throws(()=>validateVault(v),/session_read_failed/);
});
for(const [count,valid]of [[8,true],[9,false]])test('address quota before normalization '+count,()=>{
 const values=Array.from({length:count},(_,i)=>'https://s'+i+'.invalid');
 if(valid)assert.equal(addresses(values).length,count);else assert.throws(()=>addresses(values),/invalid_server/);
});
test('legacy UTF-8 V2 parts reassemble before decoding and preserve identity',async()=>{
 const s={...session(),userName:'中文😀'.repeat(600)};installLegacy(s);
 const saved=await SessionStore.load();assert.equal(saved.userName,s.userName);assert.equal(saved.token,s.token);assert.equal(saved.serverId,'server');
 assert.equal(decode(h.assets.get(root)).generation,'legacy-generation');
});
for(const size of [63999,64000,64001])test('V2 byte framing boundary '+size,async()=>{
 const s=session();s.userName='x'.repeat(size-encode(vault(s)).length);assert.equal(encode(vault(s)).length,size);
 if(size>64000){await assert.rejects(SessionStore.save(s),/account_store_full/);assert.equal(h.assets.size,0);return;}
 await SessionStore.save(s);const index=decode(h.assets.get(root));assert.equal(index.version,2);assert.equal(index.parts,64);assert.equal(joined().length,size);
 for(let i=0;i<index.parts;i++)assert.ok(h.assets.get(`cineisle.sessions.${index.generation}.${i}`).length<=1000);
 assert.equal((await SessionStore.load()).userName,s.userName);
});
for(const stage of ['part','root'])test('failed '+stage+' write preserves the old committed vault',async()=>{
 installLegacy();const before=new Map(h.assets),api=h.platform.get('@ohos.security.asset'),original=api.add;let writes=0;
 api.add=async attrs=>{writes++;const alias=new TextDecoder().decode(attrs.get('alias'));if((stage==='part'&&writes===2)||(stage==='root'&&alias===root))throw Error('fixture write failure');return original(attrs)};
 try{await assert.rejects(SessionStore.save({...session(),userName:'x'.repeat(3000)}),/session_save_failed/)}finally{api.add=original}
 assert.deepEqual(h.assets,before);assert.equal((await SessionStore.load()).userName,'');
});
test('root is committed after all new chunks and old generation is removed only after commit',async()=>{
 installLegacy();const api=h.platform.get('@ohos.security.asset'),original=api.add,events=[];
 api.add=async attrs=>{events.push(new TextDecoder().decode(attrs.get('alias')));return original(attrs)};
 try{await SessionStore.save({...session(),userName:'x'.repeat(3000)})}finally{api.add=original}
 assert.equal(events.at(-1),root);assert.ok(events.slice(0,-1).every(k=>k.startsWith('cineisle.sessions.')));
 assert.equal([...h.assets.keys()].some(k=>k.startsWith('cineisle.sessions.legacy-generation.')),false);
 assert.equal((await SessionStore.load()).userName.length,3000);
});
for(const fault of ['missing','oversized','too-many-parts'])test('damaged V2 '+fault+' never becomes an empty successful account',async()=>{
 const index=installLegacy();const part='cineisle.sessions.legacy-generation.0';
 if(fault==='missing')h.assets.delete(part);else if(fault==='oversized')h.assets.set(part,new Uint8Array(1001));else h.assets.set(root,encode({...index,parts:65}));
 const before=new Map(h.assets);await assert.rejects(SessionStore.load(),/session_read_failed/);assert.deepEqual(h.assets,before);
});
const salt=Array.from({length:16},(_,i)=>i);
const legacyPin=()=>({version:1,iterations:210000,salt:[...salt],hash:Array.from(crypto.pbkdf2Sync('123456',Buffer.from(salt),210000,32,'sha256'))});
test('original V1 PIN survives initialization and unlock without rewriting its Asset',async()=>{
 const raw=encode(legacyPin());h.assets.set(pinAlias,raw);await AppLock.initialize();assert.equal(AppLock.locked,true);assert.equal(await AppLock.unlock('123456'),true);assert.deepEqual(h.assets.get(pinAlias),raw);
});
for(const change of ['version','iterations','salt','hash'])test('incompatible PIN '+change+' retains the fail-closed behavior',async()=>{
 const s=legacyPin();if(change==='version')s.version=2;if(change==='iterations')s.iterations=210001;if(change==='salt')s.salt.pop();if(change==='hash')s.hash.push(0);
 h.assets.set(pinAlias,encode(s));await assert.rejects(AppLock.initialize(),/lock_storage_failed/);assert.equal(AppLock.fault,true);assert.equal(AppLock.locked,true);assert.equal(await AppLock.unlock('123456'),false);
});
test('new PIN keeps alias, V1 fields and the original PBKDF2 parameters',async()=>{
 await AppLock.configure('','123456');const s=decode(h.assets.get(pinAlias));
 assert.deepEqual(Object.keys(s),['version','iterations','salt','hash']);assert.equal(s.version,1);assert.equal(s.iterations,210000);assert.equal(s.salt.length,16);assert.equal(s.hash.length,32);
 assert.deepEqual(s.hash,Array.from(crypto.pbkdf2Sync('123456',Buffer.from(s.salt),210000,32,'sha256')));
});
test('the twelve-digit PIN upper boundary remains usable',async()=>{
 await AppLock.configure('','123456789012');AppLock.lock();assert.equal(await AppLock.unlock('123456789012'),true);
});
test('fifth failed PIN blocks until exactly thirty seconds and a correct PIN resets failures',async()=>{
 h.assets.set(pinAlias,encode(legacyPin()));await AppLock.initialize();const original=Date.now;let now=1000000;Date.now=()=>now;
 try{for(let i=0;i<5;i++)assert.equal(await AppLock.verify('654321'),false);assert.equal(await AppLock.verify('123456'),false);now+=29999;assert.equal(await AppLock.verify('123456'),false);now++;assert.equal(await AppLock.verify('123456'),true);assert.equal(AppLock.failures,0)}finally{Date.now=original}
});
for(const method of ['foreground','permit'])test('fifteen-minute background lock boundary: '+method,()=>{
 const original=Date.now;let now=1000000;Date.now=()=>now;AppLock.enabled=true;AppLock.locked=false;
 try{AppLock.background();now+=899999;AppLock[method]();assert.equal(AppLock.locked,false);if(method==='foreground'){now=1000000;AppLock.background();now+=900000}else now++;AppLock[method]();assert.equal(AppLock.locked,true)}finally{Date.now=original}
});
for(const value of ['12345','1234567890123','１２３４５６','12345a'])test('PIN syntax remains rejected: '+value,async()=>{await assert.rejects(AppLock.configure('',value),/lock_pin_format/);assert.equal(h.assets.has(pinAlias),false)});
(async()=>{for(const[name,fn]of tests){h.reset();AppLock.secret=undefined;AppLock.failures=0;AppLock.blockedUntil=0;AppLock.backgroundAt=0;await fn();console.log('PASS '+name)}console.log(`${tests.length} storage contract tests passed. File/Asset/OS fixtures do not prove native durability.`)})().catch(e=>{console.error(e);process.exitCode=1});
