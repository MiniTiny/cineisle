// Local native acceptance fixture. Synthetic credentials only; never proxies a real service.
const http = require('node:http'), fs = require('node:fs');
const port = Number(process.env.CINEISLE_ACCOUNTS_PORT || 61821);
const id = n => n.toString(16).padStart(32, '0');
const servers = { a: { Id:id(100),ServerName:'映屿测试岛 A',Version:'10.10.0' }, b:{ Id:id(200),ServerName:'映屿测试岛 B',Version:'10.8.13' } };
const names = { alice:'测试账户甲',bob:'测试账户乙',carol:'测试账户丙' };
const state = { outage:false, disabled:false, expired:false, approved:false, quickUser:'bob' };
const routes = []; let sequence = 0; const pairs = new Map();
function reply(res,status,data) { res.writeHead(status,{'Content-Type':'application/json'}); res.end(JSON.stringify(data)); }
function authentication(key,username) { return { User:{Id:id(username==='bob'?2:1),Name:names[username]},ServerId:servers[key].Id,AccessToken:`fixture-${key}-${username}` }; }
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1'), match=url.pathname.match(/^\/(primary|backup|wrong|b)(\/.*)$/);
 if (url.pathname==='/control') {
  if(req.method==='POST') {let body='';for await(const chunk of req) body+=chunk; Object.assign(state,JSON.parse(body));}
  return reply(res,200,{state,routes});
 }
 if(!match) return reply(res,404,{});
 const address=match[1],p=match[2],key=address==='b'||address==='wrong'?'b':'a';
 const header=req.headers['authorization']||req.headers['x-emby-authorization']||'';
 const token=(header.match(/Token="([^"]*)"/)||[])[1]||req.headers['x-emby-token']||'';
 const username=String(token).replace(`fixture-${key}-`,'');
 routes.push({method:req.method,address,path:p,tokenPresent:!!token,identity:token&&names[username]?`${key}:${username}`:''});
 if(address==='primary'&&state.outage) return reply(res,503,{error:'fixture outage'});
 if(p==='/System/Info/Public') return reply(res,200,servers[key]);
 if(p==='/Users/AuthenticateByName') {
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw||'{}');
  if(!names[body.Username]||body.Pw!=='fixture-pass'||(key==='a'&&body.Username==='carol')||(key==='b'&&body.Username!=='carol')) return reply(res,401,{});
  return reply(res,200,authentication(key,body.Username));
 }
 if(['/QuickConnect/Enabled','/QuickConnect/GetEnabled'].includes(p)) return reply(res,200,!state.disabled);
 if(p==='/QuickConnect/Initiate') {
  if(state.disabled)return reply(res,403,{});
  if(req.method!==(key==='b'?'GET':'POST'))return reply(res,405,{});
  const pair={Secret:`fixture-secret-${++sequence}`,Code:String(123450+sequence),Authenticated:false};pairs.set(pair.Secret,{...pair,key}); state.approved=false;state.expired=false;return reply(res,200,pair);
 }
 if(['/QuickConnect/State','/QuickConnect/Connect'].includes(p)) {
  const secret=[...url.searchParams].find(([k])=>k.toLowerCase()==='secret')?.[1], pair=pairs.get(secret);
  if(!pair||state.expired)return reply(res,404,{});
  return reply(res,200,{...pair,Authenticated:state.approved});
 }
 if(p==='/Users/AuthenticateWithQuickConnect') {
  let raw='';for await(const chunk of req)raw+=chunk;const pair=pairs.get(JSON.parse(raw||'{}').Secret);
  if(!pair||!state.approved||state.expired)return reply(res,401,{});
  return reply(res,200,authentication(key,key==='b'?'carol':state.quickUser));
 }
 if(!names[username]||token!==`fixture-${key}-${username}`)return reply(res,401,{});
 if(p==='/Users/Me')return reply(res,200,authentication(key,username).User);
 const movie={Id:id(key==='a'?301:302),Name:`${names[username]} · ${key==='a'?'岛 A':'岛 B'}专属电影`,Type:'Movie',ProductionYear:2026,UserData:{IsFavorite:false,Played:false}};
 const page=Items=>({Items,TotalRecordCount:Items.length,StartIndex:0});
 if(p.endsWith('/Views')||p==='/UserViews')return reply(res,200,page([{Id:id(400),Name:`${key.toUpperCase()} · 测试电影库`,Type:'CollectionFolder',CollectionType:'movies'}]));
 if(p.endsWith('/Latest'))return reply(res,200,[movie]);
 if(p.includes('/Images/'))return reply(res,404,{});
 if(p.endsWith('/Resume')||p==='/Shows/NextUp'||p==='/Persons')return reply(res,200,page([]));
 if(p==='/Movies/Recommendations')return reply(res,200,[]);
 if(/\/Items\/[^/]+$/.test(p))return reply(res,200,movie);
 if(p==='/Items'||p.endsWith('/Items'))return reply(res,200,page([movie]));
 return reply(res,404,{});
});
server.listen(port,'127.0.0.1',()=>console.log(`Accounts native fixture on localhost:${port}; synthetic data only.`));
function stop(){if(process.env.CINEISLE_ACCOUNTS_ROUTES)fs.writeFileSync(process.env.CINEISLE_ACCOUNTS_ROUTES,JSON.stringify({state,routes},null,2));server.close(()=>process.exit(0));}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
