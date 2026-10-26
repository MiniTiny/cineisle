import { DiscoveryRules } from '../utils/DiscoveryRules';
import { TrickplayTransport } from '../api/TrickplayTransport';
import { BifTransfer } from '../utils/Bif';
import { IntroTransport } from '../api/IntroTransport';
import { IntroTicket } from '../utils/Intro';
import util from '@ohos.util';
import { ItemsResult, MediaItem, PlaybackInfo, QueryParam, Session } from '../model/Models';
import { addresses } from '../utils/Accounts';
import { deviceNameValue } from '../utils/DeviceOptions';
import { normalizeServer, secondsToTicks } from '../utils/Protocol';
import { RewatchRecommendations } from './RewatchRecommendations';
import { HomeFeedRequests, NextUpRequests, EpisodeQueueRequests } from '../utils/FeedRequests';
import { NativeHttpTransport } from '../api/NativeHttpTransport';
import { PosterTransport } from '../api/PosterTransport';
import { PosterTarget, PosterTransfer } from '../utils/PosterOptions';
import { ApiTransport, JellyfinApi, getItemsFromQuery } from '../api/generated/JellyfinApi';
import { BaseItemKind, ImageType, ItemFields, MediaType, PlayMethod, RecommendationDto, AuthenticationResult, PublicSystemInfo, QuickConnectResult } from '../api/generated/Models';
import { itemPage, listItems, mediaItem, mediaItems, playbackInfo } from '../api/DomainMapping';

export interface PublicUser { id: string; name: string }

// Core wire operations use pinned OpenAPI; optional plugin adapters keep their own explicit contracts.
export class JellyfinClient {
  private static readonly maximumPublicUsers: number = 1000;
  private static readonly maximumPublicNameCodeUnits: number = 256;
  private static readonly maximumDeviceResponseNameCodeUnits: number = 1024;
  session: Session;
  private transport: NativeHttpTransport;
  private api: JellyfinApi;
  private versionResolved: boolean = false;
  private versionRequest?: Promise<void>;
  constructor(session: Session, serverVersion: string = '') {
    this.session = session;
    this.transport = new NativeHttpTransport(session);
    this.api = new JellyfinApi(this.transport);
    if (serverVersion) { this.useServerVersion(serverVersion); }
  }

  private useServerVersion(version: string): void {
    this.api.setServerVersion(version);
    this.versionResolved = true;
  }

  onEndpointChange(listener: (address: string) => void): void { this.transport.endpointChanged = listener; }
  static async inspectServer(server: string, transport?: ApiTransport): Promise<PublicSystemInfo> {
    const session = new Session(); session.server = normalizeServer(server); session.deviceId = util.generateRandomUUID();
    const info = transport ? await new JellyfinApi(transport).getPublicSystemInfo() : await new JellyfinClient(session).api.getPublicSystemInfo();
    if (typeof info?.Id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(info.Id) || typeof info.Version !== 'string' || (info.ServerName != null && typeof info.ServerName !== 'string')) { throw new Error('login_response_invalid'); }
    return info;
  }
  private async discoverVersion(): Promise<void> {
    const info = await this.api.getPublicSystemInfo();
    if (info?.Id !== this.session.serverId) { throw new Error('server_identity_mismatch'); }
    this.useServerVersion(info?.Version ?? '');
  }

  // Restored sessions also negotiate once per client. Concurrent home requests share the probe.
  private async ready(): Promise<void> {
    if (this.versionResolved) { return; }
    if (!this.versionRequest) { this.versionRequest = this.discoverVersion(); }
    const request = this.versionRequest;
    try { await request; }
    catch (e) { if (this.versionRequest === request) { this.versionRequest = undefined; } throw e as Error; }
  }

  private deviceAdmission(id: string, permit: () => boolean): void {
    if (!id || id !== this.session.deviceId || !permit()) { throw new Error('device_name_cancelled'); }
  }
  async deviceName(permit: () => boolean): Promise<string> {
    const id = this.session.deviceId; await this.ready(); this.deviceAdmission(id, permit);
    const value = await this.api.getDeviceOptions({ id: id });
    if (!value || typeof value !== 'object' || Array.isArray(value) || (value.DeviceId != null && value.DeviceId !== id) ||
      (value.CustomName != null && (typeof value.CustomName !== 'string' || value.CustomName.length > JellyfinClient.maximumDeviceResponseNameCodeUnits || /[\u0000-\u001f\u007f]/.test(value.CustomName)))) { throw new Error('api_response_invalid'); }
    return value.CustomName ?? '';
  }
  async updateDeviceName(name: string, permit: () => boolean): Promise<void> {
    const value = deviceNameValue(name); const id = this.session.deviceId;
    await this.ready(); this.deviceAdmission(id, permit);
    await this.api.updateDeviceOptions({ id: id, body: { CustomName: value } });
  }

