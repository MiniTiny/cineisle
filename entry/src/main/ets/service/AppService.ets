import util from '@ohos.util';
import { downloadKey, downloadStem, sameDownload } from '../utils/DownloadIdentity';
import background from '@ohos.resourceschedule.backgroundTaskManager';
import { BackgroundLease } from './BackgroundLease';
import common from '@ohos.app.ability.common';
import request from '@ohos.request';
import fs from '@ohos.file.fs';
import fileUri from '@ohos.file.fileuri';
import { Session, DownloadRecord, ItemsResult, LibraryMembership, LibrarySnapshot, MediaItem, MediaSource, PlaybackRoute, QueryParam } from '../model/Models';
import { rankActors, uniqueItems } from '../utils/Protocol';
import { JellyfinClient } from './JellyfinClient';
import { AppLock } from './AppLock';
import { PosterCache } from './PosterCache';
import { NetworkPreferences } from './NetworkPreferences';
import { NetworkPolicy } from '../utils/NetworkOptions';
import { PersistentDownload } from './PersistentDownload';
import { OfflineSubtitles } from './OfflineSubtitles';
import { DownloadSpace } from './DownloadSpace';
import { DownloadNetworkGuard } from './DownloadNetworkGuard';
import { DownloadNetwork, downloadNetwork } from '../utils/Downloads';
import { SessionStore } from './SessionStore';
import { LocalStore } from './LocalStore';
import { initializeStrings, text } from '../utils/Strings';
import { validMediaItem } from '../utils/Cache';
import { followingEpisode, precedingEpisode } from '../utils/Playback';
import { firstEpisode } from '../utils/DetailPresentation';

import { PlaybackPreferenceStore } from './PlaybackPreferenceStore';
import { ServerProfile, sessionKey, addresses } from '../utils/Accounts';
import { ExperienceStore } from './ExperienceStore';
import { PendingSync, SyncOwner } from './PendingSync';
import { ExperienceState, PendingEdit, PendingPosition, applyPending, connectionFailure, uniqueWorks } from '../utils/Experience';

interface PreparedAccount { local: LocalStore; snapshot: LibrarySnapshot; records: DownloadRecord[]; experience: ExperienceStore }
export class AppService {
  static posters: PosterCache | undefined;
  private static accountBusy: boolean = false;
  private static accountListener: (() => void) | undefined = undefined;
  private static notifyAccount(): void {
    const listener = AppService.accountListener;
    try { listener?.(); } catch (e) { if (AppService.accountListener === listener) { AppService.accountListener = undefined; } }
  }
  static subscribeAccount(listener: () => void): void { AppService.accountListener = listener; }
  static unsubscribeAccount(listener: () => void): void { if (AppService.accountListener === listener) { AppService.accountListener = undefined; } }
  static closePlayback: (() => Promise<void>) | undefined = undefined;
  private static async accountOperation(operation: () => Promise<void>): Promise<void> {
    if (AppService.accountBusy) { throw new Error('account_switching'); }
    if (PendingSync.busy || AppService.syncing || AppService.tasks.size || AppService.mutations.size || AppService.downloads.some((r: DownloadRecord) => ['downloading', 'queued'].includes(r.state))) { throw new Error('tasks_active'); }
    if (!AppLock.permit()) { throw new Error('lock_pin_wrong'); }
    AppService.accountBusy = true; try { await operation(); } finally { AppService.accountBusy = false; }
  }

  static experience: ExperienceStore | undefined = undefined;
  private static syncRevision: number = 0;
  private static editRevision: number = 0;
  private static mutations: Map<string, Promise<void>> = new Map();
  private static latestEdits: Map<string, number> = new Map();
  private static polling: boolean = false;
  private static pumping: boolean = false;
  static playbackPreferences: PlaybackPreferenceStore = new PlaybackPreferenceStore();
  static client: JellyfinClient | undefined = undefined;
  static context: common.UIAbilityContext;
  static local: LocalStore | undefined = undefined;
  static snapshot: LibrarySnapshot = new LibrarySnapshot();
  static downloads: DownloadRecord[] = [];
  static syncing: boolean = false;
  static cacheRecovered: boolean = false;
  private static downloadListener: (() => void) | undefined = undefined;

  static subscribeDownloads(listener: () => void): void { AppService.downloadListener = listener; }
  static unsubscribeDownloads(listener: () => void): void {
    if (AppService.downloadListener === listener) { AppService.downloadListener = undefined; }
  }
  private static initialized: boolean = false;
  private static tasks: Map<string, request.DownloadTask> = new Map();

  static async initialize(context: common.UIAbilityContext): Promise<void> {
    AppService.context = context; initializeStrings(context.resourceManager);
    if (AppService.initialized) { return; }
    if (!AppService.posters) { AppService.posters = new PosterCache(context); }
    await AppService.posters.initialize();
    try { await NetworkPreferences.load(context); } catch (e) { /* Bounded defaults remain available; settings show the error. */ }
    try { await AppService.playbackPreferences.load(context); } catch (e) { /* Settings errors do not prevent login/browsing. */ }
    await AppLock.ensureInitialized();
    PendingSync.configure(context, (): SyncOwner | undefined => AppService.client && AppService.local && AppService.experience ?
      { client: AppService.client, local: AppService.local, store: AppService.experience } : undefined);
    const session = await SessionStore.load();
    if (session) { AppService.useClient(new JellyfinClient(session)); await AppService.restoreDownloads(); await AppService.pumpDownloads(); }
    AppService.initialized = true;
    PendingSync.wake();
  }

