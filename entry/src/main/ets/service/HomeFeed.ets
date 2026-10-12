import { HomeSection, LibrarySnapshot, MediaItem } from '../model/Models';
import { JellyfinClient } from './JellyfinClient';
import { cachedItems } from '../utils/Browse';

function supported(library: MediaItem): boolean {
  return !library.CollectionType || ['movies', 'tvshows', 'boxsets'].includes(library.CollectionType);
}

// Match the phone Android feed: resume, next up, then non-empty latest shelves per library.
export async function loadHome(client: JellyfinClient): Promise<HomeSection[]> {
  const results = await Promise.all([client.resume(), client.nextUp(), client.libraries()]);
  const resume = results;
  const libraries = results[2].filter(supported);
  const latest = await Promise.all(libraries.map((library: MediaItem) => client.latest(library.Id)));
  const sections: HomeSection[] = [];
  if (resume[0].length) { sections.push({ id: 'resume', kind: 'resume', name: '', libraryId: '', items: resume[0] }); }
  if (resume[1].length) { sections.push({ id: 'nextup', kind: 'nextup', name: '', libraryId: '', items: resume[1] }); }
  libraries.forEach((library: MediaItem, index: number) => {
    if (latest[index].length) { sections.push({ id: 'library-' + library.Id, kind: 'latest', name: library.Name, libraryId: library.Id, items: latest[index] }); }
  });
  return sections;
}

// Snapshot order is not DateCreated order and cannot reproduce the server's next-up calculation.
export function cachedHome(snapshot: LibrarySnapshot): HomeSection[] {
  if (!snapshot.syncedAt) { return []; }
  if (!snapshot.libraries.length) {
    const items = cachedItems(snapshot, '', '', '', '');
    return items.length ? [{ id: 'cached', kind: 'cached', name: '', libraryId: '', items: items }] : [];
  }
  const sections: HomeSection[] = [];
  snapshot.libraries.filter(supported).forEach((library: MediaItem) => {
    const items = cachedItems(snapshot, 'library', '', library.Id, '');
    if (items.length) { sections.push({ id: 'library-' + library.Id, kind: 'cached', name: library.Name, libraryId: library.Id, items: items }); }
  });
  return sections;
}
