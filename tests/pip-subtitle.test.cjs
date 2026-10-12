// Real page -> playback timeline -> SystemPlayback -> PiPSubtitleController.
// BuilderNode/PiPWindow are explicit fixtures: no pixels, native decoding or visual acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cineisle-pip-subtitle-'));
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));
const h = require('./player-regression.test.cjs');
const { load, nativePlayers, route, episode, AppService, Player, settle, deferred, systemPlatform: sdk } = h;
const { PiPSubtitleController } = load('components/PiPSubtitle.ets');
const { SystemPlayback } = load('service/SystemPlayback.ets');
const tests = [], owners = [], captions = [];
const test = (name, fn) => tests.push([name, fn]);
const srt = '1\n00:00:01,000 --> 00:00:03,000\n<b>你好</b> &amp; hello\n第二行\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond\n';
const cue = { text: '设备字幕', startTime: 1000, duration: 2000 };
async function page(item = route(), subtitle = async () => srt) {
  h.setRoute(item); AppService.client = { report: async () => {}, subtitle };
  const p = new Player(); p.aboutToAppear(); owners.push(p.system); await p.system.initialize();
  p.surfaceId = 'surface'; await p.controller.open(item, 'surface'); await settle(); return p;
}
async function pip(p) { await p.system.startPiP(); const window = sdk.windows.at(-1); assert.ok(window.config.customUIController); return window; }
const textOf = window => window.captionNode?.builderNode.params.text;
async function serverCue(p, time = 1500) { await p.controller.selectSubtitle('server:20'); nativePlayers.at(-1).emit('timeUpdate', time); }
function caption() { const errors = []; const c = new PiPSubtitleController(() => errors.push('failed')); captions.push(c); return { c, errors }; }