  private static prepareClient(client: JellyfinClient): PreparedAccount {
    const local = new LocalStore(AppService.context, client.session);
    const snapshot = local.snapshot();
    const records = local.downloads();
    // Basic download migration does not claim process-death resume. Retain completed media only as playable.
    records.forEach((record: DownloadRecord) => {
      if (record.state === 'downloading' && !record.agentId) { record.state = 'interrupted'; }
      if (record.state === 'complete' && !fs.accessSync(record.path)) { record.state = 'missing'; }
    });
    local.saveDownloads(records);
    const experience = new ExperienceStore(local);
    const edits = experience.snapshot().pending;
    const extra = [...edits.map((p: PendingEdit) => p.item), ...experience.snapshot().positions.map((p: PendingPosition) => p.item)].filter((i: MediaItem | undefined) => !!i && validMediaItem(i) && !snapshot.items.some((v: MediaItem) => v.Id === i.Id)) as MediaItem[];
    snapshot.items = applyPending(uniqueWorks([...snapshot.items, ...extra]), edits);
    const positions = experience.snapshot().positions;
    snapshot.items.forEach((i: MediaItem) => { const position = positions.find((p: PendingPosition) => p.id === i.Id); if (position) { i.UserData = i.UserData ?? {}; i.UserData.PlaybackPositionTicks = position.ticks; } });
    return { local: local, snapshot: snapshot, records: records, experience: experience };
  }

  private static useClient(client: JellyfinClient, prepared?: PreparedAccount): void {
    const data = prepared ?? AppService.prepareClient(client);
    if (AppService.experience) { AppService.experience.changed = undefined; }
    AppService.local = data.local; AppService.snapshot = data.snapshot; AppService.downloads = data.records; AppService.experience = data.experience;
    AppService.client = client; AppService.cacheRecovered = data.local.recovered;
    AppService.posters?.cancelAll();
    data.experience.changed = () => PendingSync.wake();
    client.onEndpointChange((address: string) => { if (AppService.client === client) { SessionStore.rememberAddress(client.session.serverId, address).catch(() => {}); } });
    AppService.notifyAccount();
    PendingSync.wake();
  }
  private static clearClient(): void {
    if (AppService.experience) { AppService.experience.changed = undefined; }
    AppService.client = undefined; AppService.local = undefined; AppService.experience = undefined; AppService.snapshot = new LibrarySnapshot();
    AppService.posters?.cancelAll();
    AppService.downloads = []; AppService.cacheRecovered = false; AppService.notifyAccount();
    PendingSync.wake();
  }
  private static async acceptClient(client: JellyfinClient, allowed: () => boolean = () => true): Promise<void> {
    if (!allowed() || !AppLock.permit()) { throw new Error('login_cancelled'); }
    const server = (await SessionStore.servers()).find((s: ServerProfile) => s.id === client.session.serverId);
    if (server) { client.session.addresses = addresses(Array.from(new Set([...server.addresses, client.session.server]))); client.session.serverName = server.name; }
    const data = AppService.prepareClient(client); await AppService.closePlayback?.();
    if (!allowed() || !AppLock.permit()) { throw new Error('login_cancelled'); }
    await SessionStore.save(client.session); AppService.useClient(client, data);
  }
  static async login(server: string, name: string, password: string, allowed: () => boolean = () => true, expectedServerId: string = ''): Promise<void> {
    await AppService.accountOperation(async () => {
      const target = (await SessionStore.servers()).find((s: ServerProfile) => s.addresses.includes(server.trim().replace(/\/+$/, '')));
      if (expectedServerId && target && expectedServerId !== target.id) { throw new Error('server_identity_mismatch'); }
      await AppService.acceptClient(await JellyfinClient.login(server, name, password, expectedServerId || target?.id || '', target?.addresses ?? [], allowed), allowed);
    });
    await AppService.restoreDownloads(); await AppService.pumpDownloads();
  }
  static async loginQuick(client: JellyfinClient): Promise<void> {
    await AppService.accountOperation(async () => AppService.acceptClient(client)); await AppService.restoreDownloads(); await AppService.pumpDownloads();
  }
  static async switchAccount(key: string): Promise<void> {
    await AppService.accountOperation(async () => {
      const session = await SessionStore.get(key); const client = new JellyfinClient(session); const data = AppService.prepareClient(client);
      if (!data.experience.snapshot().offline) { try { await client.validateAccount(); } catch (e) { if (!NetworkPolicy.cacheAllowed() || !connectionFailure(e as Error)) { throw e as Error; } } }
      await AppService.closePlayback?.(); await SessionStore.save(client.session); AppService.useClient(client, data);
    });
    await AppService.restoreDownloads(); await AppService.pumpDownloads();
  }
  static async logout(): Promise<void> { await AppService.accountOperation(async () => { await AppService.closePlayback?.(); await SessionStore.clear(); AppService.clearClient(); }); }
  static async resetAccounts(): Promise<void> { await AppService.accountOperation(async () => { await AppService.closePlayback?.(); await SessionStore.reset(); AppService.clearClient(); }); }
  static async removeAccount(key: string): Promise<void> {
    await AppService.accountOperation(async () => { const active = AppService.client && sessionKey(AppService.client.session) === key; if (active) { await AppService.closePlayback?.(); } await SessionStore.remove(key); if (active) { AppService.clearClient(); } });
  }
  static async removeServer(id: string): Promise<void> {
    await AppService.accountOperation(async () => { const active = AppService.client?.session.serverId === id; if (active) { await AppService.closePlayback?.(); } await SessionStore.removeServer(id); if (active) { AppService.clearClient(); } });
  }
  static async saveServer(id: string, name: string, inputs: string[]): Promise<void> {
    await AppService.accountOperation(async () => {
      const list = addresses(inputs); const client = AppService.client;
      let replacement: JellyfinClient | undefined = undefined; let prepared: PreparedAccount | undefined = undefined;
      if (client?.session.serverId === id && !list.includes(client.session.server)) {
        const info = await JellyfinClient.inspectServer(list[0]); if (info.Id !== id) { throw new Error('server_identity_mismatch'); }
        const session = JSON.parse(JSON.stringify(client.session)) as Session; session.server = list[0]; session.addresses = list; session.serverName = name;
        replacement = new JellyfinClient(session, info.Version ?? ''); prepared = AppService.prepareClient(replacement);
      }
      const profile: ServerProfile = { id: id, name: name, addresses: list, preferred: client?.session.serverId === id && list.includes(client.session.server) ? client.session.server : list[0] };
      await SessionStore.updateServer(profile);
      if (replacement && prepared) { AppService.useClient(replacement, prepared); }
      else if (client?.session.serverId === id) { client.session.addresses = list; client.session.serverName = name; }
    });
  }
  static requireClient(): JellyfinClient {
    if (AppService.accountBusy) { throw new Error('account_switching'); }
    if (!AppService.client) { throw new Error('login_required'); }
    return AppService.client;
  }

