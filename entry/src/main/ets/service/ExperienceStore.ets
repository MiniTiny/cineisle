import { SearchHistoryRules } from '../utils/SearchHistory';
import { ExperienceState, PendingEdit, PendingPosition, applyPending } from '../utils/Experience';
import { MediaItem } from '../model/Models';
import { rankActors } from '../utils/Protocol';
import { validMediaItem } from '../utils/Cache';
import { LocalStore } from './LocalStore';
import { AppFailure } from '../utils/Failures';

// Account-scoped, atomic metadata. Mutations publish only after the disk write succeeds.
export class ExperienceStore {
  private local: LocalStore;
  changed: (() => void) | undefined = undefined;
  acknowledged: ((pending: PendingEdit[], positions: PendingPosition[]) => void) | undefined = undefined;
  constructor(local: LocalStore) { this.local = local; }
  snapshot(): ExperienceState { return this.local.experience(); }
  update(change: (next: ExperienceState) => void): ExperienceState {
    const next = this.local.changeExperience(change);
    try { this.changed?.(); } catch (e) { /* A scheduling failure cannot roll back an already durable edit. */ }
    return next;
  }
  acknowledge(id: string, matches: (state: ExperienceState) => boolean, field?: string): void {
    this.commitMirrors(id, matches, true, field);
  }
  settleLocalEdits(): void {
    for (const edit of this.snapshot().pending.filter((p: PendingEdit) => p.localOnly === true)) {
      this.acknowledge(edit.id, (next: ExperienceState): boolean => next.pending.some((p: PendingEdit) =>
        p.id === edit.id && p.field === edit.field && p.revision === edit.revision && p.value === edit.value && p.localOnly === true), edit.field);
    }
  }
  retain(id: string, field: string, revision: number): void {
    this.commitMirrors(id, (next: ExperienceState): boolean => next.pending.some((p: PendingEdit) =>
      p.id === id && p.field === field && p.revision === revision), false, field);
  }
  private commitMirrors(id: string, matches: (state: ExperienceState) => boolean, acknowledge: boolean, field?: string): void {
    let pending: PendingEdit[] = []; let positions: PendingPosition[] = [];
    try {
      this.update((next: ExperienceState) => {
        if (!matches(next)) { return; }
        pending = next.pending.filter((p: PendingEdit) => p.id === id);
        positions = next.positions.filter((p: PendingPosition) => p.id === id);
        if (!pending.length && !positions.length) { return; }
        this.mergeIntentItems(next, id);
        // The durable intent remains the recovery journal until every mirror and the acknowledgement are saved.
        this.materialize(id, pending, positions);
        if (acknowledge) {
          next.pending = next.pending.filter((p: PendingEdit) => p.id !== id || (field !== undefined && p.field !== field));
          if (field === undefined) { next.positions = next.positions.filter((p: PendingPosition) => p.id !== id); }
        }
      });
    } catch (e) { throw new AppFailure('sync_cache_write_failed', 'storage'); }
    if (pending.length || positions.length) {
      try { this.acknowledged?.(pending, positions); } catch (e) { /* All mirrors are already durable; a UI refresh cannot undo acknowledgement. */ }
    }
  }
  private mergeIntentItems(next: ExperienceState, id: string): void {
    next.positions.forEach((p: PendingPosition) => { if (p.id === id) { p.item = applyPending([p.item], next.pending, next.positions)[0]; } });
    next.pending.forEach((p: PendingEdit) => { if (p.id === id && p.item) { p.item = applyPending([p.item], next.pending, next.positions)[0]; } });
  }
  private materialize(id: string, pending: PendingEdit[], positions: PendingPosition[]): void {
    const snapshot = this.local.snapshot();
    if (!snapshot.items.some((item: MediaItem) => item.Id === id)) {
      let seed: MediaItem | undefined = undefined; let revision = -1;
      positions.forEach((p: PendingPosition) => { if (p.revision > revision && validMediaItem(p.item)) { seed = p.item; revision = p.revision; } });
      pending.forEach((p: PendingEdit) => { if (p.item && p.revision > revision && validMediaItem(p.item)) { seed = p.item; revision = p.revision; } });
      if (seed) { snapshot.items.push(seed); }
    }
    snapshot.items = applyPending(snapshot.items, pending, positions); snapshot.actors = rankActors(snapshot.items);
    this.local.saveSnapshot(snapshot);
    const records = this.local.downloads();
    records.forEach((record) => { record.item = applyPending([record.item], pending, positions)[0]; });
    this.local.saveDownloads(records);
    const sections = this.local.home();
    sections.forEach((section) => { section.items = applyPending(section.items, pending, positions); });
    this.local.saveHome(sections);
  }
  search(term: string): void {
    const value = term.trim().slice(0, SearchHistoryRules.maxTermCodeUnits); if (!value) { return; }
    this.update((next: ExperienceState) => { next.searches = [value, ...next.searches.filter((s: string) => s.toLowerCase() !== value.toLowerCase())].slice(0, SearchHistoryRules.maxEntries); });
  }
}
