import { ActorSummary, DownloadRecord, LibrarySnapshot, MediaItem, MediaLink, MediaSource, MediaStream, Person } from '../model/Models';

function validPerson(person: Person): boolean {
  return !!person && typeof person === 'object' && typeof person.Id === 'string' &&
    typeof person.Name === 'string' && (person.Type == undefined || typeof person.Type === 'string') &&
    (person.Role == undefined || typeof person.Role === 'string');
}

export function validStream(stream: MediaStream): boolean {
  if (!stream || typeof stream.Type !== 'string' || !Number.isSafeInteger(stream.Index) || stream.Index < 0) { return false; }
  const strings: Array<string | undefined> = [stream.Codec, stream.Language, stream.DisplayTitle, stream.ChannelLayout,
    stream.VideoRange, stream.VideoRangeType, stream.VideoDoViTitle, stream.AudioSpatialFormat];
  const numbers: Array<number | undefined> = [stream.Width, stream.Height, stream.Channels, stream.BitDepth, stream.BitRate, stream.DvProfile];
  return strings.every((v: string | undefined) => v == undefined || typeof v === 'string') &&
    numbers.every((v: number | undefined) => v == undefined || Number.isFinite(v)) &&
    (stream.IsExternal == undefined || typeof stream.IsExternal === 'boolean') && (stream.IsTextSubtitle == undefined || typeof stream.IsTextSubtitle === 'boolean');
}

export function validMediaSource(source: MediaSource): boolean {
  return !!source && typeof source.Id === 'string' && !!source.Id &&
    (source.Name == undefined || typeof source.Name === 'string') && (source.Container == undefined || typeof source.Container === 'string') &&
    (source.Size == undefined || Number.isFinite(source.Size)) &&
    (source.MediaStreams == undefined || (Array.isArray(source.MediaStreams) && source.MediaStreams.every(validStream)));
}

export function validMediaItem(item: MediaItem): boolean {
  if (!item || typeof item !== 'object' || typeof item.Id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(item.Id) ||
    typeof item.Name !== 'string' || typeof item.Type !== 'string') { return false; }
  // Optional Jellyfin fields can be absent or null; consumers already use nullish fallbacks.
  if (item.People != undefined && (!Array.isArray(item.People) || !item.People.every(validPerson))) { return false; }
  if (item.CommunityRating != undefined && !Number.isFinite(item.CommunityRating)) { return false; }
  if (item.RunTimeTicks != undefined && !Number.isFinite(item.RunTimeTicks)) { return false; }
  if (item.CollectionType != undefined && typeof item.CollectionType !== 'string') { return false; }
  if (item.SeriesId != undefined && typeof item.SeriesId !== 'string') { return false; }
  if (item.SeasonId != undefined && typeof item.SeasonId !== 'string') { return false; }
  if (item.IndexNumber != undefined && (!Number.isSafeInteger(item.IndexNumber) || item.IndexNumber < 0)) { return false; }
  if (item.ParentIndexNumber != undefined && (!Number.isSafeInteger(item.ParentIndexNumber) || item.ParentIndexNumber < 0)) { return false; }
  if (item.Overview != undefined && typeof item.Overview !== 'string') { return false; }
  if (item.DateCreated != undefined && typeof item.DateCreated !== 'string') { return false; }
  const strings: Array<string | undefined> = [item.OriginalTitle, item.OfficialRating, item.PremiereDate, item.EndDate, item.Status, item.PlayAccess];
  if (!strings.every((v: string | undefined) => v == undefined || typeof v === 'string')) { return false; }
  if (item.Genres != undefined && (!Array.isArray(item.Genres) || !item.Genres.every((v: string) => typeof v === 'string'))) { return false; }
  if ((item.CanDownload != undefined && typeof item.CanDownload !== 'boolean') || (item.CanDelete != undefined && typeof item.CanDelete !== 'boolean')) { return false; }
  if (item.RemoteTrailers != undefined && (!Array.isArray(item.RemoteTrailers) || !item.RemoteTrailers.every((v: MediaLink) => !!v &&
    (v.Name == undefined || typeof v.Name === 'string') && (v.Url == undefined || typeof v.Url === 'string')))) { return false; }
  if (item.MediaStreams != undefined && (!Array.isArray(item.MediaStreams) || !item.MediaStreams.every(validStream))) { return false; }
  if (item.MediaSources != undefined && (!Array.isArray(item.MediaSources) || !item.MediaSources.every(validMediaSource))) { return false; }
  if (item.UserData != undefined) {
    if (!item.UserData || typeof item.UserData !== 'object') { return false; }
    if (item.UserData.PlayCount != undefined && !Number.isFinite(item.UserData.PlayCount)) { return false; }
    if (item.UserData.PlaybackPositionTicks != undefined && !Number.isFinite(item.UserData.PlaybackPositionTicks)) { return false; }
    if (item.UserData.IsFavorite != undefined && typeof item.UserData.IsFavorite !== 'boolean') { return false; }
    if (item.UserData.Played != undefined && typeof item.UserData.Played !== 'boolean') { return false; }
    if (item.UserData.LastPlayedDate != undefined && typeof item.UserData.LastPlayedDate !== 'string') { return false; }
  }
  return true;
}