  // Low-level compatibility entry; application features use generated operations below.
  async request<T>(path: string, params: QueryParam[] = [], method: string = 'GET', body: string = ''): Promise<T> {
    return this.transport.request<T>(path, method, params, body);
  }

  static async login(server: string, name: string, password: string, expectedServerId: string = '', candidates: string[] = [], allowed: () => boolean = () => true): Promise<JellyfinClient> {
    const session = new Session();
    session.server = normalizeServer(server); session.serverId = expectedServerId; session.addresses = addresses(Array.from(new Set([session.server, ...candidates])));
    session.deviceId = util.generateRandomUUID();
    const client = new JellyfinClient(session);
    const info = await client.api.getPublicSystemInfo();
    client.useServerVersion(info?.Version ?? '');
    if (expectedServerId && info?.Id !== expectedServerId) { throw new Error('server_identity_mismatch'); }
    if (!allowed()) { throw new Error('account_cancelled'); }
    const result = await client.api.authenticateUserByName({ body: { Username: name.trim(), Pw: password } });
    client.acceptAuthentication(info, result);
    return client;
  }

  acceptAuthentication(info: PublicSystemInfo, result: AuthenticationResult): void {
    if (typeof info?.Id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(info.Id) || typeof result?.User?.Id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(result.User.Id) ||
      typeof result.AccessToken !== 'string' || !result.AccessToken || /["\r\n]/.test(result.AccessToken) || (result.ServerId != null && result.ServerId !== info.Id) ||
      (result.User.Name != null && typeof result.User.Name !== 'string')) { throw new Error('login_response_invalid'); }
    this.session.serverId = info.Id; this.session.userId = result.User.Id; this.session.userName = result.User.Name ?? '';
    this.session.token = result.AccessToken; this.session.serverName = info.ServerName ?? ''; this.session.addresses = [this.session.server];
  }
  static async quickClient(server: string, expectedServerId: string = '', candidates: string[] = []): Promise<JellyfinClient> {
    const session = new Session(); session.server = normalizeServer(server); session.serverId = expectedServerId; session.addresses = addresses(Array.from(new Set([session.server, ...candidates]))); session.deviceId = util.generateRandomUUID(); const client = new JellyfinClient(session);
    const info = await client.api.getPublicSystemInfo();
    if (typeof info?.Id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(info.Id)) { throw new Error('login_response_invalid'); }
    if (expectedServerId && info.Id !== expectedServerId) { throw new Error('server_identity_mismatch'); }
    client.useServerVersion(info.Version ?? ''); client.session.serverId = info.Id; client.session.serverName = info.ServerName ?? ''; return client;
  }
  async quickEnabled(): Promise<boolean> { const enabled = await this.api.getQuickConnectEnabled(); if (typeof enabled !== 'boolean') { throw new Error('api_response_invalid'); } return enabled; }
  async publicUsers(): Promise<PublicUser[]> {
    if (this.session.token) { throw new Error('api_session_invalid'); }
    const users = await this.api.getPublicUsers();
    if (!Array.isArray(users) || users.length > JellyfinClient.maximumPublicUsers) { throw new Error('public_users_invalid'); }
    const result: PublicUser[] = [];
    for (const user of users) {
      if (typeof user?.Id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(user.Id) || typeof user.Name !== 'string' ||
        !user.Name.trim() || user.Name.length > JellyfinClient.maximumPublicNameCodeUnits || (user.ServerId != null && user.ServerId !== this.session.serverId)) { throw new Error('public_users_invalid'); }
      if (!result.some((value: PublicUser) => value.id === user.Id)) { result.push({ id: user.Id, name: user.Name }); }
    }
    return result;
  }
  async quickInitiate(): Promise<QuickConnectResult> { return this.api.initiateQuickConnect(); }
  async quickState(secret: string): Promise<QuickConnectResult> { return this.api.getQuickConnectState({ secret: secret }); }
  async quickAuthenticate(secret: string): Promise<void> {
    const result = await this.api.authenticateWithQuickConnect({ body: { Secret: secret } });
    this.acceptAuthentication({ Id: this.session.serverId, ServerName: this.session.serverName }, result);
  }
  async validateAccount(): Promise<void> {
    await this.ready(); const user = await this.api.getCurrentUser(); if (user?.Id !== this.session.userId || (user.Name != null && typeof user.Name !== 'string')) { throw new Error('login_response_invalid'); }
    this.session.userName = user.Name ?? this.session.userName;
  }

  trickplay(id: string, allowed: () => boolean): BifTransfer { return new TrickplayTransport(this.session).fetch(id, allowed); }
  intro(id: string, allowed: () => boolean): IntroTicket { return new IntroTransport(this.session).fetch(id, allowed); }

  async autoNextEnabled(): Promise<boolean> {
    await this.ready(); const user = await this.api.getCurrentUser();
    if (user?.Id !== this.session.userId) { throw new Error('login_response_invalid'); }
    if (user.Configuration != null && (typeof user.Configuration !== 'object' || Array.isArray(user.Configuration))) { throw new Error('api_response_invalid'); }
    const enabled = user.Configuration?.EnableNextEpisodeAutoPlay;
    if (enabled !== undefined && typeof enabled !== 'boolean') { throw new Error('api_response_invalid'); }
    return enabled !== false;
  }

  async discoveryCandidates(limit: number = DiscoveryRules.candidateLimit): Promise<MediaItem[]> {
    return (await this.items([{ key: 'IncludeItemTypes', value: 'Movie,Series' }, { key: 'Filters', value: 'IsUnplayed' },
      { key: 'Limit', value: String(limit) }, { key: 'SortBy', value: 'DateCreated' }, { key: 'SortOrder', value: 'Descending' }])).Items;
  }

  async libraries(): Promise<MediaItem[]> {
    await this.ready();
    const result = await this.api.getUserViews({ userId: this.session.userId });
    return listItems(result);
  }

  async items(params: QueryParam[] = []): Promise<ItemsResult> {
    const options = getItemsFromQuery([
      { key: 'Fields', value: 'Overview,People,Genres,MediaSources,SortName,DateCreated' },
      { key: 'Recursive', value: 'true' },
      { key: 'EnableUserData', value: 'true' }, ...params
    ]);
    options.userId = this.session.userId;
    await this.ready();
    return itemPage(await this.api.getItems(options));
  }

  async detail(id: string): Promise<MediaItem> {
    await this.ready();
    return mediaItem(await this.api.getItem({ itemId: id, userId: this.session.userId }));
  }

  async resume(limit: number = HomeFeedRequests.resumeLimit): Promise<MediaItem[]> {
    await this.ready();
    const result = await this.api.getResumeItems({ userId: this.session.userId, limit: limit, mediaTypes: [MediaType.Video] });
    return listItems(result);
  }

  async latest(parentId: string = '', limit: number = HomeFeedRequests.latestLimit(parentId)): Promise<MediaItem[]> {
    await this.ready();
    return mediaItems(await this.api.getLatestMedia({ userId: this.session.userId, parentId: parentId || undefined, limit: limit, includeItemTypes: parentId ? undefined : [BaseItemKind.Movie, BaseItemKind.Series], enableUserData: true }));
  }

  async nextUp(seriesId: string = '', limit: number = NextUpRequests.limit(seriesId)): Promise<MediaItem[]> {
    await this.ready();
    return listItems(await this.api.getNextUp({ userId: this.session.userId, seriesId: seriesId || undefined, limit: limit, enableUserData: true }));
  }

  async recommend(): Promise<MediaItem[]> {
    await this.ready();
    return RewatchRecommendations.load({
      recommendations: async (categoryLimit: number, itemLimit: number): Promise<MediaItem[]> => {
        const groups = await this.api.getMovieRecommendations({ userId: this.session.userId, categoryLimit: categoryLimit, itemLimit: itemLimit, fields: [ItemFields.People] });
        if (!Array.isArray(groups)) { throw new Error('api_response_invalid'); }
        const candidates: MediaItem[] = [];
        groups.forEach((group: RecommendationDto) => candidates.push(...mediaItems(group?.Items ?? [])));
        return candidates;
      },
      watchedMovies: async (limit: number): Promise<MediaItem[]> => {
        const fallback = await this.items([{ key: 'IncludeItemTypes', value: 'Movie' }, { key: 'IsPlayed', value: 'true' },
          { key: 'SortBy', value: 'DatePlayed' }, { key: 'SortOrder', value: 'Descending' }, { key: 'Limit', value: String(limit) }]);
        return fallback.Items ?? [];
      }
    });
  }

  async children(item: MediaItem): Promise<MediaItem[]> {
    await this.ready();
    const result = item.Type === 'Series'
      ? await this.api.getSeasons({ seriesId: item.Id, userId: this.session.userId })
      : await this.api.getEpisodes({ seriesId: item.SeriesId ?? '', userId: this.session.userId, seasonId: item.Type === 'Season' ? item.Id : undefined });
    return listItems(result);
  }

  async favorite(id: string, enabled: boolean): Promise<void> {
    await this.ready();
    if (enabled) { await this.api.markFavoriteItem({ itemId: id, userId: this.session.userId }); }
    else { await this.api.unmarkFavoriteItem({ itemId: id, userId: this.session.userId }); }
  }

  async played(id: string, enabled: boolean): Promise<void> {
    await this.ready();
    if (enabled) { await this.api.markPlayedItem({ itemId: id, userId: this.session.userId }); }
    else { await this.api.markUnplayedItem({ itemId: id, userId: this.session.userId }); }
  }

  async removeItem(id: string): Promise<void> {
    await this.ready();
    return this.api.deleteItem({ itemId: id });
  }

  image(id: string, tag: string = '', backdrop: boolean = false): string {
    if (backdrop) {
      return this.api.getItemImageByIndexUrl({ itemId: id, imageType: ImageType.Backdrop, imageIndex: 0, maxWidth: 960, quality: 85, tag: tag || undefined });
    }
    return this.api.getItemImageUrl({ itemId: id, imageType: ImageType.Primary, maxWidth: 360, quality: 85, tag: tag || undefined });
  }

  poster(target: PosterTarget, allowed: () => boolean): PosterTransfer { return new PosterTransport(this.session).fetch(target, allowed); }

  async playbackInfo(id: string): Promise<PlaybackInfo> {
    await this.ready();
    return playbackInfo(await this.api.getPlaybackInfo({ itemId: id, userId: this.session.userId }));
  }

  async episodePage(seriesId: string, start: number): Promise<ItemsResult> {
    await this.ready();
    return itemPage(await this.api.getEpisodes({ seriesId: seriesId, userId: this.session.userId, fields: [ItemFields.MediaSources], isMissing: false, startIndex: start, limit: EpisodeQueueRequests.pageItems }));
  }

  async subtitle(id: string, sourceId: string, index: number, transfer?: ApiTransport, format: string = 'srt'): Promise<string> {
    if (!Number.isSafeInteger(index) || index < 0 || !['srt', 'ass'].includes(format)) { throw new Error('subtitle_failed'); }
    await this.ready();
    const api = transfer ? new JellyfinApi(transfer) : this.api;
    return api.getSubtitle({ routeItemId: id, routeMediaSourceId: sourceId, routeIndex: index, routeFormat: format, startPositionTicks: 0 });
  }

  subtitleTransport(): ApiTransport { return this.transport; }

  stream(id: string, sourceId: string): string {
    return this.api.getVideoStreamUrl({ itemId: id, static: true, mediaSourceId: sourceId, deviceId: this.session.deviceId });
  }

  async offlinePosition(id: string, ticks: number): Promise<void> {
    if (!Number.isSafeInteger(ticks) || ticks < 0) { throw new Error('api_numeric_range'); }
    await this.ready(); return this.api.reportPlaybackStopped({ body: { ItemId: id, PositionTicks: ticks } });
  }

  async report(event: string, id: string, sourceId: string, playSessionId: string, seconds: number, paused: boolean): Promise<void> {
    const position = secondsToTicks(seconds);
    if (!Number.isSafeInteger(position)) { throw new Error('api_numeric_range'); }
    if (event !== '' && event !== 'Progress' && event !== 'Stopped') { throw new Error('api_parameter_invalid'); }
    await this.ready();
    switch (event) {
      case '':
        return this.api.reportPlaybackStart({ body: { ItemId: id, MediaSourceId: sourceId, PlaySessionId: playSessionId, PositionTicks: position, IsPaused: paused, CanSeek: true, PlayMethod: PlayMethod.DirectPlay } });
      case 'Progress':
        return this.api.reportPlaybackProgress({ body: { ItemId: id, MediaSourceId: sourceId, PlaySessionId: playSessionId, PositionTicks: position, IsPaused: paused, CanSeek: true, PlayMethod: PlayMethod.DirectPlay } });
      case 'Stopped':
        return this.api.reportPlaybackStopped({ body: { ItemId: id, MediaSourceId: sourceId, PlaySessionId: playSessionId, PositionTicks: position } });
      default: throw new Error('api_parameter_invalid');
    }
  }
}
