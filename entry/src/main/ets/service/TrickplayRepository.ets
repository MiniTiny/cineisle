import fs from '@ohos.file.fs';
import { BIF_LIMIT, BifData, BifTicket, BifTransfer, parseBif } from '../utils/Bif';
import { JellyfinClient } from './JellyfinClient';
import { LocalStore } from './LocalStore';

interface CacheFile { name: string; size: number; modified: number }
interface Job { run: () => Promise<void>; live: () => boolean; done: () => void }
// Small disposable per-account cache: 32 MiB / 16 BIFs, oldest write evicted first.
export class TrickplayRepository {
  private serial: Promise<void> = Promise.resolve();
  private active: number = 0;
  private waiting: Job[] = [];
  private disk<T>(work: () => Promise<T>): Promise<T> { const result = this.serial.then(work); this.serial = result.then(() => {}, () => {}); return result; }
  load(client: JellyfinClient, local: LocalStore | undefined, id: string, offline: boolean, allowed: () => boolean,
    admit: (work: () => Promise<void>) => Promise<void>): BifTicket {
    let active = true; let transfer: BifTransfer | undefined; let finish: (data?: BifData) => void = () => {};
    const live = (): boolean => { try { return active && allowed(); } catch (e) { return false; } };
    const result = new Promise<BifData | undefined>((resolve) => { finish = resolve; });
    const job: Job = { live: live, done: () => finish(), run: async () => {
      try {
        if (!live() || !/^[a-zA-Z0-9-]{1,128}$/.test(id)) { return; }
        const root = local ? local.directory + '/trickplay-v1' : '';
        let data: BifData | undefined;
        if (root) { try { data = await this.disk(() => live() ? this.read(root + '/' + id + '.bif', live) : Promise.resolve(undefined)); } catch (e) {} }
        if (!live()) { return; }
        if (data) { finish(data); return; }
        if (offline) { return; }
        transfer = client.trickplay(id, live); const bytes = await transfer.result;
        if (!live() || !bytes) { return; }
        data = parseBif(bytes); if (!data) { return; }
        if (root) { try { await admit(() => this.disk(() => this.save(root, id, bytes, live))); } catch (e) { /* Preview remains available in memory when optional cache cannot be admitted. */ } }
        if (live()) { finish(data); }
      } catch (e) { /* Optional plugin/cache errors never fail playback or a video download. */ }
      finally { finish(); }
    } };
    if (this.waiting.length >= 8 || !live()) { finish(); }
    else { this.waiting.push(job); this.drain(); }
    return { result: result, cancel: () => { active = false; transfer?.cancel(); this.waiting = this.waiting.filter((value: Job) => value !== job); finish(); } };
  }
  private drain(): void {
    while (this.active < 2 && this.waiting.length) {
      const job = this.waiting.shift()!; if (!job.live()) { job.done(); continue; }
      ++this.active; job.run().finally(() => { --this.active; this.drain(); });
    }
  }
  private async read(path: string, allowed: () => boolean): Promise<BifData | undefined> {
    try {
      const size = (await fs.stat(path)).size; if (!Number.isInteger(size) || size < 76 || size > BIF_LIMIT) { throw new Error('invalid'); }
      const file = await fs.open(path, fs.OpenMode.READ_ONLY); const bytes = new Uint8Array(size);
      try { let offset = 0; while (offset < size) { const part = new ArrayBuffer(size - offset); const n = await fs.read(file.fd, part); if (n <= 0 || n > size - offset) { throw new Error('invalid'); } bytes.set(new Uint8Array(part, 0, n), offset); offset += n; } }
      finally { await fs.close(file); }
      const value = parseBif(bytes.buffer as ArrayBuffer); if (!value) { throw new Error('invalid'); } return value;
    } catch (e) { if (allowed()) { await fs.unlink(path).catch(() => {}); } return undefined; }
  }
  private async save(root: string, id: string, bytes: ArrayBuffer, allowed: () => boolean): Promise<void> {
    if (!allowed()) { return; }
    await fs.mkdir(root, true).catch(() => {});
    const entries: CacheFile[] = [];
    for (const name of await fs.listFile(root)) {
      if (!allowed()) { return; }
      if (/^[a-zA-Z0-9-]{1,128}\.part$/.test(name)) { await fs.unlink(root + '/' + name); }
      if (!/^[a-zA-Z0-9-]{1,128}\.bif$/.test(name)) { continue; }
      const stat = await fs.stat(root + '/' + name); entries.push({ name: name, size: stat.size, modified: stat.mtime });
    }
    // Count an existing destination too: the atomic temporary file also needs space.
    entries.sort((a: CacheFile, b: CacheFile) => a.modified - b.modified || a.name.localeCompare(b.name));
    let total = entries.reduce((n: number, value: CacheFile) => n + value.size, 0);
    while (entries.length && (total + bytes.byteLength > 32 * 1048576 || entries.length >= 16)) { if (!allowed()) { return; } const entry = entries.shift()!; await fs.unlink(root + '/' + entry.name); total -= entry.size; }
    const temporary = root + '/' + id + '.part';
    try {
      if (!allowed()) { return; }
      const file = await fs.open(temporary, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      try { let offset = 0; while (offset < bytes.byteLength) { if (!allowed()) { return; } const n = await fs.write(file.fd, bytes.slice(offset)); if (n <= 0 || n > bytes.byteLength - offset) { throw new Error('write'); } offset += n; } await fs.fsync(file.fd); }
      finally { await fs.close(file); }
      if (allowed()) { await fs.rename(temporary, root + '/' + id + '.bif'); }
    } finally { await fs.unlink(temporary).catch(() => {}); }
  }
}
