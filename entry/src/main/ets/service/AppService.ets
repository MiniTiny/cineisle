import background from '@ohos.resourceschedule.backgroundTaskManager';
import { BackgroundLease } from './BackgroundLease';
import common from '@ohos.app.ability.common';
import request from '@ohos.request';
import fs from '@ohos.file.fs';
import fileUri from '@ohos.file.fileuri';
import { DownloadRecord, ItemsResult, LibraryMembership, LibrarySnapshot, MediaItem, MediaSource, PlaybackRoute, QueryParam } from '../model/Models';
import { rankActors, safeItemId, uniqueItems } from '../utils/Protocol';
import { JellyfinClient } from './JellyfinClient';
import { AppLock } from './AppLock';
import { PersistentDownload } from './PersistentDownload';
import { SessionStore } from './SessionStore';
import { LocalStore } from './LocalStore';
import { initializeStrings, text } from '../utils/Strings';
import { validMediaItem } from '../utils/Cache';
import { followingEpisode } from '../utils/Playback';
import { firstEpisode } from '../utils/DetailPresentation';

import { PlaybackPreferenceStore } from './PlaybackPreferenceStore';
import { ExperienceStore } from './ExperienceStore';
import { ExperienceState, PendingEdit, PendingPosition, applyPending, connectionFailure, uniqueWorks } from '../utils/Experience';

