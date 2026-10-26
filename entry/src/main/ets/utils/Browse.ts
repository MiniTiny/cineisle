import { LibrarySnapshot, MediaItem, QueryParam } from '../model/Models';

export class BrowseRequestLimits {
  static readonly pageItems: number = 60;
  static readonly allItemsPageItems: number = 200;
}

export const librarySortFields: string[] = ['SortName', 'CommunityRating', 'CriticRating', 'DateCreated', 'DatePlayed', 'PremiereDate'];
export const searchTypes: string[] = ['', 'Movie', 'Series', 'Episode'];
// Reject broken pages instead of changing the offset or duplicating ArkUI card identities.
export function searchPage(current: MediaItem[], page: MediaItem[], total: number, type: string = ''): MediaItem[] {
  const values = current.concat(page); const ids = new Set<string>();
  if (!Number.isSafeInteger(total) || total < values.length || (!page.length && total > current.length)) { throw new Error('api_response_invalid'); }
  for (const item of values) {
    if (!item.Id || ids.has(item.Id) || !searchTypes.slice(1).includes(item.Type) || (searchTypes.slice(1).includes(type) && item.Type !== type)) { throw new Error('api_response_invalid'); }
    ids.add(item.Id);
  }
  return values;
}

export function browseParams(mode: string, search: string, parentId: string, personId: string, sort: string = 'SortName', descending: boolean = false, collectionType: string = '', searchType: string = ''): QueryParam[] {
  const library = mode === 'library' || mode === 'offline-library';
  const types = mode === 'search' && searchTypes.slice(1).includes(searchType) ? searchType : library && collectionType === 'boxsets' ? 'BoxSet' : mode === 'search' || mode === 'favorites' ? 'Movie,Series,Episode' : 'Movie,Series';
  const params: QueryParam[] = [{ key: 'IncludeItemTypes', value: types },
    { key: 'SortBy', value: library && librarySortFields.includes(sort) ? sort : 'SortName' },
    { key: 'SortOrder', value: library && descending ? 'Descending' : 'Ascending' }];
  if (mode === 'search') { params.push({ key: 'SearchTerm', value: search.trim() }); }
  if (mode === 'favorites') { params.push({ key: 'Filters', value: 'IsFavorite' }); }
  if (parentId) { params.push({ key: 'ParentId', value: parentId }); }
  if (personId) { params.push({ key: 'PersonIds', value: personId }); }
  return params;
}

export function cachedItems(snapshot: LibrarySnapshot, mode: string, search: string, parentId: string, personId: string, sort: string = 'SortName', descending: boolean = false, searchType: string = ''): MediaItem[] {
  let items = snapshot.items.filter((item: MediaItem) =>
    item.Type === 'Movie' || item.Type === 'Series' || ((mode === 'search' || mode === 'favorites') && item.Type === 'Episode'));
  if (parentId) {
    const membership = (snapshot.memberships ?? []).find((entry) => entry.libraryId === parentId);
    if (!membership) { throw new Error('cache_library_unavailable'); }
    const ids = new Set(membership.itemIds);
    items = items.filter((item: MediaItem) => ids.has(item.Id));
  }
  if (personId) { items = items.filter((item: MediaItem) => (item.People ?? []).some((person) => person.Id === personId)); }
  if (mode === 'favorites') { items = items.filter((item: MediaItem) => item.UserData?.IsFavorite === true); }
  if (mode === 'search') {
    const term = search.trim().toLocaleLowerCase();
    items = items.filter((item: MediaItem) => item.Name.toLocaleLowerCase().includes(term) && (!searchTypes.slice(1).includes(searchType) || item.Type === searchType));
  }
  const field = (mode === 'library' || mode === 'offline-library') && librarySortFields.includes(sort) ? sort : 'SortName';
  const direction = (mode === 'library' || mode === 'offline-library') && descending ? -1 : 1;
  return items.sort((a: MediaItem, b: MediaItem) => {
    if (field === 'SortName') {
      const library = mode === 'library' || mode === 'offline-library';
      return direction * (library ? a.SortName ?? a.Name : a.Name).localeCompare(library ? b.SortName ?? b.Name : b.Name) || a.Id.localeCompare(b.Id);
    }
    const left = sortValue(a, field); const right = sortValue(b, field);
    // Missing metadata remains last in either direction; stable identity breaks ties.
    if (left === undefined || right === undefined) { return left === right ? a.Id.localeCompare(b.Id) : left === undefined ? 1 : -1; }
    return direction * (left - right) || a.Id.localeCompare(b.Id);
  });
}

function sortValue(item: MediaItem, field: string): number | undefined {
  if (field === 'CommunityRating') { return Number.isFinite(item.CommunityRating) ? item.CommunityRating : undefined; }
  if (field === 'CriticRating') { return Number.isFinite(item.CriticRating) ? item.CriticRating : undefined; }
  const value = field === 'DateCreated' ? item.DateCreated : field === 'DatePlayed' ? item.UserData?.LastPlayedDate : item.PremiereDate;
  const number = Date.parse(value ?? ''); return Number.isFinite(number) ? number : undefined;
}
