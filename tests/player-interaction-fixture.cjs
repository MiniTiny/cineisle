// SDK gesture callbacks and the lower Player methods share the real Controller
// and NativePlaybackEngine. Only AVPlayer/platform APIs are explicit fixtures.
const assert = require('node:assert/strict'), common = require('./contract-external.cjs');
const { fixture } = require('./resource-cache-result.cjs');
const h = require('./player-regression.test.cjs'), { AppLock } = h.load('service/AppLock.ets');
const media = h.platform.get('@ohos.multimedia.media'), create = media.createAVPlayer;
const sliderEnum = Object.getOwnPropertyDescriptor(global, 'SliderChangeMode');
let trace, controllers, pages;
const nativeFailure = phase => { if (process.argv.includes('--native-' + phase + '-init-failure')) throw Object.assign(Error('injected player interaction ' + phase + ' failure'), { code: 'EIO', contractInjected: true }); };
const f = { assert, h, AppLock, trace: () => trace,
  async rig(layer, options = {}) {
    const r = h.rig(), n = new h.NativePlayer(); n.duration = 120000; h.nativeQueue.push(n); controllers.push(r.c);
    const route = h.route(); await r.c.open(route, 'surface'); await h.settle();
    trace.call('controller-ready', () => {});
    await fixture('controller-readiness', () => assert.equal(r.values.state, 'playing'));
    if (options.speed) r.c.setSpeed(options.speed);
    const seek = n.seek, speed = n.setSpeed, controllerSeek = r.c.seek.bind(r.c), attempts = [];
    n.seek = (...args) => trace.call('native-seek', () => { nativeFailure('seek'); return seek.apply(n, args); });
    n.setSpeed = (...args) => trace.call('native-speed', () => { nativeFailure('speed'); return speed.apply(n, args); });
    r.c.seek = value => { attempts.push(value); return trace.call('controller-seek', () => controllerSeek(value)); };
    const overrides = { alive: true, visible: true, locked: false, state: 'playing', busy: false, settingsBusy: false, controlsLocked: false, pipActive: false, duration: 120000, surfaceWidth: options.width ?? 400, surfaceHeight: 300, playbackPosition: options.anchor ?? 10000, speed: options.speed ?? 1, trickplayEnabled: false, route, controller: r.c, appLock: AppLock };
    let p, form;
    if (layer === 'sdk') { const ui = trace.call('ui-compile', () => require('./brand-forms.test.cjs')); form = ui.render('Player', overrides); p = form.view; }
    else { p = Object.assign(new h.Player(), overrides, { ownerClient: h.AppService.client }); }
    pages.push(p); const start = n.calls.length;
    const gesture = type => form?.gestures.find(g => g.type === type);
    const slider = form && require('./brand-forms.test.cjs').flat(form.roots).find(node => node.type === 'Slider' && node.attrs.accessibilityText?.[0] === 'app.string.player_seek');
    const event = (dx, dy = 0) => ({ offsetX: dx, offsetY: dy, fingerList: [{ localX: 100 + dx, localY: 100 + dy }] });
    return { p, r, n, attempts, form, gesture, slider,
      beginPan() { if (form) gesture('PanGesture').callbacks.onActionStart(event(0)); else p.beginSeek(100, 100); },
      preview(dx) { if (form) gesture('PanGesture').callbacks.onActionUpdate(event(dx)); else p.previewSeek(dx); },
      endPan() { if (form) gesture('PanGesture').callbacks.onActionEnd(); else p.endSeek(); },
      hold() { if (form) gesture('LongPressGesture').callbacks.onAction(event(0)); else p.holdSpeed(100, 100); },
      cancelHold() { if (form) gesture('LongPressGesture').callbacks.onActionCancel(); else p.cancelGesture(); },
      sliderChange(value, mode) { if (form) slider.attrs.onChange[0](value, mode); else p.sliderSeek(value, mode); },
      snapshot: () => ({ attempts: [...attempts], seeks: n.calls.slice(start).filter(c => c[0] === 'seek').map(c => c[1]), speeds: n.calls.slice(start).filter(c => c[0] === 'speed').map(c => c[1]), errors: [...r.values.errors], preview: p.seekPreview, sliderPreview: p.sliderPreview, speed: p.speed, held: p.heldSpeed })
    };
  },
  async invoke(layer, action, options) { try { const r = await f.rig(layer, options); trace.call('ui-action', () => {}); return { value: await action(r) }; } catch (unexpected) { if (unexpected.code === 'ERR_RESOURCE_FIXTURE') throw unexpected; return { unexpected }; } },
  run: tests => common.run(tests, 'player-interaction', () => {
    h.reset(); trace = common.external('player-interaction', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); controllers = []; pages = [];
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated player interaction setup failure');
    Object.defineProperty(global, 'SliderChangeMode', { configurable: true, get: () => trace.call('slider-enum', () => { nativeFailure('enum'); return { Begin: 0, Moving: 1, End: 2, Click: 3 }; }) });
    media.createAVPlayer = (...args) => trace.call('av-create', async () => {
      if (process.argv.includes('--native-init-failure')) throw Object.assign(Error('injected native AVPlayer initializer failure'), { code: 'EIO', contractInjected: true });
      return create(...args);
    });
  }, async () => { for (const p of pages) { p.clearHide(); p.cancelGesture(); } for (const c of controllers) await c.close(); media.createAVPlayer = create; if (sliderEnum) Object.defineProperty(global, 'SliderChangeMode', sliderEnum); else delete global.SliderChangeMode; }, () => trace.healthy())
};
module.exports = f;
