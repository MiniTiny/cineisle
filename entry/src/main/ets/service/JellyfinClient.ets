import util from '@ohos.util';
import { ItemsResult, MediaItem, PlaybackInfo, QueryParam, Session } from '../model/Models';
import { normalizeServer, playedRecommendations, secondsToTicks } from '../utils/Protocol';
import { NativeHttpTransport } from '../api/NativeHttpTransport';
import { JellyfinApi, getItemsFromQuery } from '../api/generated/JellyfinApi';
import { BaseItemKind, ImageType, ItemFields, MediaType, PlayMethod, RecommendationDto } from '../api/generated/Models';
import { itemPage, listItems, mediaItem, mediaItems, playbackInfo } from '../api/DomainMapping';

// Stable business facade. All application wire operations come from pinned OpenAPI.
export class JellyfinClient {
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

  private async discoverVersion(): Promise<void> {
    const info = await this.api.getPublicSystemInfo();
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

  // Low-level compatibility entry; application features use generated operations below.
  async request<T>(path: string, params: QueryParam[] = [], method: string = 'GET', body: string = ''): Promise<T> {
    return this.transport.request<T>(path, method, params, body);
  }

  static async login(server: string, name: string, password: string): Promise<JellyfinClient> {
    const session = new Session();
    session.server = normalizeServer(server);
    session.deviceId = util.generateRandomUUID();
    const client = new JellyfinClient(session);
    const info = await client.api.getPublicSystemInfo();
    client.useServerVersion(info?.Version ?? '');
    const result = await client.api.authenticateUserByName({ body: { Username: name.trim(), Pw: password } });
    if (typeof info?.Id !== 'string' || !info.Id || typeof result?.User?.Id !== 'string' || !result.User.Id ||
      typeof result.AccessToken !== 'string' || !result.AccessToken || /["\r\n]/.test(result.AccessToken) ||
      (result.User.Name != undefined && typeof result.User.Name !== 'string')) { throw new Error('login_response_invalid'); }
    session.serverId = info.Id; session.userId = result.User.Id; session.userName = result.User.Name ?? ''; session.token = result.AccessToken;
    return client;
  }

  async libraries(): Promise<MediaItem[]> {
    await this.ready();
    const result = await this.api.getUserViews({ userId: this.session.userId });
    return listItems(result);
  }

  async items(params: QueryParam[] = []): Promise<ItemsResult> {
    const options = getItemsFromQuery([
      { key: 'Fields', value: 'Overview,People,Genres,MediaSources' },
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

  async resume(): Promise<MediaItem[]> {
    await this.ready();
    const result = await this.api.getResumeItems({ userId: this.session.userId, limit: 20, mediaTypes: [MediaType.Video] });
    return listItems(result);
  }

  async latest(parentId: string = ''): Promise<MediaItem[]> {
    await this.ready();
    return mediaItems(await this.api.getLatestMedia({ userId: this.session.userId, parentId: parentId || undefined, limit: parentId ? 12 : 30, includeItemTypes: parentId ? undefined : [BaseItemKind.Movie, BaseItemKind.Series], enableUserData: true }));
  }

  async nextUp(seriesId: string = ''): Promise<MediaItem[]> {
    await this.ready();
    return listItems(await this.api.getNextUp({ userId: this.session.userId, seriesId: seriesId || undefined, limit: seriesId ? 1 : 9, enableUserData: true }));
  }

  async recommend(): Promise<MediaItem[]> {
    await this.ready();
    const candidates: MediaItem[] = [];
    try {
      const groups = await this.api.getMovieRecommendations({ userId: this.session.userId, categoryLimit: 5, itemLimit: 8, fields: [ItemFields.People] });
      if (!Array.isArray(groups)) { throw new Error('api_response_invalid'); }
      groups.forEach((group: RecommendationDto) => candidates.push(...mediaItems(group?.Items ?? [])));
    } catch (e) {
      // Recommendation plugins are optional; fallback still requires a successful media request.
      candidates.length = 0;
    }
    if (candidates.some((item: MediaItem) => item.UserData?.Played === true)) { return playedRecommendations(candidates, []); }
    const fallback = await this.items([{ key: 'IncludeItemTypes', value: 'Movie' }, { key: 'IsPlayed', value: 'true' },
      { key: 'SortBy', value: 'DatePlayed' }, { key: 'SortOrder', value: 'Descending' }, { key: 'Limit', value: '100' }]);
    return playedRecommendations([], fallback.Items ?? []);
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

  async playbackInfo(id: string): Promise<PlaybackInfo> {
    await this.ready();
    return playbackInfo(await this.api.getPlaybackInfo({ itemId: id, userId: this.session.userId }));
  }

  async episodePage(seriesId: string, start: number): Promise<ItemsResult> {
    await this.ready();
    return itemPage(await this.api.getEpisodes({ seriesId: seriesId, userId: this.session.userId, fields: [ItemFields.MediaSources], isMissing: false, startIndex: start, limit: 200 }));
  }

  async subtitle(id: string, sourceId: string, index: number): Promise<string> {
    if (!Number.isSafeInteger(index) || index < 0) { throw new Error('subtitle_failed'); }
    await this.ready();
    return this.api.getSubtitle({ routeItemId: id, routeMediaSourceId: sourceId, routeIndex: index, routeFormat: 'srt', startPositionTicks: 0 });
  }

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
