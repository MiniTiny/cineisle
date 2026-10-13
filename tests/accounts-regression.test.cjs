// Actual account/HTTP/Quick Connect methods; Asset and network are explicit isolated fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs');
const h = require('./feature-regression.test.cjs');
const { SessionStore } = h.load('service/SessionStore.ets');
const { AppService } = h.load('service/AppService.ets');
const { JellyfinClient } = h.load('service/JellyfinClient.ets');
const { NativeHttpTransport } = h.load('api/NativeHttpTransport.ets');
const { QuickConnectLogin } = h.load('service/QuickConnectLogin.ets');
const { accounts, addresses, sessionKey, validateVault } = h.load('utils/Accounts.ts');
global.Scroller = class { constructor(){this.calls=[]} scrollTo(value){this.calls.push(value)} };
const { Accounts } = h.load('pages/Accounts.ets');
const { AppLock } = h.load('service/AppLock.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const session = (server='one', user='a', url='https://one.invalid/jellyfin') => ({ server:url, serverId:server, userId:user,userName:user, token:'fixture-'+server+'-'+user, deviceId:'fixture-device', serverName:server });
const reply = (body, code=200) => ({responseCode:code,result: typeof body==='string'?body:JSON.stringify(body)});
const network = () => Object.assign(Error('fixture network outage'), {code:2300006});
const info = (id='one') => reply({Id:id,ServerName:id,Version:'10.10.0'});
const root = 'cineisle.current.session';
const keys = () => [...h.assets.keys()];
const secret = key => new TextDecoder().decode(h.assets.get(key));
const query = api => new URL(api.url);
const saved = async () => SessionStore.load();
const settle = async () => {for(let i=0;i<5;i++)await new Promise(setImmediate)};

test('migrates the original single-session Asset without losing account or token', async () => {
  const old=session();h.assets.set(root,new TextEncoder().encode(JSON.stringify(old)));assert.equal((await saved()).token,old.token);assert.equal((await SessionStore.list()).length,1);assert.equal(JSON.parse(secret(root)).version,2);
});
test('migration write failure preserves the original Asset and active session', async () => {
 const old=JSON.stringify(session());h.assets.set(root,new TextEncoder().encode(old));const asset=h.platform.get('@ohos.security.asset'), add=asset.add;asset.add=async()=>{throw Error('disk failure')};try{await assert.rejects(saved(),/session_save_failed/);assert.equal(secret(root),old)}finally{asset.add=add}
});
test('two servers with the same user ID remain distinct and selectable', async () => {
 await SessionStore.save(session());await SessionStore.save(session('two','a','https://two.invalid'));assert.equal((await SessionStore.list()).length,2);await SessionStore.select('one_a');assert.equal((await saved()).serverId,'one');assert.equal((await SessionStore.get('two_a')).token,'fixture-two-a');
});
test('multiple users on one server share server addresses and retain separate tokens', async () => {
 await SessionStore.save(session());await SessionStore.save(session('one','b'));await SessionStore.updateServer({id:'one',name:'海岛',addresses:['https://one.invalid/jellyfin','http://lan.invalid:8096/jellyfin'],preferred:'https://one.invalid/jellyfin'});assert.equal((await SessionStore.get('one_a')).addresses.length,2);assert.equal((await SessionStore.get('one_b')).token,'fixture-one-b');assert.equal((await SessionStore.servers()).length,1);
});
test('a repeated login replaces the same server/user instead of duplicating it', async () => {
 await SessionStore.save(session());await SessionStore.save({...session(),token:'new-fixture'});assert.equal((await SessionStore.list()).length,1);assert.equal((await saved()).token,'new-fixture');
});
test('account summaries contain no token or device credentials', async () => {
 await SessionStore.save(session());const value=JSON.stringify(await SessionStore.list());assert.ok(!value.includes('fixture-one-a'));assert.ok(!value.includes('fixture-device'));assert.equal((await SessionStore.list())[0].active,true);
});
test('chunking respects Asset 1024-byte limit including multibyte data', async () => {
 for(let n=0;n<8;n++)await SessionStore.save({...session('one','user-'+n),userName:'映屿'.repeat(80),token:'fixture-'+n+'x'.repeat(300)});assert.equal((await SessionStore.list()).length,8);for(const bytes of h.assets.values())assert.ok(bytes.length<=1024);assert.equal((await SessionStore.get('one_user-3')).userName,'映屿'.repeat(80));
});
test('failed final index commit rolls back new chunks and preserves the old vault', async () => {
 await SessionStore.save(session());const original=secret(root),before=keys().sort();const asset=h.platform.get('@ohos.security.asset'),add=asset.add;asset.add=async attrs=>{if(new TextDecoder().decode(attrs.get('alias'))===root)throw Error('full');return add(attrs)};try{await assert.rejects(SessionStore.save(session('two','b','https://two.invalid')),/session_save_failed/);assert.equal(secret(root),original);assert.deepEqual(keys().sort(),before)}finally{asset.add=add};assert.equal((await saved()).serverId,'one');
});
test('corrupt or missing chunks fail closed rather than clearing or mixing accounts', async () => {
 await SessionStore.save(session());const child=keys().find(k=>k!==root);h.assets.delete(child);await assert.rejects(saved(),/session_read_failed/);assert.ok(h.assets.has(root));
});
test('malformed legacy data is preserved for recovery', async () => {
 h.assets.set(root,new TextEncoder().encode('{broken'));await assert.rejects(saved(),/session_read_failed/);assert.equal(secret(root),'{broken');
});
test('concurrent credential mutations serialize without losing an account', async () => {
 await Promise.all([SessionStore.save(session()),SessionStore.save(session('two','a','https://two.invalid'))]);assert.equal((await SessionStore.list()).length,2);
});
test('sign-out removes only the current credential and retains saved servers', async () => {
 await SessionStore.save(session());await SessionStore.save(session('one','b'));await SessionStore.clear();assert.equal(await saved(),undefined);assert.deepEqual((await SessionStore.list()).map(x=>x.userId),['a']);assert.equal((await SessionStore.servers()).length,1);
});
test('removing a nonactive account preserves the selected account', async () => {
 await SessionStore.save(session());await SessionStore.save(session('one','b'));await SessionStore.remove('one_a');assert.equal((await saved()).userId,'b');await SessionStore.remove('one_b');assert.equal(await saved(),undefined);
});
test('removing a server removes all its credentials and preserves other servers', async () => {
 await SessionStore.save(session());await SessionStore.save(session('one','b'));await SessionStore.save(session('two','a','https://two.invalid'));await SessionStore.removeServer('one');assert.equal((await SessionStore.list()).length,1);assert.equal((await saved()).serverId,'two');
});
test('address normalization retains reverse-proxy paths and rejects credentials/query fragments', () => {
 assert.deepEqual(addresses([' https://one.invalid/jellyfin/// ','https://one.invalid/jellyfin']),['https://one.invalid/jellyfin']);for(const value of ['ftp://one.invalid','http://u:p@one.invalid','https://one.invalid?api_key=fixture','https://one.invalid#x'])assert.throws(()=>addresses([value]),/invalid_server/);
});
test('an address cannot be assigned to two server identities', async () => {
 await SessionStore.save(session());await assert.rejects(SessionStore.updateServer({id:'two',name:'two',addresses:['https://one.invalid/jellyfin'],preferred:'https://one.invalid/jellyfin'}),/server_address_conflict/);assert.equal((await SessionStore.servers()).length,1);
});
test('preferred working address persists for every user of a server', async () => {
 await SessionStore.save(session());await SessionStore.save(session('one','b'));await SessionStore.updateServer({id:'one',name:'one',addresses:['https://one.invalid/jellyfin','https://backup.invalid/path'],preferred:'https://one.invalid/jellyfin'});await SessionStore.rememberAddress('one','https://backup.invalid/path');assert.equal((await SessionStore.get('one_a')).server,'https://backup.invalid/path');assert.equal((await saved()).server,'https://backup.invalid/path');
});
test('GET connection failure probes backup anonymously before one safe retry', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid/path']};const transport=new NativeHttpTransport(s);h.queue.push(network(),info(),reply({ok:true}));assert.equal((await transport.request('/Items','GET',[],'')).ok,true);assert.deepEqual(h.requests.map(x=>query(x).pathname),['/jellyfin/Items','/path/System/Info/Public','/path/Items']);assert.ok(!h.requests[1].options.header.Authorization.includes('Token='));assert.ok(h.requests[2].options.header.Authorization.includes('fixture-one-a'));assert.equal(s.server,'https://backup.invalid/path');
});
test('restored version discovery can fail over before issuing media requests', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid/path']};h.queue.push(network(),info(),info(),reply({Items:[],TotalRecordCount:0}));await new JellyfinClient(s).libraries();assert.equal(s.server,'https://backup.invalid/path');assert.ok(h.requests.slice(0,3).every(x=>!x.options.header.Authorization.includes('Token=')));
});
test('wrong server backup receives neither token nor retried request', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://other.invalid']};h.queue.push(network(),info('wrong'));await assert.rejects(new NativeHttpTransport(s).request('/Items','GET',[],''),/network_failed/);assert.equal(s.server,'https://one.invalid/jellyfin');assert.equal(h.requests.length,2);assert.ok(!h.requests[1].options.header.Authorization.includes('Token='));
});
for(const code of [401,403,400,404,405,500])test('HTTP '+code+' is not replayed at a different address', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid']};h.queue.push(reply('',code));await assert.rejects(new NativeHttpTransport(s).request('/Items','GET',[],''));assert.equal(h.requests.length,1);
});
for(const method of ['POST','DELETE'])test(method+' unknown outcome is not replayed even when a backup is found', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid']};h.queue.push(network(),info());await assert.rejects(new NativeHttpTransport(s).request('/UserFavoriteItems/item',method,[],''),/network_failed/);assert.equal(h.requests.length,2);assert.equal(s.server,'https://backup.invalid');
});
test('a gateway outage 503 uses a verified fallback', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid']};h.queue.push(reply('',503),info(),reply({ok:1}));assert.equal((await new NativeHttpTransport(s).request('/Items','GET',[],'')).ok,1);
});
test('concurrent failed GETs share one backup identity probe', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid']};h.queue.push(network(),network(),info(),reply({ok:1}),reply({ok:2}));const t=new NativeHttpTransport(s);await Promise.all([t.request('/Items','GET',[],''),t.request('/UserViews','GET',[],'')]);assert.equal(h.requests.filter(x=>query(x).pathname.endsWith('/System/Info/Public')).length,1);
});
test('switching restores only that account catalog and offline pending edits', async () => {
 await SessionStore.save(session());await SessionStore.save(session('one','b'));AppService.useClient(new JellyfinClient(session('one','b'),'10.10.0'));AppService.snapshot.items=[h.film('private-b')];AppService.local.saveSnapshot(AppService.snapshot);AppService.useClient(new JellyfinClient(session(),'10.10.0'));h.queue.push(info(),reply({Id:'b',Name:'b'}));await AppService.switchAccount('one_b');assert.equal(AppService.client.session.userId,'b');assert.equal(AppService.snapshot.items[0].Id,'private-b');assert.equal((await saved()).userId,'b');
});
test('401 account switch keeps the current account and selected vault entry', async () => {
 await SessionStore.save(session('one','b'));await SessionStore.save(session());AppService.useClient(new JellyfinClient(session(),'10.10.0'));const before=AppService.client;h.queue.push(info(),reply('',401));await assert.rejects(AppService.switchAccount('one_b'),/login_expired/);assert.equal(AppService.client,before);assert.equal((await saved()).userId,'a');
});
test('a saved offline account can be selected without losing its cache', async () => {
 await SessionStore.save(session('one','b'));AppService.useClient(new JellyfinClient(session(),'10.10.0'));h.queue.push(network());await AppService.switchAccount('one_b');assert.equal(AppService.client.session.userId,'b');
});
test('in-flight downloads block all account changes and credential removal', async () => {
 await SessionStore.save(session());AppService.useClient(new JellyfinClient(session(),'10.10.0'));AppService.downloads=[{state:'downloading'}];await assert.rejects(AppService.removeAccount('one_a'),/tasks_active/);assert.equal((await saved()).userId,'a');assert.equal(h.requests.length,0);
});
test('PIN gate prevents switching or removing accounts through service methods', async () => {
 AppLock.locked=true;await assert.rejects(AppService.removeServer('one'),/lock_pin_wrong/);assert.equal(h.requests.length,0);
});
test('failed switch persistence does not publish the other account', async () => {
 await SessionStore.save(session('one','b'));await SessionStore.save(session());AppService.useClient(new JellyfinClient(session(),'10.10.0'));const before=AppService.client;h.queue.push(info(),reply({Id:'b'}));const api=h.platform.get('@ohos.security.asset'),add=api.add;api.add=async()=>{throw Error('full')};try{await assert.rejects(AppService.switchAccount('one_b'),/session_save_failed/);assert.equal(AppService.client,before)}finally{api.add=add};assert.equal((await saved()).userId,'a');
});
test('relogin at a saved address checks server identity before sending password', async () => {
 await SessionStore.save(session());h.queue.push(info('wrong'));await assert.rejects(AppService.login('https://one.invalid/jellyfin','a','fixture-password'),/server_identity_mismatch/);assert.equal(h.requests.length,1);assert.ok(!h.requests[0].options.extraData);
});
test('adding a new login keeps earlier accounts and inherits configured addresses', async () => {
 await SessionStore.save(session());await SessionStore.updateServer({id:'one',name:'custom',addresses:['https://one.invalid/jellyfin','https://backup.invalid'],preferred:'https://one.invalid/jellyfin'});h.queue.push(info(),reply({User:{Id:'b',Name:'b'},AccessToken:'fixture-b'}));await AppService.login('https://one.invalid/jellyfin','b','fixture-password');assert.equal((await SessionStore.list()).length,2);assert.equal(AppService.client.session.addresses.length,2);assert.equal(AppService.client.session.serverName,'custom');
});
const initiate = async (controller, enabled=true, result={Code:'123456',Secret:'fixture-secret',Authenticated:false}) => {h.queue.push(info(),reply(enabled));if(enabled)h.queue.push(reply(result));return controller.begin('https://one.invalid/jellyfin')};
test('Quick Connect disabled server creates no secret request', async () => {await assert.rejects(initiate(new QuickConnectLogin(),false),/quick_connect_disabled/);assert.equal(h.requests.length,2)});
test('Quick Connect checks then exchanges secret only after authorization', async () => {
 const c=new QuickConnectLogin();assert.equal(await initiate(c),'123456');h.queue.push(reply({Authenticated:false}));assert.equal(await c.poll(),undefined);c.lastPoll=0;h.queue.push(reply({Authenticated:true}),reply({User:{Id:'a',Name:'a'},AccessToken:'fixture-one-a'}));const client=await c.poll();assert.equal(client.session.userId,'a');assert.deepEqual(JSON.parse(h.requests.at(-1).options.extraData),{Secret:'fixture-secret'});assert.equal(h.assets.size,0);await assert.rejects(c.poll(),/quick_connect_cancelled/);
});
test('Quick Connect secret/code never persist before successful login', async () => {
 const c=new QuickConnectLogin();await initiate(c);h.queue.push(reply({Authenticated:false}));await c.poll();assert.equal(h.assets.size,0);c.cancel();assert.equal(c.secret,'');assert.equal(c.code,'');
});
test('Quick Connect never overlaps polls or checks sooner than five seconds', async () => {
 const c=new QuickConnectLogin();await initiate(c);const d=h.deferred(),api=h.platform.get('@ohos.net.http'),create=api.createHttp;api.createHttp=()=>({request:()=>d.promise,destroy(){}});try{const first=c.poll();await settle();assert.equal(await c.poll(),undefined);d.resolve(reply({Authenticated:false}));await first;assert.equal(await c.poll(),undefined)}finally{api.createHttp=create}
});
test('Quick Connect expires locally and clears secrets', async () => {const c=new QuickConnectLogin();await initiate(c);c.expires=Date.now()-1;await assert.rejects(c.poll(),/quick_connect_expired/);assert.equal(c.secret,'')});
test('cancel while checking prevents a late token exchange', async () => {
 const c=new QuickConnectLogin();await initiate(c);const d=h.deferred(),api=h.platform.get('@ohos.net.http'),create=api.createHttp;api.createHttp=()=>({request:()=>d.promise,destroy(){}});try{const checking=c.poll();await settle();c.cancel();d.resolve(reply({Authenticated:true}));await assert.rejects(checking,/quick_connect_cancelled/);assert.equal(h.assets.size,0)}finally{api.createHttp=create}
});
test('mismatched Quick Connect secret or malformed result fails without token exchange', async () => {
 const c=new QuickConnectLogin();await initiate(c);h.queue.push(reply({Authenticated:true,Secret:'other'}));await assert.rejects(c.poll(),/api_response_invalid/);assert.equal(h.requests.length,4);
});
test('server-expired Quick Connect becomes a restartable code error', async () => {const c=new QuickConnectLogin();await initiate(c);h.queue.push(reply('',404));await assert.rejects(c.poll(),/quick_connect_expired/);assert.equal(c.secret,'')});
test('Quick Connect transport failure retains the pairing for a later retry', async () => {const c=new QuickConnectLogin();await initiate(c);h.queue.push(network());await assert.rejects(c.poll(),/network_failed/);assert.equal(c.secret,'fixture-secret');c.cancel()});
test('page hide cancels Quick Connect and clears password without storing credentials', async () => {const p=new Accounts();p.visible=true;p.password='fixture-password';p.quickCode='123456';p.quick.secret='fixture-secret';p.onPageHide();assert.equal(p.password,'');assert.equal(p.quickCode,'');assert.equal(p.quick.secret,'');assert.equal(h.assets.size,0)});

