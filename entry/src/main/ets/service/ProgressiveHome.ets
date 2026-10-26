import { HomeSection, MediaItem } from '../model/Models';
import { JellyfinClient } from './JellyfinClient';
import { NetworkPolicy } from '../utils/NetworkOptions';
import { authorizationFailure } from '../utils/Experience';
import { supportsHomeLibrary } from './HomeFeed';
import { HomeFeedRequests, NextUpRequests } from '../utils/FeedRequests';

export interface HomeFailure { id: string; name: string; message: string }
export interface HomeUpdate { sections: HomeSection[]; failures: HomeFailure[]; busy: boolean; cached: boolean }
interface HomeRequest { collectionType?: string; id: string; kind: string; name: string; libraryId: string; fetch: () => Promise<MediaItem[]> }

// One account/page owns this loader. Four shared slots include independent retries.
export class ProgressiveHome {
  private static readonly maxActiveRequests: number = 4;
  private requests: HomeRequest[] = [];
  private sections: Map<string, HomeSection> = new Map();
  private errors: Map<string, HomeFailure> = new Map();
  private pending: Set<string> = new Set();
  private queue: HomeRequest[] = [];
  private active: number = 0;
  private alive: boolean = true;
  private cached: boolean = false;
  private complete: (() => void) | undefined = undefined;
  private client: JellyfinClient;
  private publish: (value: HomeUpdate) => void;
  constructor(client: JellyfinClient, publish: (value: HomeUpdate) => void) { this.client = client; this.publish = publish; }

  cancel(): void { this.alive = false; this.queue = []; this.complete?.(); this.complete = undefined; }
  private emit(): void {
    if (!this.alive) { return; }
    this.publish({ sections: this.requests.map((r: HomeRequest) => this.sections.get(r.id)).filter((s: HomeSection | undefined) => !!s) as HomeSection[],
      failures: Array.from(this.errors.values()), busy: this.pending.size > 0, cached: this.cached });
  }
  start(preview: HomeSection[]): Promise<void> {
    if (!NetworkPolicy.cacheAllowed()) { preview = []; }
    const finished = new Promise<void>((resolve) => { this.complete = resolve; });
    this.requests = [
      { id: 'resume', kind: 'resume', name: '', libraryId: '', fetch: () => this.client.resume(HomeFeedRequests.resumeLimit) },
      { id: 'nextup', kind: 'nextup', name: '', libraryId: '', fetch: () => this.client.nextUp('', NextUpRequests.feedLimit) },
      { id: 'libraries', kind: '', name: '', libraryId: '', fetch: () => this.client.libraries() }
    ];
    preview.forEach((section: HomeSection) => this.sections.set(section.id, section));
    // Cached latest shelves keep their position until the current views response establishes order.
    preview.filter((s: HomeSection) => s.libraryId).forEach((s: HomeSection) => this.requests.push({ id: s.id, kind: s.kind, name: s.name, libraryId: s.libraryId, collectionType: s.collectionType, fetch: () => this.client.latest(s.libraryId, HomeFeedRequests.latestLimit(s.libraryId)) }));
    preview.filter((s: HomeSection) => s.id === 'cached').forEach((s: HomeSection) => this.requests.push({ id: s.id, kind: s.kind, name: s.name, libraryId: '', fetch: async () => [] }));
    this.cached = preview.length > 0; this.emit();
    this.requests.slice(0, 3).forEach((r: HomeRequest) => this.enqueue(r));
    return finished;
  }
  retry(id: string): void {
    const request = this.requests.find((r: HomeRequest) => r.id === id);
    if (request && !this.pending.has(id) && this.alive) { this.errors.delete(id); this.enqueue(request); }
  }
  private enqueue(request: HomeRequest): void {
    this.pending.add(request.id); this.queue.push(request); this.emit(); this.drain();
  }
  private drain(): void {
    while (this.alive && this.active < ProgressiveHome.maxActiveRequests && this.queue.length) {
      const request = this.queue.shift()!; ++this.active; this.run(request);
    }
  }
  private async run(request: HomeRequest): Promise<void> {
    try {
      const items = await request.fetch(); if (!this.alive) { return; }
      if (request.id === 'libraries') {
        const libraries = items.filter(supportsHomeLibrary);
        const ids = new Set(libraries.map((i: MediaItem) => 'library-' + i.Id));
        this.sections.forEach((s: HomeSection, id: string) => { if (s.libraryId && !ids.has(id)) { this.sections.delete(id); } });
        this.requests = this.requests.slice(0, 3);
        libraries.forEach((i: MediaItem) => {
          const next: HomeRequest = { id: 'library-' + i.Id, kind: 'latest', name: i.Name, libraryId: i.Id, collectionType: i.CollectionType, fetch: () => this.client.latest(i.Id, HomeFeedRequests.latestLimit(i.Id)) };
          this.requests.push(next); this.enqueue(next);
        });
      } else if (items.length) {
        this.sections.set(request.id, { id: request.id, kind: request.kind, name: request.name, libraryId: request.libraryId, collectionType: request.collectionType, items: items });
      } else { this.sections.delete(request.id); }
      this.errors.delete(request.id);
    } catch (e) {
      if (!this.alive) { return; }
      const error = e as Error;
      if (authorizationFailure(error)) {
        this.sections.clear(); this.errors.clear(); this.pending.clear(); this.cached = false;
        this.errors.set(request.id, { id: request.id, name: request.name, message: error.message }); this.emit(); this.cancel(); return;
      }
      this.errors.set(request.id, { id: request.id, name: request.name, message: error.message });
    } finally {
      --this.active; this.pending.delete(request.id);
      if (this.pending.size === 0 && this.errors.size === 0) { this.cached = false; }
      this.emit(); this.drain();
      if (this.alive && this.pending.size === 0) { this.complete?.(); this.complete = undefined; }
    }
  }
}
