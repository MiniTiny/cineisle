import { BaseItemDto, BaseItemDtoQueryResult, BaseItemPerson, MediaSourceInfo, MediaStream as StreamDto, MediaUrl, PlaybackInfoResponse } from './generated/Models';
import { ItemsResult, MediaLink, MediaItem, MediaSource, MediaStream, Person, PlaybackInfo } from '../model/Models';
import { validMediaItem, validMediaSource, validStream } from '../utils/Cache';

// Cache/UI domain models require identities. Wire DTOs retain OpenAPI optional/nullable fields.
export function mediaItem(dto: BaseItemDto): MediaItem {
  if (!dto || typeof dto.Id !== 'string' || !dto.Id || typeof dto.Name !== 'string' || typeof dto.Type !== 'string' || !dto.Type) { throw new Error('api_response_invalid'); }
  if ((dto.People != undefined && !Array.isArray(dto.People)) || (dto.MediaSources != undefined && !Array.isArray(dto.MediaSources)) ||
    (dto.UserData != undefined && (typeof dto.UserData !== 'object' || Array.isArray(dto.UserData)))) { throw new Error('api_response_invalid'); }
  const result: MediaItem = {
    Id: dto.Id, Name: dto.Name, Type: dto.Type, CollectionType: dto.CollectionType ?? undefined,
    OriginalTitle: dto.OriginalTitle ?? undefined, OfficialRating: dto.OfficialRating ?? undefined,
    Genres: dto.Genres ?? undefined, PremiereDate: dto.PremiereDate ?? undefined, EndDate: dto.EndDate ?? undefined,
    Status: dto.Status ?? undefined, CanDownload: dto.CanDownload ?? undefined, CanDelete: dto.CanDelete ?? undefined,
    PlayAccess: dto.PlayAccess ?? undefined, RemoteTrailers: dto.RemoteTrailers ? links(dto.RemoteTrailers) : undefined,
    MediaStreams: dto.MediaStreams ? streams(dto.MediaStreams) : undefined,
    Overview: dto.Overview ?? undefined, DateCreated: dto.DateCreated ?? undefined, ProductionYear: dto.ProductionYear ?? undefined,
    CommunityRating: dto.CommunityRating ?? undefined, RunTimeTicks: dto.RunTimeTicks ?? undefined,
    SeriesId: dto.SeriesId ?? undefined, SeriesName: dto.SeriesName ?? undefined, SeasonId: dto.SeasonId ?? undefined,
    IndexNumber: dto.IndexNumber ?? undefined, ParentIndexNumber: dto.ParentIndexNumber ?? undefined,
    ImageTags: dto.ImageTags ? { Primary: dto.ImageTags['Primary'] ?? undefined } : undefined,
    BackdropImageTags: dto.BackdropImageTags ?? undefined,
    UserData: dto.UserData ? {
      IsFavorite: dto.UserData.IsFavorite ?? undefined, Played: dto.UserData.Played ?? undefined,
      PlayCount: dto.UserData.PlayCount ?? undefined, PlaybackPositionTicks: dto.UserData.PlaybackPositionTicks ?? undefined,
      LastPlayedDate: dto.UserData.LastPlayedDate ?? undefined
    } : undefined,
    People: dto.People ? people(dto.People) : undefined,
    MediaSources: dto.MediaSources ? mediaSources(dto.MediaSources) : undefined
  };
  if (!validMediaItem(result)) { throw new Error('api_response_invalid'); }
  return result;
}

export function mediaItems(dtos: BaseItemDto[]): MediaItem[] {
  if (!Array.isArray(dtos)) { throw new Error('api_response_invalid'); }
  return dtos.map((dto: BaseItemDto) => mediaItem(dto));
}

export function listItems(dto: BaseItemDtoQueryResult): MediaItem[] {
  if (!dto || !Array.isArray(dto.Items)) { throw new Error('api_response_invalid'); }
  return mediaItems(dto.Items);
}

