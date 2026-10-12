import media from '@ohos.multimedia.media';
import audio from '@ohos.multimedia.audio';
import fs from '@ohos.file.fs';
import { PlaybackRoute } from '../model/Models';
import { parseSubtitles, subtitleAt, SubtitleCue, textSubtitle, TrackChoice } from '../utils/Playback';
import { text } from '../utils/Strings';
import { JellyfinClient } from './JellyfinClient';
import { PlaybackPreferences, preferredTrack } from '../utils/PlaybackPreferences';

export interface PlayerView {
  state: (state: string) => void;
  time: (position: number, duration: number) => void;
  tracks: (audio: TrackChoice[], subtitles: TrackChoice[], audioKey: string, subtitleKey: string) => void;
  subtitle: (value: string) => void;
  error: (message: string) => void;
  reportError: (failed: boolean) => void;
  complete: () => void;
  beforePlay?: () => Promise<boolean>;
  interrupted?: () => void;
}
interface PendingReport { route: PlaybackRoute; position: number; paused: boolean }
export interface PlaybackStatus {
  route: PlaybackRoute; state: string; position: number; duration: number; speed: number; width: number; height: number;
}

// Owns the native player and its FD. Every asynchronous callback is tied to one load.
export class PlaybackController {
  private player: media.AVPlayer | undefined = undefined;
  private file: fs.File | undefined = undefined;
  private generation: number = 0;
  private selection: number = 0;
  private audioSelection: number = 0;
  private preferenceRevision: number = 0;
  private audioOperations: Promise<void> = Promise.resolve();
  private pendingAudio: number = 0;
  private route: PlaybackRoute = new PlaybackRoute();
  private audio: TrackChoice[] = [];
  private subtitles: TrackChoice[] = [];
  private audioKey: string = '';
  private subtitleKey: string = '';
  private cues: SubtitleCue[] = [];
  private nativeSubtitle: string = '';
  private subtitleEnded: boolean = false;
  private subtitleStart: number = 0;
  private subtitleEnd: number = 0;
  private position: number = 0;
  private started: boolean = false;
  private paused: boolean = false;
  private hidden: boolean = false;
  private lastReport: number = 0;
  private speed: media.PlaybackSpeed = media.PlaybackSpeed.SPEED_FORWARD_1_00_X;
  private rate: number = 1;
  private reports: Promise<void> = Promise.resolve();
  private pendingProgress: Map<number, PendingReport> = new Map();
  private client: JellyfinClient | undefined;
  private view: PlayerView;
  private preferences: () => PlaybackPreferences;
  constructor(client: JellyfinClient | undefined, view: PlayerView, preferences: () => PlaybackPreferences = () => new PlaybackPreferences()) {
    this.client = client; this.view = view; this.preferences = preferences;
  }

  private active(player: media.AVPlayer, generation: number): boolean {
    return this.player === player && this.generation === generation;
  }

  private send(event: string): void {
    if (this.route.offline || !this.client) { return; }
    const generation = this.generation; const client = this.client;
    const report: PendingReport = { route: this.route, position: this.position, paused: this.paused };
    if (event === 'Progress') {
      const pending = this.pendingProgress.get(generation);
      if (pending) { pending.position = report.position; pending.paused = report.paused; return; }
      this.pendingProgress.set(generation, report);
    }
    // Capture identity before enqueueing, so old stop/progress cannot be attributed to a new source.
    this.reports = this.reports.then(async () => {
      if (event === 'Progress') { this.pendingProgress.delete(generation); }
      try { await client.report(event, report.route.item.Id, report.route.mediaSourceId, report.route.playSessionId, report.position / 1000, report.paused);
        if (generation === this.generation) { this.view.reportError(false); }
      } catch (e) { if (generation === this.generation) { this.view.reportError(true); } }
    });
  }

  private stopReport(): void {
    if (this.started) { this.paused = true; this.send('Stopped'); this.started = false; }
  }

  async close(): Promise<void> {
    this.stopReport(); ++this.generation; ++this.selection; ++this.audioSelection; ++this.preferenceRevision;
    this.audioOperations = Promise.resolve(); this.pendingAudio = 0;
    const player = this.player; const file = this.file;
    this.player = undefined; this.file = undefined;
    this.cues = []; this.nativeSubtitle = ''; this.view.subtitle('');
    try { if (player) { await player.release(); } }
    catch (e) { this.view.error(text('player_release_failed')); }
    finally { if (file) { fs.closeSync(file); } }
  }

