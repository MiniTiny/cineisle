import { playbackRateFromNative } from './PlaybackSpeedAdapter';
import media from '@ohos.multimedia.media';
import audio from '@ohos.multimedia.audio';
import deviceInfo from '@ohos.deviceInfo';
import * as native from 'libcineisle_mpv.so';
import { PlaybackEngine, PlaybackEvents, PlaybackBackendInfo } from './PlaybackEngine';
import { MpvAudioFocus } from './MpvAudioFocus';
import { SubtitleContent } from '../utils/InlineSubtitle';
import { mpvTextSubtitle } from '../utils/MpvTextSubtitle';
import { AssFonts } from './AssFonts';
import { MpvOptions, defaultMpvOptions, copyMpvOptions, validMpvOptions } from '../utils/MpvOptions';
import { MpvBridgeLimits } from '../utils/MpvLimits';

// The shim is safe to import on API12; the optional library is loaded only inside capability/create.
export class MpvPlaybackEngine implements PlaybackEngine {
  private nativeCaption: boolean = true;
  get nativeSubtitles(): boolean { return this.nativeCaption; }
  private wantedSubtitle: boolean = true;
  private subtitleStrategy: number = -1;
  private subtitleCacheKey: string = '';
  private subtitleContent: SubtitleContent | undefined;
  private subtitlePublished: string = '';
  private surfacePixelWidth: number = 0;
  private surfacePixelHeight: number = 0;
  private appliedSurfaceWidth: number = 0;
  private appliedSurfaceHeight: number = 0;
  private phase: string = 'idle';
  private events: PlaybackEvents | undefined;
  private handle: native.MpvHandle | undefined;
  private opening: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private released: boolean = false;
  private failed: boolean = false;
  private wantedPause: boolean = true;
  private intentRevision: number = 0;
  private polling: boolean = false;
  private pollWork: Promise<void> | undefined;
  private timer: number = -1;
  private timeout: number = -1;
  private ready: (() => void) | undefined;
  private rejectReady: ((error: Error) => void) | undefined;
  private wantedSeek: number = 0;
  private confirmedSeek: number = 0;
  private frameReady: boolean = false;
  private source: string = '';
  private fontConfiguration: string;
  private options: MpvOptions;
  private descriptor: media.AVFileDescriptor | undefined;
  private surface: string | undefined;
  private renderer: audio.AudioRendererInfo | undefined;
  private focus: MpvAudioFocus = new MpvAudioFocus(() => this.interrupted());
  private value: native.MpvState = { loaded: false, rendered: false, paused: true, ended: false, seeking: false,
    error: 0, duration: 0, position: 0, width: 0, height: 0, speed: 1, volume: 1, seekRevision: 0, seekDone: 0, tracks: [],
    subtitleText: '', subtitleAss: '', subtitleStart: -1, subtitleEnd: -1, subtitleEvents: '', subtitleFontSize: 55, subtitleOverflow: false, surfaceWidth: 0, surfaceHeight: 0,
    hardwareDecoder: '', videoOutput: '', audioOutput: '' };

