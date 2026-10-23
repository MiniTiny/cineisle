import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import { canonicalPreferences, copyPreferences, PlaybackPreferences, validPreferences } from '../utils/PlaybackPreferences';

// App-level settings, independent of account caches. Publish only after durable flush succeeds.
export class PlaybackPreferenceStore {
  private static readonly storeName: string = 'playback_languages';
  private static readonly valueKey: string = 'settings_v1';
  private context: common.UIAbilityContext | undefined = undefined;
  private store: preferences.Preferences | undefined = undefined;
  private loading: Promise<void> | undefined = undefined;
  private writes: Promise<void> = Promise.resolve();
  private value: PlaybackPreferences = new PlaybackPreferences();
  private persisted: string = '';
  issue: string = '';

  snapshot(): PlaybackPreferences { return copyPreferences(this.value); }

  async load(context: common.UIAbilityContext): Promise<void> {
    this.context = context;
    if (this.store) { return; }
    if (this.loading) { return this.loading; }
    this.loading = this.read(context);
    try { await this.loading; } finally { this.loading = undefined; }
  }

  private async read(context: common.UIAbilityContext): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: PlaybackPreferenceStore.storeName });
      const raw = await store.get(PlaybackPreferenceStore.valueKey, '');
      this.persisted = typeof raw === 'string' ? raw : '';
      this.issue = '';
      if (raw !== '') {
        try {
          const parsed = JSON.parse(this.persisted) as PlaybackPreferences;
          if (!validPreferences(parsed)) { throw new Error('invalid'); }
          this.value = canonicalPreferences(parsed);
        } catch (e) { this.issue = 'playback_preferences_invalid'; }
      }
      this.store = store;
    } catch (e) { this.issue = 'playback_preferences_load_failed'; throw new Error(this.issue); }
  }

  async save(value: PlaybackPreferences): Promise<PlaybackPreferences> {
    const next = canonicalPreferences(value);
    const writing = this.writes.then(async () => {
      if (!this.store) {
        if (!this.context) { throw new Error('playback_preferences_load_failed'); }
        await this.load(this.context);
      }
      const store = this.store!; const previous = this.persisted;
      try {
        const encoded = JSON.stringify(next);
        await store.put(PlaybackPreferenceStore.valueKey, encoded); await store.flush();
        this.persisted = encoded; this.value = copyPreferences(next); this.issue = '';
      } catch (e) {
        // A failed flush can leave the platform instance dirty; restore its previous value before retrying.
        try { await store.put(PlaybackPreferenceStore.valueKey, previous); await store.flush(); } catch (restoreError) {
          this.issue = 'playback_preferences_restore_failed'; throw new Error(this.issue);
        }
        this.issue = 'playback_preferences_save_failed'; throw new Error(this.issue);
      }
    });
    this.writes = writing.catch(() => {});
    await writing;
    return copyPreferences(next);
  }
}
