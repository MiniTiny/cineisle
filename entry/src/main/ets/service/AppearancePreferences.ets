import { WallpaperColors, PaletteTicket } from './WallpaperColors';
import { DynamicPalette } from '../utils/DynamicPalette';
import { uiPalette } from '../utils/UiPalette';
import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import window from '@ohos.window';
import { AppearanceOptions, copyAppearance, validAppearance } from '../utils/Appearance';

// Global visual settings; window effects and durable preferences commit before reactive publication.
export class AppearancePreferences {
  private static readonly storeName: string = 'appearance_options';
  private static readonly valueKey: string = 'settings_v1';
  private static context: common.UIAbilityContext | undefined;
  private static main: window.Window | undefined;
  private static epoch: number = 0;
  private static store: preferences.Preferences | undefined;
  private static writes: Promise<void> = Promise.resolve();
  private static raw: preferences.ValueType = '';
  private static value: AppearanceOptions = new AppearanceOptions();
  private static colors: DynamicPalette | undefined;
  private static source: WallpaperColors = new WallpaperColors();
  private static ticket: PaletteTicket | undefined;
  private static visible: boolean = true;
  private static refreshing: boolean = false;
  private static refreshAgain: boolean = false;
  private static updateQueued: boolean = false;
  private static pendingColors: DynamicPalette | undefined;
  private static pendingMain: window.Window | undefined;
  private static pendingEpoch: number = 0;
  static issue: string = '';
  static snapshot(): AppearanceOptions { return copyAppearance(AppearancePreferences.value); }
  static async attach(context: common.UIAbilityContext, main: window.Window): Promise<void> {
    if (!context?.filesDir) { throw new Error('appearance_unavailable'); }
    AppearancePreferences.context = context; AppearancePreferences.main = main; ++AppearancePreferences.epoch;
    await AppearancePreferences.load(context);
  }
  static detach(main?: window.Window): void { if (main === AppearancePreferences.main) { ++AppearancePreferences.epoch; AppearancePreferences.main = undefined; AppearancePreferences.ticket?.cancel(); AppearancePreferences.source.stop(); } }
  static background(): void { AppearancePreferences.visible = false; ++AppearancePreferences.epoch; AppearancePreferences.ticket?.cancel(); AppearancePreferences.source.stop(); }
  static foreground(): void {
    AppearancePreferences.visible = true;
    if (!AppearancePreferences.main || !AppearancePreferences.context) { return; }
    if (AppearancePreferences.refreshing) { AppearancePreferences.refreshAgain = true; return; }
    AppearancePreferences.refreshing = true;
    AppearancePreferences.load(AppearancePreferences.context).catch(() => {}).finally(() => { AppearancePreferences.refreshing = false; if (AppearancePreferences.refreshAgain) { AppearancePreferences.refreshAgain = false; if (AppearancePreferences.visible) { AppearancePreferences.foreground(); } } });
  }
  private static watch(value: AppearanceOptions): void {
    if (!(value.dynamicColors ?? true) || !AppearancePreferences.visible) { AppearancePreferences.source.stop(); return; }
    AppearancePreferences.source.start((colors?: DynamicPalette) => {
      AppearancePreferences.pendingColors = colors; AppearancePreferences.pendingMain = AppearancePreferences.main; AppearancePreferences.pendingEpoch = AppearancePreferences.epoch;
      if (AppearancePreferences.updateQueued) { return; } AppearancePreferences.updateQueued = true;
      const update = AppearancePreferences.writes.then(async () => {
        AppearancePreferences.updateQueued = false;
        const main = AppearancePreferences.pendingMain; const epoch = AppearancePreferences.pendingEpoch; const colors = AppearancePreferences.pendingColors;
        if (!main || main !== AppearancePreferences.main || epoch !== AppearancePreferences.epoch || !AppearancePreferences.visible || !(AppearancePreferences.value.dynamicColors ?? true)) { return; }
        try { await AppearancePreferences.native(AppearancePreferences.value, main, epoch, () => true, colors); AppearancePreferences.colors = colors; AppearancePreferences.publish(AppearancePreferences.value, colors); AppearancePreferences.issue = ''; }
        catch (e) { await AppearancePreferences.restoreColors(main, epoch); }
      });
      AppearancePreferences.writes = update.catch(() => {});
    });
  }
  private static async resolve(value: AppearanceOptions, main: window.Window, epoch: number, allowed: () => boolean): Promise<DynamicPalette | undefined> {
    AppearancePreferences.watch(value);
    if (!(value.dynamicColors ?? true) || !AppearancePreferences.visible) { return undefined; }
    AppearancePreferences.ticket?.cancel();
    const ticket = AppearancePreferences.source.read(() => main === AppearancePreferences.main && epoch === AppearancePreferences.epoch && AppearancePreferences.visible && allowed()); AppearancePreferences.ticket = ticket;
    try { return await ticket.result; } finally { if (AppearancePreferences.ticket === ticket) { AppearancePreferences.ticket = undefined; } }
  }
  private static async restoreColors(main: window.Window, epoch: number): Promise<void> {
    if (main !== AppearancePreferences.main || epoch !== AppearancePreferences.epoch) { return; }
    let issue = 'appearance_unavailable';
    try { await AppearancePreferences.native(AppearancePreferences.value, main, epoch, () => true, AppearancePreferences.colors); }
    catch (e) { issue = 'appearance_restore_failed'; }
    if (main !== AppearancePreferences.main || epoch !== AppearancePreferences.epoch) { return; }
    AppearancePreferences.issue = issue;
    AppStorage.setOrCreate('cineIslePaletteStatus', 'dynamic_colors_update_failed');
  }

