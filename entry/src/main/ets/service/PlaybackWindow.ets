import window from '@ohos.window';
import common from '@ohos.app.ability.common';
import { PlayerOptionRules } from '../utils/PlayerOptions';

export interface PlaybackWindowState { visible: boolean; playing: boolean; immersive: boolean; locked: boolean; pip: boolean }

// Window mutations are serialized. A late native response must be followed by the latest
// desired state (including restoration), never by an obsolete foreground request.
export class PlaybackWindow {
  static current: PlaybackWindow | undefined;
  private previous: PlaybackWindow | undefined;
  private main: window.Window | undefined;
  private original: window.WindowProperties | undefined;
  private orientation: window.Orientation = window.Orientation.UNSPECIFIED;
  private appliedOrientation: window.Orientation | undefined;
  private appliedLayout: boolean | undefined;
  private appliedBars: boolean | undefined;
  private appliedKeep: boolean | undefined;
  private appliedBrightness: number | undefined;
  private requestedBrightness: number = PlayerOptionRules.systemBrightness;
  private state: PlaybackWindowState = { visible: false, playing: false, immersive: false, locked: false, pip: false };
  private hidden: boolean = false;
  private locked: boolean = false;
  private closed: boolean = false;
  private restored: boolean = false;
  private dirty: boolean = false;
  private work: Promise<void> | undefined;
  private context: common.UIAbilityContext;
  private error: (code: string) => void;
  constructor(context: common.UIAbilityContext, error: (code: string) => void) {
    this.context = context; this.error = error;
    this.previous = PlaybackWindow.current; PlaybackWindow.current = this;
  }
  get brightness(): number {
    const value = this.appliedBrightness ?? this.original?.brightness ?? PlayerOptionRules.systemBrightness;
    return value >= 0 ? value : 0.5;
  }
  update(state: PlaybackWindowState): Promise<void> { if (!this.closed) { this.state = state; } return this.schedule(); }
  background(): Promise<void> { this.hidden = true; return this.schedule(); }
  foreground(): Promise<void> { this.hidden = false; return this.schedule(); }
  setLocked(locked: boolean): Promise<void> { this.locked = locked; return this.schedule(); }
  async setBrightness(value: number): Promise<boolean> {
    if (this.closed || !Number.isFinite(value) || !PlayerOptionRules.validBrightness(value)) { return false; }
    this.requestedBrightness = value; await this.schedule();
    return !this.closed && this.appliedBrightness === value;
  }
  dispose(): Promise<void> { this.closed = true; return this.schedule(); }
  private schedule(): Promise<void> {
    this.dirty = true;
    this.work = (this.work ?? Promise.resolve()).then(() => this.drain());
    return this.work;
  }
  private async initialize(): Promise<void> {
    if (this.main) { return; }
    const main = await window.getLastWindow(this.context);
    if (this.previous) {
      const sameWindow = this.previous.original?.id === undefined || this.previous.original?.id === main.getWindowProperties().id;
      await this.previous.dispose();
      if (sameWindow && !this.previous.restored) { throw new Error('window_restore_failed'); }
      this.previous = undefined;
    }
    // Even a disposed owner reads its baseline before finishing, but performs no foreground writes.
    this.original = main.getWindowProperties(); this.orientation = main.getPreferredOrientation(); this.main = main;
    this.appliedBrightness = this.original.brightness; this.appliedKeep = this.original.isKeepScreenOn;
    this.appliedLayout = this.original.isLayoutFullScreen; this.appliedBars = this.original.isFullScreen;
    this.appliedOrientation = this.orientation;
  }
  private async attempt(action: () => Promise<void>, code: string): Promise<boolean> {
    try { await action(); return true; }
    catch (e) { this.error(code); return false; }
  }
  private async drain(): Promise<void> {
    try { await this.initialize(); }
    catch (e) {
      this.dirty = false; this.error('window_unavailable');
      if (this.closed && !this.main && !this.previous) { this.restored = true; if (PlaybackWindow.current === this) { PlaybackWindow.current = undefined; } }
      return;
    }
    while (this.dirty) {
      this.dirty = false;
      const main = this.main!; const original = this.original!;
      const visible = !this.closed && !this.hidden && !this.locked && this.state.visible && !this.state.locked && !this.state.pip;
      const immersive = visible && this.state.immersive;
      const keep = visible && this.state.playing ? true : this.closed ? original.isKeepScreenOn : false;
      const brightness = visible && this.requestedBrightness >= 0 ? this.requestedBrightness : original.brightness;
      const orientation = immersive ? window.Orientation.AUTO_ROTATION_LANDSCAPE : this.orientation;
      const layout = immersive || original.isLayoutFullScreen;
      // The normal CineIsle window enables both bars. Never overwrite their colors/privacy settings.
      const bars = immersive || original.isFullScreen;
      if (this.appliedKeep !== keep && await this.attempt(() => main.setWindowKeepScreenOn(keep), 'screen_on_failed')) { this.appliedKeep = keep; }
      if (this.dirty) { continue; }
      if (this.appliedBrightness !== brightness && await this.attempt(() => main.setWindowBrightness(brightness), 'brightness_failed')) { this.appliedBrightness = brightness; }
      if (this.dirty) { continue; }
      if (this.appliedOrientation !== orientation && await this.attempt(() => main.setPreferredOrientation(orientation), 'window_unavailable')) { this.appliedOrientation = orientation; }
      if (this.dirty) { continue; }
      if (this.appliedLayout !== layout && await this.attempt(() => main.setWindowLayoutFullScreen(layout), 'window_unavailable')) { this.appliedLayout = layout; }
      if (this.dirty) { continue; }
      if (this.appliedBars !== bars && await this.attempt(() => main.setWindowSystemBarEnable(bars ? [] : ['status', 'navigation']), 'window_unavailable')) { this.appliedBars = bars; }
      this.restored = this.appliedKeep === original.isKeepScreenOn && this.appliedBrightness === original.brightness &&
        this.appliedOrientation === this.orientation && this.appliedLayout === original.isLayoutFullScreen && this.appliedBars === original.isFullScreen;
    }
    if (this.closed && this.restored && PlaybackWindow.current === this) { PlaybackWindow.current = undefined; }
  }
}
