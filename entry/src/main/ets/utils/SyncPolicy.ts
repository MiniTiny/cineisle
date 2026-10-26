// Persisted sync-attempt validation and replay use the same bounded retry contract.
export class SyncRetryPolicy {
  static readonly maxAttempts: number = 5;
  static readonly initialDelayMs: number = 30000;
  static readonly maxDelayMs: number = 20 * 60 * 1000;

  static nextAttempt(previous?: number): number { return Math.min(SyncRetryPolicy.maxAttempts, (previous ?? 0) + 1); }
  static nextRetryAt(nowMs: number, attempt: number): number {
    return nowMs + Math.min(SyncRetryPolicy.maxDelayMs, SyncRetryPolicy.initialDelayMs * Math.pow(2, attempt - 1));
  }
}

// OS cadence, drain budget and UI wake-up timing are distinct from retry backoff.
export class SyncSchedule {
  static readonly wakeDebounceMs: number = 500;
  static readonly executionBudgetMs: number = 80000;
  static readonly continuationDelayMs: number = 1000;
  static readonly repeatCycleMs: number = 20 * 60 * 1000;
}

// Catalog scope and pagination belong to offline synchronization, independently of browsing.
export class SyncCatalogPolicy {
  static readonly pageItems: number = 200;
  static supportsLibrary(collectionType?: string): boolean {
    return !collectionType || ['movies', 'tvshows'].includes(collectionType);
  }
}
