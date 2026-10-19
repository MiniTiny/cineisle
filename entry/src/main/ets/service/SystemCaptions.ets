import accessibility from '@ohos.accessibility';
import { CaptionConfig, CaptionSnapshot, copyCaptionConfig, validCaptionConfig, sameCaptionConfig } from '../utils/CaptionStyle';
function captionStyleChanged(_style: accessibility.CaptionsStyle): void { SystemCaptions.read(); }
function captionEnableChanged(_enabled: boolean): void { SystemCaptions.read(); }
// System-wide preferences, independent of the signed-in Jellyfin account. Product code writes only on explicit Apply.
export class SystemCaptions {
  private static manager: accessibility.CaptionsManager | undefined = undefined;
  private static styleHook: boolean = false;
  private static enableHook: boolean = false;
  private static cleanupPending: boolean = false;
  private static listeners: Set<(state: CaptionSnapshot) => void> = new Set();
  private static state: CaptionSnapshot = new CaptionSnapshot();
  private static reading: boolean = false;
  private static work: Promise<void> = Promise.resolve();
  static snapshot(): CaptionSnapshot { const state = new CaptionSnapshot(); state.available = SystemCaptions.state.available; state.issue = SystemCaptions.state.issue; state.config = copyCaptionConfig(SystemCaptions.state.config); return state; }
  private static nativeStyle(config: CaptionConfig): accessibility.CaptionsStyle {
    return { fontFamily: config.family as accessibility.CaptionsFontFamily, fontScale: config.fontScale, fontColor: config.foreground,
      backgroundColor: config.background, windowColor: config.window, fontEdgeType: config.edge as accessibility.CaptionsFontEdgeType };
  }
  static read(): CaptionSnapshot {
    if (SystemCaptions.reading) { return SystemCaptions.snapshot(); }
    SystemCaptions.reading = true; const before = JSON.stringify(SystemCaptions.state); const next = new CaptionSnapshot();
    try {
      if (SystemCaptions.cleanupPending) { SystemCaptions.release(); if (SystemCaptions.cleanupPending) { throw new Error('caption_unavailable'); } }
      if (!canIUse('SystemCapability.BarrierFree.Accessibility.Hearing')) { throw new Error('caption_unavailable'); }
      const manager = SystemCaptions.manager ?? accessibility.getCaptionsManager(); SystemCaptions.manager = manager;
      if (SystemCaptions.listeners.size) {
        try {
          if (!SystemCaptions.styleHook) { SystemCaptions.styleHook = true; manager.on('styleChange', captionStyleChanged); }
          if (!SystemCaptions.enableHook) { SystemCaptions.enableHook = true; manager.on('enableChange', captionEnableChanged); }
        } catch (e) { SystemCaptions.cleanupPending = true; throw e as Error; }
      }
      const native = manager.style; const config = new CaptionConfig(); config.enabled = manager.enabled; config.fontScale = native.fontScale;
      config.family = native.fontFamily; config.foreground = native.fontColor; config.background = native.backgroundColor; config.window = native.windowColor; config.edge = native.fontEdgeType;
      if (!validCaptionConfig(config)) { throw new Error('caption_invalid'); }
      next.available = true; next.config = copyCaptionConfig(config); next.issue = '';
    } catch (e) { next.issue = (e as Error).message === 'caption_invalid' ? 'caption_invalid' : 'caption_unavailable'; }
    SystemCaptions.state = next; SystemCaptions.reading = false;
    if (JSON.stringify(next) !== before) { SystemCaptions.listeners.forEach((listener) => { try { listener(SystemCaptions.snapshot()); } catch (e) { /* A retired view cannot prevent other caption updates. */ } }); }
    return SystemCaptions.snapshot();
  }
  static observe(listener: (state: CaptionSnapshot) => void): () => void {
    const before = JSON.stringify(SystemCaptions.state); SystemCaptions.listeners.add(listener); const state = SystemCaptions.read();
    if (JSON.stringify(state) === before) { try { listener(state); } catch (e) { /* The subscription still has a deterministic release handle. */ } }
    let active = true;
    return () => { if (!active) { return; } active = false; SystemCaptions.listeners.delete(listener); if (!SystemCaptions.listeners.size) { SystemCaptions.release(); } };
  }
  private static release(): void {
    const manager = SystemCaptions.manager; if (!manager) { return; }
    try { if (SystemCaptions.styleHook) { manager.off('styleChange', captionStyleChanged); SystemCaptions.styleHook = false; } } catch (e) { SystemCaptions.state.issue = 'caption_unavailable'; }
    try { if (SystemCaptions.enableHook) { manager.off('enableChange', captionEnableChanged); SystemCaptions.enableHook = false; } } catch (e) { SystemCaptions.state.issue = 'caption_unavailable'; }
    SystemCaptions.cleanupPending = SystemCaptions.styleHook || SystemCaptions.enableHook;
    if (!SystemCaptions.styleHook && !SystemCaptions.enableHook) { SystemCaptions.manager = undefined; }
  }
  private static async verified(config: CaptionConfig): Promise<CaptionSnapshot | undefined> {
    for (let n = 0; n < 6; n++) { const state = SystemCaptions.read(); if (state.available && sameCaptionConfig(state.config, config)) { return state; } if (n < 5) { await new Promise<void>((resolve) => setTimeout(resolve, 100)); } }
    return undefined;
  }
  static save(expected: CaptionConfig, draft: CaptionConfig): Promise<CaptionSnapshot> {
    if (!validCaptionConfig(expected) || !validCaptionConfig(draft)) { return Promise.reject(new Error('caption_invalid')); }
    const base = copyCaptionConfig(expected); const target = copyCaptionConfig(draft);
    const result = SystemCaptions.work.then(async (): Promise<CaptionSnapshot> => {
      const prior = SystemCaptions.read(); if (!prior.available || !SystemCaptions.manager) { throw new Error('caption_unavailable'); }
      if (sameCaptionConfig(prior.config, target)) { return prior; }
      if (!sameCaptionConfig(prior.config, base)) { throw new Error('caption_changed'); }
      const manager = SystemCaptions.manager;
      try {
        manager.style = SystemCaptions.nativeStyle(target); manager.enabled = target.enabled;
        const verified = await SystemCaptions.verified(target); if (!verified) { throw new Error('caption_save_failed'); } return verified;
      } catch (e) {
        const current = SystemCaptions.read(); const partial = copyCaptionConfig(target); partial.enabled = prior.config.enabled;
        // Restore only a state still attributable to our write. An external writer retains ownership of its own values.
        if (!current.available) { throw new Error('caption_save_unconfirmed'); }
        if (sameCaptionConfig(current.config, target) || sameCaptionConfig(current.config, partial)) {
          try { manager.style = SystemCaptions.nativeStyle(prior.config); manager.enabled = prior.config.enabled; }
          catch (restoreError) { throw new Error('caption_save_unconfirmed'); }
          if (!await SystemCaptions.verified(prior.config)) { throw new Error('caption_save_unconfirmed'); }
        } else if (!sameCaptionConfig(current.config, prior.config)) { throw new Error('caption_save_unconfirmed'); }
        throw new Error('caption_save_failed');
      }
    });
    SystemCaptions.work = result.then(() => {}, () => {}); return result;
  }
}
