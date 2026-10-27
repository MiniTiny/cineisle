// Real WallpaperColors/AppearancePreferences and disk-backed Preferences; wallpaper/window/clock are fixtures.
const f = require('./catalog-contract-fixture.cjs').make('wallpaper-contract'), { h } = f;
const prefs = require('./preferences-platform.cjs').install(h.platform, h.directory), api = h.platform.get('@ohos.wallpaper');
const { AppearancePreferences: A } = h.load('service/AppearancePreferences.ets'), { AppearanceOptions } = h.load('utils/Appearance.ts'), { WallpaperColors } = h.load('service/WallpaperColors.ets');
let provider, handlers, sources, tickets, reads, events, time, main;
const colors = () => [{ red: 30, green: 120, blue: 200, alpha: 255 }];
function observe(promise) { let state = { settled: false }; promise.then(value => { state = { settled: true, value }; }, error => { state = { settled: true, error }; }); return () => state; }
function clock() {
  const original = { setTimeout, clearTimeout, setInterval, clearInterval }, pending = new Map(), scheduled = []; let now = 0, next = 0;
  global.setTimeout = (callback, ms) => f.trace().call('timer-set', () => { const id = ++next; scheduled.push(ms); pending.set(id, { callback, at: now + ms }); return id; }, { duration: ms });
  global.clearTimeout = id => pending.delete(id);
  return { pending, scheduled, now: () => now,
    async advance(ms) { const target = now + ms; let safety = 0; while (true) { const next = [...pending].filter(([,v]) => v.at <= target).sort((a,b) => a[1].at - b[1].at || a[0] - b[0])[0]; if (!next) break; if (++safety > 1000) throw Error('non-progressing wallpaper fixture clock'); const [id, value] = next; pending.delete(id); now = value.at; f.trace().call('timer-fire', value.callback); await f.settle(); } now = target; await f.settle(); },
    restore() { Object.assign(global, original); pending.clear(); }
  };
}
const fixture = { ...f, A, prefs, colors, observe, time: () => time,
  response: fn => { provider = fn; },
  source() { const source = new WallpaperColors(); sources.push(source); return source; },
  read(source, allowed = () => true) { const ticket = source.read(allowed); tickets.push(ticket); return { ticket, state: observe(ticket.result) }; },
  attach: () => observe(A.attach(h.context, main)),
  emit(value, type = 0, index = handlers.length - 1) { handlers[index]?.(value, type); },
  stats: () => ({ reads, timers: pendingTimers(), scheduled: [...time.scheduled], events: events.map(e => [...e]), status: AppStorage.values.get('cineIslePaletteStatus'), palette: AppStorage.values.get('cineIslePalette'), issue: A.issue }),
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) {
    const native = { ...api }, preferencesOpen = prefs.api.getPreferences, publish = AppStorage.setOrCreate;
    A.ticket?.cancel(); A.source.stop(); prefs.reset(); Object.assign(A, { context: undefined, main: undefined, epoch: 0, store: undefined, writes: Promise.resolve(), raw: '', value: new AppearanceOptions(), issue: '', colors: undefined, source: new WallpaperColors(), ticket: undefined, visible: true, refreshing: false, refreshAgain: false, updateQueued: false, pendingColors: undefined, pendingMain: undefined, pendingEpoch: 0 });
    AppStorage.values.clear(); h.capabilities.add('SystemCapability.MiscServices.Wallpaper'); handlers = []; sources = []; tickets = []; reads = 0; events = []; time = clock(); provider = async () => colors();
    api.getColors = async type => f.trace().call('wallpaper-read', async () => {
      ++reads; if (process.argv.includes('--native-wallpaper-init-failure')) throw Object.assign(Error('injected native wallpaper read failure'), { code: 'EIO', contractInjected: true });
      f.assert.equal(type, 0); return provider();
    });
    api.on = (event, handler) => f.trace().call('wallpaper-on', () => { f.assert.equal(event, 'colorChange'); handlers.push(handler); });
    api.off = (event, handler) => f.trace().call('wallpaper-off', () => { f.assert.equal(event, 'colorChange'); });
    prefs.api.getPreferences = async (...args) => f.trace().call('preferences-open', async () => {
      if (process.argv.includes('--native-preferences-init-failure')) throw Object.assign(Error('injected native Preferences initializer failure'), { code: 'EIO', contractInjected: true }); return preferencesOpen(...args);
    });
    AppStorage.setOrCreate = (key, value) => f.trace().call('storage-publish', () => { events.push(['publish', key]); return publish.call(AppStorage, key, value); });
    main = { setWindowBackgroundColor: value => f.trace().call('window-background', () => { events.push(['background', value]); }), async setWindowSystemBarProperties(value) { return f.trace().call('window-bars', () => { events.push(['bars', { ...value }]); }); } };
    try { await test.action(check); }
    finally { A.ticket?.cancel(); A.source.stop(); tickets.forEach(t => t.cancel()); sources.forEach(s => s.stop()); await f.settle(); await A.writes; time.restore(); Object.assign(api, native); prefs.api.getPreferences = preferencesOpen; AppStorage.setOrCreate = publish; }
  } })))
};
function pendingTimers() { return time.pending.size; }
module.exports = fixture;
