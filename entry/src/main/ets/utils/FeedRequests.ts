// Feed quantities are product request policies; generated operations only encode their values.
export class HomeFeedRequests {
  static readonly resumeLimit: number = 20;
  private static readonly libraryLatestLimit: number = 12;
  private static readonly globalLatestLimit: number = 30;

  static latestLimit(parentId: string): number {
    return parentId ? HomeFeedRequests.libraryLatestLimit : HomeFeedRequests.globalLatestLimit;
  }
}

// Detail/playback consumers share the scoped query, rather than a homepage display limit.
export class NextUpRequests {
  static readonly feedLimit: number = 9;
  static readonly seriesLimit: number = 1;

  static limit(seriesId: string): number {
    return seriesId ? NextUpRequests.seriesLimit : NextUpRequests.feedLimit;
  }
}

// Complete episode queues page independently of home shelves and catalog synchronization.
export class EpisodeQueueRequests {
  static readonly pageItems: number = 200;
}