  static async loadAutoNext(offline: boolean = false): Promise<boolean> {
    const client = AppService.requireClient(); const store = AppService.experience;
    const state = store?.snapshot();
    if (state?.autoNextMode === 'on' || state?.autoNextMode === 'off') { return state.autoNextMode === 'on'; }
    if (offline || state?.offline) { return state?.serverAutoNext ?? true; }
    try {
      const enabled = await client.autoNextEnabled();
      if (client !== AppService.client || store !== AppService.experience) { throw new Error('login_required'); }
      store?.update((next: ExperienceState) => { next.serverAutoNext = enabled; });
      const latest = store?.snapshot();
      return latest?.autoNextMode === 'on' ? true : latest?.autoNextMode === 'off' ? false : enabled;
    } catch (e) {
      if (client !== AppService.client || store !== AppService.experience || !NetworkPolicy.cacheAllowed() || !connectionFailure(e as Error)) { throw e as Error; }
      return store?.snapshot().serverAutoNext ?? true;
    }
  }

  static saveAutoNext(mode: string): void {
    AppService.requireClient();
    if (!['server', 'on', 'off'].includes(mode) || !AppService.experience) { throw new Error('auto_next_save_failed'); }
    AppService.experience.update((next: ExperienceState) => { next.autoNextMode = mode; });
  }

  static async sync(progress: (message: string) => void): Promise<void> {
    if (AppService.experience?.snapshot().offline) { throw new Error('offline_mode_enabled'); }
    if (AppService.syncing) { throw new Error('sync_active'); }
    const client = AppService.requireClient();
    const local = AppService.local!;
    AppService.syncing = true;
    const revision = ++AppService.syncRevision; let held = false;
    try {
      if (canIUse('SystemCapability.ResourceSchedule.BackgroundTaskManager.ContinuousTask')) { await BackgroundLease.set(AppService.context, background.BackgroundMode.DATA_TRANSFER, true); held = true; }
      await AppService.flushPending();
      const views = await client.libraries();
      if (revision !== AppService.syncRevision || client !== AppService.client) { throw new Error('sync_cancelled'); }
      if (!Array.isArray(views) || !views.every(validMediaItem)) { throw new Error('sync_incomplete'); }
      const libraries = uniqueItems(views.filter((view: MediaItem) => !view.CollectionType || ['movies', 'tvshows'].includes(view.CollectionType)));
      const items: MediaItem[] = [];
      const memberships: LibraryMembership[] = [];
      for (const library of libraries) {
        const members = await AppService.syncItems(client, [{ key: 'ParentId', value: library.Id }],
          (current: number, total: number) => {
            if (revision !== AppService.syncRevision || client !== AppService.client) { throw new Error('sync_cancelled'); }
            progress(text('sync_library_progress', library.Name, current, total));
          });
        items.push(...members);
        memberships.push({ libraryId: library.Id, itemIds: members.map((item: MediaItem) => item.Id) });
      }
      const snapshot = new LibrarySnapshot(); snapshot.libraries = libraries; snapshot.memberships = memberships;
      if (revision !== AppService.syncRevision || client !== AppService.client) { throw new Error('sync_cancelled'); }
      snapshot.items = applyPending(uniqueItems(items), AppService.experience?.snapshot().pending ?? [], AppService.experience?.snapshot().positions ?? []);
      snapshot.actors = rankActors(snapshot.items); snapshot.syncedAt = Date.now();
      local.saveSnapshot(snapshot); AppService.snapshot = snapshot;
      progress(text('sync_complete', snapshot.items.length, snapshot.actors.length));
    } finally { AppService.syncing = false; if (held) { await BackgroundLease.set(AppService.context, background.BackgroundMode.DATA_TRANSFER, false); } }
  }
  static cancelSync(): void { ++AppService.syncRevision; }

  private static async syncItems(client: JellyfinClient, scope: QueryParam[], progress: (current: number, total: number) => void): Promise<MediaItem[]> {
    const items: MediaItem[] = [];
    const ids = new Set<string>();
    let total = -1;
    while (true) {
      const page = await client.items([{ key: 'IncludeItemTypes', value: 'Movie,Series,Season,Episode' },
        { key: 'SortBy', value: 'SortName' }, { key: 'SortOrder', value: 'Ascending' }, ...scope,
        { key: 'StartIndex', value: items.length.toString() }, { key: 'Limit', value: '200' }]);
      if (!page || !Array.isArray(page.Items) || !Number.isSafeInteger(page.TotalRecordCount) || page.TotalRecordCount < 0 ||
        (total >= 0 && total !== page.TotalRecordCount)) { throw new Error('sync_incomplete'); }
      total = page.TotalRecordCount;
      if ((page.Items.length === 0 && items.length < total) || items.length + page.Items.length > total) { throw new Error('sync_incomplete'); }
      for (const item of page.Items) {
        if (!validMediaItem(item) || ids.has(item.Id)) { throw new Error('sync_incomplete'); }
        ids.add(item.Id); items.push(item);
      }
      progress(items.length, total);
      const checkpoint = new LibrarySnapshot(); checkpoint.items = [...items]; checkpoint.actors = rankActors(items);
      AppService.local?.saveSyncProgress(checkpoint);
      if (items.length === total) { return items; }
    }
  }

