import statvfs from '@ohos.file.statvfs';
import fs from '@ohos.file.fs';
import { DownloadRecord } from '../model/Models';
import { text } from '../utils/Strings';

export class DownloadSpace {
  private static bytes(path: string): number {
    try { return fs.accessSync(path) ? Math.max(0, fs.statSync(path).size) : 0; } catch (e) { return 0; }
  }
  private static reserved(records: DownloadRecord[]): number {
    return records.reduce((sum: number, active: DownloadRecord) => {
      const video = active.state === 'downloading' ? Math.max(0, (active.expectedSize ?? 0) - DownloadSpace.bytes(active.path)) : 0;
      const subtitles = active.subtitleState === 'pending' ? (active.subtitles ?? []).reduce((n: number, sub) => n + Math.max(0, 4 * 1024 * 1024 - DownloadSpace.bytes(sub.path)), 0) : 0;
      return sum + video + subtitles;
    }, 0);
  }
  static async checkOptional(directory: string, bytes: number, records: DownloadRecord[]): Promise<void> {
    const free = await statvfs.getFreeSize(directory); const needed = DownloadSpace.reserved(records) + bytes + 8 * 1048576;
    if (!Number.isSafeInteger(free) || !Number.isSafeInteger(needed) || bytes < 0 || free < needed) { throw new Error('download_space_check_failed'); }
  }
  static async check(directory: string, record: DownloadRecord, records: DownloadRecord[], subtitleOnly: boolean = false): Promise<void> {
    let free: number;
    try { free = await statvfs.getFreeSize(directory); } catch (e) { throw new Error('download_space_check_failed'); }
    if (!Number.isSafeInteger(free) || free < 0) { throw new Error('download_space_check_failed'); }
    const reserved = DownloadSpace.reserved(records);
    const subtitles = (record.subtitles ?? []).filter((sub) => sub.state !== 'ready' || !fs.accessSync(sub.path));
    const needed = (subtitleOnly ? 0 : record.expectedSize ?? 0) + subtitles.length * 4 * 1024 * 1024 + 8 * 1024 * 1024;
    if (!Number.isSafeInteger(reserved + needed) || free < reserved + needed) {
      throw new Error(text('download_space_insufficient', Math.ceil((reserved + needed) / 1048576), Math.floor(free / 1048576)));
    }
  }
}