test('a third address is tried when a verified backup still cannot serve the GET', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid','https://third.invalid']};h.queue.push(network(),info(),reply('',503),info(),reply({ok:true}));assert.equal((await new NativeHttpTransport(s).request('/Items','GET',[], '')).ok,true);assert.equal(s.server,'https://third.invalid');assert.equal(h.requests.length,5);
});
test('all failed GET addresses terminate after a bounded attempt per address', async () => {
 const s={...session(),addresses:['https://one.invalid/jellyfin','https://backup.invalid','https://third.invalid']};h.queue.push(network(),info(),network(),info(),network());await assert.rejects(new NativeHttpTransport(s).request('/Items','GET',[],''),/network_failed/);assert.equal(h.requests.length,5);
});
test('a cancelled password-login page cannot commit a late credential response', async () => {
 const d=h.deferred();const login=JellyfinClient.login;JellyfinClient.login=()=>d.promise;try {const action=AppService.login('https://one.invalid','a','fixture',()=>false);await settle();d.resolve(new JellyfinClient(session(),'10.10.0'));await assert.rejects(action,/login_cancelled/);assert.equal(await saved(),undefined);assert.equal(AppService.client,undefined)}finally{JellyfinClient.login=login}
});
test('PIN relock while authenticating prevents late account commit', async () => {
 const d=h.deferred();const login=JellyfinClient.login;JellyfinClient.login=()=>d.promise;try {const action=AppService.login('https://one.invalid','a','fixture');await settle();AppLock.locked=true;d.resolve(new JellyfinClient(session(),'10.10.0'));await assert.rejects(action,/login_cancelled/);assert.equal(await saved(),undefined)}finally{JellyfinClient.login=login}
});
test('account UI resets after another page has switched or removed the active account', async () => {
 h.activate(); const p=h.page();AppService.client=undefined;p.onPageShow();assert.equal(p.signedIn,false);assert.equal(p.items.length,0);
});
test('reset can recover a corrupt root without clearing the PIN Asset or cached files', async () => {
 h.assets.set(root,new TextEncoder().encode('{broken'));h.assets.set('cineisle.app.lock.v1',new TextEncoder().encode('fixture-lock'));const path=h.directory+'/keep.fixture';fs.writeFileSync(path,'offline-cache');await AppService.resetAccounts();assert.equal(await saved(),undefined);assert.ok(h.assets.has('cineisle.app.lock.v1'));assert.ok(fs.existsSync(path));
});
test('removing all credential storage is idempotent and deletes referenced chunks', async () => {
 await SessionStore.save(session());await SessionStore.reset();await SessionStore.reset();assert.equal(h.assets.size,0);assert.equal((await SessionStore.servers()).length,0);
});
test('removing the active address verifies its replacement before saving or sending credentials', async () => {
 await SessionStore.save(session());AppService.useClient(new JellyfinClient(session(),'10.10.0'));const before=AppService.client;h.queue.push(info('wrong'));await assert.rejects(AppService.saveServer('one','new',['https://other.invalid']),/server_identity_mismatch/);assert.equal(AppService.client,before);assert.equal((await SessionStore.servers())[0].preferred,'https://one.invalid/jellyfin');assert.ok(!h.requests[0].options.header.Authorization.includes('Token='));
});
test('saving a verified replacement switches the live and persisted address with the same cache identity', async () => {
 await SessionStore.save(session());AppService.useClient(new JellyfinClient(session(),'10.10.0'));const directory=AppService.local.directory;h.queue.push(info());await AppService.saveServer('one','new',['https://backup.invalid/base']);assert.equal(AppService.client.session.server,'https://backup.invalid/base');assert.equal(AppService.local.directory,directory);assert.equal((await saved()).server,'https://backup.invalid/base');
});
test('Quick Connect disabled endpoint 401 reports disabled rather than expired login', async () => {
 const c=new QuickConnectLogin();h.queue.push(info(),reply('',401));await assert.rejects(c.begin('https://one.invalid/jellyfin'),/quick_connect_disabled/);assert.equal(h.requests.length,2);
});
test('malformed initiation data creates no active pairing or stored credential', async () => {
 for(const result of [{Code:'123',Secret:'fixture',Authenticated:false},{Code:'123456',Secret:'',Authenticated:false},{Code:'123456',Secret:'fixture',Authenticated:'false'}]) {const c=new QuickConnectLogin();await assert.rejects(initiate(c,true,result),/api_response_invalid/);assert.equal(c.secret,'');assert.equal(h.assets.size,0);}
});
test('only whitelisted session fields reach Asset even if a caller includes a password', async () => {
 await SessionStore.save({...session(),password:'never-store-password',AuthenticationResult:{Pw:'never-store-password'}});assert.ok([...h.assets.values()].every(v=>!new TextDecoder().decode(v).includes('never-store-password')));assert.equal((await saved()).password,undefined);
});
test('Quick Connect page keeps its code after a transient 503', async () => {
 const p=new Accounts();p.visible=true;p.locked=false;p.quickCode='123456';p.schedule=()=>{};p.quick.poll=async()=>{throw Object.assign(Error('http_failed:503'),{status:503})};await p.checkQuick();assert.equal(p.quickCode,'123456');assert.equal(p.busy,false);
});
test('a target account explicit offline preference prevents every switch network request', async () => {
 await SessionStore.save(session('one','b'));AppService.useClient(new JellyfinClient(session('one','b'),'10.10.0'));AppService.experience.update(s=>{s.offline=true});AppService.useClient(new JellyfinClient(session(),'10.10.0'));await AppService.switchAccount('one_b');assert.equal(h.requests.length,0);assert.equal(AppService.client.session.userId,'b');assert.equal(AppService.experience.snapshot().offline,true);
});
test('a 408 write timeout retains the durable intent and never replays the POST', async () => {
 const value=session();value.addresses=['https://one.invalid/jellyfin','https://backup.invalid'];AppService.useClient(new JellyfinClient(value,'10.10.0'));h.queue.push(reply('',408),info());assert.equal(await AppService.edit(h.film('a'),true,true),true);assert.equal(AppService.experience.snapshot().pending[0].value,true);assert.equal(h.requests.filter(x=>x.options.method==='POST').length,1);
});
test('password login to a saved server can fail over anonymously before its single credential POST', async () => {
 await SessionStore.updateServer({id:'one',name:'one',addresses:['https://one.invalid/jellyfin','https://backup.invalid/base'],preferred:'https://one.invalid/jellyfin'});h.queue.push(network(),info(),info(),reply({User:{Id:'a',Name:'a'},AccessToken:'fixture-one-a'}));await AppService.login('https://one.invalid/jellyfin','a','fixture-password');assert.equal(AppService.client.session.server,'https://backup.invalid/base');assert.equal(h.requests.filter(x=>x.options.method==='POST').length,1);assert.equal(query(h.requests.at(-1)).host,'backup.invalid');assert.ok(h.requests.slice(0,3).every(x=>!x.options.header.Authorization.includes('Token=')));
});
test('Quick Connect to a saved server can select a verified backup before initiating pairing', async () => {
 const c=new QuickConnectLogin();h.queue.push(network(),info(),info(),reply(true),reply({Code:'123456',Secret:'fixture-secret',Authenticated:false}));assert.equal(await c.begin('https://one.invalid/jellyfin','one',['https://one.invalid/jellyfin','https://backup.invalid/base']),'123456');assert.equal(query(h.requests.at(-1)).host,'backup.invalid');assert.equal(h.assets.size,0);c.cancel();
});
test('a saved account switch refreshes the server-provided display name', async () => {
 await SessionStore.save(session('one','b'));AppService.useClient(new JellyfinClient(session(),'10.10.0'));h.queue.push(info(),reply({Id:'b',Name:'renamed'}));await AppService.switchAccount('one_b');assert.equal((await SessionStore.get('one_b')).userName,'renamed');
});
test('accepted account navigation clears old routes only after replacing the current page', async () => {
 const p=new Accounts();p.visible=true;p.locked=false;const calls=[],switchAccount=AppService.switchAccount,r=h.platform.get('@ohos.router'),replace=r.replaceUrl,clear=r.clear;AppService.switchAccount=async()=>{};r.replaceUrl=async()=>{calls.push('replace')};r.clear=()=>calls.push('clear');try{await p.select({key:'one_a'});assert.deepEqual(calls,['replace','clear'])}finally{AppService.switchAccount=switchAccount;r.replaceUrl=replace;r.clear=clear}
});
test('a visible home observes a credential commit arriving after navigation back', async () => {
 h.activate();const p=h.page({tab:4,items:[h.film('private-a')]});p.onPageShow();await settle();const client=new JellyfinClient(session('one','b'),'10.10.0'),data=AppService.prepareClient(client);data.experience.update(s=>{s.offline=true});AppService.useClient(client,data);await settle();assert.equal(p.sessionClient,client);assert.ok(!p.items.some(i=>i.Id==='private-a'));assert.equal(p.busy,false);p.onPageHide();
});
test('resetting account UI clears actor, discovery, error and password state as well as media', () => {
 h.activate();const p=h.page({profiles:[{person:{Name:'private actor'}}],discoveries:[{item:h.film('private discovery')}],homeFailures:[{name:'old'}],actorQuery:'private',actorTag:'old',password:'fixture-password'});p.resetAccountState();for(const key of ['profiles','discoveries','homeFailures'])assert.equal(p[key].length,0);for(const key of ['actorQuery','actorTag','password'])assert.equal(p[key],'');
});
test('a destroyed UI observer cannot turn a committed login into a failed credential operation', async () => {
 AppService.subscribeAccount(()=>{throw Error('fixture destroyed view')});h.queue.push(info(),reply({User:{Id:'a',Name:'a'},AccessToken:'fixture-one-a'}));await AppService.login('https://one.invalid/jellyfin','a','fixture-password');assert.equal((await saved()).userId,'a');assert.equal(AppService.client.session.userId,'a');
});
test('renaming a shared server refreshes every safe account summary and survives restoration', async () => {
 await SessionStore.save(session());await SessionStore.save(session('one','b'));AppService.useClient(new JellyfinClient(session(),'10.10.0'));
 await AppService.saveServer('one','映屿新岛名',['https://one.invalid/jellyfin','https://backup.invalid']);
 const list=await SessionStore.list();assert.equal(list.length,2);assert.ok(list.every(s=>s.serverName==='映屿新岛名'&&!('token' in s)));assert.equal((await SessionStore.load()).serverName,'映屿新岛名');assert.equal(AppService.client.session.serverName,'映屿新岛名');
});
test('entering an address form resets the old account-list scroll position', () => {
 const p=new Accounts();p.visible=true;p.editServer({id:'one',name:'fixture',addresses:['https://one.invalid'],preferred:'https://one.invalid'});
 assert.equal(p.editingId,'one');assert.deepEqual(p.scroller.calls,[{xOffset:0,yOffset:0}]);
 p.endEditing();assert.equal(p.editingId,'');assert.equal(p.scroller.calls.length,2);
});
test('toggling an add-account form clears password and resets the viewport', () => {
 const p=new Accounts();p.visible=true;p.password='fixture-password';p.toggleAdding();assert.equal(p.adding,true);assert.equal(p.password,'');assert.deepEqual(p.scroller.calls,[{xOffset:0,yOffset:0}]);
 p.toggleAdding();assert.equal(p.adding,false);assert.equal(p.scroller.calls.length,2);
});
test('cancelling a code with Back resets the login form instead of retaining code scroll', () => {
 const p=new Accounts();p.visible=true;p.quickCode='123456';assert.equal(p.onBackPress(),true);assert.equal(p.quickCode,'');assert.deepEqual(p.scroller.calls,[{xOffset:0,yOffset:0}]);assert.equal(p.onBackPress(),false);
});
test('late form completion never accesses an unbound hidden scroll controller', () => {
 const p=new Accounts();p.editingId='one';p.scroller.scrollTo=()=>{throw Error('fixture unbound controller')};p.visible=false;assert.doesNotThrow(()=>p.endEditing());assert.equal(p.editingId,'');
});
(async()=>{for(const [name,fn] of tests){h.reset();await fn();await settle();console.log('PASS '+name)}console.log(`${tests.length} account regressions passed. HTTP/Asset are explicit fixtures; no native storage or real Jellyfin claim.`)})().catch(e=>{console.error(e);process.exitCode=1});