  static async available(): Promise<boolean> {
    if (deviceInfo.sdkApiVersion < MpvBridgeLimits.minPlatformApi) { return false; }
    return (await native.capability(deviceInfo.sdkApiVersion)).supported;
  }
  private constructor(fontConfiguration: string, options: MpvOptions) { this.fontConfiguration = fontConfiguration; this.options = copyMpvOptions(options); }
  static async create(cacheDirectory: string, options: MpvOptions = defaultMpvOptions()): Promise<PlaybackEngine> {
    if (!await MpvPlaybackEngine.available()) { throw new Error('mpv_unavailable'); }
    if (!cacheDirectory || !cacheDirectory.startsWith('/')) { throw new Error('mpv_font_unavailable'); }
    if (!validMpvOptions(options)) { throw new Error('mpv_options_invalid'); }
    return new MpvPlaybackEngine(AssFonts.prepare(cacheDirectory).configuration, options);
  }
  get backend(): PlaybackBackendInfo | undefined {
    if (!this.value.loaded || !this.value.rendered || this.released || this.failed) { return undefined; }
    return { hardwareDecoder: this.value.hardwareDecoder, videoOutput: this.value.videoOutput, audioOutput: this.value.audioOutput };
  }
  get state(): string { return this.phase; }
  get duration(): number { return this.value.duration; }
  get currentTime(): number { return this.value.position; }
  get width(): number { return this.value.width; }
  get height(): number { return this.value.height; }
  get url(): string | undefined { return this.source || undefined; }
  set url(value: string | undefined) {
    if (!value || this.phase !== 'idle' || this.released) { throw new Error('mpv_source_invalid'); }
    this.source = value; this.initialize();
  }
  get fdSrc(): media.AVFileDescriptor | undefined { return this.descriptor; }
  set fdSrc(value: media.AVFileDescriptor | undefined) {
    if (!value || !Number.isSafeInteger(value.fd) || value.fd < 0 || (value.offset ?? 0) !== 0 || this.phase !== 'idle' || this.released) { throw new Error('mpv_source_invalid'); }
    // fd:// borrows the controller-owned FD; it remains open until engine release finishes.
    this.descriptor = value; this.source = `fd://${value.fd}`; this.initialize();
  }
  get surfaceId(): string | undefined { return this.surface; }
  set surfaceId(value: string | undefined) { this.surface = value; }
  get audioRendererInfo(): audio.AudioRendererInfo | undefined { return this.renderer; }
  set audioRendererInfo(value: audio.AudioRendererInfo | undefined) { this.renderer = value; }
  bind(events: PlaybackEvents): void { this.events = events; }
  private change(state: string): void {
    if (this.released || this.failed || this.phase === state) { return; }
    this.phase = state; this.events?.state(state);
  }
  private initialize(): void { Promise.resolve().then(() => { if (!this.released) { this.change('initialized'); } }); }
  private fail(): void {
    if (this.released || this.failed) { return; }
    this.failed = true; this.phase = 'error'; clearInterval(this.timer); clearTimeout(this.timeout);
    this.rejectReady?.(new Error('mpv_playback_failed')); this.ready = undefined; this.rejectReady = undefined;
    this.events?.error();
  }
  prepare(): Promise<void> {
    if (this.opening) { return this.opening; }
    if (!this.source || !this.surface || this.released || this.phase !== 'initialized') { return Promise.reject(new Error('mpv_source_invalid')); }
    this.opening = this.open(); return this.opening;
  }
  private async open(): Promise<void> {
    const pending = new Promise<void>((resolve, reject) => { this.ready = resolve; this.rejectReady = reject; });
    // Attach the rejection immediately, including when release happens while native creation is pending.
    pending.catch(() => {});
    this.timeout = setTimeout(() => { this.fail(); }, 30000);
    try {
      const handle = await native.create({ api: deviceInfo.sdkApiVersion, source: this.source, surface: this.surface!, fontConfiguration: this.fontConfiguration,
        hardwareDecoder: this.options.hwdec, videoOutput: this.options.vo });
      if (this.released || this.failed) { await native.release(handle); return; }
      this.handle = handle; this.timer = setInterval(() => { this.refresh(); }, 200);
      await this.refresh(); await pending;
    } catch (e) { if (!this.released) { this.fail(); throw new Error('mpv_playback_failed'); } }
  }
  private refresh(): Promise<void> {
    if (this.polling) { return this.pollWork ?? Promise.resolve(); }
    if (!this.handle || this.released || this.failed) { return Promise.resolve(); }
    this.polling = true; const handle = this.handle;
    this.pollWork = (async () => {
      try {
        const intent = this.intentRevision;
        const state = await native.snapshot(handle);
        if (this.released || this.failed || handle !== this.handle) { return; }
        if (state.error || ![state.duration, state.position, state.width, state.height, state.speed, state.volume].every((value: number): boolean => Number.isFinite(value) && value >= 0)) { this.fail(); return; }
        // The public controller clock uses milliseconds. Native seconds may produce
        // 20.999999999999996ms for a cue whose formatted start is exactly 21ms.
        state.position = Math.round(state.position); state.duration = Math.round(state.duration);
        const width = this.surfacePixelWidth; const height = this.surfacePixelHeight;
        // VO initialization/reconfiguration can replace its drawing dimensions after an
        // earlier successful write. Wait for a rendered VO and verify its actual echo.
        if (state.rendered && width > 0 && height > 0 && (width !== this.appliedSurfaceWidth || height !== this.appliedSurfaceHeight ||
          state.surfaceWidth !== width || state.surfaceHeight !== height)) {
          await native.command(handle, { type: 'surface-size', value: width, height: height });
          if (this.released || this.failed || handle !== this.handle) { return; }
          this.appliedSurfaceWidth = width; this.appliedSurfaceHeight = height;
        }
        const selected = state.tracks.find((track: native.MpvTrack): boolean => track.kind === 'sub' && track.selected);
        const captionKey = `${selected?.index}/${selected?.codec}/${state.subtitleFontSize}/${state.subtitleOverflow}/${state.subtitleEvents}`;
        if (captionKey !== this.subtitleCacheKey) {
          this.subtitleCacheKey = captionKey;
          this.subtitleContent = mpvTextSubtitle(selected?.codec ?? '', state.subtitleEvents, state.subtitleFontSize, state.subtitleOverflow);
        }
        const nativeCaption = this.subtitleContent === undefined;
        const strategy = this.wantedSubtitle && nativeCaption ? 1 : 0;
        if (state.loaded && strategy !== this.subtitleStrategy) {
          await native.command(handle, { type: 'subtitle-visible', value: strategy });
          if (this.released || this.failed || handle !== this.handle) { return; }
          this.subtitleStrategy = strategy;
        }
        this.nativeCaption = nativeCaption; this.value = state;
        if (state.loaded && this.phase === 'initialized') {
          clearTimeout(this.timeout); const ready = this.ready; this.ready = undefined; this.rejectReady = undefined;
          this.change('prepared'); ready?.();
        }
        if (state.rendered && !state.seeking && !this.frameReady) { this.frameReady = true; this.events?.frame(); }
        const waitingSeek = this.wantedSeek > this.confirmedSeek;
        if (waitingSeek && state.seekDone >= this.wantedSeek && !state.seeking) {
          this.confirmedSeek = state.seekDone; this.events?.seek(state.position);
        }
        if (!waitingSeek || state.seekDone >= this.wantedSeek) { this.events?.time(state.position); }
        this.publishSubtitle(state, waitingSeek && state.seekDone < this.wantedSeek);
        // Native renderers can lose focus without deactivating the application
        // audio session. A core pause after confirmed playback must also revoke
        // the controller's play intent and release our session ownership.
        if (state.loaded && state.paused && !state.ended && this.phase === 'playing' && !this.wantedPause) {
          this.interrupted();
        }
        if (state.loaded && state.ended) {
          // Release the process audio session before completion can start a new
          // episode. A stale EOF must not revoke a newer play or seek request.
          if (intent !== this.intentRevision || (waitingSeek && state.seekDone < this.wantedSeek)) { return; }
          if (this.phase !== 'completed') {
            const endingSeek = this.wantedSeek;
            await this.focus.deactivate();
            if (this.released || this.failed || handle !== this.handle || intent !== this.intentRevision) { return; }
            if (endingSeek !== this.wantedSeek) {
              // A seek issued while cleanup was awaiting the audio service owns
              // the next position. Preserve its existing play intent and focus.
              if (!this.wantedPause) { await this.focus.activate(); }
              return;
            }
            this.change('completed');
          }
        }
        else if (state.loaded && !state.paused && !this.wantedPause) { this.change('playing'); }
        else if (state.loaded && state.paused && this.phase === 'playing') { this.change('paused'); }
      } catch (e) { if (!this.released && !this.failed) { this.fail(); } }
      finally { this.polling = false; this.pollWork = undefined; }
    })();
    return this.pollWork;
  }
  private publishSubtitle(state: native.MpvState, seeking: boolean): void {
    const content = this.wantedSubtitle && !seeking ? this.subtitleContent : undefined;
    const start = Number.isFinite(state.subtitleStart) && state.subtitleStart >= 0 ? Math.round(state.subtitleStart) : state.position;
    const end = Number.isFinite(state.subtitleEnd) && state.subtitleEnd > start ? Math.round(state.subtitleEnd) : start + 1000;
    const identity = content ? `${this.subtitleCacheKey}/${start}/${end}` : 'hidden';
    if (identity === this.subtitlePublished) { return; } this.subtitlePublished = identity;
    this.events?.subtitle({ text: content?.text ?? '', startTime: start, duration: end - start, content: content });
  }
  private async send(type: string, value: number): Promise<void> {
    if (!this.handle || this.released || this.failed) { throw new Error('mpv_closed'); }
    await native.command(this.handle, { type: type, value: value });
  }
  private async synchronize(): Promise<void> {
    // An in-flight snapshot may have been queued before the command. Read once more after it settles.
    const previous = this.pollWork; if (previous) { await previous; }
    await this.refresh();
  }
  private dispatch(type: string, value: number): void { this.send(type, value).catch(() => { this.fail(); }); }
  private interrupted(): void {
    if (this.released || this.failed || this.wantedPause) { return; }
    const intent = ++this.intentRevision; this.wantedPause = true;
    this.send('pause', 1).then((): Promise<void> => {
      // A newer explicit play/pause owns its focus transition. A late native
      // acknowledgement must not deactivate focus acquired by that request.
      if (intent === this.intentRevision && this.wantedPause && !this.released && !this.failed) {
        return this.focus.deactivate();
      }
      return Promise.resolve();
    }).catch(() => { this.fail(); });
    this.events?.interrupt({ eventType: audio.InterruptType.INTERRUPT_TYPE_BEGIN,
      forceType: audio.InterruptForceType.INTERRUPT_FORCE, hintType: audio.InterruptHint.INTERRUPT_HINT_PAUSE });
  }
  async play(): Promise<void> {
    if (!this.handle || this.released || this.failed) { throw new Error('mpv_closed'); }
    const intent = ++this.intentRevision; this.wantedPause = false;
    await this.focus.activate();
    if (this.released || this.failed) { throw new Error('mpv_closed'); }
    if (intent !== this.intentRevision || this.wantedPause) { return; }
    if (this.phase === 'completed' || this.value.ended) { this.seek(0, media.SeekMode.SEEK_CLOSEST); }
    await this.send('pause', 0); await this.synchronize();
  }
  async pause(): Promise<void> {
    const intent = ++this.intentRevision; this.wantedPause = true; await this.send('pause', 1); await this.synchronize();
    if (intent === this.intentRevision) { await this.focus.deactivate(); }
  }
  seek(position: number, _mode: media.SeekMode): void {
    if (!Number.isFinite(position) || position < 0 || !this.handle || this.released) { throw new Error('mpv_seek_invalid'); }
    // The controller clears its cue on every seek, including a seek inside the same event.
    // A fast native seek may finish between polls, so do not rely on observing a hidden cue.
    this.subtitlePublished = '';
    ++this.wantedSeek; this.dispatch('seek', position);
  }
  setSpeed(speed: media.PlaybackSpeed): void {
    const value = playbackRateFromNative(speed); if (value === undefined) { throw new Error('mpv_speed_invalid'); } this.dispatch('speed', value);
  }
  setVolume(value: number): void { if (!Number.isFinite(value) || value < 0 || value > 1) { throw new Error('mpv_volume_invalid'); } this.dispatch('volume', value); }
  setSurfaceSize(width: number, height: number): void {
    if (![width, height].every((value: number): boolean => Number.isSafeInteger(value) && value > 0 && value <= MpvBridgeLimits.maxSurfaceDimensionPx)) { throw new Error('mpv_surface_invalid'); }
    if (this.released || this.failed) { return; }
    this.surfacePixelWidth = width; this.surfacePixelHeight = height;
    if (this.handle) { this.refresh(); }
  }
  async getTrackDescription(): Promise<media.MediaDescription[]> {
    await this.synchronize(); return this.value.tracks.map((track: native.MpvTrack): media.MediaDescription => ({ track_index: track.index,
      track_type: track.kind === 'audio' ? media.MediaType.MEDIA_TYPE_AUD : media.MediaType.MEDIA_TYPE_SUBTITLE,
      language: track.language, track_name: track.title }));
  }
  async getSelectedTracks(): Promise<number[]> { await this.synchronize(); return this.value.tracks.filter((track: native.MpvTrack): boolean => track.selected).map((track: native.MpvTrack): number => track.index); }
  async selectTrack(index: number): Promise<void> {
    const track = this.value.tracks.find((track: native.MpvTrack): boolean => track.index === index);
    if (!track) { throw new Error('mpv_track_invalid'); } await this.send(track.kind === 'audio' ? 'audio' : 'subtitle', index); await this.synchronize();
  }
  async setNativeSubtitleVisible(visible: boolean): Promise<void> {
    if (!this.handle || this.released || this.failed) { throw new Error('mpv_closed'); }
    this.wantedSubtitle = visible; await this.synchronize();
    if (this.released || this.failed) { throw new Error('mpv_closed'); }
  }
  release(): Promise<void> {
    if (this.closing) { return this.closing; }
    ++this.intentRevision; this.released = true; this.phase = 'released'; this.events = undefined; clearInterval(this.timer); clearTimeout(this.timeout);
    this.rejectReady?.(new Error('mpv_closed')); this.ready = undefined; this.rejectReady = undefined;
    const focusClosing = this.focus.release(); focusClosing.catch(() => {});
    this.closing = (async () => {
      // A late native create is released by open(), before the original controller-owned FD can close.
      try { await this.opening; } catch (e) { /* Failed creation owns its cleanup. */ }
      try {
        const handle = this.handle; this.handle = undefined;
        if (handle) { await native.release(handle); }
        await this.pollWork;
      } finally { await focusClosing; }
    })(); return this.closing;
  }
}
