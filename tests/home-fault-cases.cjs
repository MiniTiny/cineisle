const policy='entry/src/main/ets/utils/FeedRequests.ts',loader='entry/src/main/ets/service/ProgressiveHome.ets',feed='entry/src/main/ets/service/HomeFeed.ets',adapter='entry/src/main/ets/service/JellyfinClient.ets';
const recipes=[],suite='home-contract.test.cjs';
const add=(id,file,old,replacement,name)=>recipes.push({id,file,old,replacement,name,suite});
for(const [key,value,method,argument]of [['resumeLimit',20,'resume','global'],['libraryLatestLimit',12,'latest','library'],['globalLatestLimit',30,'latest','global'],['feedLimit',9,'nextUp','global'],['seriesLimit',1,'nextUp','series']])for(const delta of [-1,1])add(key+'-'+delta,policy,`${key}: number = ${value};`,`${key}: number = ${value+delta};`,`home actual ${method} ${argument} 10.10.0 warm`);
for(const value of [3,5])add('capacity-'+value,loader,'maxActiveRequests: number = 4;',`maxActiveRequests: number = ${value};`,'home scheduler count 5');
add('capacity-comparison',loader,'this.active < ProgressiveHome.maxActiveRequests','this.active <= ProgressiveHome.maxActiveRequests','home scheduler count 5');
add('retry-bypasses-slots',loader,'this.errors.delete(id); this.enqueue(request);','this.errors.delete(id); this.run(request);','home retry waits when four slots are occupied');
for(const entry of ['batch','progressive','Index','cached'])add('library-filter-'+entry,feed,"return !library.CollectionType || ['movies', 'tvshows', 'boxsets'].includes(library.CollectionType);",'return true;','home library matrix '+entry);
add('remove-boxset',feed,"['movies', 'tvshows', 'boxsets']","['movies', 'tvshows']",'home library matrix progressive');
add('remove-missing-library-type',feed,'!library.CollectionType || ','','home library matrix batch');
add('remove-cancel-guard',loader,'if (!this.alive) { return; }\n    this.publish','if (false) { return; }\n    this.publish','home cancellation rejects late publications');
add('remove-authorization-guard',loader,'if (authorizationFailure(error))','if (false)','home authorization clears cache and cancels late results');
for(const [id,file,old,replacement,name]of [
 ['batch-resume',feed,'client.resume(HomeFeedRequests.resumeLimit)','client.resume(19)','home library matrix batch'],
 ['progressive-resume',loader,'this.client.resume(HomeFeedRequests.resumeLimit)','this.client.resume(19)','home library matrix Index'],
 ['batch-nextup',feed,"client.nextUp('', NextUpRequests.feedLimit)","client.nextUp('', 8)",'home library matrix batch'],
 ['progressive-nextup',loader,"this.client.nextUp('', NextUpRequests.feedLimit)","this.client.nextUp('', 8)",'home library matrix Index'],
 ['batch-latest',feed,'client.latest(library.Id, HomeFeedRequests.latestLimit(library.Id))','client.latest(library.Id, 11)','home library matrix batch'],
 ['progressive-latest',loader,'this.client.latest(i.Id, HomeFeedRequests.latestLimit(i.Id))','this.client.latest(i.Id, 11)','home library matrix Index'],
 ['detail-nextup','entry/src/main/ets/service/DetailData.ets','client.nextUp(item.Id, NextUpRequests.limit(item.Id))','client.nextUp(item.Id, 9)','home scoped next up through detail consumer'],
 ['playback-nextup','entry/src/main/ets/service/AppService.ets','nextUp(seriesId, NextUpRequests.limit(seriesId))','nextUp(seriesId, 9)','home scoped next up through playback consumer'],
 ['adapter-resume',adapter,'getResumeItems({ userId: this.session.userId, limit: limit,','getResumeItems({ userId: this.session.userId, limit: 19,','home actual resume global 10.10.0 warm'],
 ['adapter-latest',adapter,'parentId: parentId || undefined, limit: limit,','parentId: parentId || undefined, limit: 11,','home actual latest library 10.10.0 warm'],
 ['adapter-nextup',adapter,'seriesId: seriesId || undefined, limit: limit,','seriesId: seriesId || undefined, limit: 2,','home actual nextUp series 10.10.0 warm']
])add(id,file,old,replacement,name);
const controls=[
 {name:'home actual resume global 10.10.0 warm',phase:'resume',requiredCalls:{create:1},details:{pathname:'/jellyfin/UserItems/Resume'}},
 {name:'home actual resume global 10.10.0 cold',phase:'version',requiredCalls:{create:1},details:{pathname:'/jellyfin/System/Info/Public'}},
 {name:'home actual resume global 10.10.0 warm',phase:'create',nativeInit:true},
 {name:'home actual latest library 10.10.0 warm',phase:'latest',requiredCalls:{create:1}},
 {name:'home actual nextUp series 10.10.0 warm',phase:'nextup',requiredCalls:{create:1}},
 {name:'home scheduler count 5',phase:'scheduler',requiredCalls:{views:1}},
 {name:'home library matrix Index',phase:'views',requiredCalls:{create:1}},
 {name:'home scheduler count 5',phase:'setup'}
].map(c=>({...c,scope:'home',suite}));
module.exports={recipes,controls,scope:'home',fixture:'tests/home-contract-fixture.cjs',earlyPhase:'scheduler',earlyOld:'const active = h.activate();',earlyReplacement:"trace.call('scheduler',()=>{}); const active = h.activate();",selfFaults:[{id:'native-init-capture',phase:'create',file:'tests/home-contract-fixture.cjs',old:"trace.call('create', () => {",replacement:"((phase, operation) => operation())('create', () => {"}]};
