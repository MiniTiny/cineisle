import { MediaItem } from '../model/Models';

// Rewatch selection is a product rule, independent of protocol encoding and discovery scoring.
export class RewatchRules {
  private static readonly maxFallbackItems: number = 15;

  private static watched(items: MediaItem[]): MediaItem[] {
    const ids = new Set<string>();
    return items.filter((item: MediaItem) => item.UserData?.Played === true).filter((item: MediaItem) => {
      if (ids.has(item.Id)) { return false; }
      ids.add(item.Id);
      return true;
    });
  }

  static select(groups: MediaItem[], fallback: MediaItem[], random: () => number = () => Math.random()): MediaItem[] {
    const played = RewatchRules.watched(groups);
    if (played.length > 0) { return played; }
    const pool = RewatchRules.watched(fallback);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const item = pool[i]; pool[i] = pool[j]; pool[j] = item;
    }
    return pool.slice(0, RewatchRules.maxFallbackItems);
  }
}
