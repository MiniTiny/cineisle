import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import i18n from '@ohos.i18n';
import { UiLanguage, validUiLanguage, effectiveUiLanguage } from '../utils/UiLanguage';

// Application-wide, independent of the active server/account. Call attach only after loadContent.
export class LanguagePreferences {
  private static readonly storeName: string = 'ui_language';
  private static readonly valueKey: string = 'choice_v1';
  private static context: common.UIAbilityContext | undefined;
  private static store: preferences.Preferences | undefined;
  private static loading: Promise<void> | undefined;
  private static writes: Promise<void> = Promise.resolve();
  private static value: UiLanguage = 'system';
  private static persisted: preferences.ValueType = '';
  private static applied: string = '';
  static issue: string = '';
  static snapshot(): UiLanguage { return LanguagePreferences.value; }
  static async attach(context: common.UIAbilityContext): Promise<void> {
    if (!context?.filesDir) { throw new Error('ui_language_load_failed'); }
    LanguagePreferences.context = context;
    if (LanguagePreferences.loading) { await LanguagePreferences.loading; }
    else if (!LanguagePreferences.store) {
      LanguagePreferences.loading = LanguagePreferences.read(context);
      try { await LanguagePreferences.loading; } finally { LanguagePreferences.loading = undefined; }
    }
    try { LanguagePreferences.apply(LanguagePreferences.value); if (LanguagePreferences.issue === 'ui_language_apply_failed') { LanguagePreferences.issue = ''; } }
    catch (e) { LanguagePreferences.issue = 'ui_language_apply_failed'; throw new Error(LanguagePreferences.issue); }
  }
  private static async read(context: common.UIAbilityContext): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: LanguagePreferences.storeName });
      const raw = await store.get(LanguagePreferences.valueKey, '');
      LanguagePreferences.persisted = raw;
      if (typeof raw !== 'string' || (raw !== '' && !validUiLanguage(raw))) { throw new Error('ui_language_invalid'); }
      LanguagePreferences.value = (raw || 'system') as UiLanguage; LanguagePreferences.store = store; LanguagePreferences.issue = '';
    } catch (e) { LanguagePreferences.issue = (e as Error).message === 'ui_language_invalid' ? 'ui_language_invalid' : 'ui_language_load_failed'; throw new Error(LanguagePreferences.issue); }
  }
  private static apply(choice: UiLanguage): void {
    const context = LanguagePreferences.context; if (!context) { throw new Error('ui_language_load_failed'); }
    const target = effectiveUiLanguage(choice, i18n.System.getSystemLanguage());
    if (target !== LanguagePreferences.applied) { context.getApplicationContext().setLanguage(target); LanguagePreferences.applied = target; }
  }
  static systemChanged(): void {
    if (LanguagePreferences.value !== 'system' || !LanguagePreferences.store) { return; }
    try { LanguagePreferences.apply('system'); if (LanguagePreferences.issue === 'ui_language_apply_failed') { LanguagePreferences.issue = ''; } } catch (e) { LanguagePreferences.issue = 'ui_language_apply_failed'; }
  }
  static async save(value: UiLanguage, allowed: () => boolean): Promise<UiLanguage> {
    if (!validUiLanguage(value)) { throw new Error('ui_language_invalid'); }
    const writing = LanguagePreferences.writes.then(async () => {
      const context = LanguagePreferences.context; if (!context) { throw new Error('ui_language_load_failed'); }
      if (!allowed()) { throw new Error('ui_language_cancelled'); }
      if (!LanguagePreferences.store) { LanguagePreferences.store = await preferences.getPreferences(context, { name: LanguagePreferences.storeName }); }
      const store = LanguagePreferences.store!; const previous = LanguagePreferences.persisted; const old = LanguagePreferences.value;
      if (!allowed()) { throw new Error('ui_language_cancelled'); }
      try {
        await store.put(LanguagePreferences.valueKey, value); await store.flush();
        if (!allowed()) { throw new Error('ui_language_cancelled'); }
        // Native preferred language controls cold-start resources; setLanguage refreshes the current UI.
        i18n.System.setAppPreferredLanguage(value === 'system' ? 'default' : value);
        LanguagePreferences.apply(value);
      } catch (e) {
        try { await store.put(LanguagePreferences.valueKey, previous); await store.flush(); i18n.System.setAppPreferredLanguage(old === 'system' ? 'default' : old); LanguagePreferences.applied = ''; LanguagePreferences.apply(old); if (typeof previous !== 'string' || (previous !== '' && !validUiLanguage(previous))) { LanguagePreferences.store = undefined; } }
        catch (restore) { LanguagePreferences.issue = 'ui_language_restore_failed'; throw new Error(LanguagePreferences.issue); }
        LanguagePreferences.issue = (e as Error).message === 'ui_language_cancelled' ? 'ui_language_cancelled' : 'ui_language_save_failed'; throw new Error(LanguagePreferences.issue);
      }
      LanguagePreferences.persisted = value; LanguagePreferences.value = value; LanguagePreferences.issue = '';
    });
    LanguagePreferences.writes = writing.catch(() => {}); await writing; return LanguagePreferences.snapshot();
  }
}
