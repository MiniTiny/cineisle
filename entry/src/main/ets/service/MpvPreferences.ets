import preferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';
import { MpvOptions, defaultMpvOptions, copyMpvOptions, decodeMpvOptions, validMpvOptions } from '../utils/MpvOptions';

// Application-level options are independent of the selected account and default AVPlayer.
export class MpvPreferences {
  private static readonly storeName: string = 'mpv_playback_options';
  private static readonly valueKey: string = 'options_v1';
  private static context: common.UIAbilityContext | undefined;
  private static store: preferences.Preferences | undefined;
  private static loading: Promise<void> | undefined;
  private static writes: Promise<void> = Promise.resolve();
  private static raw: preferences.ValueType = '';
  private static value: MpvOptions = defaultMpvOptions();
  private static ready: boolean = false;
  static issue: string = '';
  static known(): boolean { return MpvPreferences.ready; }
  static snapshot(): MpvOptions { return copyMpvOptions(MpvPreferences.value); }
  static requireOptions(): MpvOptions {
    if (!MpvPreferences.ready) { throw new Error(MpvPreferences.issue || 'mpv_options_load_failed'); }
    return MpvPreferences.snapshot();
  }
  static async load(context: common.UIAbilityContext): Promise<void> {
    if (!context?.filesDir) { throw new Error('mpv_options_load_failed'); }
    MpvPreferences.context = context;
    if (MpvPreferences.loading) { return MpvPreferences.loading; }
    if (MpvPreferences.store) {
      if (!MpvPreferences.ready) { throw new Error(MpvPreferences.issue || 'mpv_options_invalid'); }
      return;
    }
    MpvPreferences.loading = MpvPreferences.read(context);
    try { await MpvPreferences.loading; } finally { MpvPreferences.loading = undefined; }
  }
  private static async read(context: common.UIAbilityContext): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: MpvPreferences.storeName });
      const raw = await store.get(MpvPreferences.valueKey, '');
      MpvPreferences.store = store; MpvPreferences.raw = raw;
      const value = typeof raw === 'string' ? decodeMpvOptions(raw) : undefined;
      if (!value) { throw new Error('mpv_options_invalid'); }
      MpvPreferences.value = value; MpvPreferences.ready = true; MpvPreferences.issue = '';
    } catch (e) {
      MpvPreferences.ready = false;
      MpvPreferences.issue = (e as Error).message === 'mpv_options_invalid' ? 'mpv_options_invalid' : 'mpv_options_load_failed';
      throw new Error(MpvPreferences.issue);
    }
  }
  static async save(value: MpvOptions, allowed: () => boolean): Promise<MpvOptions> {
    if (!validMpvOptions(value)) { throw new Error('mpv_options_invalid'); }
    const next = copyMpvOptions(value);
    const writing = MpvPreferences.writes.then(async () => {
      const context = MpvPreferences.context;
      if (!context) { throw new Error('mpv_options_load_failed'); }
      if (!allowed()) { throw new Error('mpv_options_cancelled'); }
      if (!MpvPreferences.store) {
        try { await MpvPreferences.load(context); }
        catch (e) { if (!MpvPreferences.store) { throw e as Error; } }
      }
      const store = MpvPreferences.store!; const previous = MpvPreferences.raw;
      if (!allowed()) { throw new Error('mpv_options_cancelled'); }
      try {
        await store.put(MpvPreferences.valueKey, JSON.stringify(next)); await store.flush();
        if (!allowed()) { throw new Error('mpv_options_cancelled'); }
      } catch (e) {
        try { await store.put(MpvPreferences.valueKey, previous); await store.flush(); }
        catch (_) { MpvPreferences.ready = false; MpvPreferences.issue = 'mpv_options_restore_failed'; throw new Error(MpvPreferences.issue); }
        MpvPreferences.issue = (e as Error).message === 'mpv_options_cancelled' ? 'mpv_options_cancelled' : 'mpv_options_save_failed';
        throw new Error(MpvPreferences.issue);
      }
      MpvPreferences.raw = JSON.stringify(next); MpvPreferences.value = next;
      MpvPreferences.ready = true; MpvPreferences.issue = '';
    });
    MpvPreferences.writes = writing.catch(() => {}); await writing; return copyMpvOptions(next);
  }
}