  async open(route: PlaybackRoute, surface: string, position: number = -1, paused: boolean = false): Promise<void> {
    const closing = this.close(); const generation = this.generation;
    await closing;
    if (generation !== this.generation) { return; }
    this.route = route; this.position = 0; this.paused = paused; this.started = false; this.subtitleEnded = false;
    this.audio = []; this.subtitles = []; this.audioKey = ''; this.subtitleKey = ''; this.lastReport = 0;
    this.view.tracks([], [], '', ''); this.view.time(0, 0); this.view.state('loading');
    const resume = position >= 0 ? position : (route.item.UserData?.PlaybackPositionTicks ?? 0) / 10000;
    try {
      const player = await media.createAVPlayer();
      if (generation !== this.generation) { await player.release(); return; }
      this.player = player;
      player.on('stateChange', (state: string) => {
        if (!this.active(player, generation)) { return; }
        if (state === 'playing' && this.paused) { this.pausePlayback(); return; }
        this.view.state(state);
        if (state === 'initialized') {
          player.surfaceId = surface;
          player.audioRendererInfo = { usage: audio.StreamUsage.STREAM_USAGE_MOVIE, rendererFlags: 0 };
          player.prepare().catch(() => { if (this.active(player, generation)) { this.view.error(text('play_error')); } });
        } else if (state === 'prepared') {
          this.prepared(player, generation, resume);
        } else if (state === 'playing') {
          this.paused = false;
          if (!this.started) { this.started = true; this.send(''); } else { this.send('Progress'); }
        } else if (state === 'paused') {
          this.paused = true; if (this.started) { this.send('Progress'); }
        } else if (state === 'completed') {
          this.subtitleEnded = true; this.nativeSubtitle = ''; this.view.subtitle('');
          this.position = player.duration; this.view.time(this.position, player.duration); this.stopReport(); this.view.complete();
        } else if (state === 'error') { this.subtitleEnded = true; this.view.subtitle(''); this.stopReport(); this.view.error(text('play_error')); }
      });
      player.on('timeUpdate', (position: number) => {
        if (!this.active(player, generation)) { return; }
        this.position = position; this.view.time(position, player.duration); this.renderSubtitle();
        if (this.started && !this.paused && Date.now() - this.lastReport >= 10000) { this.lastReport = Date.now(); this.send('Progress'); }
      });
      player.on('subtitleUpdate', (info: media.SubtitleInfo) => {
        if (!this.active(player, generation)) { return; }
        this.nativeSubtitle = info.text ?? '';
        this.subtitleStart = info.startTime ?? this.position;
        this.subtitleEnd = this.subtitleStart + (info.duration ?? 0);
        this.renderSubtitle();
      });
      player.on('error', () => { if (this.active(player, generation)) { this.subtitleEnded = true; this.view.subtitle(''); this.stopReport(); this.view.error(text('play_error')); } });
      player.on('audioInterrupt', (event: audio.InterruptEvent) => {
          if (!this.active(player, generation)) { return; }
          if (event.hintType === audio.InterruptHint.INTERRUPT_HINT_PAUSE || event.hintType === audio.InterruptHint.INTERRUPT_HINT_STOP) {
            this.paused = true; this.pausePlayback(); this.view.interrupted?.();
          }
          // Resume requires an explicit play command, so an interruption cannot undo a user's pause.
      });
      if (route.offline && route.filePath) {
        this.file = fs.openSync(route.filePath, fs.OpenMode.READ_ONLY);
        player.fdSrc = { fd: this.file.fd, offset: 0, length: fs.statSync(route.filePath).size };
      } else { player.url = route.url; }
    } catch (e) { if (generation === this.generation) { await this.close(); this.view.error(text('play_error')); } }
  }

