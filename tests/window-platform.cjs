// Explicit native-window fixture, including delayed and rejected platform mutations.
const state = { calls: [], failures: new Set(), waits: new Map(), context: { abilityInfo: {} } };
class NativeWindow {
  constructor() { this.props = { id: 1, brightness: -1, isKeepScreenOn: false, isFullScreen: false, isLayoutFullScreen: false }; this.orientation = 0; }
  getWindowProperties() { return { ...this.props }; }
  getPreferredOrientation() { return this.orientation; }
  async apply(name, value) {
    state.calls.push([name, value]);
    if (state.waits.has(name)) await state.waits.get(name);
    if (state.failures.has(name)) throw new Error('native ' + name + ' rejected');
  }
  async setWindowKeepScreenOn(value) { await this.apply('keep', value); this.props.isKeepScreenOn = value; }
  async setWindowBrightness(value) { await this.apply('brightness', value); this.props.brightness = value; }
  async setPreferredOrientation(value) { await this.apply('orientation', value); this.orientation = value; }
  async setWindowLayoutFullScreen(value) { await this.apply('layout', value); this.props.isLayoutFullScreen = value; }
  async setWindowSystemBarEnable(value) { await this.apply('bars', value); this.props.isFullScreen = value.length === 0; }
}
state.reset = () => { state.calls.length = 0; state.failures.clear(); state.waits.clear(); state.main = new NativeWindow(); delete state.getWait; delete state.failGet; };
state.reset();
state.install = platform => platform.set('@ohos.window', { Orientation: { UNSPECIFIED: 0, AUTO_ROTATION_LANDSCAPE: 7 },
  async getLastWindow() { if (state.getWait) await state.getWait; if (state.failGet) throw new Error('window unavailable'); return state.main; } });
module.exports = state;
