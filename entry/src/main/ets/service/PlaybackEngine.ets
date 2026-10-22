import media from '@ohos.multimedia.media';
import audio from '@ohos.multimedia.audio';
import { SubtitleContent } from '../utils/InlineSubtitle';

export interface EngineSubtitle extends media.SubtitleInfo { content?: SubtitleContent }

export interface PlaybackEvents {
  state: (state: string) => void;
  time: (position: number) => void;
  seek: (position: number) => void;
  subtitle: (info: EngineSubtitle) => void;
  frame: () => void;
  error: () => void;
  interrupt: (event: audio.InterruptEvent) => void;
}

// The controller retains queue, reports, subtitle caches and progress ownership across engines.
export interface PlaybackEngine {
  readonly nativeSubtitles: boolean;
  readonly state: string;
  readonly duration: number;
  readonly currentTime: number;
  readonly width: number;
  readonly height: number;
  url: string | undefined;
  fdSrc: media.AVFileDescriptor | undefined;
  surfaceId: string | undefined;
  audioRendererInfo: audio.AudioRendererInfo | undefined;
  bind(events: PlaybackEvents): void;
  prepare(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  release(): Promise<void>;
  seek(position: number, mode: media.SeekMode): void;
  setSpeed(speed: media.PlaybackSpeed): void;
  setVolume(volume: number): void;
  setSurfaceSize(width: number, height: number): void;
  getTrackDescription(): Promise<media.MediaDescription[]>;
  getSelectedTracks(): Promise<number[]>;
  selectTrack(index: number): Promise<void>;
  setNativeSubtitleVisible(visible: boolean): Promise<void>;
}
export type PlaybackEngineFactory = () => Promise<PlaybackEngine>;

export class NativePlaybackEngine implements PlaybackEngine {
  readonly nativeSubtitles: boolean = false;
  private player: media.AVPlayer;
  private constructor(player: media.AVPlayer) { this.player = player; }
  static async create(): Promise<PlaybackEngine> { return new NativePlaybackEngine(await media.createAVPlayer()); }
  get state(): string { return this.player.state; }
  get duration(): number { return this.player.duration; }
  get currentTime(): number { return this.player.currentTime; }
  get width(): number { return this.player.width; }
  get height(): number { return this.player.height; }
  get url(): string | undefined { return this.player.url; }
  set url(value: string | undefined) { this.player.url = value; }
  get fdSrc(): media.AVFileDescriptor | undefined { return this.player.fdSrc; }
  set fdSrc(value: media.AVFileDescriptor | undefined) { this.player.fdSrc = value; }
  get surfaceId(): string | undefined { return this.player.surfaceId; }
  set surfaceId(value: string | undefined) { this.player.surfaceId = value; }
  get audioRendererInfo(): audio.AudioRendererInfo | undefined { return this.player.audioRendererInfo; }
  set audioRendererInfo(value: audio.AudioRendererInfo | undefined) { this.player.audioRendererInfo = value; }
  bind(events: PlaybackEvents): void {
    this.player.on('stateChange', events.state); this.player.on('timeUpdate', events.time);
    this.player.on('seekDone', events.seek); this.player.on('subtitleUpdate', events.subtitle);
    this.player.on('startRenderFrame', events.frame); this.player.on('error', events.error);
    this.player.on('audioInterrupt', events.interrupt);
  }
  prepare(): Promise<void> { return this.player.prepare(); }
  play(): Promise<void> { return this.player.play(); }
  pause(): Promise<void> { return this.player.pause(); }
  release(): Promise<void> { return this.player.release(); }
  seek(position: number, mode: media.SeekMode): void { this.player.seek(position, mode); }
  setSpeed(speed: media.PlaybackSpeed): void { this.player.setSpeed(speed); }
  setVolume(volume: number): void { this.player.setVolume(volume); }
  setSurfaceSize(_width: number, _height: number): void { /* AVPlayer follows its platform surface. */ }
  getTrackDescription(): Promise<media.MediaDescription[]> { return this.player.getTrackDescription(); }
  getSelectedTracks(): Promise<number[]> { return this.player.getSelectedTracks(); }
  selectTrack(index: number): Promise<void> { return this.player.selectTrack(index); }
  async setNativeSubtitleVisible(_visible: boolean): Promise<void> { /* Native subtitle cues are drawn by the view. */ }
}
