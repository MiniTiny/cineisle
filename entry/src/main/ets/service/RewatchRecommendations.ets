import { MediaItem } from '../model/Models';
import { RewatchRules } from '../utils/RewatchRules';

// The adapter supplies mapped media; this use case owns optional-plugin fallback and request budgets.
export interface RewatchSource {
  recommendations: (categoryLimit: number, itemLimit: number) => Promise<MediaItem[]>;
  watchedMovies: (limit: number) => Promise<MediaItem[]>;
}

export class RewatchRecommendations {
  private static readonly categoryLimit: number = 5;
  private static readonly itemsPerCategory: number = 8;
  private static readonly fallbackCandidates: number = 100;

  static async load(source: RewatchSource): Promise<MediaItem[]> {
    let candidates: MediaItem[] = [];
    try {
      candidates = await source.recommendations(RewatchRecommendations.categoryLimit, RewatchRecommendations.itemsPerCategory);
    } catch (e) {
      // Optional plugin errors are discarded; the watched-media fallback must still succeed.
      candidates = [];
    }
    if (candidates.some((item: MediaItem) => item.UserData?.Played === true)) { return RewatchRules.select(candidates, []); }
    const fallback = await source.watchedMovies(RewatchRecommendations.fallbackCandidates);
    return RewatchRules.select([], fallback);
  }
}