test('PiP seeds already visible Unicode/multiline SRT using the same player and surface', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p);
  assert.equal(textOf(window), '你好 & hello\n第二行'); assert.equal(textOf(window), p.subtitle);
  assert.equal(nativePlayers.length, 1); assert.equal(window.config.componentController, p.surface);
  assert.equal(window.captionNode.builderNode.context, window.uiContext);
});
test('no selected subtitle builds an empty overlay without inventing a cue', async () => {
  const p = await page(); const window = await pip(p); assert.equal(textOf(window), ''); assert.equal(p.subtitleKey, '');
});
test('background time updates change and expire SRT in both views', async () => {
  const p = await page(); const window = await pip(p); p.onPageHide(); await serverCue(p);
  assert.equal(textOf(window), p.subtitle); nativePlayers[0].emit('timeUpdate', 3500); assert.equal(textOf(window), '');
  nativePlayers[0].emit('timeUpdate', 4500); assert.equal(textOf(window), 'Second'); assert.equal(nativePlayers[0].state, 'playing');
});
test('paused PiP seek clears cue gaps and rewinding restores the correct SRT', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p); await p.system.pause();
  p.controller.seek(3500); assert.equal(textOf(window), ''); p.controller.seek(4500); assert.equal(textOf(window), 'Second');
  p.controller.seek(1500); assert.equal(textOf(window), '你好 & hello\n第二行'); assert.equal(nativePlayers[0].state, 'paused');
});
test('subtitles off clears page and PiP immediately without muting or pausing audio', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p); await p.controller.selectSubtitle('');
  assert.equal(textOf(window), ''); assert.equal(p.subtitle, ''); nativePlayers[0].emit('timeUpdate', 4500);
  assert.equal(textOf(window), ''); assert.equal(nativePlayers[0].state, 'playing'); assert.ok(nativePlayers[0].selected.includes(5));
});
test('native subtitle events obey start/expiry boundaries in PiP including offline playback', async () => {
  const file = path.join(directory, 'offline.mp4'); fs.writeFileSync(file, 'sample-fixture');
  const item = Object.assign(route(), { offline: true, filePath: file, url: 'file://' + file });
  const p = await page(item); assert.ok(p.subtitles.every(t => !t.remote)); assert.ok(nativePlayers[0].fd);
  await p.controller.selectSubtitle('native:12'); const window = await pip(p);
  nativePlayers[0].emit('subtitleUpdate', cue); assert.equal(textOf(window), '');
  nativePlayers[0].emit('timeUpdate', 1000); assert.equal(textOf(window), '设备字幕');
  nativePlayers[0].emit('timeUpdate', 3000); assert.equal(textOf(window), '');
});
test('seeking a native subtitle clears stale text in both views', async () => {
  const p = await page(); await p.controller.selectSubtitle('native:12'); nativePlayers[0].emit('timeUpdate', 1500); nativePlayers[0].emit('subtitleUpdate', cue);
  const window = await pip(p); p.controller.seek(1700); assert.equal(textOf(window), ''); assert.equal(p.subtitle, '');
});
test('switching to native subtitle replaces server text only when native cue arrives', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p); await p.controller.selectSubtitle('native:12'); assert.equal(textOf(window), '');
  nativePlayers[0].emit('subtitleUpdate', cue); assert.equal(textOf(window), '设备字幕'); assert.equal(textOf(window), p.subtitle);
});
test('failed or pending subtitle replacement preserves the prior cue in PiP', async () => {
  let calls = 0; const wait = deferred(); const p = await page(route(), async () => ++calls === 1 ? srt : wait.promise);
  await serverCue(p); const window = await pip(p); const replacement = p.controller.selectSubtitle('server:21'); await settle();
  assert.equal(textOf(window), '你好 & hello\n第二行'); wait.resolve('<html>error</html>'); await replacement;
  assert.equal(textOf(window), '你好 & hello\n第二行'); assert.equal(p.subtitleKey, 'server:20'); assert.equal(p.message, 'subtitle_failed');
});
test('off during a pending subtitle fetch prevents its late cue from appearing', async () => {
  const wait = deferred(); const p = await page(route(), () => wait.promise); const window = await pip(p);
  const pending = p.controller.selectSubtitle('server:20'); await settle(); await p.controller.selectSubtitle(''); wait.resolve(srt); await pending;
  nativePlayers[0].emit('timeUpdate', 1500); assert.equal(textOf(window), ''); assert.equal(p.subtitleKey, '');
});
test('identical time updates do not rebuild or repeatedly update a subtitle node', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p), node = window.captionNode.builderNode;
  const updates = node.updates.length; for (let i = 0; i < 30; i++) nativePlayers[0].emit('timeUpdate', 1600 + i);
  assert.equal(node.updates.length, updates); assert.equal(sdk.nodes.length, 1);
});
test('new PiP container builds its node in its own UIContext and disposes the old node', () => {
  const { c } = caption(); c.setText('中文'); const first = c.makeNode(sdk.uiContext()).builderNode;
  const context = sdk.uiContext(), second = c.makeNode(context).builderNode; c.setText('更新');
  assert.equal(first.disposed, 1); assert.equal(second.context, context); assert.equal(second.params.text, '更新'); assert.equal(context.scoped, 1);
});
test('resize adapts font/line limit and rejects invalid dimensions without losing subtitle', () => {
  const { c } = caption(); c.setText('one\ntwo\nthree'); const node = c.makeNode(sdk.uiContext()).builderNode;
  c.aboutToResize({ width: 160, height: 90 }); assert.equal(node.params.fontSize, 10); assert.ok(node.params.maxLines >= 1 && node.params.maxLines <= 4);
  const small = { ...node.params }; c.aboutToResize({ width: NaN, height: 90 }); c.aboutToResize({ width: 0, height: -1 }); assert.deepEqual(node.params, small);
  c.aboutToResize({ width: 900, height: 600 }); assert.equal(node.params.fontSize, 18); assert.equal(node.params.maxLines, 4); assert.equal(node.params.text, 'one\ntwo\nthree');
});
test('container disappearance frees node; rebuilding seeds the latest cached text', () => {
  const { c } = caption(); c.setText('A'); const first = c.makeNode(sdk.uiContext()).builderNode; c.aboutToDisappear(); c.setText('B');
  assert.equal(first.disposed, 1); const second = c.makeNode(sdk.uiContext()).builderNode; assert.equal(second.params.text, 'B');
});
test('terminal caption disposal is idempotent and rejects late text or node creation', () => {
  const { c } = caption(); c.setText('A'); const node = c.makeNode(sdk.uiContext()).builderNode; c.dispose(); c.dispose(); c.setText('late');
  assert.equal(node.disposed, 1); assert.equal(node.params.text, ''); assert.equal(c.makeNode(sdk.uiContext()), null); assert.equal(c.isReleased, true);
});
test('PiP restore and re-entry free the old node and seed the current foreground cue', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p), first = window.captionNode.builderNode;
  p.onPageHide(); await window.emit('stateChange', 5); await p.system.stopPiP(); await settle();
  assert.equal(first.disposed, 1); assert.equal(p.subtitle, '你好 & hello\n第二行'); nativePlayers[0].emit('timeUpdate', 4500);
  await p.system.startPiP(); assert.equal(window.captionNode.builderNode.params.text, 'Second'); assert.equal(sdk.windows.length, 1); assert.equal(nativePlayers.length, 1);
});
test('subtitle changes during async PiP creation are applied to the newly mounted node', async () => {
  const p = await page(); await serverCue(p); const wait = deferred(); sdk.createPiPWait = wait.promise;
  const starting = p.system.startPiP(); await settle(); nativePlayers[0].emit('timeUpdate', 4500); wait.resolve(); await starting;
  assert.equal(textOf(sdk.windows[0]), 'Second');
});
test('exit during PiP creation prevents any late subtitle node or text resurrection', async () => {
  const p = await page(); await serverCue(p); const owner = p.system, wait = deferred(); sdk.createPiPWait = wait.promise;
  const starting = owner.startPiP(); await settle(); p.aboutToDisappear(); wait.resolve(); await starting; await owner.dispose();
  const c = sdk.windows[0].config.customUIController; owner.updateSubtitle('late'); assert.equal(c.makeNode(sdk.uiContext()), null); assert.equal(sdk.nodes.length, 0);
});
test('exit during PiP start rejects its late makeNode callback', async () => {
  const p = await page(); await serverCue(p); const owner = p.system, wait = deferred(); sdk.startPiPWait = wait.promise;
  const starting = owner.startPiP(); await settle(); p.aboutToDisappear(); wait.resolve(); await starting; await owner.dispose();
  assert.equal(sdk.windows[0].captionNode, null); assert.equal(sdk.nodes.length, 0); assert.equal(sdk.windows[0].stopped, 1);
});
test('media source change clears PiP caption and ignores old native subtitle callbacks', async () => {
  const p = await page(); await p.controller.selectSubtitle('native:12'); nativePlayers[0].emit('timeUpdate', 1500); nativePlayers[0].emit('subtitleUpdate', cue);
  const window = await pip(p), old = nativePlayers[0], original = AppService.playback; AppService.playback = async () => route(episode('e1', 1, 1), 'source-b');
  try { await p.source(1); await settle(); assert.equal(textOf(window), ''); old.emit('subtitleUpdate', { ...cue, text: '旧字幕' }); assert.equal(textOf(window), '');
    assert.equal(p.route.mediaSourceId, 'source-b'); assert.equal(p.subtitleKey, '');
  } finally { AppService.playback = original; }
});
test('authorized PiP auto-next clears old subtitle and keeps the same overlay/window', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p), original = AppService.nextPlayback;
  AppService.nextPlayback = async () => route(episode('e2', 1, 2));
  try { p.onPageHide(); nativePlayers[0].change('completed'); await settle(); assert.equal(p.route.item.Id, 'e2');
    assert.equal(textOf(window), ''); assert.equal(p.subtitleKey, ''); assert.equal(sdk.windows.length, 1);
    await serverCue(p); assert.equal(textOf(window), '你好 & hello\n第二行');
  } finally { AppService.nextPlayback = original; }
});
test('terminal episode clears long cue; late native events cannot restore it', async () => {
  const p = await page(); p.autoNext = false; await p.controller.selectSubtitle('native:12'); nativePlayers[0].emit('timeUpdate', 1500);
  nativePlayers[0].emit('subtitleUpdate', { ...cue, duration: 100000 }); const window = await pip(p);
  nativePlayers[0].change('completed'); await settle(); assert.equal(textOf(window), '');
  nativePlayers[0].emit('subtitleUpdate', { text: 'late', startTime: 60000, duration: 10000 }); nativePlayers[0].emit('timeUpdate', 60000); assert.equal(textOf(window), '');
});
test('native error clears both subtitles and prevents late events repainting them', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p); nativePlayers[0].emit('error', new Error('decode failed'));
  assert.equal(textOf(window), ''); assert.equal(p.subtitle, ''); nativePlayers[0].emit('timeUpdate', 1500); assert.equal(textOf(window), '');
});
test('BuilderNode build failure is visible, cleans up, and re-entry can recover', async () => {
  const p = await page(); await serverCue(p); sdk.failNodeBuild = true; const window = await pip(p);
  assert.equal(window.captionNode, null); assert.equal(p.message, 'pip_subtitle_failed'); assert.equal(sdk.nodes[0].disposed, 1);
  sdk.failNodeBuild = false; await p.system.stopPiP(); await p.system.startPiP(); assert.equal(textOf(window), '你好 & hello\n第二行');
});
test('caption update failure reports once, leaves playback running, and a later update recovers', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p), errors = [], original = p.system.view.error;
  p.system.view.error = message => { errors.push(message); original(message); }; sdk.failNodeUpdate = true;
  nativePlayers[0].emit('timeUpdate', 4500); assert.equal(p.message, 'pip_subtitle_failed'); assert.equal(nativePlayers[0].state, 'playing');
  nativePlayers[0].emit('timeUpdate', 3500); assert.deepEqual(errors, ['pip_subtitle_failed']);
  sdk.failNodeUpdate = false; nativePlayers[0].emit('timeUpdate', 1500); assert.equal(textOf(window), '你好 & hello\n第二行');
});
test('subtitle node release failure retains owner and retries cleanup successfully', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p), owner = p.system, node = window.captionNode.builderNode;
  sdk.failNodeDispose = true; await owner.dispose(); assert.equal(SystemPlayback.current, owner); assert.equal(p.message, 'pip_subtitle_failed');
  sdk.failNodeDispose = false; await owner.dispose(); assert.equal(node.disposed, 1); assert.equal(SystemPlayback.current, undefined);
});
test('PiP caption text never enters AVSession metadata or launch parameters', async () => {
  const p = await page(); const window = await pip(p); p.system.updateSubtitle('私密字幕 api_key=do-not-share');
  assert.equal(textOf(window), '私密字幕 api_key=do-not-share'); assert.ok(!JSON.stringify(sdk.sessions[0].metadata).includes('私密字幕'));
  assert.ok(!JSON.stringify(sdk.want).includes('do-not-share'));
});
test('pause/restore retains current caption and close rejects late native events', async () => {
  const p = await page(); await serverCue(p); const window = await pip(p), owner = p.system, old = nativePlayers[0];
  await owner.pause(); assert.equal(textOf(window), p.subtitle); p.aboutToDisappear(); await owner.dispose();
  old.emit('subtitleUpdate', cue); old.emit('timeUpdate', 1500); assert.equal(window.captionNode.builderNode.params.text, ''); assert.equal(window.captionNode.builderNode.disposed, 1);
});
(async () => {
  for (const [name, fn] of tests) {
    h.reset(); owners.length = 0; captions.length = 0; SystemPlayback.current = undefined;
    try { await fn(); await settle(); console.log('PASS ' + name); }
    finally { sdk.failNodeDispose = false; for (const c of captions) c.dispose(); for (const s of owners) await s.dispose(); await settle(); }
  }
  console.log(`${tests.length} PiP subtitle regression tests passed. Node fixtures do not prove PiP pixels, readability or native controls.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
