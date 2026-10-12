import { LibrarySnapshot, MediaItem, QueryParam } from '../model/Models';

export function browseParams(mode: string, search: string, parentId: string, personId: string): QueryParam[] {
  const types = mode === 'search' || mode === 'favorites' ? 'Movie,Series,Episode' : 'Movie,Series';
  const params: QueryParam[] = [{ key: 'IncludeItemTypes', value: types },
    { key: 'SortBy', value: 'SortName' }, { key: 'SortOrder', value: 'Ascending' }];
  if (mode === 'search') { params.push({ key: 'SearchTerm', value: search.trim() }); }
  if (mode === 'favorites') { params.push({ key: 'Filters', value: 'IsFavorite' }); }
  if (parentId) { params.push({ key: 'ParentId', value: parentId }); }
  if (personId) { params.push({ key: 'PersonIds', value: personId }); }
  return params;
}

export function cachedItems(snapshot: LibrarySnapshot, mode: string, search: string, parentId: string, personId: string): MediaItem[] {
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
    items = items.filter((item: MediaItem) => item.Name.toLocaleLowerCase().includes(term));
  }
  return items.sort((a: MediaItem, b: MediaItem) => a.Name.localeCompare(b.Name));
}
