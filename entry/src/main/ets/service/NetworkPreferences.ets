import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import connection from '@ohos.net.connection';
import { NetworkOptions, NetworkPolicy, copyNetworkOptions, validNetworkOptions } from '../utils/NetworkOptions';

// A single application preference record; account data and credentials never enter this store.
export class NetworkPreferences {
  private static context: common.Context | undefined;
  private static store: preferences.Preferences | undefined;
  private static loading: Promise<void> | undefined;
  private static writes: Promise<void> = Promise.resolve();
  private static persisted: string = '';
  static issue: string = '';
  static async load(context: common.Context): Promise<void> {
    NetworkPolicy.networkAvailable = (): boolean => connection.hasDefaultNetSync();
    NetworkPreferences.context = context;
    if (NetworkPreferences.store) { return; }
    if (NetworkPreferences.loading) { return NetworkPreferences.loading; }
    NetworkPreferences.loading = NetworkPreferences.read(context);
    try { await NetworkPreferences.loading; } finally { NetworkPreferences.loading = undefined; }
  }
  private static async read(context: common.Context): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: 'network_options' });
      const raw = await store.get('settings_v1', ''); NetworkPreferences.persisted = typeof raw === 'string' ? raw : '';
      const next = raw === '' ? new NetworkOptions() : JSON.parse(NetworkPreferences.persisted) as NetworkOptions;
      if (!validNetworkOptions(next)) { throw new Error('network_options_invalid'); }
      NetworkPolicy.publish(next); NetworkPreferences.store = store; NetworkPreferences.issue = '';
    } catch (e) {
      NetworkPreferences.issue = (e as Error).message === 'network_options_invalid' || e instanceof SyntaxError ? 'network_options_invalid' : 'network_options_load_failed';
      throw new Error(NetworkPreferences.issue);
    }
  }
  static async save(value: NetworkOptions, allowed: () => boolean): Promise<NetworkOptions> {
    if (!validNetworkOptions(value)) { throw new Error('network_options_invalid'); }
    const next = copyNetworkOptions(value);
    const writing = NetworkPreferences.writes.then(async () => {
      if (!allowed()) { throw new Error('network_options_cancelled'); }
      if (!NetworkPreferences.store) {
        if (!NetworkPreferences.context) { throw new Error('network_options_load_failed'); }
        // Permit explicit repair of a corrupt record, while still requiring a usable platform store.
        NetworkPreferences.store = await preferences.getPreferences(NetworkPreferences.context, { name: 'network_options' });
      }
      if (!allowed()) { throw new Error('network_options_cancelled'); }
      const store = NetworkPreferences.store!; const previous = NetworkPreferences.persisted;
      try {
        const encoded = JSON.stringify(next); await store.put('settings_v1', encoded); await store.flush();
        NetworkPreferences.persisted = encoded; NetworkPolicy.publish(next); NetworkPreferences.issue = '';
      } catch (e) {
        try { await store.put('settings_v1', previous); await store.flush(); }
        catch (restoreError) { NetworkPreferences.store = undefined; NetworkPreferences.issue = 'network_options_restore_failed'; throw new Error(NetworkPreferences.issue); }
        NetworkPreferences.issue = 'network_options_save_failed'; throw new Error(NetworkPreferences.issue);
      }
    });
    NetworkPreferences.writes = writing.catch(() => {}); await writing; return copyNetworkOptions(next);
  }
}