  private async prepared(player: media.AVPlayer, generation: number, resume: number): Promise<void> {
    try {
      const descriptions = await player.getTrackDescription();
      const selected = await player.getSelectedTracks();
      if (!this.active(player, generation)) { return; }
      for (const info of descriptions) {
        const index = info[media.MediaDescriptionKey.MD_KEY_TRACK_INDEX] as number;
        const type = info[media.MediaDescriptionKey.MD_KEY_TRACK_TYPE] as number;
        if (!Number.isSafeInteger(index) || (type !== media.MediaType.MEDIA_TYPE_AUD && type !== media.MediaType.MEDIA_TYPE_SUBTITLE)) { continue; }
        const description = (info[media.MediaDescriptionKey.MD_KEY_LANGUAGE] as string) || (info[media.MediaDescriptionKey.MD_KEY_TRACK_NAME] as string) || '';
        const label = text(type === media.MediaType.MEDIA_TYPE_AUD ? 'audio_track_number' : 'subtitle_track_number', index + 1) + (description ? ` · ${description}` : '');
        const language = info[media.MediaDescriptionKey.MD_KEY_LANGUAGE];
        const track: TrackChoice = { key: `native:${index}`, index: index, type: type, label: label, remote: false,
          language: typeof language === 'string' ? language : '' };
        if (type === media.MediaType.MEDIA_TYPE_AUD) { this.audio.push(track); if (selected.includes(index)) { this.audioKey = track.key; } }
        else { this.subtitles.push(track); if (selected.includes(index)) { this.subtitleKey = track.key; } }
      }
      if (!this.route.offline) {
        const source = this.route.sources.find((source) => source.Id === this.route.mediaSourceId);
        for (const stream of source?.MediaStreams ?? []) {
          if (textSubtitle(stream)) {
            this.subtitles.push({ key: `server:${stream.Index}`, index: stream.Index, type: media.MediaType.MEDIA_TYPE_SUBTITLE,
              label: text('server_subtitle', stream.DisplayTitle || stream.Language || stream.Codec || stream.Index.toString()), remote: true, language: stream.Language ?? '' });
          }
        }
      }
      this.emitTracks(); this.view.time(0, player.duration);
      await this.applyPreferences(this.preferences(), false);
      if (!this.active(player, generation)) { return; }
      if (Number.isFinite(resume) && resume > 0 && resume < player.duration) { player.seek(resume, media.SeekMode.SEEK_CLOSEST); this.position = resume; }
      player.setSpeed(this.speed);
      if (!this.paused && !this.hidden) {
        const permitted = this.view.beforePlay ? await this.view.beforePlay() : true;
        if (permitted && this.active(player, generation) && !this.paused && !this.hidden) { await player.play(); }
      }
    } catch (e) { if (this.active(player, generation)) { this.view.error(text('play_error')); } }
  }

  private emitTracks(): void { this.view.tracks(this.audio.slice(), this.subtitles.slice(), this.audioKey, this.subtitleKey); }
  private renderSubtitle(): void {
    if (this.subtitleEnded || !this.player) { this.view.subtitle(''); return; }
    this.view.subtitle(this.subtitleKey.startsWith('server:') ? subtitleAt(this.cues, this.position) :
      this.subtitleKey.startsWith('native:') && this.position >= this.subtitleStart && this.position < this.subtitleEnd ? this.nativeSubtitle : '');
  }

  async selectAudio(key: string): Promise<void> {
    const player = this.player; const generation = this.generation; const revision = ++this.audioSelection;
    const track = this.audio.find((track: TrackChoice) => track.key === key);
    if (!player || !track) { return; }
    ++this.pendingAudio;
    const selecting = this.audioOperations.then(async () => {
      if (!this.active(player, generation) || revision !== this.audioSelection) { return; }
      try { await player.selectTrack(track.index);
        if (this.active(player, generation) && revision === this.audioSelection) { this.audioKey = key; this.emitTracks(); }
      } catch (e) { if (this.active(player, generation) && revision === this.audioSelection) { this.view.error(text('track_switch_failed')); } }
    });
    this.audioOperations = selecting;
    try { await selecting; } finally { if (generation === this.generation) { --this.pendingAudio; } }
  }

  async applyPreferences(preferences: PlaybackPreferences, waitForSubtitles: boolean = true): Promise<void> {
    const player = this.player; const generation = this.generation; const revision = ++this.preferenceRevision;
    // Even an unchanged/off preference must invalidate an earlier, still-loading subtitle selection.
    const subtitleRevision = ++this.selection;
    if (!player) { return; }
    const audioKey = preferredTrack(this.audio, preferences.audioLanguage, this.audioKey);
    if ((audioKey && audioKey !== this.audioKey) || this.pendingAudio > 0) { await this.selectAudio(audioKey ?? this.audioKey); }
    if (!this.active(player, generation) || revision !== this.preferenceRevision || subtitleRevision !== this.selection) { return; }
    const subtitleKey = preferences.subtitlesOff ? '' : preferredTrack(this.subtitles, preferences.subtitleLanguage, this.subtitleKey);
    if (subtitleKey !== undefined && subtitleKey !== this.subtitleKey) {
      const selecting = this.selectSubtitle(subtitleKey);
      // Online subtitle extraction can be slow. Audio is ready before playback; subtitle loading never blocks it.
      if (waitForSubtitles) { await selecting; }
    }
  }