  static async playback(item: MediaItem, sourceId: string = '', offlineOnly: boolean = false): Promise<PlaybackRoute> {
    if (item.PlayAccess === 'None') { throw new Error('play_not_allowed'); }
    offlineOnly = offlineOnly || (AppService.experience?.snapshot().offline ?? false);
    const route = new PlaybackRoute(); route.item = item;
    const record = AppService.downloads.find((record: DownloadRecord) => record.id === item.Id && record.state === 'complete' &&
      (!sourceId || record.mediaSourceId === sourceId) && fs.accessSync(record.path));
    if (record) { const local = AppService.downloadPlayback(record); local.item = item; return local; }
    if (offlineOnly) { throw new Error('next_not_downloaded'); }
    const client = AppService.requireClient();
    const info = await client.playbackInfo(item.Id);
    if (client !== AppService.client) { throw new Error('login_required'); }
    route.sources = (info.MediaSources ?? []).filter((source: MediaSource) => !!source?.Id);
    const source = sourceId ? route.sources.find((source: MediaSource) => source.Id === sourceId) : route.sources[0];
    if (!source) { throw new Error('no_media_source'); }
    route.mediaSourceId = source.Id; route.playSessionId = info.PlaySessionId ?? '';
    route.url = client.stream(item.Id, source.Id);
    return route;
  }

  static downloadPlayback(record: DownloadRecord): PlaybackRoute {
    AppService.requireClient();
    if (!AppService.downloads.includes(record)) { throw new Error('login_required'); }
    if (record.item.PlayAccess === 'None') { throw new Error('play_not_allowed'); }
    if (record.state !== 'complete' || !fs.accessSync(record.path)) { throw new Error('next_not_downloaded'); }
    const route = new PlaybackRoute(); route.item = record.item;
    route.url = fileUri.getUriFromPath(record.path); route.filePath = record.path; route.offline = true;
    route.mediaSourceId = record.mediaSourceId ?? ''; route.subtitles = record.subtitles ?? []; return route;
  }

  static async seriesEpisodes(seriesId: string): Promise<MediaItem[]> {
    const client = AppService.requireClient();
    const episodes: MediaItem[] = []; let total = -1; const ids = new Set<string>();
    while (true) {
      const page: ItemsResult = await client.episodePage(seriesId, episodes.length);
      if (client !== AppService.client) { throw new Error('login_required'); }
      if (!page || !Array.isArray(page.Items) || !Number.isSafeInteger(page.TotalRecordCount) || page.TotalRecordCount < 0 ||
        (total >= 0 && total !== page.TotalRecordCount)) { throw new Error('episode_queue_failed'); }
      total = page.TotalRecordCount;
      if ((page.Items.length === 0 && episodes.length < total) || episodes.length + page.Items.length > total) { throw new Error('episode_queue_failed'); }
      for (const episode of page.Items) {
        if (!validMediaItem(episode) || episode.Type !== 'Episode' || episode.SeriesId !== seriesId || ids.has(episode.Id)) { throw new Error('episode_queue_failed'); }
        ids.add(episode.Id); episodes.push(episode);
      }
      if (episodes.length === total) { break; }
    }
    return episodes;
  }

  static async detailPlayback(item: MediaItem, sourceId: string = '', offline: boolean = false, restart: boolean = false, downloadPath: string = ''): Promise<PlaybackRoute> {
    const client = AppService.client;
    if (item.PlayAccess === 'None') { throw new Error('play_not_allowed'); }
    let target = item;
    if (item.Type === 'Series' || item.Type === 'Season') {
      const seriesId = item.Type === 'Series' ? item.Id : item.SeriesId ?? '';
      if (!seriesId) { throw new Error('episode_order_unknown'); }
      const next = !offline && item.Type === 'Series' ? await AppService.requireClient().nextUp(seriesId) : [];
      if (client !== AppService.client) { throw new Error('login_required'); }
      if (next.length && (next[0].Type !== 'Episode' || next[0].SeriesId !== seriesId)) { throw new Error('episode_queue_failed'); }
      target = next[0] ?? firstEpisode(offline ? AppService.snapshot.items : await AppService.seriesEpisodes(seriesId), seriesId, item.Type === 'Season' ? item.Id : '')!;
      if (!target) { throw new Error('no_playable_episode'); }
    }
    if (client !== AppService.client) { throw new Error('login_required'); }
    if (target.PlayAccess === 'None') { throw new Error('play_not_allowed'); }
    const chosen = downloadPath ? AppService.downloads.find((record: DownloadRecord) => record.path === downloadPath && record.id === target.Id) : undefined;
    if (downloadPath && !chosen) { throw new Error('next_not_downloaded'); }
    const result = chosen ? AppService.downloadPlayback(chosen) : await AppService.playback(target, sourceId, offline);
    if (chosen) { result.item = target; }
    if (client !== AppService.client) { throw new Error('login_required'); }
    if (restart) {
      const current = JSON.parse(JSON.stringify(result.item)) as MediaItem;
      if (!current.UserData) { current.UserData = {}; }
      current.UserData.PlaybackPositionTicks = 0; result.item = current;
    }
    return result;
  }

  static async nextPlayback(route: PlaybackRoute): Promise<PlaybackRoute | undefined> { return AppService.adjacentPlayback(route, false); }
  static async previousPlayback(route: PlaybackRoute): Promise<PlaybackRoute | undefined> { return AppService.adjacentPlayback(route, true); }
  private static async adjacentPlayback(route: PlaybackRoute, previous: boolean): Promise<PlaybackRoute | undefined> {
    const item = route.item;
    if (item.Type !== 'Episode' || !item.SeriesId) { return undefined; }
    const client = AppService.client;
    const episodes = route.offline ? AppService.snapshot.items : await AppService.seriesEpisodes(item.SeriesId);
    if (client !== AppService.client) { throw new Error('login_required'); }
    const next = previous ? precedingEpisode(item, episodes) : followingEpisode(item, episodes);
    if (!next) { return undefined; }
    const current = AppService.downloads.find((record: DownloadRecord) => record.path === route.filePath);
    const matching = route.offline && current?.sourceName ? AppService.downloads.find((record: DownloadRecord) => record.id === next.Id && record.state === 'complete' && record.sourceName === current.sourceName && fs.accessSync(record.path)) : undefined;
    const result = matching ? AppService.downloadPlayback(matching) : await AppService.playback(next, '', route.offline);
    if (matching) { result.item = next; }
    if (client !== AppService.client) { throw new Error('login_required'); }
    return result;
  }