export class AppService {
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
    try { await AppService.playbackPreferences.load(context); } catch (e) { /* Settings errors do not prevent login/browsing. */ }
    await AppLock.initialize();
    const session = await SessionStore.load();
    if (session) { AppService.useClient(new JellyfinClient(session)); await AppService.restoreDownloads(); await AppService.pumpDownloads(); }
    AppService.initialized = true;
  }

  private static useClient(client: JellyfinClient): void {
    const local = new LocalStore(AppService.context, client.session);
    const snapshot = local.snapshot();
    const records = local.downloads();
    // Basic download migration does not claim process-death resume. Retain completed media only as playable.
    records.forEach((record: DownloadRecord) => {
      if (record.state === 'downloading' && !record.agentId) { record.state = 'interrupted'; }
      if (record.state === 'complete' && !fs.accessSync(record.path)) { record.state = 'missing'; }
    });
    local.saveDownloads(records);
    AppService.local = local; AppService.snapshot = snapshot; AppService.downloads = records; AppService.client = client;
    AppService.experience = new ExperienceStore(local);
    const edits = AppService.experience.snapshot().pending;
    const extra = [...edits.map((p: PendingEdit) => p.item), ...AppService.experience.snapshot().positions.map((p: PendingPosition) => p.item)].filter((i: MediaItem | undefined) => !!i && validMediaItem(i) && !snapshot.items.some((v: MediaItem) => v.Id === i.Id)) as MediaItem[];
    AppService.snapshot.items = applyPending(uniqueWorks([...snapshot.items, ...extra]), edits);
    const positions = AppService.experience.snapshot().positions;
    AppService.snapshot.items.forEach((i: MediaItem) => { const position = positions.find((p: PendingPosition) => p.id === i.Id); if (position) { i.UserData = i.UserData ?? {}; i.UserData.PlaybackPositionTicks = position.ticks; } });
    AppService.cacheRecovered = local.recovered;
  }

  static async login(server: string, name: string, password: string): Promise<void> {
    const client = await JellyfinClient.login(server, name, password);
    await SessionStore.save(client.session);
    AppService.useClient(client); await AppService.restoreDownloads(); await AppService.pumpDownloads();
  }

  static async logout(): Promise<void> {
    if (AppService.syncing || AppService.tasks.size > 0 || AppService.downloads.some((r: DownloadRecord) => ['downloading', 'queued'].includes(r.state))) { throw new Error('tasks_active'); }
    await SessionStore.clear();
    AppService.client = undefined; AppService.local = undefined;
    AppService.experience = undefined;
    AppService.snapshot = new LibrarySnapshot(); AppService.downloads = [];
    AppService.cacheRecovered = false;
  }

  static requireClient(): JellyfinClient {
    if (!AppService.client) { throw new Error('login_required'); }
    return AppService.client;
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
    offlineOnly = offlineOnly || (AppService.experience?.snapshot().offline ?? false);
    const route = new PlaybackRoute(); route.item = item;
    const record = AppService.downloads.find((record: DownloadRecord) => record.id === item.Id && record.state === 'complete');
    if (!sourceId && record && fs.accessSync(record.path)) {
      route.url = fileUri.getUriFromPath(record.path); route.filePath = record.path; route.offline = true; return route;
    }
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

  static async detailPlayback(item: MediaItem, sourceId: string = '', offline: boolean = false, restart: boolean = false): Promise<PlaybackRoute> {
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
    const result = await AppService.playback(target, sourceId, offline);
    if (client !== AppService.client) { throw new Error('login_required'); }
    if (restart) {
      const current = JSON.parse(JSON.stringify(result.item)) as MediaItem;
      if (!current.UserData) { current.UserData = {}; }
      current.UserData.PlaybackPositionTicks = 0; result.item = current;
    }
    return result;
  }

  static async nextPlayback(route: PlaybackRoute): Promise<PlaybackRoute | undefined> {
    const item = route.item;
    if (item.Type !== 'Episode' || !item.SeriesId) { return undefined; }
    const client = AppService.client;
    const episodes = route.offline ? AppService.snapshot.items : await AppService.seriesEpisodes(item.SeriesId);
    const next = followingEpisode(item, episodes);
    if (!next) { return undefined; }
    const result = await AppService.playback(next, '', route.offline);
    if (!route.offline && client !== AppService.client) { throw new Error('login_required'); }
    return result;
  }

  static async download(item: MediaItem, sourceId: string = ''): Promise<void> {
    const client = AppService.requireClient(); const local = AppService.local!;
    if (AppService.downloads.some((record: DownloadRecord) => record.id === item.Id)) { throw new Error('download_exists'); }
    if (item.CanDownload !== true) { throw new Error('download_not_allowed'); }
    const info = await client.playbackInfo(item.Id);
    if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
    const preference = AppService.experience?.snapshot();
    const preferred = !sourceId && preference?.rememberDownloadSource ? preference.sourcePreference : '';
    const source = sourceId ? info.MediaSources?.find((value: MediaSource) => value.Id === sourceId) :
      info.MediaSources?.find((value: MediaSource) => preferred && (value.Name || value.Container || '') === preferred) ?? info.MediaSources?.[0];
    if (!source) { throw new Error('no_download_source'); }
    const record = new DownloadRecord(); record.id = item.Id; record.item = item; record.mediaSourceId = source.Id;
    const extension = /^[a-zA-Z0-9]+$/.test(source.Container ?? '') ? source.Container : 'media';
    record.path = `${local.directory}/${safeItemId(item.Id)}.${extension}`;
    if (PersistentDownload.available()) {
      const owned = (): boolean => client === AppService.client && local === AppService.local && AppService.downloads.includes(record);
      AppService.downloads.push(record);
      const save = (): void => { if (owned()) { local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); if (record.state !== 'downloading') { AppService.pumpDownloads(); } } };
      try { await PersistentDownload.create(AppService.context, record, client.stream(item.Id, source.Id), owned, save); }
      catch (e) { AppService.downloads = AppService.downloads.filter((r: DownloadRecord) => r !== record); if (client === AppService.client) { local.saveDownloads(AppService.downloads); } throw e as Error; }
      if (preference?.rememberDownloadSource) { AppService.experience?.update((next: ExperienceState) => { next.sourcePreference = source.Name || source.Container || ''; }); }
      return;
    }
    const task = await request.downloadFile(AppService.context, { url: client.stream(item.Id, source.Id),
      filePath: record.path, enableMetered: false, enableRoaming: false });
    if (client !== AppService.client || local !== AppService.local || AppService.downloads.some((value: DownloadRecord) => value.id === record.id)) {
      if (!await task.delete()) { throw new Error('cancel_download_failed'); }
      throw new Error(client !== AppService.client ? 'login_required' : 'download_exists');
    }
    const records = [...AppService.downloads, record];
    try { local.saveDownloads(records); } catch (e) { await task.delete(); throw new Error('download_create_failed'); }
    AppService.tasks.set(record.id, task); AppService.downloads = records;
    if (preference?.rememberDownloadSource) {
      AppService.experience?.update((next: ExperienceState) => { next.sourcePreference = source.Name || source.Container || ''; });
    }
    const owned = (): boolean => client === AppService.client && local === AppService.local && AppService.tasks.get(record.id) === task;
    task.on('progress', (received: number, total: number) => {
      if (!owned()) { return; }
      record.progress = Number.isFinite(received) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(1, received / total)) : 0;
      record.received = Number.isSafeInteger(received) ? Math.max(0, received) : 0; record.total = Number.isSafeInteger(total) ? Math.max(0, total) : 0;
      AppService.downloadListener?.();
    });
    task.on('complete', () => {
      if (!owned()) { return; }
      record.state = 'complete'; record.progress = 1; AppService.tasks.delete(record.id);
      local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); AppService.pumpDownloads();
    });
    task.on('fail', (reason: number) => {
      if (!owned()) { return; }
      record.state = 'failed'; record.failure = text('download_failure_reason', Number.isFinite(reason) ? reason : 0); AppService.tasks.delete(record.id);
      local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); AppService.pumpDownloads();
    });
    AppService.downloadListener?.();
  }

  static async retryDownload(record: DownloadRecord): Promise<void> {
    if (!['failed', 'interrupted', 'missing'].includes(record.state)) { throw new Error('download_exists'); }
    const item = record.item; const source = record.mediaSourceId ?? '';
    const client = AppService.requireClient();
    const latest = await client.detail(item.Id);
    if (client !== AppService.client || !AppService.downloads.includes(record)) { throw new Error('login_required'); }
    await AppService.removeDownload(record);
    try { await AppService.download(latest, latest.MediaSources?.some((s: MediaSource) => s.Id === source) ? source : ''); }
    catch (e) {
      // Preserve a retryable record if task creation or a removed source fails.
      if (client === AppService.client && !AppService.downloads.some((r: DownloadRecord) => r.id === record.id)) {
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
      const task = AppService.tasks.get(record.id); if (!task) { continue; }
      try {
        const info = await task.getTaskInfo();
        if (client !== AppService.client || local !== AppService.local || AppService.tasks.get(record.id) !== task) { return; }
        record.taskId = info.downloadId; record.received = info.downloadedBytes; record.total = info.downloadTotalBytes;
        record.progress = info.downloadTotalBytes > 0 ? Math.max(0, Math.min(1, info.downloadedBytes / info.downloadTotalBytes)) : 0;
        if (info.status === request.SESSION_SUCCESSFUL && fs.accessSync(record.path)) { record.state = 'complete'; record.progress = 1; AppService.tasks.delete(record.id); }
        if (info.status === request.SESSION_FAILED) { record.state = 'failed'; record.failure = text('download_failure_reason', info.failedReason); AppService.tasks.delete(record.id); }
        local?.saveDownloads(AppService.downloads); AppService.downloadListener?.();
      } catch (e) { /* The event stream remains authoritative when a query is unavailable. */ }
    }
    } finally { AppService.polling = false; }
  }

  static async batchDownload(items: MediaItem[], sourceId: string = ''): Promise<string[]> {
    const client = AppService.requireClient(); const local = AppService.local!; const failed: string[] = []; const queued: DownloadRecord[] = [];
    for (const item of uniqueWorks(items)) {
      if (client !== AppService.client) { throw new Error('login_required'); }
      if (AppService.downloads.some((r: DownloadRecord) => r.id === item.Id)) { continue; }
      if (item.CanDownload !== true || !validMediaItem(item)) { failed.push(item.Id); continue; }
      const record = new DownloadRecord(); record.id = item.Id; record.item = item; record.state = 'queued'; record.mediaSourceId = sourceId;
      record.path = `${local.directory}/${safeItemId(item.Id)}.media`; queued.push(record);
    }
    const records = [...AppService.downloads, ...queued]; local.saveDownloads(records); AppService.downloads = records; AppService.downloadListener?.(); await AppService.pumpDownloads();
    const chosen = new Set(items.map((i: MediaItem) => i.Id));
    AppService.downloads.filter((r: DownloadRecord) => chosen.has(r.id) && r.state === 'failed').forEach((r: DownloadRecord) => { if (!failed.includes(r.id)) { failed.push(r.id); } });
    return failed;
  }
  private static async pumpDownloads(): Promise<void> {
    if (AppService.pumping || !AppService.client) { return; } AppService.pumping = true;
    const client = AppService.client; const local = AppService.local;
    try {
      while (client === AppService.client && AppService.downloads.filter((r: DownloadRecord) => r.state === 'downloading').length < 4) {
        const record = AppService.downloads.find((r: DownloadRecord) => r.state === 'queued'); if (!record) { return; }
        try {
          const latest = await client.detail(record.id);
          if (client !== AppService.client || local !== AppService.local) { return; }
          if (!AppService.downloads.includes(record)) { continue; }
          AppService.downloads = AppService.downloads.filter((r: DownloadRecord) => r !== record);
          await AppService.download(latest, record.mediaSourceId ?? '');
        } catch (e) {
          if (client !== AppService.client || local !== AppService.local) { return; }
          record.state = 'failed'; record.failure = (e as Error).message;
          if (!AppService.downloads.some((r: DownloadRecord) => r.id === record.id)) { AppService.downloads.push(record); }
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
    store?.update((next: ExperienceState) => { next.pending = next.pending.filter((p: PendingEdit) => p.id !== item.Id || p.field !== field); next.pending.push({ id: item.Id, field: field, value: value, revision: revision, item: copy }); });
    let queued = offline;
    if (!offline) {
      try {
        await AppService.mutation(key, async () => {
          if (client !== AppService.client || local !== AppService.local) { throw new Error('login_required'); }
          if (favorite) { await client.favorite(item.Id, value); } else { await client.played(item.Id, value); }
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
    store.update((next: ExperienceState) => { next.positions = next.positions.filter((p: PendingPosition) => p.id !== item.Id); next.positions.push({ id: item.Id, ticks: ticks, revision: revision, item: copy }); });
    AppService.snapshot.items = [copy, ...AppService.snapshot.items.filter((i: MediaItem) => i.Id !== item.Id)];
    AppService.snapshot.actors = rankActors(AppService.snapshot.items); local.saveSnapshot(AppService.snapshot);
    AppService.downloads.forEach((r: DownloadRecord) => { if (r.id === item.Id) { r.item = copy; } }); local.saveDownloads(AppService.downloads);
  }
  static async flushPending(): Promise<void> {
    const client = AppService.requireClient(); const store = AppService.experience; if (!store) { return; }
    for (const position of store.snapshot().positions) {
      try { await client.offlinePosition(position.id, position.ticks); }
      catch (e) { if (connectionFailure(e as Error)) { return; } throw e as Error; }
      if (client !== AppService.client || store !== AppService.experience) { throw new Error('login_required'); }
      store.update((next: ExperienceState) => { next.positions = next.positions.filter((p: PendingPosition) => p.id !== position.id || p.revision !== position.revision); });
    }
    for (const edit of store.snapshot().pending) {
      try {
        await AppService.mutation(AppService.mutationKey(client, edit.id, edit.field), async () => {
          if (client !== AppService.client || store !== AppService.experience) { throw new Error('login_required'); }
          if (edit.field === 'favorite') { await client.favorite(edit.id, edit.value); } else { await client.played(edit.id, edit.value); }
        });
      } catch (e) { if (connectionFailure(e as Error)) { return; } throw e as Error; }
      if (client !== AppService.client || store !== AppService.experience) { throw new Error('login_required'); }
      store.update((next: ExperienceState) => { next.pending = next.pending.filter((p: PendingEdit) => p.id !== edit.id || p.field !== edit.field || p.revision !== edit.revision || p.value !== edit.value); });
    }
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
    if (record.agentId && !['complete', 'missing'].includes(record.state)) { await PersistentDownload.remove(record); }
    const task = AppService.tasks.get(record.id);
    if (task) {
      if (!await task.delete()) { throw new Error('cancel_download_failed'); }
      AppService.tasks.delete(record.id);
    }
    AppService.downloads = AppService.downloads.filter((item: DownloadRecord) => item.id !== record.id);
    if (fs.accessSync(record.path)) { fs.unlinkSync(record.path); }
    AppService.local?.saveDownloads(AppService.downloads);
    AppService.downloadListener?.();
  }
}
