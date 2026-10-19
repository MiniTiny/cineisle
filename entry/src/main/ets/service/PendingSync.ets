import common from '@ohos.app.ability.common';
import workScheduler from '@ohos.resourceschedule.workScheduler';
import connection from '@ohos.net.connection';
import { BusinessError } from '@ohos.base';
import { AppLock } from './AppLock';
import { NetworkPreferences } from './NetworkPreferences';
import { SessionStore } from './SessionStore';
import { LocalStore } from './LocalStore';
import { ExperienceStore } from './ExperienceStore';
import { JellyfinClient } from './JellyfinClient';
import { ExperienceState, PendingEdit, PendingPosition, connectionFailure } from '../utils/Experience';
import { sessionKey } from '../utils/Accounts';

export interface SyncOwner { client: JellyfinClient; local: LocalStore; store: ExperienceStore }
interface ItemSyncIntent { id: string; position?: PendingPosition; played?: PendingEdit; favorite?: PendingEdit }
// The OS stores only a fixed job identity. Credentials remain in Asset, intents in account-private files.
export class PendingSync {
  static get busy(): boolean { return !!PendingSync.running; }
  static readonly WORK_ID: number = 1701;
  static readonly ABILITY: string = 'PendingSyncAbility';
  static issue: string = '';
  private static context: common.Context | undefined = undefined;
  private static owner: (() => SyncOwner | undefined) | undefined = undefined;
  private static running: Promise<void> | undefined = undefined;
  private static generation: number = 0;
  private static interactive: boolean = false;
  private static timer: number = -1;
  private static net: connection.NetConnection | undefined = undefined;
  private static jobs: Promise<void> = Promise.resolve();
  private static state(issue: string): void { PendingSync.issue = issue; AppStorage.setOrCreate('cineIsleSyncIssue', issue); }
  static configure(context: common.Context, owner?: () => SyncOwner | undefined): void {
    PendingSync.context = context;
    if (owner) { PendingSync.owner = owner; PendingSync.interactive = true; }
    if (owner && !PendingSync.net && canIUse('SystemCapability.Communication.NetManager.Core')) {
      try {
        const net = connection.createNetConnection(); PendingSync.net = net;
        net.on('netAvailable', () => PendingSync.wake());
        net.register((error: BusinessError) => { if (error) { net.unregister(() => {}); PendingSync.net = undefined; } });
      } catch (e) { PendingSync.net = undefined; }
    }
  }
  static foreground(): void { PendingSync.interactive = true; PendingSync.wake(); }
  static background(): void { PendingSync.interactive = false; PendingSync.clearTimer(); PendingSync.wake(); }
  static stop(): void { ++PendingSync.generation; PendingSync.clearTimer(); }
  private static clearTimer(): void { if (PendingSync.timer >= 0) { clearTimeout(PendingSync.timer); PendingSync.timer = -1; } }
  static wake(): void {
    if (!PendingSync.context) { return; }
    PendingSync.reconcile();
    if (!PendingSync.interactive || !AppLock.permit()) { return; }
    PendingSync.clearTimer();
    PendingSync.timer = setTimeout(() => { PendingSync.timer = -1; PendingSync.run().catch(() => {}); }, 500);
  }
  private static work(): workScheduler.WorkInfo {
    return { workId: PendingSync.WORK_ID, bundleName: PendingSync.context!.applicationInfo.name, abilityName: PendingSync.ABILITY,
      isPersisted: true, networkType: workScheduler.NetworkType.NETWORK_TYPE_ANY, isRepeat: true, repeatCycleTime: 20 * 60 * 1000 };
  }
  private static reconcile(): void {
    PendingSync.jobs = PendingSync.jobs.then(async () => {
      if (!PendingSync.context || !canIUse('SystemCapability.ResourceSchedule.WorkScheduler')) { PendingSync.state('sync_schedule_unavailable'); return; }
      try {
        let pending = false;
        for (const account of await SessionStore.list()) {
          const session = await SessionStore.get(account.key);
          const state = new LocalStore(PendingSync.context, session).experience();
          if (!state.offline && !state.syncBlocked && (state.syncAttempts ?? 0) < 5 && (state.pending.length || state.positions.length)) { pending = true; break; }
        }
        let existing: workScheduler.WorkInfo | undefined;
        try { existing = await workScheduler.getWorkStatus(PendingSync.WORK_ID); } catch (e) { /* Not registered. */ }
        if (pending && !existing) { workScheduler.startWork(PendingSync.work()); }
        else if (!pending && existing) { workScheduler.stopWork(existing, true); }
      } catch (e) { PendingSync.state('sync_schedule_unavailable'); }
    });
  }
  static run(): Promise<void> {
    if (PendingSync.running) { return PendingSync.running; }
    const work = PendingSync.drainAccounts().catch(() => { PendingSync.state('sync_retry_waiting'); });
    PendingSync.running = work;
    return work.finally(() => { if (PendingSync.running === work) { PendingSync.running = undefined; } PendingSync.reconcile(); });
  }
  private static async drainAccounts(): Promise<void> {
    const context = PendingSync.context; if (!context || !AppLock.permit()) { return; }
    try { await NetworkPreferences.load(context); } catch (e) { /* Retain bounded defaults/last committed policy. */ }
    const generation = PendingSync.generation; const deadline = Date.now() + 80000;
    let retryAt = Number.MAX_SAFE_INTEGER;
    for (const account of await SessionStore.list()) {
      if (generation !== PendingSync.generation || !AppLock.permit() || Date.now() >= deadline) { break; }
      const session = await SessionStore.get(account.key);
      const active = PendingSync.owner?.();
      const local = active && sessionKey(active.client.session) === account.key ? active.local : new LocalStore(context, session);
      const store = active && local === active.local ? active.store : new ExperienceStore(local);
      const state = store.snapshot();
      const stamp = PendingSync.stamp(state);
      if (state.offline || (!state.pending.length && !state.positions.length)) { continue; }
      if (state.syncBlocked || (state.syncAttempts ?? 0) >= 5) { PendingSync.state(state.syncBlocked ? 'sync_auth_required' : 'sync_retry_exhausted'); continue; }
      if ((state.syncNextAt ?? 0) > Date.now()) { retryAt = Math.min(retryAt, state.syncNextAt!); continue; }
      const client = active && local === active.local ? active.client : new JellyfinClient(session);
      const allowed = async (): Promise<boolean> => {
        if (generation !== PendingSync.generation || !AppLock.permit() || Date.now() >= deadline || store.snapshot().offline) { return false; }
        try { const saved = await SessionStore.get(account.key); return saved.token === session.token && saved.deviceId === session.deviceId; }
        catch (e) { return false; }
      };
      try {
        await local.transfer(async () => {
          if (!await allowed()) { return; }
          await client.validateAccount();
          await PendingSync.flush(client, store, allowed);
        });
        if (!await allowed()) { continue; }
        store.update((next: ExperienceState) => { next.syncAttempts = 0; next.syncNextAt = 0; next.syncBlocked = false; });
        PendingSync.state('');
        if (store.snapshot().pending.length || store.snapshot().positions.length) { retryAt = Math.min(retryAt, Date.now() + 1000); }
      } catch (e) {
        if (!await allowed()) { continue; }
        if (PendingSync.stamp(store.snapshot()) !== stamp) { retryAt = Math.min(retryAt, Date.now() + 1000); continue; }
        const transient = connectionFailure(e as Error) || (e as Error).message === 'sync_cache_write_failed';
        const result = store.update((next: ExperienceState) => {
          next.syncAttempts = Math.min(5, (next.syncAttempts ?? 0) + 1);
          next.syncBlocked = !transient;
          next.syncNextAt = Date.now() + Math.min(20 * 60 * 1000, 30000 * Math.pow(2, next.syncAttempts - 1));
        });
        PendingSync.state(!transient ? 'sync_auth_required' : result.syncAttempts === 5 ? 'sync_retry_exhausted' : 'sync_retry_waiting');
        if (transient && result.syncAttempts! < 5) { retryAt = Math.min(retryAt, result.syncNextAt!); }
      }
    }
    PendingSync.clearTimer();
    if (PendingSync.interactive && retryAt < Number.MAX_SAFE_INTEGER && AppLock.permit()) {
      PendingSync.timer = setTimeout(() => { PendingSync.timer = -1; PendingSync.run().catch(() => {}); }, Math.max(1000, retryAt - Date.now()));
    }
  }
  private static stamp(state: ExperienceState): string {
    return state.pending.map((p: PendingEdit) => `${p.id}/${p.field}/${p.revision}`).join('|') + ':' +
      state.positions.map((p: PendingPosition) => `${p.id}/${p.revision}`).join('|');
  }
  static async flush(client: JellyfinClient, store: ExperienceStore, allowed: () => Promise<boolean>): Promise<void> {
    const initial = store.snapshot();
    const ids = Array.from(new Set<string>([...initial.positions.map((p: PendingPosition) => p.id), ...initial.pending.map((p: PendingEdit) => p.id)]));
    for (const id of ids) {
      const intent = PendingSync.itemIntent(store.snapshot(), id);
      if (!intent.position && !intent.played && !intent.favorite) { continue; }
      let stale = false;
      // Frozen Android sync applies played, favorite, then position. Marking unplayed resets the server position.
      for (const edit of [intent.played, intent.favorite]) {
        if (!edit) { continue; }
        if (!await allowed()) { return; }
        if (!PendingSync.sameIntent(store.snapshot(), intent)) { stale = true; break; }
        if (edit.field === 'played') { await client.played(id, edit.value); } else { await client.favorite(id, edit.value); }
        if (!await allowed()) { return; }
        if (!PendingSync.sameIntent(store.snapshot(), intent)) { stale = true; break; }
      }
      if (stale) { continue; }
      if (intent.position) {
        if (!await allowed()) { return; }
        if (!PendingSync.sameIntent(store.snapshot(), intent)) { continue; }
        await client.offlinePosition(id, intent.position.ticks);
        if (!await allowed()) { return; }
      }
      // Keep the whole item pending on partial failure or a concurrent edit, as Android's snapshot acknowledgement does.
      store.acknowledge(id, (next: ExperienceState): boolean => PendingSync.sameIntent(next, intent));
    }
  }
  private static itemIntent(state: ExperienceState, id: string): ItemSyncIntent {
    return { id: id, position: state.positions.find((p: PendingPosition) => p.id === id),
      played: state.pending.find((p: PendingEdit) => p.id === id && p.field === 'played'),
      favorite: state.pending.find((p: PendingEdit) => p.id === id && p.field === 'favorite') };
  }
  private static sameIntent(state: ExperienceState, intent: ItemSyncIntent): boolean {
    const latest = PendingSync.itemIntent(state, intent.id);
    return latest.position?.revision === intent.position?.revision && latest.position?.ticks === intent.position?.ticks &&
      latest.played?.revision === intent.played?.revision && latest.played?.value === intent.played?.value &&
      latest.favorite?.revision === intent.favorite?.revision && latest.favorite?.value === intent.favorite?.value;
  }
}
