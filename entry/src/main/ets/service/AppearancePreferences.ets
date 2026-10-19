import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import window from '@ohos.window';
import { AppearanceOptions, copyAppearance, validAppearance } from '../utils/Appearance';

// Global visual settings; window effects and durable preferences commit before reactive publication.
export class AppearancePreferences {
  private static context: common.UIAbilityContext | undefined;
  private static main: window.Window | undefined;
  private static epoch: number = 0;
  private static store: preferences.Preferences | undefined;
  private static writes: Promise<void> = Promise.resolve();
  private static raw: preferences.ValueType = '';
  private static value: AppearanceOptions = new AppearanceOptions();
  static issue: string = '';
  static snapshot(): AppearanceOptions { return copyAppearance(AppearancePreferences.value); }
  static async attach(context: common.UIAbilityContext, main: window.Window): Promise<void> {
    if (!context?.filesDir) { throw new Error('appearance_unavailable'); }
    AppearancePreferences.context = context; AppearancePreferences.main = main; ++AppearancePreferences.epoch;
    await AppearancePreferences.load(context);
  }
  static detach(main?: window.Window): void { if (main === AppearancePreferences.main) { ++AppearancePreferences.epoch; AppearancePreferences.main = undefined; } }
  private static async read(context: common.UIAbilityContext): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: 'appearance_options' }); const raw = await store.get('settings_v1', ''); AppearancePreferences.raw = raw;
      const value = raw === '' ? new AppearanceOptions() : typeof raw === 'string' ? JSON.parse(raw) as AppearanceOptions : undefined;
      if (!value || !validAppearance(value)) { throw new Error('appearance_invalid'); }
      AppearancePreferences.value = copyAppearance(value); AppearancePreferences.store = store; AppearancePreferences.issue = '';
    } catch (e) { AppearancePreferences.issue = (e as Error).message === 'appearance_invalid' || e instanceof SyntaxError ? 'appearance_invalid' : 'appearance_load_failed'; throw new Error(AppearancePreferences.issue); }
  }
  static async load(context: common.UIAbilityContext): Promise<void> {
    const main = AppearancePreferences.main; const epoch = AppearancePreferences.epoch;
    if (!main || !context?.filesDir) { throw new Error('appearance_unavailable'); }
    const loading = AppearancePreferences.writes.then(async () => {
      if (main !== AppearancePreferences.main || epoch !== AppearancePreferences.epoch) { throw new Error('appearance_cancelled'); }
      AppearancePreferences.context = context;
      if (!AppearancePreferences.store) { await AppearancePreferences.read(context); }
      try { await AppearancePreferences.native(AppearancePreferences.value, main, epoch, () => true); }
      catch (e) { AppearancePreferences.issue = (e as Error).message === 'appearance_cancelled' ? 'appearance_cancelled' : 'appearance_unavailable'; throw new Error(AppearancePreferences.issue); }
      AppearancePreferences.publish(AppearancePreferences.value); AppearancePreferences.issue = '';
    });
    AppearancePreferences.writes = loading.catch(() => {}); await loading;
  }
  private static publish(value: AppearanceOptions): void {
    AppStorage.setOrCreate('cineIsleAmoled', value.amoled); AppStorage.setOrCreate('cineIsleExtraInfo', value.extraInfo);
  }
  private static async native(value: AppearanceOptions, main: window.Window, epoch: number, allowed: () => boolean): Promise<void> {
    const current = (): boolean => main === AppearancePreferences.main && epoch === AppearancePreferences.epoch && allowed();
    if (!current()) { throw new Error('appearance_cancelled'); }
    main.setWindowBackgroundColor(value.amoled ? '#000000' : '#13232E');
    await main.setWindowSystemBarProperties({ statusBarColor: value.amoled ? '#000000' : '#0D1924', navigationBarColor: value.amoled ? '#000000' : '#13232E', statusBarContentColor: '#F2F3FA', navigationBarContentColor: '#F2F3FA' });
    if (!current()) { throw new Error('appearance_cancelled'); }
  }
  static async save(value: AppearanceOptions, allowed: () => boolean): Promise<AppearanceOptions> {
    if (!validAppearance(value)) { throw new Error('appearance_invalid'); } const next = copyAppearance(value);
    const writing = AppearancePreferences.writes.then(async () => {
      const context = AppearancePreferences.context; const main = AppearancePreferences.main; const epoch = AppearancePreferences.epoch;
      if (!context || !main) { throw new Error('appearance_unavailable'); }
      if (!allowed()) { throw new Error('appearance_cancelled'); }
      if (!AppearancePreferences.store) { AppearancePreferences.store = await preferences.getPreferences(context, { name: 'appearance_options' }); }
      const store = AppearancePreferences.store!; const previous = AppearancePreferences.raw; const old = AppearancePreferences.snapshot();
      if (!allowed()) { throw new Error('appearance_cancelled'); }
      try {
        await store.put('settings_v1', JSON.stringify(next)); await store.flush();
        await AppearancePreferences.native(next, main, epoch, allowed);
      } catch (e) {
        try { await store.put('settings_v1', previous); await store.flush(); if (main === AppearancePreferences.main && epoch === AppearancePreferences.epoch) { await AppearancePreferences.native(old, main, epoch, () => true); } AppearancePreferences.store = undefined; }
        catch (restore) { AppearancePreferences.store = undefined; AppearancePreferences.issue = 'appearance_restore_failed'; throw new Error(AppearancePreferences.issue); }
        AppearancePreferences.issue = (e as Error).message === 'appearance_cancelled' ? 'appearance_cancelled' : 'appearance_save_failed'; throw new Error(AppearancePreferences.issue);
      }
      AppearancePreferences.value = next; AppearancePreferences.raw = JSON.stringify(next); AppearancePreferences.publish(next); AppearancePreferences.issue = '';
    });
    AppearancePreferences.writes = writing.catch(() => {}); await writing; return AppearancePreferences.snapshot();
  }
}
