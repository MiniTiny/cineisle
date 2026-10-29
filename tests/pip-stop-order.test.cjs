// The installed SDK permits stopPiP Promise completion before STOPPED delivery.
// Model these signals independently, including actual observed 1300015/1300012 errors.
const assert = require('node:assert/strict');
const h = require('./player-regression.test.cjs');
const { SystemPlayback } = h.load('service/SystemPlayback.ets');
const { PlaybackController } = h.load('service/PlaybackController.ets');
const cases = [], owners = []; let completed = 0, current = '';
process.on('beforeExit', () => { if (completed !== cases.length) { console.error(`Incomplete PiP stop suite: ${completed}/${cases.length}; pending ${current}`); process.exitCode = 1; } });
const test = (name, run) => cases.push([name, run]);
async function rig() {
  let owner; const errors = [], route = h.route();
  const controller = new PlaybackController({ report: async () => {} }, {
    state: () => owner?.sync(true), time: () => owner?.sync(), tracks() {}, subtitle() {},
    error: message => errors.push(message), reportError() {}, complete() {},
    beforePlay: () => owner.permitPlay(), interrupted: () => owner.pause()
  });
  owner = new SystemPlayback(h.systemPlatform.context, controller, {}, route, {
    changed() {}, error: message => errors.push(message), next: async () => {}, stopped() {}
  }); owners.push(owner);
  await owner.initialize(); await controller.open(route, 'stop-order'); await h.settle();
  await owner.startPiP(); const window = h.systemPlatform.windows.at(-1), stopped = window.handlers.stateChange;
  const originalStart = window.startPiP.bind(window), originalStop = window.stopPiP.bind(window);
  let phase = 'active', calls = 0, gate, failure;
  window.startPiP = async () => { phase = 'active'; await originalStart(); };
  window.stopPiP = async () => {
    calls++;
    if (failure) throw Object.assign(Error('native stop rejected'), { code: failure });
    if (phase !== 'active') throw Object.assign(Error('duplicate or abnormal native stop'), { code: phase === 'stopping' ? 1300015 : 1300012 });
    phase = 'stopping'; if (gate) await gate.promise; phase = 'stopped';
  };
  return { errors, owner, window, calls: () => calls, gate: value => { gate = value; }, fail: code => { failure = code; },
    signal: async () => { window.config.customUIController.aboutToDisappear(); await stopped(4); await h.settle(); },
    restore: () => { window.stopPiP = originalStop; failure = undefined; gate?.resolve(); window.config.customUIController.aboutToDisappear(); stopped(4); } };
}
async function clock(run) {
  const set = global.setTimeout, clear = global.clearTimeout, timers = new Map(); let serial = -100;
  global.setTimeout = (fn, ms, ...args) => {
    if (ms !== 3000) return set(fn, ms, ...args);
    const id = serial--; timers.set(id, () => fn(...args)); return id;
  };
  global.clearTimeout = id => { if (!timers.delete(id)) clear(id); };
  try { await run({ size: () => timers.size, expire: () => { const pending = [...timers.values()]; timers.clear(); assert.ok(pending.length); pending.forEach(fn => fn()); } }); }
  finally { global.setTimeout = set; global.clearTimeout = clear; }
}
test('successful stop awaits the independent STOPPED event before returning', async () => {
  const r = await rig(); let done = false;
  try {
    const stop = r.owner.stopPiP().then(() => { done = true; }); await h.settle();
    assert.equal(r.calls(), 1); assert.equal(done, false, 'native Promise alone is not STOPPED confirmation');
    await r.signal(); await stop; assert.equal(done, true); assert.equal(r.owner.pipActive, false);
    await r.owner.dispose(); assert.equal(r.calls(), 1); assert.equal(SystemPlayback.current, undefined);
  } finally { r.restore(); }
});
test('concurrent stop callers share one native request while awaiting STOPPED', async () => {
  const r = await rig();
  try {
    const a = r.owner.stopPiP(), b = r.owner.stopPiP(); await h.settle(); assert.equal(r.calls(), 1);
    await r.signal(); await Promise.all([a, b]); await r.owner.dispose(); assert.equal(r.calls(), 1); assert.equal(SystemPlayback.current, undefined);
  } finally { r.restore(); }
});
test('dispose during pending native stop keeps its listener and never issues a duplicate stop', async () => {
  const r = await rig(), gate = h.deferred(); r.gate(gate);
  try {
    const stop = r.owner.stopPiP(); await h.settle(); const close = r.owner.dispose(); await h.settle();
    assert.equal(r.calls(), 1); assert.ok(r.window.handlers.stateChange); assert.equal(SystemPlayback.current, r.owner);
    gate.resolve(); await h.settle(); assert.equal(r.calls(), 1); await r.signal(); await Promise.all([stop, close]);
    assert.equal(SystemPlayback.current, undefined); assert.equal(h.systemPlatform.sessions[0].destroyed, 1);
    assert.deepEqual(r.window.handlers, {}); assert.equal(h.systemPlatform.taskActive, false);
  } finally { r.restore(); }
});
test('queued restart waits for STOPPED and still reuses the same player and PiP controller', async () => {
  const r = await rig();
  try {
    const stop = r.owner.stopPiP(), start = r.owner.startPiP(); await h.settle(); assert.equal(r.window.started, 1);
    await r.signal(); await Promise.all([stop, start]); assert.equal(r.window.started, 2); assert.equal(h.systemPlatform.windows.length, 1); assert.equal(h.nativePlayers.length, 1);
    assert.equal(r.owner.pipActive, true);
  } finally { r.restore(); }
});
test('STOPPED before native Promise completion still waits for both signals', async () => {
  const r = await rig(), gate = h.deferred(); r.gate(gate); let done = false;
  try {
    const stop = r.owner.stopPiP().then(() => { done = true; }); await h.settle(); await r.signal(); assert.equal(done, false);
    gate.resolve(); await stop; await r.owner.dispose(); assert.equal(r.calls(), 1); assert.equal(SystemPlayback.current, undefined);
  } finally { r.restore(); }
});
test('missing STOPPED is bounded and its late signal allows cleanup without replaying native stop', async () => clock(async timers => {
  const r = await rig();
  try {
    const stop = r.owner.stopPiP(); await h.settle(); assert.equal(timers.size(), 1); timers.expire(); await stop;
    assert.equal(r.errors.at(-1), 'pip_failed'); assert.equal(SystemPlayback.current, r.owner); assert.equal(r.calls(), 1);
    const close = r.owner.dispose(); await h.settle(); assert.equal(r.calls(), 1); assert.equal(timers.size(), 1);
    await r.signal(); await close; assert.equal(timers.size(), 0); assert.equal(SystemPlayback.current, undefined);
  } finally { r.restore(); }
}));
test('terminal cleanup timeout retains the actual owner until the late STOPPED confirmation', async () => clock(async timers => {
  const r = await rig();
  try {
    const close = r.owner.dispose(); await h.settle(); assert.equal(r.calls(), 1); timers.expire(); await close;
    assert.equal(SystemPlayback.current, r.owner); assert.equal(r.errors.at(-1), 'system_playback_cleanup_failed');
    const a = r.owner.dispose(), b = r.owner.dispose(); await h.settle();
    assert.equal(timers.size(), 1); assert.equal(r.calls(), 1); await r.signal(); await Promise.all([a, b]);
    assert.equal(r.calls(), 1); assert.equal(SystemPlayback.current, undefined); assert.equal(h.systemPlatform.sessions[0].destroyed, 1);
  } finally { r.restore(); }
}));
test('timed out pending native Promise is reused and cleanup waits for its late completion too', async () => clock(async timers => {
  const r = await rig(), gate = h.deferred(); r.gate(gate);
  try {
    const stop = r.owner.stopPiP(); await h.settle(); timers.expire(); await stop; assert.equal(r.calls(), 1);
    let closed = false; const close = r.owner.dispose().then(() => { closed = true; }); await h.settle();
    await r.signal(); assert.equal(closed, false); assert.equal(r.calls(), 1);
    gate.resolve(); await close; assert.equal(SystemPlayback.current, undefined); assert.equal(timers.size(), 0);
  } finally { r.restore(); }
}));
test('genuine stop failures remain visible and retain ownership for an explicit retry', async () => {
  const r = await rig(); r.fail(1300011);
  try {
    await r.owner.dispose(); assert.equal(SystemPlayback.current, r.owner); assert.equal(r.errors.at(-1), 'system_playback_cleanup_failed'); assert.equal(r.calls(), 1);
    r.fail(undefined); const retry = r.owner.dispose(); await h.settle(); assert.equal(r.calls(), 2); await r.signal(); await retry;
    assert.equal(SystemPlayback.current, undefined);
  } finally { r.restore(); }
});
test('duplicate late STOPPED callbacks after disposal cannot mutate a replacement owner', async () => {
  const r = await rig();
  try {
    const close = r.owner.dispose(); await h.settle(); await r.signal(); await close;
    const newer = await rig(); try { await r.signal(); assert.equal(SystemPlayback.current, newer.owner); assert.equal(newer.owner.pipActive, true); }
    finally { newer.restore(); }
  } finally { r.restore(); }
});
(async () => {
  for (const [name, run] of cases) {
    h.reset(); SystemPlayback.current = undefined; owners.length = 0;
    current = name;
    try { await run(); completed++; console.log('PASS ' + name); }
    finally { for (const owner of owners) await owner.dispose(); await h.settle(); }
  }
  console.log(`${cases.length} PiP stop ordering regressions passed. Independent SDK event fixtures do not replace device lifecycle acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
