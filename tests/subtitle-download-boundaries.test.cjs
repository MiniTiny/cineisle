// Real transfer/fetch orchestration and isolated files; system download tasks are explicit fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const h=require('./feature-regression.test.cjs');
const {SubtitleTransfer}=h.load('service/SubtitleTransfer.ets');
const {OfflineSubtitles}=h.load('service/OfflineSubtitles.ets');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const settle=()=>new Promise(setImmediate);
function taskFixture(agent){
  const client=h.activate(),handlers={},events=[];let owned=true,ready;
  const started=new Promise(resolve=>ready=resolve);
  const filename=path.join(h.directory,'boundary.srt'),temporary=filename+'.fetch';
  const api=h.platform.get('@ohos.request');
  if(agent){
    h.capabilities.add('SystemCapability.Request.FileTransferAgent');
    api.agent={Action:{DOWNLOAD:1},Mode:{FOREGROUND:1},Network:{WIFI:1},
      remove:async id=>events.push(['remove',id]),
      create:async()=>({tid:'boundary',on:(name,fn)=>handlers[name]=fn,start:async()=>ready()})};
  }else{
    h.capabilities.delete('SystemCapability.Request.FileTransferAgent');
    api.downloadFile=async()=>({on:(name,fn)=>{handlers[name]=fn;if(name==='progress')ready();},delete:async()=>{events.push(['delete']);return true;}});
  }
  const transfer=new SubtitleTransfer(client.subtitleTransport(),h.context,filename,{mobile:false,roaming:false},()=>owned);
  return {events,handlers,temporary,started,cancel:()=>owned=false,work:()=>transfer.text('/probe','GET',[],''),
    progress:n=>handlers.progress(agent?{processed:n}:n),complete:()=>handlers[agent?'completed':'complete']()};
}
function bytes(size){const chunk='中😀';return chunk.repeat(Math.floor(size/7))+'x'.repeat(size%7);}
for(const agent of [false,true])for(const phase of ['progress','completion'])for(const size of [4194303,4194304,4194305]){
  test(`${agent?'agent':'legacy'} ${phase} UTF-8 bytes ${size}`,async()=>{
    const f=taskFixture(agent),result=f.work();
    // Attach rejection observation before the asynchronous event to avoid unhandled-rejection races.
    const observed=result.then(value=>({value}),error=>({error}));await f.started;
    const source=bytes(size);assert.equal(Buffer.byteLength(source),size);assert.ok(source.length<size);
    fs.writeFileSync(f.temporary,source);
    if(phase==='progress')f.progress(size);
    if(phase==='progress'&&size>4194304){
      // Check cancellation now: a later timeout/completion rejection must not mask a missing progress guard.
      await settle();try{assert.equal(f.events.length,1,'oversized progress must immediately remove the task')}
      finally{f.complete()}
    }
    if(phase==='completion'||size<=4194304)f.complete();
    const outcome=await observed;
    if(size<=4194304)assert.equal(outcome.value,source);else assert.match(outcome.error.message,/offline_subtitle_failed/);
    // A late completed event must not publish a rejected oversized transfer or clean up twice.
    f.complete();await settle();
    assert.equal(f.events.length,1);assert.equal(fs.existsSync(f.temporary),false);
  });
}
for(const agent of [false,true])test(`${agent?'agent':'legacy'} ownership loss cancels and removes partial data`,async()=>{
  const f=taskFixture(agent),observed=f.work().then(()=>assert.fail('cancelled transfer resolved'),e=>e);
  await f.started;fs.writeFileSync(f.temporary,'partial');f.cancel();f.progress(1);
  assert.match((await observed).message,/offline_subtitle_failed/);f.complete();await settle();
  assert.equal(f.events.length,1);assert.equal(fs.existsSync(f.temporary),false);
});
const srt='1\n00:00:01,000 --> 00:00:02,000\n';
const ass='[Script Info]\n[Events]\nFormat: Layer, Start, End, Text\nDialogue: 0,0:00:01.00,0:00:02.00,text\n;';
for(const format of ['srt','ass'])for(const character of ['中','😀'])for(const size of [1048575,1048576,1048577]){
  test(`new ${format} ${character} code units ${size} commits only admitted documents`,async()=>{
    const client=h.activate(),header=format==='srt'?srt:ass,remaining=size-header.length;
    const source=header+character.repeat(Math.floor(remaining/character.length))+'x'.repeat(remaining%character.length);
    assert.equal(source.length,size);assert.ok(Buffer.byteLength(source)>size);
    client.subtitle=async()=>source;
    const old={index:1,path:path.join(h.directory,'old.srt'),format:'srt',state:'ready'};
    fs.writeFileSync(old.path,srt+'old subtitle');
    const planned={index:1,path:path.join(h.directory,'new.'+format),format,state:'pending'};
    const record={id:'movie',mediaSourceId:'source',subtitles:[old],subtitleState:'ready'};
    const commits=[];await OfflineSubtitles.fetch(record,client,()=>true,()=>commits.push(JSON.parse(JSON.stringify(record))),h.context,[planned]);
    if(size<=1048576){
      assert.equal(record.subtitleState,'ready');assert.equal(record.subtitles[0].state,'ready');
      assert.equal(record.subtitles[0].path,planned.path);assert.equal(fs.readFileSync(planned.path,'utf8'),source);
      assert.equal(fs.existsSync(old.path),false);assert.equal(commits.length,2);
    }else{
      assert.equal(record.subtitleState,'failed');assert.equal(record.subtitles[0],old);
      assert.equal(fs.readFileSync(old.path,'utf8'),srt+'old subtitle');assert.equal(fs.existsSync(planned.path),false);
      assert.equal(commits.length,1);assert.equal(commits[0].subtitles[0].path,old.path);
    }
    for(const suffix of ['.tmp','.fetch'])assert.equal(fs.existsSync(planned.path+suffix),false);
  });
}
(async()=>{for(const[name,fn]of tests){h.reset();await fn();console.log('PASS '+name)}console.log(`${tests.length} subtitle download boundary tests passed. Native download/network services remain fixtures.`)})().catch(e=>{console.error(e);process.exitCode=1});