export function validSnapshot(snapshot: LibrarySnapshot): boolean {
  if (!snapshot || typeof snapshot !== 'object' || !Number.isFinite(snapshot.syncedAt) || snapshot.syncedAt < 0 ||
    !Array.isArray(snapshot.items) || !snapshot.items.every(validMediaItem) || !Array.isArray(snapshot.actors)) { return false; }
  if (!snapshot.actors.every((actor: ActorSummary) => !!actor && validPerson(actor.person) &&
    Number.isFinite(actor.playCount) && Number.isFinite(actor.itemCount))) { return false; }
  // Older snapshots have no directory index. They remain usable as a flat offline collection.
  if (snapshot.libraries === undefined && snapshot.memberships === undefined) { return true; }
  if (!Array.isArray(snapshot.libraries) || !snapshot.libraries.every(validMediaItem) || !Array.isArray(snapshot.memberships)) { return false; }
  const libraryIds = new Set(snapshot.libraries.map((library: MediaItem) => library.Id));
  const itemIds = new Set(snapshot.items.map((item: MediaItem) => item.Id));
  const seen = new Set<string>();
  for (const membership of snapshot.memberships) {
    if (!membership || !libraryIds.has(membership.libraryId) || seen.has(membership.libraryId) ||
      !Array.isArray(membership.itemIds) || !membership.itemIds.every((id: string) => itemIds.has(id))) { return false; }
    seen.add(membership.libraryId);
  }
  return seen.size === libraryIds.size;
}

export function validDownloads(records: DownloadRecord[], directory: string): boolean {
  return Array.isArray(records) && records.every((record: DownloadRecord) => {
    if ((record?.mediaSourceId != undefined && typeof record.mediaSourceId !== 'string') || !record || !validMediaItem(record.item) || record.id !== record.item.Id || typeof record.path !== 'string' ||
      !['queued', 'downloading', 'complete', 'failed', 'interrupted', 'missing'].includes(record.state) ||
      !Number.isFinite(record.progress) || record.progress < 0 || record.progress > 1) { return false; }
    if (record.agentId !== undefined && (typeof record.agentId !== 'string' || !/^[0-9]+$/.test(record.agentId))) { return false; }
    if (record.failure !== undefined && typeof record.failure !== 'string') { return false; }
    if ([record.taskId, record.received, record.total].some((n: number | undefined) => n !== undefined && (!Number.isSafeInteger(n) || n < 0))) { return false; }
    const prefix = `${directory}/${record.id}.`;
    return record.path.startsWith(prefix) && /^[a-zA-Z0-9]+$/.test(record.path.slice(prefix.length));
  });
}
