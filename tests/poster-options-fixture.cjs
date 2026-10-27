const f=require('./catalog-contract-fixture.cjs').make('poster-options'),{h}=f,p=require('./poster-platform.cjs').install(h),native=h.platform.get('@ohos.data.preferences'),fs=require('node:fs'),path=require('node:path');
const {PosterCache}=h.load('service/PosterCache.ets');let caches=[];
module.exports={...f,p,cache:async()=>{const c=new PosterCache(h.context);caches.push(c);await c.initialize();return c;},ui:()=>f.trace().call('ui-compile',()=>require('./brand-forms.test.cjs')),run:tests=>f.run(tests.map(test=>({...test,async action(check){
 p.reset();caches=[];fs.rmSync(path.join(h.directory,'poster_options.fixture.json'),{force:true});
 native.getPreferences=(...args)=>f.trace().call('prefs-open',async()=>{if(process.argv.includes('--native-prefs-init-failure'))throw Object.assign(Error('injected native Preferences initialization failure'),{code:'EIO',contractInjected:true});const store=await p.preferences.api.getPreferences(...args);if(!store.observed){store.observed=true;for(const [key,phase]of [['get','prefs-get'],['put','prefs-put'],['flush','prefs-flush']]){const method=store[key].bind(store);store[key]=(...args)=>f.trace().call(phase,()=>method(...args),{key:args[0]});}}return store;});
 try{await test.action(check);}finally{for(const c of caches)c.cancelAll(false);native.getPreferences=p.preferences.api.getPreferences;}
 }})))};
