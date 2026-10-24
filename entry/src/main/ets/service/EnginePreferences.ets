import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import { EngineChoice, validEngineChoice } from '../utils/EngineChoice';

// Application-wide like Android's playerMpv preference. Publish only after durable flush.
export class EnginePreferences {
  private static readonly storeName: string = 'playback_engine';
  private static readonly valueKey: string = 'choice_v1';
  private static context: common.UIAbilityContext | undefined;
  private static store: preferences.Preferences | undefined;
  private static loading: Promise<void> | undefined;
  private static writes: Promise<void> = Promise.resolve();
  private static raw: preferences.ValueType = '';
  private static value: EngineChoice = 'native';
  private static ready: boolean = false;
  static issue: string = '';
  static snapshot(): EngineChoice { return EnginePreferences.value; }
  static known(): boolean { return EnginePreferences.ready; }
  static requireChoice(): EngineChoice {
    if (!EnginePreferences.ready) { throw new Error(EnginePreferences.issue || 'engine_load_failed'); }
    return EnginePreferences.value;
  }
  static async load(context: common.UIAbilityContext): Promise<void> {
    if (!context?.filesDir) { throw new Error('engine_load_failed'); }
    EnginePreferences.context = context;
    if (EnginePreferences.loading) { return EnginePreferences.loading; }
    if (EnginePreferences.store) {
      if (!EnginePreferences.ready) { throw new Error(EnginePreferences.issue || 'engine_invalid'); }
      return;
    }
    EnginePreferences.loading = EnginePreferences.read(context);
    try { await EnginePreferences.loading; } finally { EnginePreferences.loading = undefined; }
  }
  private static async read(context: common.UIAbilityContext): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: EnginePreferences.storeName });
      const raw = await store.get(EnginePreferences.valueKey, '');
      EnginePreferences.raw = raw; EnginePreferences.store = store;
      if (typeof raw !== 'string' || (raw !== '' && !validEngineChoice(raw))) { throw new Error('engine_invalid'); }
      EnginePreferences.value = (raw || 'native') as EngineChoice;
      EnginePreferences.ready = true; EnginePreferences.issue = '';
    } catch (e) {
      EnginePreferences.ready = false;
      EnginePreferences.issue = (e as Error).message === 'engine_invalid' ? 'engine_invalid' : 'engine_load_failed';
      throw new Error(EnginePreferences.issue);
    }
  }
  static async save(choice: EngineChoice, allowed: () => boolean): Promise<EngineChoice> {
    if (!validEngineChoice(choice)) { throw new Error('engine_invalid'); }
    const writing = EnginePreferences.writes.then(async () => {
      const context = EnginePreferences.context; if (!context) { throw new Error('engine_load_failed'); }
      if (!allowed()) { throw new Error('engine_cancelled'); }
      if (!EnginePreferences.store) {
        try { await EnginePreferences.load(context); }
        catch (e) { if (!EnginePreferences.store) { throw e as Error; } }
      }
      // Explicit selection may repair a corrupt value; rollback retains the exact previous raw data.
      const store = EnginePreferences.store!; const previous = EnginePreferences.raw;
      if (!allowed()) { throw new Error('engine_cancelled'); }
      try {
        await store.put(EnginePreferences.valueKey, choice); await store.flush();
        if (!allowed()) { throw new Error('engine_cancelled'); }
      } catch (e) {
        try { await store.put(EnginePreferences.valueKey, previous); await store.flush(); }
        catch (_) { EnginePreferences.ready = false; EnginePreferences.issue = 'engine_restore_failed'; throw new Error(EnginePreferences.issue); }
        EnginePreferences.issue = (e as Error).message === 'engine_cancelled' ? 'engine_cancelled' : 'engine_save_failed';
        throw new Error(EnginePreferences.issue);
      }
      EnginePreferences.raw = choice; EnginePreferences.value = choice;
      EnginePreferences.ready = true; EnginePreferences.issue = '';
    });
    EnginePreferences.writes = writing.catch(() => {}); await writing; return choice;
  }
}
