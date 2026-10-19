import { DownloadNetwork } from '../utils/Downloads';
// UI/cache domain models. Jellyfin wire DTOs are generated under api/generated.
export class Session {
  server: string = '';
  serverId: string = '';
  userId: string = '';
  userName: string = '';
  token: string = '';
  deviceId: string = '';
  addresses?: string[];
  serverName?: string;
}

export interface UserData {
  IsFavorite?: boolean;
  Played?: boolean;
  PlayCount?: number;
  PlaybackPositionTicks?: number;
  LastPlayedDate?: string;
}
export interface Person { Id: string; Name: string; Type?: string; Role?: string; PrimaryImageTag?: string }
export interface ImageTags { Primary?: string }
export interface MediaStream {
  Type: string; Index: number; Codec?: string; Language?: string; DisplayTitle?: string; IsExternal?: boolean; IsTextSubtitle?: boolean;
  Width?: number; Height?: number; BitDepth?: number; BitRate?: number; Channels?: number; ChannelLayout?: string;
  VideoRange?: string; VideoRangeType?: string; VideoDoViTitle?: string; DvProfile?: number; AudioSpatialFormat?: string;
}
export interface MediaSource { Id: string; Name?: string; Container?: string; Size?: number; MediaStreams?: MediaStream[] }
export interface MediaItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  DateCreated?: string;
  CollectionType?: string;
  OriginalTitle?: string;
  SortName?: string;
  OfficialRating?: string;
  Genres?: string[];
  PremiereDate?: string;
  EndDate?: string;
  Status?: string;
  CanDownload?: boolean;
  CanDelete?: boolean;
  PlayAccess?: string;
  RemoteTrailers?: MediaLink[];
  MediaStreams?: MediaStream[];
  ProductionYear?: number;
  CommunityRating?: number;
  CriticRating?: number;
  RunTimeTicks?: number;
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ImageTags?: ImageTags;
  BackdropImageTags?: string[];
  UserData?: UserData;
  People?: Person[];
  MediaSources?: MediaSource[];
}
export interface ItemsResult { Items: MediaItem[]; TotalRecordCount: number }
export interface PlaybackInfo { MediaSources: MediaSource[]; PlaySessionId?: string }
export interface QueryParam { key: string; value: string }
export class PlaybackRoute {
  item: MediaItem = { Id: '', Name: '', Type: '' };
  url: string = '';
  mediaSourceId: string = '';
  playSessionId: string = '';
  offline: boolean = false;
  filePath: string = '';
  sources: MediaSource[] = [];
  subtitles: DownloadSubtitle[] = [];
}
export interface DownloadSubtitle { index: number; title: string; language: string; path: string; state: string }
export class DownloadRecord {
  network?: DownloadNetwork;
  expectedSize?: number;
  subtitles?: DownloadSubtitle[];
  subtitleState?: string;
  mediaSourceId?: string;
  id: string = '';
  item: MediaItem = { Id: '', Name: '', Type: '' };
  path: string = '';
  state: string = 'downloading';
  progress: number = 0;
  agentId?: string;
  taskId?: number;
  failure?: string;
  received?: number;
  total?: number;
}
export class ActorSummary {
  person: Person = { Id: '', Name: '' };
  playCount: number = 0;
  itemCount: number = 0;
}
export class LibrarySnapshot {
  syncedAt: number = 0;
  items: MediaItem[] = [];
  actors: ActorSummary[] = [];
  libraries: MediaItem[] = [];
  memberships: LibraryMembership[] = [];
}

export interface LibraryMembership { libraryId: string; itemIds: string[] }

export interface HomeSection { id: string; kind: string; name: string; libraryId: string; items: MediaItem[]; collectionType?: string }

export interface MediaLink { Name?: string; Url?: string }