export function itemPage(dto: BaseItemDtoQueryResult): ItemsResult {
  if (!dto || !Array.isArray(dto.Items) || !Number.isSafeInteger(dto.TotalRecordCount) || dto.TotalRecordCount! < 0) { throw new Error('api_response_invalid'); }
  return { Items: mediaItems(dto.Items), TotalRecordCount: dto.TotalRecordCount! };
}

function people(dtos: BaseItemPerson[]): Person[] {
  if (!Array.isArray(dtos)) { throw new Error('api_response_invalid'); }
  return dtos.map((dto: BaseItemPerson): Person => {
    if (!dto || typeof dto.Id !== 'string' || !dto.Id || typeof dto.Name !== 'string') { throw new Error('api_response_invalid'); }
    return { Id: dto.Id, Name: dto.Name, Type: dto.Type ?? undefined, Role: dto.Role ?? undefined, PrimaryImageTag: dto.PrimaryImageTag ?? undefined };
  });
}

function links(dtos: MediaUrl[]): MediaLink[] {
  if (!Array.isArray(dtos)) { throw new Error('api_response_invalid'); }
  return dtos.map((dto: MediaUrl): MediaLink => {
    if (!dto) { throw new Error('api_response_invalid'); }
    return { Name: dto.Name ?? undefined, Url: dto.Url ?? undefined };
  });
}

function streams(dtos: StreamDto[]): MediaStream[] {
  if (!Array.isArray(dtos)) { throw new Error('api_response_invalid'); }
  return dtos.map((dto: StreamDto): MediaStream => {
    if (!dto || typeof dto.Type !== 'string' || !Number.isSafeInteger(dto.Index) || dto.Index! < 0) { throw new Error('api_response_invalid'); }
    const result: MediaStream = { Type: dto.Type, Index: dto.Index!, Codec: dto.Codec ?? undefined, Language: dto.Language ?? undefined,
      DisplayTitle: dto.DisplayTitle ?? undefined,
      Width: dto.Width ?? undefined, Height: dto.Height ?? undefined, BitDepth: dto.BitDepth ?? undefined, BitRate: dto.BitRate ?? undefined,
      Channels: dto.Channels ?? undefined, ChannelLayout: dto.ChannelLayout ?? undefined, VideoRange: dto.VideoRange ?? undefined,
      VideoRangeType: dto.VideoRangeType ?? undefined, VideoDoViTitle: dto.VideoDoViTitle ?? undefined, DvProfile: dto.DvProfile ?? undefined,
      AudioSpatialFormat: dto.AudioSpatialFormat ?? undefined, IsExternal: dto.IsExternal ?? undefined, IsTextSubtitle: dto.IsTextSubtitleStream ?? undefined };
    if (!validStream(result)) { throw new Error('api_response_invalid'); }
    return result;
  });
}

function mediaSources(dtos: MediaSourceInfo[]): MediaSource[] {
  if (!Array.isArray(dtos)) { throw new Error('api_response_invalid'); }
  return dtos.filter((dto: MediaSourceInfo) => !!dto && typeof dto.Id === 'string' && !!dto.Id).map((dto: MediaSourceInfo): MediaSource => {
    const result: MediaSource = { Id: dto.Id!, Name: dto.Name ?? undefined, Container: dto.Container ?? undefined, Size: dto.Size ?? undefined, MediaStreams: dto.MediaStreams ? streams(dto.MediaStreams) : undefined };
    if (!validMediaSource(result)) { throw new Error('api_response_invalid'); }
    return result;
  });
}

export function playbackInfo(dto: PlaybackInfoResponse): PlaybackInfo {
  if (!dto) { throw new Error('api_response_invalid'); }
  return { MediaSources: mediaSources(dto.MediaSources ?? []), PlaySessionId: dto.PlaySessionId ?? undefined };
}