  private static async read(context: common.UIAbilityContext): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: AppearancePreferences.storeName }); const raw = await store.get(AppearancePreferences.valueKey, ''); AppearancePreferences.raw = raw;
      const value = raw === '' ? new AppearanceOptions() : typeof raw === 'string' ? JSON.parse(raw) as AppearanceOptions : undefined;
      if (!value || !validAppearance(value)) { throw new Error('appearance_invalid'); }
      AppearancePreferences.value = copyAppearance(value); AppearancePreferences.store = store; AppearancePreferences.issue = '';
    } catch (e) { AppearancePreferences.issue = (e as Error).message === 'appearance_invalid' || e instanceof SyntaxError ? 'appearance_invalid' : 'appearance_load_failed'; throw new Error(AppearancePreferences.issue); }
  }
  static async load(context: common.UIAbilityContext): Promise<void> {
    const main = AppearancePreferences.main; const epoch = AppearancePreferences.epoch;
    if (!main || !context?.filesDir) { throw new Error('appearance_unavailable'); }
    const loading = AppearancePreferences.writes.then(async () => {
      if (main !== AppearancePreferences.main || epoch !== AppearancePreferences.epoch || !AppearancePreferences.visible) { throw new Error('appearance_cancelled'); }
      AppearancePreferences.context = context;
      if (!AppearancePreferences.store) { await AppearancePreferences.read(context); }
      const colors = await AppearancePreferences.resolve(AppearancePreferences.value, main, epoch, () => true);
      try { await AppearancePreferences.native(AppearancePreferences.value, main, epoch, () => true, colors); }
      catch (e) { if ((e as Error).message === 'appearance_cancelled') { throw new Error('appearance_cancelled'); } await AppearancePreferences.restoreColors(main, epoch); throw new Error(AppearancePreferences.issue); }
      AppearancePreferences.colors = colors; AppearancePreferences.publish(AppearancePreferences.value, colors); AppearancePreferences.issue = '';
    });
    AppearancePreferences.writes = loading.catch(() => {}); await loading;
  }
  private static publish(value: AppearanceOptions, colors?: DynamicPalette): void {
    AppStorage.setOrCreate('cineIslePalette', uiPalette(colors)); AppStorage.setOrCreate('cineIslePaletteStatus', !(value.dynamicColors ?? true) ? 'dynamic_colors_off' : colors ? 'dynamic_colors_active' : 'dynamic_colors_fallback');
    AppStorage.setOrCreate('cineIsleAmoled', value.amoled); AppStorage.setOrCreate('cineIsleExtraInfo', value.extraInfo);
  }
  private static async native(value: AppearanceOptions, main: window.Window, epoch: number, allowed: () => boolean, colors?: DynamicPalette): Promise<void> {
    const current = (): boolean => main === AppearancePreferences.main && epoch === AppearancePreferences.epoch && allowed();
    if (!current()) { throw new Error('appearance_cancelled'); }
    main.setWindowBackgroundColor(value.amoled ? '#000000' : colors?.raised ?? '#13232E');
    await main.setWindowSystemBarProperties({ statusBarColor: value.amoled ? '#000000' : colors?.background ?? '#0D1924', navigationBarColor: value.amoled ? '#000000' : colors?.raised ?? '#13232E', statusBarContentColor: '#F2F3FA', navigationBarContentColor: '#F2F3FA' });
    if (!current()) { throw new Error('appearance_cancelled'); }
  }
  static async save(value: AppearanceOptions, allowed: () => boolean): Promise<AppearanceOptions> {
    if (!validAppearance(value)) { throw new Error('appearance_invalid'); } const next = copyAppearance(value);
    const writing = AppearancePreferences.writes.then(async () => {
      const context = AppearancePreferences.context; const main = AppearancePreferences.main; const epoch = AppearancePreferences.epoch;
      if (!context || !main) { throw new Error('appearance_unavailable'); }
      if (!allowed()) { throw new Error('appearance_cancelled'); }
      if (!AppearancePreferences.store) { AppearancePreferences.store = await preferences.getPreferences(context, { name: AppearancePreferences.storeName }); }
      const store = AppearancePreferences.store!; const previous = AppearancePreferences.raw; const old = AppearancePreferences.snapshot(); const oldColors = AppearancePreferences.colors; let colors: DynamicPalette | undefined;
      if (!allowed()) { throw new Error('appearance_cancelled'); }
      try {
        await store.put(AppearancePreferences.valueKey, JSON.stringify(next)); await store.flush();
        colors = await AppearancePreferences.resolve(next, main, epoch, allowed);
        await AppearancePreferences.native(next, main, epoch, allowed, colors);
      } catch (e) {
        try { await store.put(AppearancePreferences.valueKey, previous); await store.flush(); if (main === AppearancePreferences.main && epoch === AppearancePreferences.epoch) { await AppearancePreferences.native(old, main, epoch, () => true, oldColors); } AppearancePreferences.store = undefined; }
        catch (restore) { AppearancePreferences.store = undefined; AppearancePreferences.issue = 'appearance_restore_failed'; throw new Error(AppearancePreferences.issue); }
        AppearancePreferences.watch(old); AppearancePreferences.issue = (e as Error).message === 'appearance_cancelled' ? 'appearance_cancelled' : 'appearance_save_failed'; throw new Error(AppearancePreferences.issue);
      }
      AppearancePreferences.value = next; AppearancePreferences.raw = JSON.stringify(next); AppearancePreferences.colors = colors; AppearancePreferences.publish(next, colors); AppearancePreferences.issue = '';
    });
    AppearancePreferences.writes = writing.catch(() => {}); await writing; return AppearancePreferences.snapshot();
  }
}