  async selectSubtitle(key: string): Promise<void> {
    const player = this.player; const generation = this.generation; const revision = ++this.selection;
    const track = this.subtitles.find((track: TrackChoice) => track.key === key);
    if (!player || (key && !track)) { return; }
    try {
      let cues: SubtitleCue[] = [];
      if (track?.remote) {
        if (!this.client) { throw new Error('login_required'); }
        cues = parseSubtitles(await this.client.subtitle(this.route.item.Id, this.route.mediaSourceId, track.index));
        if (!cues.length) { throw new Error('subtitle_failed'); }
      }
      if (!this.active(player, generation) || revision !== this.selection) { return; }
      if (track && !track.remote) {
        const selected = await player.getSelectedTracks();
        if (!this.active(player, generation) || revision !== this.selection) { return; }
        if (!selected.includes(track.index)) { await player.selectTrack(track.index); this.nativeSubtitle = ''; }
      }
      if (!this.active(player, generation) || revision !== this.selection) { return; }
      // Subtitle rendering belongs to the view: off hides all cues without muting audio.
      this.cues = cues; this.subtitleKey = key; this.emitTracks(); this.renderSubtitle();
    } catch (e) { if (this.active(player, generation) && revision === this.selection) { this.view.error(text('subtitle_failed')); } }
  }

  async toggle(): Promise<void> {
    if (this.player?.state === 'playing') { await this.pausePlayback(); } else { await this.play(); }
  }

  async play(): Promise<boolean> {
    const player = this.player;
    if (!player || this.hidden) { return false; }
    if (player.state === 'playing') { return true; }
    if (!['prepared', 'paused', 'completed'].includes(player.state)) { return false; }
    try { this.paused = false; this.subtitleEnded = false; await player.play(); return this.player === player && !this.paused && this.snapshot().state === 'playing'; }
    catch (e) { this.view.error(text('play_error')); return false; }
  }

  async pausePlayback(): Promise<boolean> {
    this.paused = true;
    const player = this.player;
    if (!player || player.state !== 'playing') { return true; }
    try { await player.pause(); return true; }
    catch (e) { this.view.error(text('play_error')); return false; }
  }

  snapshot(): PlaybackStatus {
    return { route: this.route, state: this.player?.state ?? 'released', position: this.position,
      duration: this.player?.duration ?? 0, speed: this.rate, width: this.player?.width ?? 0, height: this.player?.height ?? 0 };
  }

  async hide(continuePlayback: boolean = false): Promise<boolean> {
    this.hidden = !continuePlayback;
    return continuePlayback ? true : this.pausePlayback();
  }

  pause(): void {
    this.hide(false);
  }
  show(): void { this.hidden = false; }
  seek(position: number): void {
    if (!Number.isFinite(position) || !this.player || !['prepared', 'playing', 'paused', 'completed'].includes(this.player.state)) { return; }
    try { this.player.seek(Math.max(0, Math.min(position, this.player.duration)), media.SeekMode.SEEK_CLOSEST);
      this.position = Math.max(0, Math.min(position, this.player.duration)); this.nativeSubtitle = ''; this.renderSubtitle();
    } catch (e) { this.view.error(text('play_error')); }
  }
  setSpeed(speed: number): void {
    this.rate = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(speed) ? speed : 1;
    const speeds: Map<number, media.PlaybackSpeed> = new Map([
      [0.5, media.PlaybackSpeed.SPEED_FORWARD_0_50_X], [0.75, media.PlaybackSpeed.SPEED_FORWARD_0_75_X],
      [1, media.PlaybackSpeed.SPEED_FORWARD_1_00_X], [1.25, media.PlaybackSpeed.SPEED_FORWARD_1_25_X],
      [1.5, media.PlaybackSpeed.SPEED_FORWARD_1_50_X], [1.75, media.PlaybackSpeed.SPEED_FORWARD_1_75_X], [2, media.PlaybackSpeed.SPEED_FORWARD_2_00_X]
    ]);
    this.speed = speeds.get(this.rate)!;
    try { if (this.player && ['prepared', 'playing', 'paused'].includes(this.player.state)) { this.player.setSpeed(this.speed); } }
    catch (e) { this.view.error(text('speed_failed')); }
  }
}
