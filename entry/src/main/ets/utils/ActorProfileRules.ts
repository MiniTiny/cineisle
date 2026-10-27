// Evidence confidence, presentation cap and recommendation weighting belong to actor profiles.
export class ActorProfileRules {
  private static readonly minimumSupportingWorks: number = 3;
  private static readonly supportingRatio: number = 0.35;
  static readonly maximumTags: number = 5;
  private static readonly favoriteWeight: number = 3;
  private static readonly watchedWeight: number = 2;

  static minimumSupport(workCount: number): number {
    return Math.max(ActorProfileRules.minimumSupportingWorks, Math.ceil(workCount * ActorProfileRules.supportingRatio));
  }
  static recommendationScore(favorite: number, watched: number, unplayed: number): number {
    return unplayed ? favorite * ActorProfileRules.favoriteWeight + watched * ActorProfileRules.watchedWeight : 0;
  }
}
