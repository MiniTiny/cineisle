import { SubtitleTransferLimits } from '../utils/SubtitleLimits';
import statvfs from '@ohos.file.statvfs';
import fs from '@ohos.file.fs';
import { DownloadRecord } from '../model/Models';
import { text } from '../utils/Strings';
import { AppFailure } from '../utils/Failures';

export class DownloadSpace {
  private static readonly bytesPerMiB: number = 1048576;
  private static readonly safetyMarginBytes: number = 8 * DownloadSpace.bytesPerMiB;
  private static subtitleReservations: Map<DownloadRecord, number[]> = new Map();
  static reserveSubtitles(record: DownloadRecord, count: number): () => void {
    const claims = DownloadSpace.subtitleReservations.get(record) ?? [];
    claims.push(count * SubtitleTransferLimits.maxBytes); DownloadSpace.subtitleReservations.set(record, claims);
    let released = false;
    return () => {
      if (released) { return; } released = true;
      claims.splice(claims.indexOf(count * SubtitleTransferLimits.maxBytes), 1);
      if (!claims.length) { DownloadSpace.subtitleReservations.delete(record); }
    };
  }
  private static bytes(path: string): number {
    try { return fs.accessSync(path) ? Math.max(0, fs.statSync(path).size) : 0; } catch (e) { return 0; }
  }
  private static reserved(records: DownloadRecord[]): number {
    return records.reduce((sum: number, active: DownloadRecord) => {
      const video = active.state === 'downloading' ? Math.max(0, (active.expectedSize ?? 0) - DownloadSpace.bytes(active.path)) : 0;
      const subtitles = active.subtitleState === 'pending' ? (active.subtitles ?? []).reduce((n: number, sub) => n + Math.max(0, SubtitleTransferLimits.maxBytes - DownloadSpace.bytes(sub.path)), 0) : 0;
      const reserved = Math.max(0, ...(DownloadSpace.subtitleReservations.get(active) ?? []));
      return sum + video + Math.max(subtitles, reserved);
    }, 0);
  }
  static async checkOptional(directory: string, bytes: number, records: DownloadRecord[]): Promise<void> {
    const free = await statvfs.getFreeSize(directory); const needed = DownloadSpace.reserved(records) + bytes + DownloadSpace.safetyMarginBytes;
    if (!Number.isSafeInteger(free) || !Number.isSafeInteger(needed) || bytes < 0 || free < needed) { throw new Error('download_space_check_failed'); }
  }
  static async check(directory: string, record: DownloadRecord, records: DownloadRecord[], subtitleOnly: boolean = false): Promise<void> {
    let free: number;
    try { free = await statvfs.getFreeSize(directory); } catch (e) { throw new Error('download_space_check_failed'); }
    if (!Number.isSafeInteger(free) || free < 0) { throw new Error('download_space_check_failed'); }
    const reserved = DownloadSpace.reserved(records);
    const subtitles = (record.subtitles ?? []).filter((sub) => sub.state !== 'ready' || !fs.accessSync(sub.path));
    const needed = (subtitleOnly ? 0 : record.expectedSize ?? 0) + subtitles.length * SubtitleTransferLimits.maxBytes + DownloadSpace.safetyMarginBytes;
    if (!Number.isSafeInteger(reserved + needed) || free < reserved + needed) {
      const requiredMb = Math.ceil((reserved + needed) / DownloadSpace.bytesPerMiB); const availableMb = Math.floor(free / DownloadSpace.bytesPerMiB);
      throw new AppFailure('download_space_insufficient', 'storage', text('download_space_insufficient', requiredMb, availableMb), [requiredMb, availableMb]);
    }
  }
}
