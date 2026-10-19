import { ExperienceState } from '../utils/Experience';
import { LocalStore } from './LocalStore';

// Account-scoped, atomic metadata. Mutations publish only after the disk write succeeds.
export class ExperienceStore {
  private local: LocalStore;
  changed: (() => void) | undefined = undefined;
  constructor(local: LocalStore) { this.local = local; }
  snapshot(): ExperienceState { return this.local.experience(); }
  update(change: (next: ExperienceState) => void): ExperienceState {
    const next = this.local.changeExperience(change);
    try { this.changed?.(); } catch (e) { /* A scheduling failure cannot roll back an already durable edit. */ }
    return next;
  }
  search(term: string): void {
    const value = term.trim().slice(0, 128); if (!value) { return; }
    this.update((next: ExperienceState) => { next.searches = [value, ...next.searches.filter((s: string) => s.toLowerCase() !== value.toLowerCase())].slice(0, 20); });
  }
}
