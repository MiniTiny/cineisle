import fs from '@ohos.file.fs';
import common from '@ohos.app.ability.common';
import { downloadNetwork } from '../utils/Downloads';
import { SubtitleTransfer } from './SubtitleTransfer';
import { DownloadRecord, DownloadSubtitle, MediaSource } from '../model/Models';
import { parseSubtitles, SubtitleCue, textSubtitle } from '../utils/Playback';
import { downloadStem } from '../utils/DownloadIdentity';
import { JellyfinClient } from './JellyfinClient';

// Cache convertible text tracks, including embedded tracks unsupported by the native decoder.
// Only SRT text and safe metadata are persisted. Authenticated delivery URLs never enter JSON.
export class OfflineSubtitles {
  static plan(record: DownloadRecord, source: MediaSource, directory: string): DownloadSubtitle[] {
    const seen = new Set<number>();
    return (source.MediaStreams ?? []).filter((stream) => {
      if (!textSubtitle(stream) || seen.has(stream.Index)) { return false; }
      seen.add(stream.Index); return true;
    }).map((stream): DownloadSubtitle => ({ index: stream.Index, title: (stream.DisplayTitle || stream.Language || stream.Codec || '').slice(0, 256),
      language: (stream.Language ?? '').slice(0, 63), path: `${directory}/${downloadStem(record)}.subtitle-${stream.Index}.srt`, state: 'pending' }));
  }

  static read(subtitle: DownloadSubtitle): SubtitleCue[] {
    if (!fs.accessSync(subtitle.path) || fs.statSync(subtitle.path).size > 4 * 1024 * 1024) { throw new Error('offline_subtitle_failed'); }
    const cues = parseSubtitles(fs.readTextSync(subtitle.path));
    if (!cues.length) { throw new Error('offline_subtitle_failed'); }
    return cues;
  }

  static async fetch(record: DownloadRecord, client: JellyfinClient, owned: () => boolean, save: () => void, context: common.UIAbilityContext): Promise<void> {
    for (const subtitle of record.subtitles ?? []) {
      if (!owned()) { return; }
      try {
        if (subtitle.state === 'ready') { OfflineSubtitles.read(subtitle); continue; }
      } catch (e) { subtitle.state = 'pending'; }
      try {
        const content = await client.subtitle(record.id, record.mediaSourceId ?? '', subtitle.index,
          new SubtitleTransfer(client.subtitleTransport(), context, subtitle.path, record.network ?? downloadNetwork(), owned));
        if (!owned()) { return; }
        if (content.length > 1024 * 1024 || !parseSubtitles(content).length) { throw new Error('offline_subtitle_failed'); }
        const file = fs.openSync(subtitle.path + '.tmp', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
        try { fs.writeSync(file.fd, content); fs.fsyncSync(file.fd); } finally { fs.closeSync(file); }
        fs.renameSync(subtitle.path + '.tmp', subtitle.path); subtitle.state = 'ready';
      } catch (e) {
        if (!owned()) { return; }
        subtitle.state = 'failed';
        if (fs.accessSync(subtitle.path + '.tmp')) { fs.unlinkSync(subtitle.path + '.tmp'); }
      }
      save();
    }
    if (owned()) { record.subtitleState = (record.subtitles ?? []).every((s: DownloadSubtitle) => s.state === 'ready') ? 'ready' : 'failed'; save(); }
  }

  static remove(record: DownloadRecord): void {
    for (const subtitle of record.subtitles ?? []) {
      for (const path of [subtitle.path, subtitle.path + '.tmp']) { if (fs.accessSync(path)) { fs.unlinkSync(path); } }
    }
  }
}
