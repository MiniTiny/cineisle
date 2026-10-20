// Product controller/page/PiP lifecycles. Native renderer and AVPlayer remain explicit fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./player-regression.test.cjs');
const { ass } = require('./ass-test-fixture.cjs');
const { PiPSubtitleController } = h.load('components/PiPSubtitle.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const picture = () => ({bitmap:{fixture:true},canvasWidth:640,canvasHeight:360,left:40,top:60,width:160,height:28});
const active = new Set();
async function rig() {
  h.reset(); const r = h.rig({subtitle:async()=>ass}); const engines = [], pictures = [];
  r.c.view.styledSubtitle = frame => pictures.push(frame);
  r.c.view.createStyledSubtitle = async (document, publish, failure) => {
    assert.equal(document, ass);
    const value = {calls:[],clears:0,closes:0,publish,failure,
      render(...args) {this.calls.push(args);}, clear(){this.clears++;publish(undefined);}, close(){this.closes++;publish(undefined);} };
    engines.push(value); return value;
  };
  await r.c.open(h.route(),'surface'); await h.settle(); active.add(r.c);
  return {...r,engines,pictures,player:h.nativePlayers[0]};
}
test('online ASS asks for raw format, keeps intrinsic styling, and renders using the native clock', async () => {
  const r=await rig(), calls=[]; r.c.client.subtitle=async(...args)=>{calls.push(args);return ass;};
  r.player.currentTime=1234; await r.c.selectSubtitle('server:21');
  assert.equal(calls[0][4],'ass');assert.equal(r.values.subtitleKey,'server:21');assert.equal(r.values.subtitle,'');
  assert.deepEqual(r.engines[0].calls.at(-1),[1234,1920,1080]);const frame=picture();r.engines[0].publish(frame);assert.equal(r.pictures.at(-1),frame);
});
test('ASS preparation failure retains selected SRT and its clock', async()=>{
  const r=await rig();r.c.client.subtitle=async()=> '1\n00:00:01,000 --> 00:00:03,000\nold SRT';await r.c.selectSubtitle('server:20');r.c.seek(1500);
  r.c.client.subtitle=async()=>ass;r.c.view.createStyledSubtitle=async()=>{throw Error('native unavailable');};await r.c.selectSubtitle('server:21');
  assert.equal(r.values.subtitleKey,'server:20');assert.equal(r.values.subtitle,'old SRT');assert.equal(r.values.errors.at(-1),'subtitle_failed');
});
test('a late prepared ASS is closed after selecting off and never publishes',async()=>{
  const r=await rig(), wait=h.deferred();const create=r.c.view.createStyledSubtitle;
  r.c.view.createStyledSubtitle=async(...args)=>{const value=await create(...args);await wait.promise;return value;};
  const selection=r.c.selectSubtitle('server:21');await h.settle();await r.c.selectSubtitle('');wait.resolve();await selection;
  assert.equal(r.engines[0].closes,1);r.engines[0].publish(picture());assert.equal(r.pictures.at(-1),undefined);assert.equal(r.values.subtitleKey,'');
});
test('source replacement closes active ASS and rejects old render/failure callbacks',async()=>{
  const r=await rig();await r.c.selectSubtitle('server:21');const engine=r.engines[0];await r.c.open(h.route(undefined,'source-b'),'surface');await h.settle();
  const errors=r.values.errors.length;engine.publish(picture());engine.failure();assert.equal(engine.closes,1);assert.equal(r.pictures.at(-1),undefined);assert.equal(r.values.errors.length,errors);
});
test('native renderer failure clears the frame without stopping video and allows SRT recovery',async()=>{
  const r=await rig();await r.c.selectSubtitle('server:21');r.engines[0].publish(picture());r.engines[0].failure();
  assert.equal(r.pictures.at(-1),undefined);assert.equal(r.values.subtitleKey,'');assert.equal(r.values.state,'playing');
  r.c.client.subtitle=async()=> '1\n00:00:01,000 --> 00:00:03,000\nrecovered';await r.c.selectSubtitle('server:20');r.c.seek(1500);assert.equal(r.values.subtitle,'recovered');
});
test('pending seek clears ASS until seekDone confirms the clock; paused video has no render ticker',async()=>{
  const r=await rig();await r.c.selectSubtitle('server:21');await r.c.pausePlayback();const engine=r.engines[0];
  r.player.seek=()=>{};r.c.seek(7000);const count=engine.calls.length;assert.equal(r.pictures.at(-1),undefined);
  await new Promise(resolve=>setTimeout(resolve,80));assert.equal(engine.calls.length,count);r.player.currentTime=7100;r.player.emit('seekDone',7100);
  assert.deepEqual(engine.calls.at(-1),[7100,1920,1080]);assert.equal(r.c.styledTimer,-1);
});
test('audio-only background and PIN visibility gates stop the ticker and reject late frames',async()=>{
  const r=await rig();await r.c.selectSubtitle('server:21');const engine=r.engines[0];await r.c.hide(true);
  assert.equal(r.c.styledTimer,-1);engine.publish(picture());assert.equal(r.pictures.at(-1),undefined);
  r.c.setStyledSubtitleVisible(true);assert.ok(r.c.styledTimer!==-1);r.c.setStyledSubtitleVisible(false);r.c.show();
  assert.equal(r.c.styledTimer,-1);engine.publish(picture());assert.equal(r.pictures.at(-1),undefined);
});
test('completion and close clear ASS, stop rendering, and close native context once',async()=>{
  const r=await rig();await r.c.selectSubtitle('server:21');r.player.change('completed');assert.equal(r.pictures.at(-1),undefined);assert.equal(r.c.styledTimer,-1);
  await r.c.close();await r.c.close();assert.equal(r.engines[0].closes,1);r.engines[0].publish(picture());assert.equal(r.pictures.at(-1),undefined);
});
test('offline ASS reads raw local document without a network request',async()=>{
  const r=await rig(),video=path.join(h.directory,'ass-offline.mp4'),sub=path.join(h.directory,'ass-offline.ass');fs.writeFileSync(video,'fixture');fs.writeFileSync(sub,ass);
  r.c.client.subtitle=async()=>{throw Error('network forbidden');};await r.c.open(Object.assign(h.route(),{offline:true,filePath:video,subtitles:[{index:8,title:'ASS',language:'zho',path:sub,state:'ready',format:'ass'}]}),'surface');await h.settle();
  await r.c.selectSubtitle('local:8');assert.equal(r.values.subtitleKey,'local:8');assert.equal(r.engines.length,1);
});
test('PiP frames use their own context, resize with contain geometry, and disposal releases references',()=>{
  h.reset();const c=new PiPSubtitleController(()=>{throw Error('PiP error');}),frame=picture();c.setFrame(frame);c.aboutToResize({width:360,height:360});
  const context=h.systemPlatform.uiContext(),node=c.makeNode(context).builderNode;
  assert.equal(node.params.frame,frame);assert.deepEqual(node.params.bounds,{left:22.5,top:112.5,width:90,height:15.75});
  c.aboutToResize({width:640,height:360});assert.deepEqual(node.params.bounds,{left:40,top:60,width:160,height:28});
  const next=c.makeNode(h.systemPlatform.uiContext()).builderNode;assert.equal(node.disposed,1);assert.equal(next.params.frame,frame);
  c.dispose();assert.equal(next.params.frame,undefined);assert.equal(next.disposed,1);c.setFrame(frame);assert.equal(c.makeNode(context),null);
});
test('page PIN and background state propagate to styled visibility; exit clears the page reference',async()=>{
  h.reset();h.setRoute(h.route());const p=new h.Player();p.aboutToAppear();await h.settle();active.add(p.controller);
  p.styledFrame=picture();p.locked=true;p.windowStateChanged();assert.equal(p.controller.styledVisible,false);
  p.onPageShow();assert.equal(p.controller.styledVisible,false);p.locked=false;p.windowStateChanged();assert.equal(p.controller.styledVisible,true);
  p.onPageHide();await h.settle();assert.equal(p.controller.styledVisible,false);const system=p.system;p.aboutToDisappear();assert.equal(p.styledFrame,undefined);await system.dispose();
});
(async()=>{for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}finally{for(const c of active)await c.close();active.clear();}}console.log(tests.length+' ASS player regression tests passed. Native renderer, AVPlayer and PiP nodes are fixtures.');})().catch(async error=>{for(const c of active)await c.close();console.error(error);process.exitCode=1;});
