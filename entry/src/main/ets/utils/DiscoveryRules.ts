// Discovery candidate retrieval and ranking are separate from rewatch and actor-profile rules.
export class DiscoveryRules {
  static readonly candidateLimit: number = 200;
  static readonly maximumResults: number = 30;
  private static readonly followedActorWeight: number = 4;
  private static readonly favoriteGenreWeight: number = 2;

  static score(actorCount: number, genreCount: number): number {
    return actorCount * DiscoveryRules.followedActorWeight + genreCount * DiscoveryRules.favoriteGenreWeight;
  }
}
