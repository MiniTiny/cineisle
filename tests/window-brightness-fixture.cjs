// Actual PlaybackWindow and Player. Native window functions are explicit API fixtures.
const base = require('./playback-timing-fixture.cjs'), { h } = base, windowState = require('./window-platform.cjs');
const { PlaybackWindow } = h.load('service/PlaybackWindow.ets');
const f = { ...base, windowState,
  async lower(value, action) {
    windowState.main.props.brightness = value; const errors = [], w = new PlaybackWindow(h.systemPlatform.context, e => errors.push(e));
    try { await w.update({ visible: true, playing: false, immersive: false, locked: false, pip: false }); return await action(w, errors); }
    finally { await w.dispose(); if (PlaybackWindow.current === w) PlaybackWindow.current = undefined; }
  },
  async page() { const r = await base.offlinePage(), { playerOptions } = h.load('utils/PlayerOptions.ts'), options = playerOptions(); options.rememberBrightness = true; r.store.update(s => { s.playerUi = options; }); r.p.ui = options; return r; },
  run: tests => base.run(tests.map(test => ({ ...test, async action(check, time) {
    windowState.reset(); PlaybackWindow.current = undefined;
    const api = h.platform.get('@ohos.window'), original = api.getLastWindow, main = windowState.main, write = main.setWindowBrightness;
    const initFailure = process.argv.includes('--native-window-init-failure'), writeFailure = process.argv.includes('--native-brightness-init-failure');
    windowState.failGet = initFailure;
    api.getLastWindow = (...args) => { const details = {}; return f.trace().call('window-read', async () => {
      try { return await original(...args); } catch (cause) { if (!initFailure || cause.message !== 'window unavailable') throw cause; details.originalError = cause.message; throw Object.assign(Error('actual native window acquisition failed', { cause }), { code: 'EIO', contractInjected: true }); }
    }, details); };
    main.setWindowBrightness = async value => { const details = { value }; const result = await f.trace().call('brightness-write', async () => {
      if (writeFailure) windowState.failures.add('brightness');
      try { await write.call(main, value); return {}; } catch (cause) {
        if (writeFailure && cause.message === 'native brightness rejected') { details.originalError = cause.message; throw Object.assign(Error('actual native brightness write failed', { cause }), { code: 'EIO', contractInjected: true }); }
        if (windowState.failures.has('brightness') && cause.message === 'native brightness rejected') return { expected: cause };
        throw cause;
      }
    }, details); if (result.expected) throw result.expected; };
    try { await test.action(check, time); } finally { api.getLastWindow = original; main.setWindowBrightness = write; windowState.failGet = false; windowState.failures.clear(); }
  } })))
};
module.exports = f;
