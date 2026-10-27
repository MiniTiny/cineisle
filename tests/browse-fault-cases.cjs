const policy='entry/src/main/ets/utils/Browse.ts',service='entry/src/main/ets/service/AppService.ets',index='entry/src/main/ets/pages/Index.ets',suite='browse-contract.test.cjs',recipes=[];
const add=(id,file,old,replacement,name)=>recipes.push({id,file,old,replacement,name,suite});
for(const [key,value,name]of [['pageItems',60,'browse Index search 61'],['allItemsPageItems',200,'browse allItems actual 201']])for(const delta of [-1,1])add(key+'-'+delta,policy,`${key}: number = ${value};`,`${key}: number = ${value+delta};`,name);
add('Index-consumer-argument',index,'String(BrowseRequestLimits.pageItems)',"'61'",'browse Index search 61');
for(const consumer of ['favorites','actor','collection'])add('allItems-consumer-'+consumer,service,'String(BrowseRequestLimits.allItemsPageItems)',"'199'",'browse actual consumer '+consumer);
add('fixed-offset',service,"{ key: 'StartIndex', value: String(items.length) }","{ key: 'StartIndex', value: String(Math.floor(items.length / 200) * 200) }",'browse allItems uses actual short-page offsets and callback copies');
add('callback-alias',service,'onPage?.([...items]);','onPage?.(items);','browse allItems uses actual short-page offsets and callback copies');
add('callback-skipped',service,'onPage?.([...items]);','void 0;','browse allItems callback rejection propagates unchanged');
for(const [id,old,replacement,name]of [
 ['total-drift',"if (total >= 0 && page.TotalRecordCount !== total) { throw new Error('sync_incomplete'); } total = page.TotalRecordCount;","total = page.TotalRecordCount;",'changing-total'],
 ['missing-gap',"if (!page.Items.length && items.length < total || items.length + page.Items.length > total)","if (items.length + page.Items.length > total)",'gap'],
 ['overflow',"if (!page.Items.length && items.length < total || items.length + page.Items.length > total)","if (!page.Items.length && items.length < total)",'overflow'],
 ['duplicate',"!validMediaItem(item) || seen.has(item.Id)","!validMediaItem(item)",'duplicate-in-page'],
 ['bad-item',"!validMediaItem(item) || seen.has(item.Id)","seen.has(item.Id)",'invalid-item']
])add(id,service,old,replacement,'browse allItems independent '+name);
const controls=[
 {name:'browse allItems actual 201',phase:'request',requiredCalls:{'http-create':1}},
 {name:'browse allItems actual 201',phase:'http-create',nativeInit:true},
 {name:'browse allItems independent duplicate-in-page',phase:'domain'},
 {name:'browse actual consumer favorites',phase:'file-open',requiredCalls:{request:2},details:{filename:'library.json.tmp',stage:'business'}},
 {name:'browse actual consumer favorites',phase:'file-write',requiredCalls:{request:2},details:{filename:'library.json.tmp',stage:'business'}},
 {name:'browse actual consumer favorites',phase:'file-rename',requiredCalls:{request:2},details:{filename:'library.json',stage:'business'}},
 {name:'browse allItems actual 201',phase:'setup'}
].map(c=>({...c,scope:'browse',suite}));
module.exports={recipes,controls,scope:'browse',fixture:'tests/catalog-contract-fixture.cjs',earlyPhase:'file-open',earlyOld:'const active = h.activate();',earlyReplacement:"trace.call('file-open',()=>{}); const active = h.activate();",selfFaults:[{id:'native-init-capture',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"trace.call('http-create',()=>{",replacement:"((phase,operation)=>operation())('http-create',()=>{"}]};
