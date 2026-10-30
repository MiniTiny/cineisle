const assert = require('node:assert/strict');
const f = require('./dialog-layout-fixture.cjs');
const tests = [], test = (name, action) => tests.push({ name, action });
function geometry(r, width, height, check) {
  const node = r.native.contents.at(-1);
  const outer = f.flat(r.roots).findLast(n => n.type === 'Column' && n.attrs.id?.[0] === 'CineIsleCompactDialog');
  check(() => {
    assert.ok(node); assert.ok(outer);
    assert.equal(outer.attrs.width[0], Math.min(720, width - 32));
    assert.equal(outer.attrs.height[0], height * 0.9);
    const flex = f.flat(outer.children).find(n => n.type === 'Flex');
    const actionColumns = flex.children.flatMap(n => n.type === 'ForEach' ? n.children : [n]).filter(n => n.type === 'Column');
    assert.equal(actionColumns.length, node.data.actions.length);
    for (const col of actionColumns) assert.equal(col.attrs.width[0], width >= 600 && node.data.actions.length > 1 ? '48%' : '100%');
    // Wide layout keeps a separately scrolling message above actions; narrow layout scrolls all.
    assert.equal(outer.children.find(n => n.type === 'If').children.some(n => n.type === 'Text'), width >= 600);
  });
}
for (const entry of f.entries) {
  test('entry ' + entry.id, async check => {
    for (const [width, height] of [[599, 439], [600, 439], [601, 439], [800, 440], [800, 441]]) {
      const r = f.makePage(entry, width, height); await r.trigger(); await f.settle();
      check(() => {
        assert.equal(r.native.alerts.length, height >= 440 ? 1 : 0);
        assert.equal(r.native.contents.length, height < 440 ? 1 : 0);
        assert.equal(r.native.options.length, 1); const options = r.native.options[0];
        assert.equal(options.width, height < 440 ? Math.min(720, width - 32) : undefined);
        assert.equal(options.height, height < 440 ? '90%' : undefined);
        assert.equal(options.buttonDirection, ['posters-clear','index-reason'].includes(entry.id) ? undefined : height < 440 && width >= 600 ? 2 : 1);
      });
      if (height < 440) geometry(r, width, height, check);
      else check(() => {
        const options = r.native.alerts[0]; assert.equal(options.width, undefined); assert.equal(options.height, undefined);
        assert.equal(options.buttonDirection, ['posters-clear', 'index-reason'].includes(entry.id) ? undefined : 1);
      });
    }
  });
  if (entry.action) test('action ' + entry.id, async check => {
    const gate = f.deferred(), r = f.makePage(entry, 600, 439, { closeGate: gate }); await r.trigger();
    const content = r.native.contents[0], before = r.events.filter(e => e[0] === entry.action).length;
    f.clickDialog(r,1); f.clickDialog(r,1); await f.settle();
    const pending = [r.events.filter(e => e[0] === entry.action).length, r.native.timers.length];
    check(() => assert.deepEqual(pending, [before, 0]));
    gate.resolve(); await f.settle();
    const confirmed = [r.events.filter(e => e[0] === entry.action).length, r.native.calls['dialog-close'], content.disposed, r.native.timers.length];
    check(() => assert.deepEqual(confirmed, [before + 1, 1, 0, 1]));
    content.data.release(); r.native.flush(); content.data.release();
    check(() => assert.equal(content.disposed, 1));
  });
  if (entry.action) test('pending close disappearance ' + entry.id, async check => {
    // The OS may retire the view before closeCustomDialog resolves. A confirmed
    // action still runs after that resolution, even if disposal has already run.
    for (const disposeBeforeClose of [false, true]) {
      const gate = f.deferred(), r = f.makePage(entry, 600, 439, { closeGate: gate }); await r.trigger();
      const content = r.native.contents[0], view = r.childViews.find(v => v.data === content.data);
      assert.ok(view, 'Actual CompactDialog lifecycle view missing');
      const before = r.events.filter(e => e[0] === entry.action).length;
      f.clickDialog(r, 1); await f.settle();
      view.aboutToDisappear(); view.aboutToDisappear(); f.clickDialog(r, 1);
      // Checks run after external-health validation; capture each stage now.
      const pending = [r.events.filter(e => e[0] === entry.action).length, r.native.calls['dialog-close'],
        content.disposed, r.native.timers.length, r.native.events.includes('close-resolved')];
      check(() => assert.deepEqual(pending, [before, 1, 0, 1, false]));
      if (disposeBeforeClose) r.native.flush();
      gate.resolve(); await f.settle();
      const confirmed = [r.events.filter(e => e[0] === entry.action).length, r.native.calls['dialog-close'],
        content.disposed, r.native.timers.length, r.native.events.filter(e => e === 'close-resolved').length, [...r.native.toasts]];
      check(() => assert.deepEqual(confirmed, [before + 1, 1, disposeBeforeClose ? 1 : 0, disposeBeforeClose ? 0 : 1, 1, []]));
      view.aboutToDisappear(); f.clickDialog(r, 1); r.native.flush();
      check(() => {
        assert.equal(content.disposed, 1); assert.equal(r.native.timers.length, 0);
        assert.equal(r.events.filter(e => e[0] === entry.action).length, before + 1);
      });
    }
  });
}
for (const entry of f.entries.filter(e => e.action)) test('action error ' + entry.id, async check => {
  const r = f.makePage(entry, 600, 439, { businessFailure: true }); await r.trigger();
  f.clickDialog(r,1); await f.settle();
  check(() => assert.equal(entry.id === 'posters-clear' ? r.view.posterMessage : r.view.message,
    entry.id === 'posters-clear' ? 'poster_cache_clear_failed' : entry.id === 'favorites-remove' ? 'batch_result · business action failed: EIO' : 'business action failed: EIO'));
});
test('custom button cancellation closes without running the page action',async check=>{
 const r=f.makePage(f.entries[0],600,439);await r.trigger();f.clickDialog(r,0);await f.settle();r.native.flush();
 check(()=>{assert.equal(r.events.filter(e=>e[0]==='remove').length,0);assert.equal(r.native.calls['dialog-close'],1);assert.equal(r.native.contents[0].disposed,1);});
});
for (const entry of f.entries.filter(e=>e.action)) test('native action '+entry.id,async check=>{
 const r=f.makePage(entry,600,440);await r.trigger();await f.settle();
 const before=r.events.filter(e=>e[0]===entry.action).length;await r.native.alerts[0].buttons[1].action();await f.settle();
 check(()=>{assert.equal(r.events.filter(e=>e[0]===entry.action).length,before+1);assert.equal(r.native.contents.length,0);assert.equal(r.native.calls['dialog-close'],undefined);});
});
for (const [width, height, count] of [[599,439,2],[600,439,2],[601,439,2],[751,439,2],[752,439,2],[753,439,2],[600,439,1],[600,439,0],[32,439,2],[31,439,2],[NaN,439,2],[600,NaN,2],[600,-1,2],[Infinity,439,2],[600,440,2],[600,441,2]]) {
  test(`bottom ${width} ${height} ${count}`, async check => {
    const r = f.bottom(width, height, Array.from({ length: count }, () => ({ value: 'Action', action() {} }))); r.trigger(); await f.settle();
    check(() => { assert.equal(r.native.alerts.length, height >= 440 ? 1 : 0); assert.equal(r.native.contents.length, height >= 440 ? 0 : 1); });
    if (!(height >= 440)) geometry(r, width, height, check);
  });
}
test('entry malformed height dispatch', async check => {
 for (const height of [NaN,439]) {
  const r=f.makePage(f.entries[0],600,height);await r.trigger();await f.settle();
  check(()=>{assert.equal(r.native.alerts.length,0);assert.equal(r.native.contents.length,1);assert.equal(r.native.options[0].width,Number.isNaN(height)?undefined:568);});
  geometry(r,600,height,check);
 }
});
test('bottom ordered close release action disposal', async check => {
  const gate = f.deferred(); let r;
  r = f.bottom(600,439,[{ value: 'Action', action() { r.native.events.push('action'); } }],{ closeGate: gate }); r.trigger();
  const content=r.native.contents[0]; content.data.choose(-1); content.data.choose(0.5); content.data.choose(NaN); content.data.choose(1);
  const invalidCloseCalls=r.native.calls['dialog-close'];check(() => assert.equal(invalidCloseCalls,undefined));
  content.data.choose(0); content.data.choose(0); await f.settle();
  const actionBeforeClose=r.native.events.includes('action');check(() => assert.equal(actionBeforeClose,false));
  gate.resolve(); await f.settle();
  check(() => assert.deepEqual(JSON.parse(JSON.stringify(r.native.events.filter(e=>e==='close-resolved'||e==='action'||Array.isArray(e)))),[['opened',{alignment:1,autoCancel:true}],'close-resolved',['timer',0],'action']));
  r.native.flush(); content.data.release(); content.data.choose(0); r.native.flush();
  check(() => {assert.equal(content.disposed,1);assert.equal(r.native.events.filter(e=>e==='action').length,1);});
});
test('bottom pending close disappearance preserves confirmed action', async check => {
  for (const disposeBeforeClose of [false, true]) {
    const gate = f.deferred(); let r;
    r = f.bottom(600, 439, [{ value: 'Confirm', action() { r.native.events.push('action'); } }], { closeGate: gate });
    r.trigger(); const content = r.native.contents[0], view = r.childViews.find(v => v.data === content.data);
    assert.ok(view, 'Actual CompactDialog lifecycle view missing');
    // Independent exported entry, followed by the actual SDK-built button callback.
    f.clickDialog(r, 0); await f.settle(); view.aboutToDisappear(); view.aboutToDisappear();
    f.clickDialog(r, 0);
    const pending = [r.native.events.includes('action'), r.native.events.includes('close-resolved'),
      r.native.calls['dialog-close'], content.disposed, r.native.timers.length];
    check(() => assert.deepEqual(pending, [false, false, 1, 0, 1]));
    if (disposeBeforeClose) r.native.flush();
    gate.resolve(); await f.settle();
    const confirmed = [r.native.events.filter(e => e === 'close-resolved' || e === 'action'),
      content.disposed, r.native.timers.length, [...r.native.toasts]];
    check(() => assert.deepEqual(confirmed, [['close-resolved', 'action'], disposeBeforeClose ? 1 : 0, disposeBeforeClose ? 0 : 1, []]));
    view.aboutToDisappear(); f.clickDialog(r, 0); r.native.flush();
    check(() => { assert.equal(content.disposed, 1); assert.equal(r.native.calls['dialog-close'], 1); assert.equal(r.native.events.filter(e => e === 'action').length, 1); });
  }
});
test('bottom pending close disappearance preserves rejection toast', async check => {
  const gate = f.deferred(); let actions = 0;
  const r = f.bottom(600, 439, [{ value: 'Confirm', action() { actions++; } }], { closeGate: gate, expectedFailure: 'dialog-close' });
  r.trigger(); const content = r.native.contents[0], view = r.childViews.find(v => v.data === content.data);
  assert.ok(view, 'Actual CompactDialog lifecycle view missing');
  f.clickDialog(r, 0); await f.settle(); view.aboutToDisappear(); r.native.flush();
  const pending = [actions, [...r.native.toasts], content.disposed];
  check(() => assert.deepEqual(pending, [0, [], 1]));
  gate.resolve(); await f.settle(); view.aboutToDisappear(); f.clickDialog(r, 0); r.native.flush();
  check(() => {
    assert.equal(actions, 0); assert.equal(content.disposed, 1); assert.equal(r.native.calls['dialog-close'], 1);
    assert.deepEqual(r.native.toasts, ['dialog close failed: EIO']); assert.equal(r.native.timers.length, 0);
  });
});
for (const phase of ['dialog-open','dialog-close']) test('bottom error '+phase, async check => {
  let actions=0;const r=f.bottom(600,439,[{value:'Action',action(){actions++;}}],{expectedFailure:phase});r.trigger();await f.settle();
  const content=r.native.contents[0];if(phase==='dialog-close'){content.data.choose(0);await f.settle();content.data.choose(0);await f.settle();}
  check(()=>{assert.equal(actions,0);assert.deepEqual(r.native.toasts,[phase==='dialog-open'?'dialog open failed: EIO':'dialog close failed: EIO']);assert.equal(content.disposed,phase==='dialog-open'?1:0);assert.equal(r.native.timers.length,0);});
});
test('bottom localized error preserves original errorText', async check => {
  const r=f.bottom(600,439,[],{expectedFailure:'dialog-open',errorMessage:'permission_denied'});r.trigger();await f.settle();
  check(()=>assert.deepEqual(r.native.toasts,['当前用户没有执行此操作的权限']));
});
test('bottom disappearance retires action and disposes once',async check=>{
 const r=f.bottom(600,439,[{value:'Action',action(){throw Error('Retired action ran');}}]);r.trigger();const content=r.native.contents[0];const view=r.childViews.find(v=>v.data===content.data);assert.ok(view);view.aboutToDisappear();content.data.choose(0);view.aboutToDisappear();r.native.flush();
 check(()=>{assert.equal(content.disposed,1);assert.equal(r.native.calls['dialog-close'],undefined);});
});

test('bottom disposal failure preserves thrown error and release latch',async check=>{
 const r=f.bottom(600,439,[],{expectedFailure:'content-dispose'});r.trigger();await f.settle();const content=r.native.contents[0];content.data.release();let error;try{r.native.flush();}catch(e){error=e;}content.data.release();r.native.flush();
 check(()=>{assert.equal(error?.message,'dialog dispose failed: EIO');assert.equal(content.disposed,1);assert.equal(r.native.timers.length,0);assert.deepEqual(r.native.toasts,[]);});
});
if(require.main===module)f.run(tests).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={tests};
