import { DownloadRecord } from '../model/Models';
import { safeItemId } from './Protocol';

// Existing downloads.json source-label format, independent of a platform notification title.
export class DownloadMetadataLimits {
  static readonly maxSourceNameCodeUnits: number = 256;
}

// Legacy records keep their original paths. New transfers own an opaque file stem, never a source URL.
export function downloadStem(record: DownloadRecord): string {
  return record.fileId ? 'download-' + record.fileId : safeItemId(record.id);
}
export function downloadKey(record: DownloadRecord): string { return record.path; }
export function sameDownload(record: DownloadRecord, id: string, sourceId: string): boolean {
  return record.id === id && (record.mediaSourceId ?? '') === sourceId;
}
export function downloadVersion(record: DownloadRecord): string {
  return record.sourceName || record.item.MediaSources?.find((source) => source.Id === record.mediaSourceId)?.Name || record.mediaSourceId || '';
}
