import fs from '@ohos.file.fs';
import common from '@ohos.app.ability.common';
import { DownloadRecord, LibrarySnapshot, Session, HomeSection } from '../model/Models';
import { accountKey } from '../utils/Protocol';
import { validDownloads, validSnapshot, validMediaItem } from '../utils/Cache';
import { ExperienceState, validExperience } from '../utils/Experience';

export class LocalStore {
  private static transfers: Map<string, Promise<void>> = new Map();
  readonly directory: string;
  recovered: boolean = false;
  constructor(context: common.Context, session: Session) {
    this.directory = `${context.filesDir}/${accountKey(session.serverId, session.userId)}`;
    if (!fs.accessSync(this.directory)) { fs.mkdirSync(this.directory); }
  }

  private read<T>(name: string, fallback: T, validate: (value: T) => boolean): T {
    const path = `${this.directory}/${name}.json`;
    if (!fs.accessSync(path)) { return fallback; }
    const source = fs.readTextSync(path);
    try {
      const value = JSON.parse(source) as T;
      if (validate(value)) { return value; }
    } catch (e) {
      // Preserve malformed metadata before rebuilding it. Video files are never removed here.
    }
    let backup = `${path}.corrupt-${Date.now()}`;
    while (fs.accessSync(backup)) { backup += '-1'; }
    try { fs.renameSync(path, backup); } catch (e) { throw new Error('cache_recovery_failed'); }
    this.recovered = true;
    return fallback;
  }

  private write<T>(name: string, value: T): void {
    const path = `${this.directory}/${name}.json`;
    const file = fs.openSync(path + '.tmp', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
    try { fs.writeSync(file.fd, JSON.stringify(value)); fs.fsyncSync(file.fd); } finally { fs.closeSync(file); }
    fs.renameSync(path + '.tmp', path);
  }

  snapshot(): LibrarySnapshot {
    const snapshot = this.read<LibrarySnapshot>('library', new LibrarySnapshot(), validSnapshot);
    snapshot.libraries = snapshot.libraries ?? []; snapshot.memberships = snapshot.memberships ?? [];
    return snapshot;
  }
  saveSnapshot(snapshot: LibrarySnapshot): void { this.write<LibrarySnapshot>('library', snapshot); }
  downloads(): DownloadRecord[] {
    return this.read<DownloadRecord[]>('downloads', [], (records: DownloadRecord[]) => validDownloads(records, this.directory));
  }
  saveDownloads(records: DownloadRecord[]): void { this.write<DownloadRecord[]>('downloads', records); }
  experience(): ExperienceState { return this.read<ExperienceState>('experience', new ExperienceState(), validExperience); }
  saveExperience(value: ExperienceState): void { this.write<ExperienceState>('experience', value); }
  changeExperience(change: (next: ExperienceState) => void): ExperienceState {
    const lock = fs.openSync(`${this.directory}/experience.lock`, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE);
    try {
      lock.tryLock(true);
      const next = this.experience(); change(next); this.saveExperience(next); return next;
    } finally { fs.closeSync(lock); }
  }
  transfer(operation: () => Promise<void>): Promise<void> {
    const key = this.directory;
    const result = (LocalStore.transfers.get(key) ?? Promise.resolve()).then(async () => {
      const lock = fs.openSync(`${key}/sync-transfer.lock`, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE);
      try { await lock.lock(true); await operation(); } finally { fs.closeSync(lock); }
    });
    const settled = result.then(() => {}, () => {}); LocalStore.transfers.set(key, settled);
    settled.then(() => { if (LocalStore.transfers.get(key) === settled) { LocalStore.transfers.delete(key); } });
    return result;
  }
  home(): HomeSection[] {
    return this.read<HomeSection[]>('home', [], (sections: HomeSection[]) => Array.isArray(sections) && sections.every((s: HomeSection) =>
      !!s && typeof s.id === 'string' && typeof s.kind === 'string' && typeof s.name === 'string' && typeof s.libraryId === 'string' && Array.isArray(s.items) && s.items.every(validMediaItem)));
  }
  saveHome(sections: HomeSection[]): void { this.write<HomeSection[]>('home', sections); }
  saveSyncProgress(snapshot: LibrarySnapshot): void { this.write<LibrarySnapshot>('sync-progress', snapshot); }
}
