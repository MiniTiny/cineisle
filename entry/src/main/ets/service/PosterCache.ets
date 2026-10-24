import fs from '@ohos.file.fs';
import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import crypto from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import { PosterData, PosterOptions, PosterTarget, PosterTicket, PosterTransfer, posterByteLimit, rasterImage, validPosterOptions, validPosterTarget } from '../utils/PosterOptions';

interface Entry { key: string; size: number; touched: number; saved: number }
interface Index { entries: Entry[] }
interface Lease { active: boolean; allowed: () => boolean; online: () => boolean; fetch: (allowed: () => boolean) => PosterTransfer }
export interface PosterUsage { bytes: number; files: number; issue: string }
class Job {
  key: string; epoch: number; cacheable: boolean; leases: Set<Lease> = new Set(); transfer?: PosterTransfer;
  resolve: (bytes: ArrayBuffer) => void = () => {}; reject: (error: Error) => void = () => {};
  result: Promise<ArrayBuffer>;
  constructor(key: string, epoch: number, cacheable: boolean) { this.key = key; this.epoch = epoch; this.cacheable = cacheable; this.result = new Promise<ArrayBuffer>((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
}

// One UI-process cache, shared quota and opaque keys. No URL, token or account metadata is persisted.
export class PosterCache {
  private static readonly storeName: string = 'poster_options';
  private static readonly valueKey: string = 'settings_v1';
  private static readonly maxEntries: number = 512;
  private static readonly maxQueuedJobs: number = 64;
  private static readonly maxConcurrentJobs: number = 3;
  private static readonly untaggedFreshnessMs: number = 24 * 60 * 60 * 1000;
  private static readonly maxAccountKeyCodeUnits: number = 300;
  private root: string;
  private context: common.Context;
  private options: PosterOptions = new PosterOptions();
  private store?: preferences.Preferences;
  private persisted: string = '';
  private initialized?: Promise<void>;
  private ready: boolean = false;
  private entries: Entry[] = [];
  private serial: Promise<void> = Promise.resolve();
  private settings: Promise<void> = Promise.resolve();
  private epoch: number = 0;
  private jobs: Map<string, Job> = new Map();
  private queue: Job[] = [];
  private active: number = 0;
  issue: string = '';
  constructor(context: common.Context) { this.context = context; this.root = (context.cacheDir || context.filesDir + '/cache') + '/cineisle-posters-v1'; }
  snapshot(): PosterOptions { return { enabled: this.options.enabled, maxMb: this.options.maxMb }; }
  initialize(): Promise<void> {
    if (!this.initialized) { this.initialized = this.boot().catch(() => { this.issue = 'poster_cache_unavailable'; }); }
    return this.initialized;
  }
  private async boot(): Promise<void> {
    try {
      this.store = await preferences.getPreferences(this.context, { name: PosterCache.storeName });
      const raw = await this.store.get(PosterCache.valueKey, ''); this.persisted = typeof raw === 'string' ? raw : '';
      if (raw !== '') {
        const parsed = JSON.parse(this.persisted) as PosterOptions;
        if (!validPosterOptions(parsed)) { throw new Error('invalid'); }
        this.options = { enabled: parsed.enabled, maxMb: parsed.maxMb };
      }
    } catch (e) { this.issue = 'poster_options_load_failed'; }
    await fs.mkdir(this.root, true).catch(() => {});
    let known: Entry[] = [];
    try { const parsed = JSON.parse(await fs.readText(this.root + '/index.json')) as Index; if (Array.isArray(parsed.entries)) { known = parsed.entries.slice(0, PosterCache.maxEntries); } } catch (e) { /* Reconstruct disposable files after interruption or eviction. */ }
    const names = await fs.listFile(this.root);
    for (const name of names) {
      if (/^[a-f0-9]{64}\.part$/.test(name) || name === 'index.part') { await fs.unlink(this.root + '/' + name).catch(() => {}); continue; }
      if (!/^[a-f0-9]{64}\.img$/.test(name)) { continue; }
      const size = (await fs.stat(this.root + '/' + name)).size; const key = name.slice(0, -4);
      if (!Number.isInteger(size) || size <= 0 || size > posterByteLimit) { await fs.unlink(this.root + '/' + name); continue; }
      const old = known.find((v: Entry) => v && v.key === key && v.size === size && Number.isFinite(v.touched) && Number.isFinite(v.saved));
      this.entries.push({ key: key, size: size, touched: old?.touched ?? 0, saved: old?.saved ?? 0 });
    }
    this.ready = true; await this.trim(0); await this.index();
  }
  private disk<T>(work: () => Promise<T>): Promise<T> {
    const result = this.serial.then(work); this.serial = result.then(() => {}, () => {}); return result;
  }
  private async write(path: string, bytes: ArrayBuffer): Promise<void> {
    const file = await fs.open(path, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
    try {
      let offset = 0;
      while (offset < bytes.byteLength) { const n = await fs.write(file.fd, bytes.slice(offset)); if (n <= 0) { throw new Error('poster_cache_unavailable'); } offset += n; }
      await fs.fsync(file.fd);
    } finally { await fs.close(file); }
  }
  private async index(): Promise<void> {
    await this.write(this.root + '/index.part', new util.TextEncoder().encodeInto(JSON.stringify({ entries: this.entries } as Index)).buffer as ArrayBuffer);
    await fs.rename(this.root + '/index.part', this.root + '/index.json');
  }
  private async read(entry: Entry): Promise<ArrayBuffer> {
    const size = (await fs.stat(this.root + '/' + entry.key + '.img')).size;
    if (size !== entry.size || size <= 0 || size > posterByteLimit) { throw new Error('poster_invalid'); }
    const file = await fs.open(this.root + '/' + entry.key + '.img', fs.OpenMode.READ_ONLY); const bytes = new Uint8Array(size);
    try {
      let offset = 0;
      while (offset < size) { const part = new ArrayBuffer(size - offset); const n = await fs.read(file.fd, part); if (n <= 0) { throw new Error('poster_invalid'); } bytes.set(new Uint8Array(part, 0, n), offset); offset += n; }
    } finally { await fs.close(file); }
    if (!rasterImage(bytes.buffer as ArrayBuffer)) { throw new Error('poster_invalid'); }
    return bytes.buffer as ArrayBuffer;
  }
  private async remove(key: string): Promise<void> {
    try { await fs.unlink(this.root + '/' + key + '.img'); }
    catch (e) { if (fs.accessSync(this.root + '/' + key + '.img')) { throw e as Error; } }
    this.entries = this.entries.filter((v: Entry) => v.key !== key);
  }
  private async trim(extra: number): Promise<void> {
    const sorted = [...this.entries].sort((a: Entry, b: Entry) => a.touched - b.touched || a.key.localeCompare(b.key));
    while ((this.entries.reduce((n: number, e: Entry) => n + e.size, 0) + extra > this.options.maxMb * 1024 * 1024 || this.entries.length + (extra > 0 ? 1 : 0) > PosterCache.maxEntries) && sorted.length) {
      await this.remove(sorted.shift()!.key);
    }
  }
  private live(lease: Lease): boolean { try { return lease.active && lease.allowed(); } catch (e) { return false; } }
  private online(lease: Lease): boolean { try { return this.live(lease) && lease.online(); } catch (e) { return false; } }
  private valid(job: Job): boolean { return job.epoch === this.epoch && Array.from(job.leases).some((v: Lease) => this.online(v)); }
  cancelAll(notify: boolean = true): void {
    ++this.epoch;
    this.jobs.forEach((job: Job) => { job.transfer?.cancel(); job.reject(new Error('poster_cancelled')); });
    this.jobs.clear(); this.queue = [];
    if (notify) { AppStorage.setOrCreate('cineIslePosterRevision', this.epoch); }
  }
  request(account: string, target: PosterTarget, fetch: (allowed: () => boolean) => PosterTransfer, online: () => boolean, allowed: () => boolean): PosterTicket {
    const lease: Lease = { active: true, allowed: allowed, online: online, fetch: fetch }; let detach: () => void = () => {};
    const result = this.resolve(account, target, lease, (fn: () => void) => { detach = fn; });
    return { result: result, cancel: () => { lease.active = false; detach(); } };
  }
  private async resolve(account: string, target: PosterTarget, lease: Lease, attach: (detach: () => void) => void): Promise<PosterData> {
    const epoch = this.epoch; await this.initialize();
    if (!this.live(lease) || epoch !== this.epoch || !validPosterTarget(target) || !account || account.length > PosterCache.maxAccountKeyCodeUnits) { throw new Error('poster_cancelled'); }
    let key = ''; let cacheable = true;
    try {
      const md = crypto.createMd('SHA256');
      await md.update({ data: new util.TextEncoder().encodeInto(JSON.stringify([account, target.id, target.tag ?? '', target.backdrop, target.width, 'jpeg-v1'])) });
      key = Array.from((await md.digest()).data).map((n: number) => n.toString(16).padStart(2, '0')).join('');
    } catch (e) { cacheable = false; key = 'volatile-' + util.generateRandomUUID(); this.issue = 'poster_cache_unavailable'; }
    if (!this.live(lease) || epoch !== this.epoch) { throw new Error('poster_cancelled'); }
    let cached: ArrayBuffer | undefined; let saved = 0;
    if (cacheable && this.ready && this.options.enabled) {
      try { cached = await this.disk(async () => { const entry = this.entries.find((v: Entry) => v.key === key); if (!entry) { return undefined; } saved = entry.saved; const bytes = await this.read(entry); entry.touched = Date.now(); try { await this.index(); } catch (e) { this.issue = 'poster_cache_unavailable'; } return bytes; }); }
      catch (e) { await this.forget(key); }
    }
    if (!this.live(lease) || epoch !== this.epoch) { throw new Error('poster_cancelled'); }
    if (cached && (target.tag || Date.now() - saved < PosterCache.untaggedFreshnessMs || !this.online(lease))) { return { key: key, bytes: cached }; }
    if (!this.online(lease)) { throw new Error('poster_missing'); }
    let job = this.jobs.get(key);
    if (!job) {
      if (this.queue.length >= PosterCache.maxQueuedJobs) { throw new Error('poster_busy'); }
      job = new Job(key, epoch, cacheable); this.jobs.set(key, job); this.queue.push(job);
    }
    const joined = job; joined.leases.add(lease);
    attach(() => { joined.leases.delete(lease); if (!Array.from(joined.leases).some((v: Lease) => this.live(v))) { joined.transfer?.cancel(); joined.reject(new Error('poster_cancelled')); this.queue = this.queue.filter((v: Job) => v !== joined); if (this.jobs.get(key) === joined) { this.jobs.delete(key); } } });
    this.drain();
    try { const bytes = await joined.result; if (!this.live(lease) || epoch !== this.epoch) { throw new Error('poster_cancelled'); } return { key: key, bytes: bytes }; }
    catch (e) { if (cached && (e as Error).message === 'poster_unavailable' && this.options.enabled && this.live(lease) && epoch === this.epoch) { return { key: key, bytes: cached }; } throw e as Error; }
    finally { joined.leases.delete(lease); }
  }
  private drain(): void {
    while (this.active < PosterCache.maxConcurrentJobs && this.queue.length) {
      const job = this.queue.shift()!;
      if (!this.valid(job)) { job.reject(new Error('poster_cancelled')); if (this.jobs.get(job.key) === job) { this.jobs.delete(job.key); } continue; }
      ++this.active; this.run(job);
    }
  }
  private async run(job: Job): Promise<void> {
    try {
      const lease = Array.from(job.leases).find((v: Lease) => this.online(v))!;
      job.transfer = lease.fetch(() => this.valid(job)); const bytes = await job.transfer.result;
      if (!this.valid(job)) { throw new Error('poster_cancelled'); }
      if (!bytes.byteLength || bytes.byteLength > posterByteLimit || !rasterImage(bytes)) { throw new Error('poster_invalid'); }
      if (job.cacheable && this.ready && this.options.enabled && bytes.byteLength <= this.options.maxMb * 1024 * 1024) {
        try { await this.disk(async () => {
          if (!this.valid(job) || !this.options.enabled) { return; }
          await this.remove(job.key); await this.trim(bytes.byteLength);
          try {
            await this.write(this.root + '/' + job.key + '.part', bytes);
            if (!this.valid(job) || !this.options.enabled) { await fs.unlink(this.root + '/' + job.key + '.part'); return; }
            await fs.rename(this.root + '/' + job.key + '.part', this.root + '/' + job.key + '.img');
            this.entries.push({ key: job.key, size: bytes.byteLength, touched: Date.now(), saved: Date.now() }); await this.index();
          } catch (e) { await fs.unlink(this.root + '/' + job.key + '.part').catch(() => {}); throw e as Error; }
        }); } catch (e) { this.issue = 'poster_cache_unavailable'; }
      }
      if (!this.valid(job)) { throw new Error('poster_cancelled'); } job.resolve(bytes);
    } catch (e) { job.reject(e as Error); }
    finally { if (this.jobs.get(job.key) === job) { this.jobs.delete(job.key); } --this.active; this.drain(); }
  }
  async forget(key: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(key)) { return; }
    try { await this.disk(async () => { await this.remove(key); await this.index(); }); } catch (e) { this.issue = 'poster_cache_unavailable'; }
  }
  async usage(): Promise<PosterUsage> {
    await this.initialize(); if (!this.ready) { throw new Error('poster_cache_unavailable'); } return this.disk<PosterUsage>(async () => {
      for (const entry of [...this.entries]) { try { if ((await fs.stat(this.root + '/' + entry.key + '.img')).size !== entry.size) { await this.remove(entry.key); } } catch (e) { await this.remove(entry.key); } }
      return { bytes: this.entries.reduce((n: number, e: Entry) => n + e.size, 0), files: this.entries.length, issue: this.issue };
    });
  }
  async clear(allowed: () => boolean): Promise<PosterUsage> {
    await this.initialize(); if (!allowed()) { throw new Error('poster_cancelled'); } this.cancelAll(false);
    await this.disk(async () => { if (!allowed()) { throw new Error('poster_cancelled'); } for (const entry of [...this.entries]) { await this.remove(entry.key); } for (const name of await fs.listFile(this.root)) { if (/^[a-f0-9]{64}\.part$/.test(name) || name === 'index.part') { await fs.unlink(this.root + '/' + name); } } await this.index(); });
    this.issue = ''; return this.usage();
  }
  async save(value: PosterOptions, allowed: () => boolean): Promise<PosterOptions> {
    if (!validPosterOptions(value)) { throw new Error('poster_options_invalid'); }
    const next: PosterOptions = { enabled: value.enabled, maxMb: value.maxMb };
    const writing = this.settings.then(async () => {
      await this.initialize(); if (!allowed()) { throw new Error('poster_cancelled'); }
      if (!this.store) { this.store = await preferences.getPreferences(this.context, { name: PosterCache.storeName }); }
      if (!allowed()) { throw new Error('poster_cancelled'); } const previous = this.persisted;
      try { const encoded = JSON.stringify(next); await this.store.put(PosterCache.valueKey, encoded); await this.store.flush(); this.persisted = encoded; }
      catch (e) { try { await this.store.put(PosterCache.valueKey, previous); await this.store.flush(); } catch (restore) { this.store = undefined; throw new Error('poster_options_restore_failed'); } throw new Error('poster_options_save_failed'); }
      this.options = next; this.cancelAll(); this.issue = '';
      try { if (this.ready) { await this.disk(async () => { await this.trim(0); await this.index(); }); } } catch (e) { this.issue = 'poster_cache_trim_failed'; }
    });
    this.settings = writing.catch(() => {}); await writing; return this.snapshot();
  }
}
