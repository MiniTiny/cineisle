import { IntroLimits, IntroEntry, IntroSegment, IntroTicket, validIntro } from '../utils/Intro';
import { JellyfinClient } from './JellyfinClient';
import { LocalStore } from './LocalStore';

// Per-account LocalStore owns cached data. A ticket never publishes or saves after its owner is invalid.
export class IntroRepository {
  load(client: JellyfinClient, local: LocalStore | undefined, id: string, offline: boolean, allowed: () => boolean): IntroTicket {
    let active = true; let transfer: IntroTicket | undefined;
    const live = (): boolean => { try { return active && allowed(); } catch (e) { return false; } };
    const save = (segment: IntroSegment): void => {
      if (!local || !live()) { return; }
      try { const entries = local.intros().filter((entry: IntroEntry) => entry.id !== id); entries.push({ id: id, segment: segment, touched: Date.now() }); local.saveIntros(entries.sort((a: IntroEntry, b: IntroEntry) => b.touched - a.touched).slice(0, IntroLimits.maxCacheEntries)); } catch (e) { /* Optional cache failure never blocks playback. */ }
    };
    const result = (async (): Promise<IntroSegment | undefined> => {
      if (!live() || !/^[a-zA-Z0-9-]{1,128}$/.test(id)) { return undefined; }
      try { const cached = local?.intros().find((entry: IntroEntry) => entry.id === id); if (cached) { save(cached.segment); return live() ? cached.segment : undefined; } } catch (e) {}
      if (offline || !live()) { return undefined; }
      try { transfer = client.intro(id, live); const segment = await transfer.result; if (!live() || !segment || !validIntro(segment)) { return undefined; } save(segment); return live() ? segment : undefined; } catch (e) { return undefined; }
    })();
    return { result: result, cancel: () => { active = false; transfer?.cancel(); } };
  }
}