  static async download(item: MediaItem, sourceId: string = '', network?: DownloadNetwork): Promise<void> {
    const client = AppService.requireClient(); const local = AppService.local!; let record: DownloadRecord | undefined;
    await AppService.mutation('download-admission', async () => {
      if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
      record = await AppService.startDownload(item, sourceId, network);
    });
    if (record) { await AppService.cacheSubtitles(record, client, local); }
  }

  private static async startDownload(item: MediaItem, sourceId: string, network?: DownloadNetwork): Promise<DownloadRecord> {
    const client = AppService.requireClient(); const local = AppService.local!;
    if (item.CanDownload !== true) { throw new Error('download_not_allowed'); }
    const info = await client.playbackInfo(item.Id);
    if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
    const preference = AppService.experience?.snapshot();
    const preferred = !sourceId && preference?.rememberDownloadSource ? preference.sourcePreference : '';
    const source = sourceId ? info.MediaSources?.find((value: MediaSource) => value.Id === sourceId) :
      info.MediaSources?.find((value: MediaSource) => preferred && (value.Name || value.Container || '') === preferred) ?? info.MediaSources?.[0];
    if (!source) { throw new Error('no_download_source'); }
    if (AppService.downloads.some((record: DownloadRecord) => sameDownload(record, item.Id, source.Id))) { throw new Error('download_exists'); }
    const record = new DownloadRecord(); record.id = item.Id; record.item = JSON.parse(JSON.stringify(item)) as MediaItem; record.item.MediaSources = info.MediaSources; record.mediaSourceId = source.Id;
    record.fileId = util.generateRandomUUID().replace(/-/g, '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(record.fileId)) { throw new Error('download_create_failed'); }
    record.sourceName = (source.Name || source.Container || '').slice(0, 256);
    record.network = network ?? downloadNetwork(preference?.downloadMobile, preference?.downloadRoaming);
    record.expectedSize = Number.isSafeInteger(source.Size) && (source.Size ?? 0) > 0 ? source.Size : undefined;
    const extension = /^[a-zA-Z0-9]+$/.test(source.Container ?? '') ? source.Container : 'media';
    record.path = `${local.directory}/${downloadStem(record)}.${extension}`;
    if (AppService.downloads.some((value: DownloadRecord) => downloadStem(value) === downloadStem(record)) || fs.accessSync(record.path)) { throw new Error('download_create_failed'); }
    record.subtitles = OfflineSubtitles.plan(record, source, local.directory); record.subtitleState = record.subtitles.length ? 'pending' : 'ready';
    await DownloadSpace.check(local.directory, record, AppService.downloads);
    if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
    if (PersistentDownload.available()) {
      const owned = (): boolean => client === AppService.client && local === AppService.local && AppService.downloads.includes(record);
      AppService.downloads.push(record);
      const save = (): void => { if (owned()) { local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); if (record.state !== 'downloading') { AppService.pumpDownloads(); } } };
      try { await PersistentDownload.create(AppService.context, record, client.stream(item.Id, source.Id), owned, save); }
      catch (e) { AppService.downloads = AppService.downloads.filter((r: DownloadRecord) => r !== record); if (client === AppService.client) { local.saveDownloads(AppService.downloads); } throw e as Error; }
      if (preference?.rememberDownloadSource) { AppService.experience?.update((next: ExperienceState) => { next.sourcePreference = source.Name || source.Container || ''; }); }
      return record;
    }
    await DownloadNetworkGuard.legacy(record.network);
    if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
    const task = await request.downloadFile(AppService.context, { url: client.stream(item.Id, source.Id),
      filePath: record.path, enableMetered: record.network.mobile, enableRoaming: record.network.mobile && record.network.roaming });
    if (client !== AppService.client || local !== AppService.local || AppService.downloads.some((value: DownloadRecord) => sameDownload(value, record.id, record.mediaSourceId ?? ''))) {
      if (!await task.delete()) { throw new Error('cancel_download_failed'); }
      throw new Error(client !== AppService.client ? 'login_required' : 'download_exists');
    }
    const records = [...AppService.downloads, record];
    try { local.saveDownloads(records); } catch (e) { await task.delete(); throw new Error('download_create_failed'); }
    AppService.tasks.set(downloadKey(record), task); AppService.downloads = records;
    if (preference?.rememberDownloadSource) {
      AppService.experience?.update((next: ExperienceState) => { next.sourcePreference = source.Name || source.Container || ''; });
    }
    const owned = (): boolean => client === AppService.client && local === AppService.local && AppService.tasks.get(downloadKey(record)) === task;
    task.on('progress', (received: number, total: number) => {
      if (!owned()) { return; }
      record.progress = Number.isFinite(received) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(1, received / total)) : 0;
      record.received = Number.isSafeInteger(received) ? Math.max(0, received) : 0; record.total = Number.isSafeInteger(total) ? Math.max(0, total) : 0;
      AppService.downloadListener?.();
    });
    task.on('complete', () => {
      if (!owned()) { return; }
      record.state = 'complete'; record.progress = 1; AppService.tasks.delete(downloadKey(record));
      local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); AppService.pumpDownloads();
    });
    task.on('fail', (reason: number) => {
      if (!owned()) { return; }
      record.state = 'failed'; record.failure = text('download_failure_reason', Number.isFinite(reason) ? reason : 0); AppService.tasks.delete(downloadKey(record));
      local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); AppService.pumpDownloads();
    });
    AppService.downloadListener?.();
    return record;
  }

  private static async cacheSubtitles(record: DownloadRecord, client: JellyfinClient, local: LocalStore): Promise<void> {
    const owned = (): boolean => client === AppService.client && local === AppService.local && AppService.downloads.includes(record);
    await AppService.mutation(`subtitles:${downloadKey(record)}`, async () => {
      await OfflineSubtitles.fetch(record, client, owned, () => { if (owned()) { local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); } }, AppService.context);
    });
  }

  static async retrySubtitles(record: DownloadRecord): Promise<void> {
    const client = AppService.requireClient(); const local = AppService.local;
    if (!local || !AppService.downloads.includes(record) || record.state !== 'complete') { throw new Error('offline_subtitle_failed'); }
    if (AppService.experience?.snapshot().offline) { throw new Error('offline_mode_enabled'); }
    const info = await client.playbackInfo(record.id);
    if (client !== AppService.client || local !== AppService.local || !AppService.downloads.includes(record)) { throw new Error('login_required'); }
    const source = info.MediaSources.find((s: MediaSource) => s.Id === record.mediaSourceId);
    if (!source) { throw new Error('no_media_source'); }
    const plan = OfflineSubtitles.plan(record, source, local.directory);
    const prepared = new DownloadRecord(); prepared.path = record.path;
    prepared.subtitles = plan.map((subtitle) => record.subtitles?.find((old) => old.index === subtitle.index && old.state === 'ready') ?? subtitle);
    await AppService.mutation('download-admission', async () => {
      await DownloadSpace.check(local.directory, prepared, AppService.downloads.filter((value: DownloadRecord) => value !== record), true);
      if (client !== AppService.client || local !== AppService.local || !AppService.downloads.includes(record)) { throw new Error('login_required'); }
      record.subtitles = prepared.subtitles; record.subtitleState = 'pending'; local.saveDownloads(AppService.downloads);
    });
    const preference = AppService.experience?.snapshot();
    record.network = downloadNetwork(preference?.downloadMobile, preference?.downloadRoaming);
    local.saveDownloads(AppService.downloads);
    await AppService.cacheSubtitles(record, client, local);
  }

  static async retryDownload(record: DownloadRecord): Promise<void> {
    if (!['failed', 'interrupted', 'missing'].includes(record.state)) { throw new Error('download_exists'); }
    const item = record.item; const source = record.mediaSourceId ?? '';
    const client = AppService.requireClient();
    const latest = await client.detail(item.Id);
    if (client !== AppService.client || !AppService.downloads.includes(record)) { throw new Error('login_required'); }
    if (source) {
      try {
        const info = await client.playbackInfo(item.Id);
        if (client !== AppService.client || !AppService.downloads.includes(record)) { throw new Error('login_required'); }
        if (!info.MediaSources?.some((value: MediaSource) => value.Id === source)) { throw new Error('no_download_source'); }
      } catch (e) {
        if (client === AppService.client && AppService.downloads.includes(record)) { record.state = 'failed'; record.failure = (e as Error).message; AppService.local?.saveDownloads(AppService.downloads); AppService.downloadListener?.(); }
        throw e as Error;
      }
    }
    await AppService.removeDownload(record);
    try { await AppService.download(latest, source); }
    catch (e) {
      // Preserve a retryable record if task creation or a removed source fails.
      if (client === AppService.client && !AppService.downloads.some((r: DownloadRecord) => sameDownload(r, record.id, record.mediaSourceId ?? ''))) {
        record.state = 'failed'; record.failure = (e as Error).message; AppService.downloads.push(record); AppService.local?.saveDownloads(AppService.downloads); AppService.downloadListener?.();
      }
      throw e as Error;
    }
  }

  private static async restoreDownloads(): Promise<void> {
    const client = AppService.client; const local = AppService.local;
    for (const record of AppService.downloads.filter((r: DownloadRecord) => !!r.agentId && r.state === 'downloading')) {
      const owned = (): boolean => client === AppService.client && local === AppService.local && AppService.downloads.includes(record);
      try { await PersistentDownload.restore(AppService.context, record, owned, () => { if (owned()) { local?.saveDownloads(AppService.downloads); AppService.downloadListener?.(); } }); }
      catch (e) { if (owned()) { record.state = 'interrupted'; local?.saveDownloads(AppService.downloads); } }
    }
  }
  static async pollDownloads(): Promise<void> {
    if (AppService.polling) { return; } AppService.polling = true;
    const client = AppService.client; const local = AppService.local;
    try {
    for (const record of AppService.downloads.filter((r: DownloadRecord) => r.state === 'downloading')) {
      if (record.agentId) {
        const owned = (): boolean => client === AppService.client && local === AppService.local && AppService.downloads.includes(record);
        try { await PersistentDownload.poll(record, owned, () => { if (owned()) { local?.saveDownloads(AppService.downloads); AppService.downloadListener?.(); } }); } catch (e) {}
        continue;
      }
      const task = AppService.tasks.get(downloadKey(record)); if (!task) { continue; }
      try {
        const info = await task.getTaskInfo();
        if (client !== AppService.client || local !== AppService.local || AppService.tasks.get(downloadKey(record)) !== task) { return; }
        record.taskId = info.downloadId; record.received = info.downloadedBytes; record.total = info.downloadTotalBytes;
        record.progress = info.downloadTotalBytes > 0 ? Math.max(0, Math.min(1, info.downloadedBytes / info.downloadTotalBytes)) : 0;
        if (info.status === request.SESSION_SUCCESSFUL && fs.accessSync(record.path)) { record.state = 'complete'; record.progress = 1; AppService.tasks.delete(downloadKey(record)); }
        if (info.status === request.SESSION_FAILED) { record.state = 'failed'; record.failure = text('download_failure_reason', info.failedReason); AppService.tasks.delete(downloadKey(record)); }
        local?.saveDownloads(AppService.downloads); AppService.downloadListener?.();
      } catch (e) { /* The event stream remains authoritative when a query is unavailable. */ }
    }
    } finally { AppService.polling = false; }
  }

  static async batchDownload(items: MediaItem[], sourceId: string = ''): Promise<string[]> {
    const client = AppService.requireClient(); const local = AppService.local!; const failed: string[] = []; const queued: DownloadRecord[] = [];
    for (const item of uniqueWorks(items)) {
      if (client !== AppService.client) { throw new Error('login_required'); }
      if (AppService.downloads.some((r: DownloadRecord) => r.id === item.Id && (!sourceId || r.mediaSourceId === sourceId))) { continue; }
      if (item.CanDownload !== true || !validMediaItem(item)) { failed.push(item.Id); continue; }
      const record = new DownloadRecord(); record.id = item.Id; record.item = item; record.state = 'queued'; record.mediaSourceId = sourceId;
      const preference = AppService.experience?.snapshot(); record.network = downloadNetwork(preference?.downloadMobile, preference?.downloadRoaming);
      record.fileId = util.generateRandomUUID().replace(/-/g, '').toLowerCase();
      if (!/^[a-f0-9]{32}$/.test(record.fileId)) { throw new Error('download_create_failed'); }
      record.path = `${local.directory}/${downloadStem(record)}.media`;
      if ([...AppService.downloads, ...queued].some((value: DownloadRecord) => downloadStem(value) === downloadStem(record)) || fs.accessSync(record.path)) { throw new Error('download_create_failed'); }
      queued.push(record);
    }
    const records = [...AppService.downloads, ...queued]; local.saveDownloads(records); AppService.downloads = records; AppService.downloadListener?.(); await AppService.pumpDownloads();
    const chosen = new Set(items.map((i: MediaItem) => i.Id));
    AppService.downloads.filter((r: DownloadRecord) => chosen.has(r.id) && r.state === 'failed').forEach((r: DownloadRecord) => { if (!failed.includes(r.id)) { failed.push(r.id); } });
    return failed;
  }
  private static async pumpDownloads(): Promise<void> {
    if (AppService.accountBusy || AppService.pumping || !AppService.client) { return; } AppService.pumping = true;
    const client = AppService.client; const local = AppService.local;
    try {
      while (client === AppService.client && AppService.downloads.filter((r: DownloadRecord) => r.state === 'downloading').length < 4) {
        const record = AppService.downloads.find((r: DownloadRecord) => r.state === 'queued'); if (!record) { return; }
        try {
          const latest = await client.detail(record.id);
          if (client !== AppService.client || local !== AppService.local) { return; }
          if (!AppService.downloads.includes(record)) { continue; }
          AppService.downloads = AppService.downloads.filter((r: DownloadRecord) => r !== record);
          await AppService.download(latest, record.mediaSourceId ?? '', record.network);
        } catch (e) {
          if (client !== AppService.client || local !== AppService.local) { return; }
          if ((e as Error).message === 'download_exists') { local?.saveDownloads(AppService.downloads); AppService.downloadListener?.(); continue; }
          record.state = 'failed'; record.failure = (e as Error).message;
          if (!AppService.downloads.some((r: DownloadRecord) => sameDownload(r, record.id, record.mediaSourceId ?? ''))) { AppService.downloads.push(record); }
          local?.saveDownloads(AppService.downloads); AppService.downloadListener?.();
        }
      }
    } finally { AppService.pumping = false; }
  }

  static async allItems(params: QueryParam[], onPage?: (items: MediaItem[]) => void): Promise<MediaItem[]> {
    const client = AppService.requireClient(); const items: MediaItem[] = []; const seen = new Set<string>(); let total = -1;
    while (true) {
      const page = await client.items([...params, { key: 'StartIndex', value: String(items.length) }, { key: 'Limit', value: '200' }]);
      if (client !== AppService.client) { throw new Error('login_required'); }
      if (!page || !Array.isArray(page.Items) || !Number.isSafeInteger(page.TotalRecordCount) || page.TotalRecordCount < 0) { throw new Error('sync_incomplete'); }
      if (total >= 0 && page.TotalRecordCount !== total) { throw new Error('sync_incomplete'); } total = page.TotalRecordCount;
      if (!page.Items.length && items.length < total || items.length + page.Items.length > total) { throw new Error('sync_incomplete'); }
      for (const item of page.Items) { if (!validMediaItem(item) || seen.has(item.Id)) { throw new Error('sync_incomplete'); } seen.add(item.Id); items.push(item); }
      onPage?.([...items]); if (items.length === total) { return items; }
    }
  }

  private static mutation(key: string, operation: () => Promise<void>): Promise<void> {
    const previous = AppService.mutations.get(key) ?? Promise.resolve();
    const result = previous.then(operation); const settled = result.then(() => {}, () => {}); AppService.mutations.set(key, settled);
    settled.then(() => { if (AppService.mutations.get(key) === settled) { AppService.mutations.delete(key); } }); return result;
  }
  private static mutationKey(client: JellyfinClient, id: string, field: string): string { return `${client.session.serverId ?? client.session.server}/${client.session.userId}/${id}/${field}`; }
  static async edit(item: MediaItem, favorite: boolean, value: boolean, offline: boolean = false): Promise<boolean> {
    const client = AppService.requireClient(); const local = AppService.local; const store = AppService.experience;
    offline = offline || (store?.snapshot().offline ?? false); if (offline && !store) { throw new Error('cache_write_failed'); }
    const field = favorite ? 'favorite' : 'played'; const key = AppService.mutationKey(client, item.Id, field);
    const revision = AppService.editRevision = Math.max(Date.now(), AppService.editRevision + 1); AppService.latestEdits.set(key, revision);
    const prior = store?.snapshot().pending.find((p: PendingEdit) => p.id === item.Id && p.field === field);
    const copy = applyPending([JSON.parse(JSON.stringify(item)) as MediaItem], store?.snapshot().pending ?? [], store?.snapshot().positions ?? [])[0]; copy.UserData = copy.UserData ?? {};
    if (favorite) { copy.UserData.IsFavorite = value; } else { copy.UserData.Played = value; }
    // Intent is durable before an HTTP write. Unknown outcomes remain replayable after process death.
    store?.update((next: ExperienceState) => { next.pending = next.pending.filter((p: PendingEdit) => p.id !== item.Id || p.field !== field); next.pending.push({ id: item.Id, field: field, value: value, revision: revision, item: copy }); next.syncAttempts = 0; next.syncNextAt = 0; next.syncBlocked = false; });
    let queued = offline;
    if (!offline) {
      try {
        await AppService.mutation(key, async () => {
          await local!.transfer(async () => {
            if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
            if (!store?.snapshot().pending.some((p: PendingEdit) => p.id === item.Id && p.field === field && p.revision === revision)) { return; }
            if (favorite) { await client.favorite(item.Id, value); } else { await client.played(item.Id, value); }
          });
        });
      } catch (e) {
        if (!connectionFailure(e as Error)) {
          if (store === AppService.experience) { store?.update((next: ExperienceState) => {
            if (!next.pending.some((p: PendingEdit) => p.id === item.Id && p.field === field && p.revision === revision)) { return; }
            next.pending = next.pending.filter((p: PendingEdit) => p.id !== item.Id || p.field !== field); if (prior) { next.pending.push(prior); }
          }); }
          throw e as Error;
        }
        queued = true;
      }
    }
    if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
    if (!queued) { store?.update((next: ExperienceState) => { next.pending = next.pending.filter((p: PendingEdit) => p.id !== item.Id || p.field !== field || p.revision !== revision); }); }
    if (AppService.latestEdits.get(key) !== revision) { return true; }
    AppService.snapshot.items = [copy, ...AppService.snapshot.items.filter((i: MediaItem) => i.Id !== copy.Id)];
    AppService.snapshot.actors = rankActors(AppService.snapshot.items); local?.saveSnapshot(AppService.snapshot);
    if (local) { const sections = local.home(); sections.forEach((section) => { section.items = section.items.map((i: MediaItem) => i.Id === item.Id ? copy : i); }); local.saveHome(sections); }
    return queued;
  }

  static recordOfflinePosition(item: MediaItem, position: number, completed: boolean = false): void {
    const store = AppService.experience; const local = AppService.local; if (!store || !local || !Number.isFinite(position) || position < 0) { return; }
    const copy = JSON.parse(JSON.stringify(AppService.snapshot.items.find((i: MediaItem) => i.Id === item.Id) ?? item)) as MediaItem;
    copy.UserData = copy.UserData ?? {}; const ticks = completed ? 0 : Math.round(position * 10000); if (!Number.isSafeInteger(ticks)) { throw new Error('api_numeric_range'); }
    copy.UserData.PlaybackPositionTicks = ticks; copy.UserData.LastPlayedDate = new Date().toISOString();
    const revision = AppService.editRevision = Math.max(Date.now(), AppService.editRevision + 1);
    store.update((next: ExperienceState) => { next.positions = next.positions.filter((p: PendingPosition) => p.id !== item.Id); next.positions.push({ id: item.Id, ticks: ticks, revision: revision, item: copy }); next.syncAttempts = 0; next.syncNextAt = 0; next.syncBlocked = false; });
    AppService.snapshot.items = [copy, ...AppService.snapshot.items.filter((i: MediaItem) => i.Id !== item.Id)];
    AppService.snapshot.actors = rankActors(AppService.snapshot.items); local.saveSnapshot(AppService.snapshot);
    AppService.downloads.forEach((r: DownloadRecord) => { if (r.id === item.Id) { r.item = copy; } }); local.saveDownloads(AppService.downloads);
  }
  static async flushPending(): Promise<void> {
    const client = AppService.requireClient(); const store = AppService.experience; const local = AppService.local;
    if (!store || !local) { return; }
    if (store.snapshot().offline) { throw new Error('offline_mode_enabled'); }
    if (!AppLock.permit()) { throw new Error('lock_pin_wrong'); }
    store.update((next: ExperienceState) => { next.syncAttempts = 0; next.syncNextAt = 0; next.syncBlocked = false; });
    await AppService.mutation('sync/' + sessionKey(client.session), async () => {
      try {
        await local.transfer(async () => {
          await PendingSync.flush(client, store, async (): Promise<boolean> => client === AppService.client && store === AppService.experience &&
            !store.snapshot().offline && AppLock.permit());
        });
      } catch (e) { if (!connectionFailure(e as Error)) { throw e as Error; } }
    });
    PendingSync.wake();
  }

  static async deleteMedia(item: MediaItem): Promise<void> {
    if (item.Type !== 'Movie') { throw new Error('delete_not_allowed'); }
    const client = AppService.requireClient();
    // Permission can change after the page opens. Never authorize from a cached CanDelete flag.
    const latest = await client.detail(item.Id);
    if (client !== AppService.client) { throw new Error('login_required'); }
    if (latest.Id !== item.Id || latest.Type !== 'Movie' || latest.CanDelete !== true) { throw new Error('delete_not_allowed'); }
    await client.removeItem(item.Id);
    if (client !== AppService.client) { throw new Error('login_required'); }
    const snapshot = new LibrarySnapshot();
    snapshot.syncedAt = AppService.snapshot.syncedAt; snapshot.libraries = AppService.snapshot.libraries;
    snapshot.items = AppService.snapshot.items.filter((value: MediaItem) => value.Id !== item.Id);
    snapshot.memberships = AppService.snapshot.memberships.map((value: LibraryMembership): LibraryMembership =>
      ({ libraryId: value.libraryId, itemIds: value.itemIds.filter((id: string) => id !== item.Id) }));
    snapshot.actors = rankActors(snapshot.items); AppService.snapshot = snapshot;
    // Server deletion never removes local download files. Report a disk failure after the successful DELETE distinctly.
    if (snapshot.syncedAt) {
      try { AppService.local?.saveSnapshot(snapshot); }
      catch (e) { throw new Error('media_deleted_cache_failed'); }
    }
  }

  static async removeDownload(record: DownloadRecord): Promise<void> {
    const client = AppService.requireClient(); const local = AppService.local;
    if (!AppService.downloads.includes(record)) { throw new Error('login_required'); }
    if (record.agentId && !['complete', 'missing'].includes(record.state)) { await PersistentDownload.remove(record); }
    const task = AppService.tasks.get(downloadKey(record));
    if (task) {
      if (!await task.delete()) { throw new Error('cancel_download_failed'); }
      AppService.tasks.delete(downloadKey(record));
    }
    if (client !== AppService.client || local !== AppService.local || !AppService.downloads.includes(record)) { throw new Error('login_required'); }
    AppService.downloads = AppService.downloads.filter((item: DownloadRecord) => item !== record);
    OfflineSubtitles.remove(record);
    if (fs.accessSync(record.path)) { fs.unlinkSync(record.path); }
    AppService.local?.saveDownloads(AppService.downloads);
    AppService.downloadListener?.();
  }
}
