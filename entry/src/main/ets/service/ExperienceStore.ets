import { ExperienceState } from '../utils/Experience';
import { LocalStore } from './LocalStore';

// Account-scoped, atomic metadata. Mutations publish only after the disk write succeeds.
export class ExperienceStore {
  private value: ExperienceState;
  private local: LocalStore;
  constructor(local: LocalStore) { this.local = local; this.value = local.experience(); }
  snapshot(): ExperienceState { return JSON.parse(JSON.stringify(this.value)) as ExperienceState; }
  update(change: (next: ExperienceState) => void): ExperienceState {
    const next = this.snapshot(); change(next); this.local.saveExperience(next); this.value = next; return this.snapshot();
  }
  search(term: string): void {
    const value = term.trim().slice(0, 128); if (!value) { return; }
    this.update((next: ExperienceState) => { next.searches = [value, ...next.searches.filter((s: string) => s.toLowerCase() !== value.toLowerCase())].slice(0, 20); });
  }
}
