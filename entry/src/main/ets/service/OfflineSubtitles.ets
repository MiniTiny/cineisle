import { SubtitleTransferLimits, SubtitleDocumentLimits } from '../utils/SubtitleLimits';
import fs from '@ohos.file.fs';
import common from '@ohos.app.ability.common';
import { downloadNetwork } from '../utils/Downloads';
import { SubtitleTransfer } from './SubtitleTransfer';
import { DownloadRecord, DownloadSubtitle, MediaSource } from '../model/Models';
import { parseSubtitles, SubtitleCue, subtitleFormat, textSubtitle, validAssDocument } from '../utils/Playback';
import { downloadStem } from '../utils/DownloadIdentity';
import { JellyfinClient } from './JellyfinClient';

// Cache convertible text tracks, including embedded tracks unsupported by the native decoder.
// Preserve ASS styles in their original document. Authenticated delivery URLs never enter JSON.
export class OfflineSubtitles {
  private static readonly maximumTitleCodeUnits: number = 256;
  private static readonly maximumLanguageCodeUnits: number = 63;

  static plan(record: DownloadRecord, source: MediaSource, directory: string): DownloadSubtitle[] {
    const seen = new Set<number>();
    return (source.MediaStreams ?? []).filter((stream) => {
      if (!textSubtitle(stream) || seen.has(stream.Index)) { return false; }
      seen.add(stream.Index); return true;
    }).map((stream): DownloadSubtitle => ({ index: stream.Index, title: (stream.DisplayTitle || stream.Language || stream.Codec || '').slice(0, OfflineSubtitles.maximumTitleCodeUnits),
      language: (stream.Language ?? '').slice(0, OfflineSubtitles.maximumLanguageCodeUnits), format: subtitleFormat(stream),
      path: `${directory}/${downloadStem(record)}.subtitle-${stream.Index}.${subtitleFormat(stream)}`, state: 'pending' }));
  }

  static document(subtitle: DownloadSubtitle): string {
    if (!fs.accessSync(subtitle.path) || fs.statSync(subtitle.path).size > SubtitleTransferLimits.maxBytes) { throw new Error('offline_subtitle_failed'); }
    const content = fs.readTextSync(subtitle.path);
    if ((subtitle.format ?? 'srt') === 'ass' ? !validAssDocument(content) : !parseSubtitles(content).length) { throw new Error('offline_subtitle_failed'); }
    return content;
  }

  static read(subtitle: DownloadSubtitle): SubtitleCue[] {
    if (subtitle.format === 'ass') { throw new Error('offline_subtitle_failed'); }
    return parseSubtitles(OfflineSubtitles.document(subtitle));
  }

  static async fetch(record: DownloadRecord, client: JellyfinClient, owned: () => boolean, save: () => void, context: common.UIAbilityContext,
    plan: DownloadSubtitle[] = record.subtitles ?? []): Promise<void> {
    let failed = false;
    for (const planned of plan) {
      if (!owned()) { return; }
      const old = record.subtitles?.find((value: DownloadSubtitle) => value.index === planned.index);
      try {
        if (old?.state === 'ready' && old.path === planned.path && (old.format ?? 'srt') === (planned.format ?? 'srt')) { OfflineSubtitles.document(old); continue; }
      } catch (e) { /* A missing or invalid file needs a new validated download. */ }
      const subtitle: DownloadSubtitle = { index: planned.index, title: planned.title, language: planned.language,
        path: planned.path, format: planned.format, state: 'pending' };
      let downloaded = false;
      try {
        const content = await client.subtitle(record.id, record.mediaSourceId ?? '', subtitle.index,
          new SubtitleTransfer(client.subtitleTransport(), context, subtitle.path, record.network ?? downloadNetwork(), owned), subtitle.format ?? 'srt');
        if (!owned()) { return; }
        if (content.length > SubtitleDocumentLimits.maxCodeUnits || (subtitle.format === 'ass' ? !validAssDocument(content) : !parseSubtitles(content).length)) { throw new Error('offline_subtitle_failed'); }
        const file = fs.openSync(subtitle.path + '.tmp', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
        try { fs.writeSync(file.fd, content); fs.fsyncSync(file.fd); } finally { fs.closeSync(file); }
        fs.renameSync(subtitle.path + '.tmp', subtitle.path); subtitle.state = 'ready'; downloaded = true;
      } catch (e) {
        if (!owned()) { return; }
        failed = true; subtitle.state = 'failed'; OfflineSubtitles.unlink(subtitle.path + '.tmp');
        // A failed format upgrade leaves the usable previous document and its metadata intact.
        if (old?.state === 'ready' && old.path !== subtitle.path) { continue; }
      }
      const previous = record.subtitles;
      record.subtitles = (previous ?? []).map((value: DownloadSubtitle) => value.index === subtitle.index ? subtitle : value);
      if (!old) { record.subtitles.push(subtitle); }
      try { save(); }
      catch (e) {
        record.subtitles = previous;
        if (downloaded) { OfflineSubtitles.unlink(subtitle.path); }
        throw e as Error;
      }
      if (downloaded && old && old.path !== subtitle.path) { OfflineSubtitles.unlink(old.path); }
    }
    if (owned()) {
      const previous = record.subtitleState;
      record.subtitleState = !failed && (record.subtitles ?? []).every((s: DownloadSubtitle) => s.state === 'ready') ? 'ready' : 'failed';
      try { save(); } catch (e) { record.subtitleState = previous; throw e as Error; }
    }
  }

  private static unlink(path: string): void {
    try { if (fs.accessSync(path)) { fs.unlinkSync(path); } } catch (e) { /* Owned leftovers are also removed with the download. */ }
  }

  static remove(record: DownloadRecord): void {
    for (const subtitle of record.subtitles ?? []) {
      const stem = subtitle.path.slice(0, subtitle.path.lastIndexOf('.'));
      for (const extension of ['srt', 'ass']) {
        for (const suffix of ['', '.tmp', '.fetch']) {
          const path = `${stem}.${extension}${suffix}`; if (fs.accessSync(path)) { fs.unlinkSync(path); }
        }
      }
    }
  }
}
