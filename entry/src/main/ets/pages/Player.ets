import { UiPalette } from '../utils/UiPalette';
import image from '@ohos.multimedia.image';
import { AssSubtitle } from '../service/AssSubtitle';
import { StyledSubtitleFrame, StyledSubtitleBounds, styledSubtitleBounds } from '../utils/StyledSubtitle';
import { BifData, BifTicket } from '../utils/Bif';
import { TrickplayPreview } from '../service/TrickplayPreview';
import { IntroSegment, IntroTicket, introTarget } from '../utils/Intro';
import { BrandState } from '../components/BrandState';
import { BrandButton } from '../components/BrandButton';
import { BrandHeading } from '../components/BrandHeading';
import { PlayerChoice } from '../components/PlayerChoice';
import { UiLayout } from '../utils/UiLayout';
import { AppLock } from '../service/AppLock';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import common from '@ohos.app.ability.common';
import { PlaybackRoute, MediaSource } from '../model/Models';
import { TrackChoice } from '../utils/Playback';
import { text } from '../utils/Strings';
import { AppService } from '../service/AppService';
import { PlayerOptions, playerOptions } from '../utils/PlayerOptions';
import { PlaybackController, PlaybackStatus } from '../service/PlaybackController';
import { PlaybackSurface } from '../service/PlaybackSurface';
import { SystemCaptions } from '../service/SystemCaptions';
import { CaptionRenderStyle, captionRenderStyle } from '../utils/CaptionStyle';
import { captionShadows } from '../utils/CaptionUI';
import { EMPTY_SUBTITLE_RUNS, SubtitleContent, SubtitleRun, EMPTY_POSITIONED_SUBTITLES, PositionedSubtitle } from '../utils/InlineSubtitle';
import { PositionedCaption } from '../components/PositionedCaption';
import { RichCaption } from '../components/RichCaption';
import { PlaybackPreferences } from '../utils/PlaybackPreferences';
import { SystemPlayback, SystemPlayerState } from '../service/SystemPlayback';
import { PlaybackWindow } from '../service/PlaybackWindow';
import { JellyfinClient } from '../service/JellyfinClient';
import { ExperienceState } from '../utils/Experience';
import { EnginePreferences } from '../service/EnginePreferences';
import { PlaybackEngines } from '../service/PlaybackEngines';

@Entry
@Component
struct Player {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @State controlWidth: number = 360;
  @State surfaceWidth: number = 360;
  @State surfaceHeight: number = 200;
  @State videoAspect: number = 16 / 9;
  @StorageLink('cineIsleLocked') @Watch('windowStateChanged') locked: boolean = true;
  @State route: PlaybackRoute = new PlaybackRoute();
  @State message: string = '';
  @State reportMessage: string = '';
  @State speed: number = 1;
  @State state: string = 'loading';
  @State frameReady: boolean = false;
  @State playbackPosition: number = 0;
  @State duration: number = 0;
  @State subtitle: string = '';
  @State subtitleRuns: SubtitleRun[] = EMPTY_SUBTITLE_RUNS;
  @State subtitleRevision: string = '';
  @State positionedSubtitles: PositionedSubtitle[] = EMPTY_POSITIONED_SUBTITLES;
  @State styledFrame: StyledSubtitleFrame | undefined = undefined;
  @State audio: TrackChoice[] = [];
  @State subtitles: TrackChoice[] = [];
  @State audioKey: string = '';
  @State subtitleKey: string = '';
  @State options: boolean = false;
  @State thumbnail: image.PixelMap | undefined = undefined;
  @State thumbnailTime: number = 0;
  @State sliderPreview: number = -1;
  @State trickplayEnabled: boolean = true;
  private trickplayRevision: number = 0;
  private trickplayTicket: BifTicket | undefined;
  private preview: TrickplayPreview = new TrickplayPreview((bitmap?: image.PixelMap, time?: number) => { this.thumbnail = bitmap; this.thumbnailTime = time ?? 0; });
  @State intro: IntroSegment | undefined = undefined;
  @State introEnabled: boolean = true;
  private introRevision: number = 0;
  private introTicket: IntroTicket | undefined;
  @State autoNext: boolean = false;
  @State autoNextReady: boolean = false;
  @State autoNextMode: string = 'server';
  private autoNextRevision: number = 0;
  @State busy: boolean = false;
  @State systemReady: boolean = false;
  @State backgroundEnabled: boolean = false;
  @State pipSupported: boolean = false;
  @State pipActive: boolean = false;
  @State controlsLocked: boolean = false;
  @State zoomed: boolean = false;
  @State immersive: boolean = false;
  @State controlsVisible: boolean = true;
  @State night: boolean = false;
  @State dimOpacity: number = 0.6;
  @State windowBrightness: number = 0.5;
  @State volume: number = 1;
  private window: PlaybackWindow | undefined;
  private ownerClient: JellyfinClient | undefined;
  private hideTimer: number = -1;
  private panMode: string = '';
  private panX: number = -1;
  private panY: number = -1;
  private displayAnchor: number = 0;
  private brightnessTarget: number = 0.5;
  private brightnessRevision: number = 0;
  private ui: PlayerOptions = new PlayerOptions();
  @State seekPreview: number = -1;
  @State gestureHint: string = '';
  private seekAnchor: number = -1;
  private heldSpeed: number = 0;
  private lastOfflineSave: number = 0;
  @State audioLanguage: string = '';
  @State subtitleLanguage: string = '';
  @State subtitlesOff: boolean = false;
  @State settingsBusy: boolean = false;
  @State settingsMessage: string = '';
  private surface: PlaybackSurface = new PlaybackSurface((identity: string, width: number, height: number) => {
    if (this.alive && (!this.surfaceId || this.surfaceId === identity)) { this.controller?.setSurfaceSize(width, height); }
  });
  private surfaceId: string = '';
  private controller: PlaybackController | undefined = undefined;
  private system: SystemPlayback | undefined = undefined;
  private alive: boolean = false;
  @State captionStyle: CaptionRenderStyle = new CaptionRenderStyle();
  private stopCaptions: (() => void) | undefined = undefined;
  @State visible: boolean = true;
  private loadRevision: number = 0;
  private finished: boolean = false;

  aboutToAppear(): void {
    this.route = router.getParams() as PlaybackRoute;
    if (!this.route?.url || !this.route.item?.Id) { router.back(); return; }
    this.alive = true;
    this.watchCaptions();
    this.ownerClient = AppService.client; this.immersive = true;
    this.ui = playerOptions(AppService.experience?.snapshot().playerUi); this.introEnabled = this.ui.introSkipper ?? true; this.trickplayEnabled = this.ui.trickplay ?? true; this.zoomed = this.ui.startMaximized;
    this.dimOpacity = this.ui.dimOpacity ?? 0.6;
    this.window = new PlaybackWindow(getContext(this) as common.UIAbilityContext, (code: string) => { if (this.alive) { this.message = text(code); this.showControls(); } });
    if (this.ui.rememberBrightness && (this.ui.brightness ?? -1) >= 0) { this.windowBrightness = this.ui.brightness!; this.window.setBrightness(this.windowBrightness); }
    this.syncWindow();
    if (this.route.item.Type === 'Episode') { this.restoreAutoNext(); }
    this.showPreferences(AppService.playbackPreferences.snapshot());
    this.settingsMessage = AppService.playbackPreferences.issue ? text(AppService.playbackPreferences.issue) : '';
    this.controller = new PlaybackController(AppService.client, {
      state: (state: string) => { if (this.alive) { this.state = state; if (state === 'error') { this.options = false; this.clearIntro(); this.clearTrickplay(); this.system?.stopPiP(); } if (!['playing', 'prepared'].includes(state)) { this.cancelGesture(); } this.system?.sync(true); this.syncWindow(); this.showControls(); } },
      frame: (ready: boolean) => { if (this.alive) { this.frameReady = ready; } },
      closed: (status: PlaybackStatus) => { this.finishOffline(status); },
      time: (position: number, duration: number) => { if (this.alive) { this.playbackPosition = position; this.duration = duration; const status = this.controller?.snapshot(); this.speed = status?.speed ?? 1; if (status && status.width > 0 && status.height > 0) { this.videoAspect = status.width / status.height; } this.system?.sync(); if (this.route.offline && Date.now() - this.lastOfflineSave > 10000) { this.saveOffline(); } } },
      tracks: (audio: TrackChoice[], subtitles: TrackChoice[], audioKey: string, subtitleKey: string) => {
        if (this.alive) { this.audio = audio; this.subtitles = subtitles; this.audioKey = audioKey; this.subtitleKey = subtitleKey; }
      },
      subtitle: (value: string) => { if (this.alive) { this.subtitle = value; this.subtitleRevision = ''; this.subtitleRuns = EMPTY_SUBTITLE_RUNS; this.positionedSubtitles = EMPTY_POSITIONED_SUBTITLES; this.system?.updateSubtitle(value); } },
      caption: (value: SubtitleContent) => {
        if (this.alive) { this.subtitle = value.flowText; this.subtitleRevision = value.revision; this.subtitleRuns = value.flowRuns; this.positionedSubtitles = value.positioned; this.system?.updateSubtitle(value.flowText, value.flowRuns, value.positioned, value.revision); }
      },
      styledSubtitle: (frame: StyledSubtitleFrame | undefined) => {
        if (this.alive) { this.styledFrame = frame; this.system?.updateStyledSubtitle(frame); }
      },
      createStyledSubtitle: (document: string, publish: (frame: StyledSubtitleFrame | undefined) => void, failure: () => void) =>
        AssSubtitle.create(document, (getContext(this) as common.UIAbilityContext).cacheDir, publish, failure),
      error: (message: string) => { if (this.alive) { this.message = message; this.showControls(); } },
      reportError: (failed: boolean) => { if (this.alive) { this.reportMessage = failed ? text('progress_not_saved') : ''; } },
      complete: () => { this.completed(); },
      beforePlay: async () => { if (!this.alive || this.ownerClient !== AppService.client || !AppLock.permit()) { return false; } return this.system ? this.system.permitPlay() : this.visible; },
      interrupted: () => { this.cancelGesture(); this.system?.pause(); }
    }, () => AppService.playbackPreferences.snapshot(), () => PlaybackEngines.create(EnginePreferences.requireChoice(), (getContext(this) as common.UIAbilityContext).cacheDir));
    this.connectSystem(); this.restoreIntro(); this.restoreTrickplay();
  }

  private clearTrickplay(): void { ++this.trickplayRevision; this.trickplayTicket?.cancel(); this.trickplayTicket = undefined; this.preview.clear(); }
  private restoreTrickplay(): void {
    this.clearTrickplay();
    if (!this.alive || !this.visible || this.state === 'error' || this.locked || !AppLock.permit() || this.pipActive || !this.trickplayEnabled || !['Episode', 'Movie'].includes(this.route.item.Type) || this.ownerClient !== AppService.client) { return; }
    const revision = this.trickplayRevision; const route = this.route; const client = this.ownerClient;
    const allowed = (): boolean => this.alive && this.visible && !this.locked && AppLock.permit() && !this.pipActive && this.trickplayEnabled && route === this.route && client === AppService.client && revision === this.trickplayRevision;
    this.trickplayTicket = AppService.trickplay(route.item.Id, route.offline || (AppService.experience?.snapshot().offline ?? false), allowed);
    this.trickplayTicket?.result.then((data: BifData | undefined) => { if (data && allowed()) { this.preview.set(data); } }).finally(() => { if (revision === this.trickplayRevision) { this.trickplayTicket = undefined; } });
  }
  private canScrub(): boolean {
    return this.alive && this.visible && !this.locked && AppLock.permit() && !this.controlsLocked && !this.busy && !this.settingsBusy && !this.pipActive && this.ownerClient === AppService.client &&
      ['playing', 'paused', 'prepared', 'completed'].includes(this.state) && Number.isFinite(this.duration) && this.duration > 0;
  }
  private showThumbnail(position: number): void { if (this.trickplayEnabled && this.canScrub()) { this.preview.request(position, this.duration); } else { this.preview.hide(); } }
  private sliderSeek(value: number, mode: SliderChangeMode): void {
    if (!this.canScrub() || !Number.isFinite(value) || value < 0 || value > this.duration) { this.cancelGesture(); return; }
    if (mode === SliderChangeMode.Begin || mode === SliderChangeMode.Moving) { this.sliderPreview = value; this.clearHide(); this.showThumbnail(value); }
    else if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) { this.cancelGesture(); this.controller?.seek(value); this.showControls(); }
  }
  private changeTrickplay(enabled: boolean): void {
    if (this.busy || this.settingsBusy || !AppService.experience || this.ownerClient !== AppService.client) { return; }
    try {
      const options = playerOptions(AppService.experience.snapshot().playerUi); options.trickplay = enabled;
      AppService.experience.update((state: ExperienceState) => { state.playerUi = options; }); this.ui = options; this.trickplayEnabled = enabled; this.settingsMessage = '';
      if (enabled) { this.restoreTrickplay(); } else { this.clearTrickplay(); }
    } catch (e) { this.settingsMessage = text('player_trickplay_save_failed'); }
  }

  private clearIntro(): void { ++this.introRevision; this.introTicket?.cancel(); this.introTicket = undefined; this.intro = undefined; }
  private restoreIntro(): void {
    this.clearIntro();
    if (!this.alive || !this.visible || this.state === 'error' || this.locked || !AppLock.permit() || this.pipActive || !this.introEnabled || !['Episode', 'Movie'].includes(this.route.item.Type) || !AppService.intros || !this.ownerClient || this.ownerClient !== AppService.client) { return; }
    const revision = this.introRevision; const route = this.route; const client = this.ownerClient;
    const allowed = (): boolean => this.alive && this.visible && !this.locked && !this.pipActive && AppLock.permit() && this.introEnabled && this.route === route && client === AppService.client && revision === this.introRevision;
    this.introTicket = AppService.intros.load(client, AppService.local, route.item.Id, route.offline || (AppService.experience?.snapshot().offline ?? false), allowed);
    this.introTicket.result.then((segment: IntroSegment | undefined) => { if (allowed()) { this.intro = segment; } }).finally(() => { if (revision === this.introRevision) { this.introTicket = undefined; } });
  }
  private canSkipIntro(): boolean {
    return this.introEnabled && this.alive && this.visible && !this.locked && AppLock.permit() && !this.controlsLocked && !this.busy && !this.settingsBusy && !this.options && !this.pipActive &&
      this.ownerClient === AppService.client && !!this.controller && ['playing', 'paused', 'prepared'].includes(this.state) && this.seekAnchor < 0 && this.sliderPreview < 0 && this.heldSpeed === 0 && introTarget(this.intro, this.playbackPosition, this.duration) !== undefined;
  }
  private skipIntro(): void {
    if (!this.canSkipIntro()) { return; }
    const target = introTarget(this.intro, this.playbackPosition, this.duration);
    if (target === undefined) { return; }
    this.cancelGesture(); this.controller?.seek(target); this.playbackPosition = this.controller?.snapshot().position ?? this.playbackPosition; this.showControls();
  }
  private changeIntro(enabled: boolean): void {
    if (!this.alive || !this.visible || this.locked || !AppLock.permit() || this.controlsLocked || this.busy || this.settingsBusy || this.ownerClient !== AppService.client || !AppService.experience) { return; }
    try {
      const options = playerOptions(AppService.experience.snapshot().playerUi); options.introSkipper = enabled;
      AppService.experience.update((state: ExperienceState) => { state.playerUi = options; }); this.ui = options; this.introEnabled = enabled; this.settingsMessage = '';
      if (enabled) { this.restoreIntro(); } else { this.clearIntro(); }
    } catch (e) { this.settingsMessage = text('player_intro_save_failed'); }
  }

  private showPreferences(value: PlaybackPreferences): void {
    this.audioLanguage = value.audioLanguage; this.subtitleLanguage = value.subtitleLanguage; this.subtitlesOff = value.subtitlesOff;
  }

  private async restoreAutoNext(): Promise<void> {
    const revision = ++this.autoNextRevision; const client = AppService.client;
    this.autoNextReady = false; this.autoNextMode = AppService.experience?.snapshot().autoNextMode ?? 'server';
    try {
      const enabled = await AppService.loadAutoNext(this.route.offline);
      if (this.alive && revision === this.autoNextRevision && client === AppService.client) { this.autoNext = enabled; this.autoNextReady = true; }
    } catch (e) {
      if (this.alive && revision === this.autoNextRevision && client === AppService.client) { this.autoNext = false; this.autoNextReady = true; this.settingsMessage = text('auto_next_load_failed'); }
    }
  }

  private changeAutoNext(mode: string): void {
    if (!this.alive) { return; }
    try {
      AppService.saveAutoNext(mode); this.settingsMessage = ''; ++this.autoNextRevision; this.autoNextMode = mode;
      if (mode === 'server') { this.restoreAutoNext(); }
      else { this.autoNext = mode === 'on'; this.autoNextReady = true; }
    } catch (e) { this.settingsMessage = text('auto_next_save_failed'); }
  }

  private async savePreferences(reset: boolean = false): Promise<void> {
    if (!this.alive || this.settingsBusy || this.busy) { return; }
    this.settingsBusy = true; this.settingsMessage = '';
    const value: PlaybackPreferences = reset ? new PlaybackPreferences() : {
      version: 1, audioLanguage: this.audioLanguage, subtitleLanguage: this.subtitleLanguage, subtitlesOff: this.subtitlesOff
    };
    try {
      await AppService.playbackPreferences.load(getContext(this) as common.UIAbilityContext);
      const saved = await AppService.playbackPreferences.save(value);
      if (!this.alive) { return; }
      this.showPreferences(saved); this.settingsMessage = text('playback_preferences_saved');
      await this.controller?.applyPreferences(saved);
    } catch (e) {
      if (this.alive) {
        const code = (e as Error).message;
        this.settingsMessage = text(['playback_language_invalid', 'playback_preferences_load_failed', 'playback_preferences_save_failed',
          'playback_preferences_restore_failed'].includes(code) ? code : 'playback_preferences_save_failed');
      }
    } finally { if (this.alive) { this.settingsBusy = false; } }
  }

  private connectSystem(): void {
    if (!this.controller) { return; }
    this.system = new SystemPlayback(getContext(this) as common.UIAbilityContext, this.controller, this.surface, this.route, {
      changed: (state: SystemPlayerState) => { if (this.alive) { this.systemReady = state.ready; this.backgroundEnabled = state.backgroundEnabled; this.pipSupported = state.pipSupported; const changedPiP = this.pipActive !== state.pipActive; this.pipActive = state.pipActive; if (changedPiP) { if (this.pipActive) { this.clearIntro(); this.clearTrickplay(); } else if (this.visible) { this.restoreIntro(); this.restoreTrickplay(); } } this.syncWindow(); } },
      error: (message: string) => { if (this.alive) { this.message = message; } },
      next: async () => { await this.next(); },
      previous: async () => { await this.next(false, true); },
      canNavigate: () => this.alive && !this.locked && !this.controlsLocked && !this.busy && this.ownerClient === AppService.client,
      stopped: () => { if (this.alive) { ++this.loadRevision; this.busy = false; if (this.state !== 'error') { this.state = 'released'; } this.system = undefined; } }
    }, () => this.alive && !this.locked && !this.controlsLocked && !this.busy && this.ui.autoPiP);
    this.system.initialize();
  }

  private canRetry(): boolean {
    return this.alive && this.visible && this.state === 'error' && !this.locked && AppLock.permit() &&
      !this.controlsLocked && !this.busy && !this.settingsBusy && !this.pipActive &&
      this.ownerClient === AppService.client && !!this.surfaceId && !!this.controller;
  }
  private async retry(): Promise<void> {
    if (!this.canRetry()) { return; }
    this.saveOffline(); this.finished = false;
    const revision = ++this.loadRevision; this.busy = true; this.message = ''; this.reportMessage = '';
    this.clearIntro(); this.clearTrickplay(); this.cancelGesture();
    if (!this.system || this.system.isClosed) { this.connectSystem(); }
    try { await this.controller?.retry(this.surfaceId); }
    finally { if (this.alive && revision === this.loadRevision) { this.busy = false; this.showControls(); this.restoreIntro(); this.restoreTrickplay(); } }
  }

  private async toggle(): Promise<void> {
    if (this.state === 'error') { await this.retry(); return; }
    this.finished = false;
    if (this.state === 'released') {
      if (this.route.offline) { this.route.item = AppService.snapshot.items.find((item) => item.Id === this.route.item.Id) ?? this.route.item; }
      this.connectSystem(); await this.controller?.open(this.route, this.surfaceId);
    }
    else if (this.state === 'playing') { await this.system?.pause(); }
    else { await this.system?.play(); }
  }

  private saveOffline(completed: boolean = false): void {
    if (!this.route.offline || !this.alive || this.ownerClient !== AppService.client) { return; }
    const status = this.controller?.snapshot();
    // Loading clocks and pending seeks are presentation, not a new durable playback position.
    if (!status || status.state === 'released' || !status.route.offline || status.route.item.Id !== this.route.item.Id ||
      status.route.mediaSourceId !== this.route.mediaSourceId || status.route.filePath !== this.route.filePath || status.checkpoint === undefined) { return; }
    try { AppService.recordOfflinePosition(this.route.item, status.checkpoint, completed || (status.checkpointCompleted ?? false)); this.lastOfflineSave = Date.now(); }
    catch (e) { this.reportMessage = text('progress_not_saved'); }
  }
  private finishOffline(status: PlaybackStatus): void {
    if (this.ownerClient !== AppService.client || !status.route.offline || status.checkpoint === undefined) { return; }
    try { AppService.recordOfflineStop(status.route.item, status.checkpoint, status.duration); }
    catch (e) { this.reportMessage = text('progress_not_saved'); }
  }
  onBackPress(): boolean { if (this.controlsLocked) { return true; } if (this.immersive) { this.toggleImmersive(); return true; } return false; }
  private watchCaptions(): void { this.stopCaptions?.(); this.stopCaptions = undefined; if (!this.alive || !this.visible) { return; } this.stopCaptions = SystemCaptions.observe((state) => { if (this.alive && this.visible) { this.captionStyle = captionRenderStyle(state.config); } }); }
  aboutToDisappear(): void { this.stopCaptions?.(); this.stopCaptions = undefined; this.clearIntro(); this.clearTrickplay(); this.cancelGesture(); this.clearHide(); this.saveOffline(); this.alive = false; this.styledFrame = undefined; this.controller?.setStyledSubtitleVisible(false); ++this.loadRevision; this.window?.dispose(); if (this.system) { this.system.dispose(); } else { this.controller?.close(); } }
  onPageHide(): void { this.stopCaptions?.(); this.stopCaptions = undefined; this.clearIntro(); this.clearTrickplay(); this.cancelGesture(); this.clearHide(); this.saveOffline(); this.visible = false; this.syncWindow(); if (this.system) { this.system.background(); } else { this.controller?.pause(); } }
  onPageShow(): void { this.visible = true; this.watchCaptions(); this.introEnabled = playerOptions(AppService.experience?.snapshot().playerUi).introSkipper ?? true; this.trickplayEnabled = playerOptions(AppService.experience?.snapshot().playerUi).trickplay ?? true; if (!this.intro && !this.introTicket) { this.restoreIntro(); this.restoreTrickplay(); } this.syncWindow(); this.showControls(); if (this.system) { this.system.foreground(); } else { this.controller?.show(); } }

  private async completed(): Promise<void> {
    if (this.finished || !this.alive) { return; }
    this.cancelGesture(); this.finished = true; this.saveOffline(true);
    if (this.route.offline) { try { await AppService.edit(this.route.item, false, true, true); } catch (e) { this.reportMessage = text('progress_not_saved'); } }
    if (this.autoNextReady && this.autoNext && (this.visible || this.system?.canContinue) && this.route.item.Type === 'Episode') { await this.next(true); }
    else { await this.system?.queueEnded(); }
  }

  private async next(automatic: boolean = false, previous: boolean = false): Promise<void> {
    if (this.busy || !this.alive || this.controlsLocked || this.locked || !AppLock.permit()) { return; }
    this.clearIntro(); this.clearTrickplay(); this.cancelGesture(); this.saveOffline(); this.busy = true; this.message = ''; this.showControls(); const transition = ++this.loadRevision; const client = AppService.client;
    try {
      const route = previous ? await AppService.previousPlayback(this.route) : await AppService.nextPlayback(this.route);
      if (!this.alive || this.locked || !AppLock.permit() || this.controlsLocked || client !== AppService.client || transition !== this.loadRevision || !this.system?.canAutoAdvance || (!this.visible && !this.system?.canContinue) || (automatic && (!this.autoNextReady || !this.autoNext))) {
        if (automatic) { await this.system?.queueEnded(); } return;
      }
      if (!route) { this.message = text(previous ? 'queue_first_episode' : 'queue_finished'); if (automatic) { await this.system?.queueEnded(); } return; }
      this.route = route; this.finished = false; this.reportMessage = '';
      await this.controller?.open(route, this.surfaceId, 0);
    } catch (e) { if (this.alive && client === AppService.client && transition === this.loadRevision) { this.message = text(previous ? 'previous_episode_failed' : 'next_episode_failed'); if (automatic) { await this.system?.queueEnded(); } } }
    finally { if (this.alive && transition === this.loadRevision) { this.busy = false; this.showControls(); this.restoreIntro(); this.restoreTrickplay(); } }
  }

  private async source(index: number): Promise<void> {
    const source = this.route.sources[index];
    if (!source || this.busy || source.Id === this.route.mediaSourceId) { return; }
    this.clearIntro(); this.clearTrickplay(); this.cancelGesture(); this.busy = true; this.message = ''; const transition = ++this.loadRevision;
    try {
      const route = await AppService.playback(this.route.item, source.Id);
      if (!this.alive || transition !== this.loadRevision || this.system?.isClosed) { return; }
      const position = this.playbackPosition; const paused = this.state !== 'playing';
      this.route = route; this.finished = false; this.reportMessage = '';
      await this.controller?.open(route, this.surfaceId, position, paused);
    } catch (e) { if (this.alive && transition === this.loadRevision) { this.message = text('source_switch_failed'); } }
    finally { if (this.alive && transition === this.loadRevision) { this.busy = false; this.restoreIntro(); this.restoreTrickplay(); } }
  }

  private async track(key: string, audio: boolean): Promise<void> {
    if (this.busy || this.settingsBusy) { return; }
    this.busy = true; this.message = '';
    try { if (audio) { await this.controller?.selectAudio(key); } else { await this.controller?.selectSubtitle(key); } }
    finally { if (this.alive) { this.busy = false; } }
  }

  private clock(ms: number): string {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  private canGesture(): boolean {
    return this.ui.gestures && this.alive && this.visible && !this.locked && AppLock.permit() && !this.controlsLocked && !this.busy && !this.settingsBusy && !this.pipActive &&
      ['prepared', 'playing', 'paused', 'completed'].includes(this.state);
  }
  private insideGesture(x: number, y: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) && x >= 24 && x <= this.surfaceWidth - 24 && y >= 24 && y <= this.surfaceHeight - 24;
  }
  private cancelGesture(): void {
    this.sliderPreview = -1; this.preview.hide();
    const previous = this.heldSpeed; this.heldSpeed = 0; this.seekAnchor = -1; this.seekPreview = -1; this.gestureHint = ''; this.panMode = ''; this.panX = -1; this.panY = -1; ++this.brightnessRevision;
    if (previous > 0) { this.speed = previous; this.controller?.setSpeed(previous); this.system?.sync(true); }
  }
  private changeSpeed(speed: number): void { this.cancelGesture(); this.speed = speed; this.controller?.setSpeed(speed); this.system?.sync(true); }
  private doubleTap(x: number, y: number): void {
    if (!this.canGesture() || !this.insideGesture(x, y)) { return; }
    this.cancelGesture();
    if (x >= this.surfaceWidth * 0.4 && x <= this.surfaceWidth * 0.6) { this.toggle(); return; }
    if (!Number.isFinite(this.duration) || this.duration <= 0) { return; }
    this.controller?.seek(Math.max(0, Math.min(this.duration, this.playbackPosition + (x < this.surfaceWidth * 0.4 ? -this.ui.back : this.ui.forward))));
  }
  private beginSeek(x: number, y: number): void {
    if (!this.ui.seek || !this.canGesture() || !this.insideGesture(x, y) || !Number.isFinite(this.duration) || this.duration <= 0) { return; }
    this.cancelGesture(); this.seekAnchor = this.playbackPosition; this.seekPreview = this.playbackPosition;
  }
  private previewSeek(offset: number): void {
    if (!this.canGesture()) { this.cancelGesture(); return; }
    if (this.seekAnchor < 0 || !Number.isFinite(offset)) { return; }
    this.seekPreview = Math.max(0, Math.min(this.duration, this.seekAnchor + offset * 90000 / Math.max(1, this.surfaceWidth)));
    this.gestureHint = text('gesture_seek_preview', this.clock(this.seekPreview)); this.clearHide(); this.showThumbnail(this.seekPreview);
  }
  private endSeek(): void {
    const position = this.seekPreview; const allowed = this.canGesture(); this.cancelGesture();
    if (allowed && position >= 0) { this.controller?.seek(position); } this.showControls();
  }
  private holdSpeed(x: number, y: number): void {
    if (!this.canGesture() || !this.insideGesture(x, y) || this.state !== 'playing' || this.heldSpeed > 0) { return; }
    this.cancelGesture(); this.heldSpeed = this.speed; this.speed = 2; this.controller?.setSpeed(2); this.gestureHint = text('gesture_speed_hold'); this.system?.sync(true);
  }
  private pinch(scale: number): void {
    if (!this.ui.zoom) { return; }
    if (!this.canGesture() || !Number.isFinite(scale) || scale <= 0) { return; }
    this.cancelGesture(); if (Math.abs(scale - 1) > 0.1) { this.zoomed = scale > 1; }
  }

  private syncWindow(): void {
    this.controller?.setStyledSubtitleVisible(this.alive && !this.locked && AppLock.permit() && this.ownerClient === AppService.client && (this.visible || this.pipActive));
    this.window?.update({ visible: this.visible && this.alive, playing: this.state === 'playing', immersive: this.immersive, locked: this.locked || !AppLock.permit(), pip: this.pipActive });
  }
  private styledBounds(): StyledSubtitleBounds {
    return this.styledFrame ? styledSubtitleBounds(this.styledFrame, this.surfaceWidth, this.surfaceHeight, this.zoomed) ??
      { left: 0, top: 0, width: 0, height: 0 } : { left: 0, top: 0, width: 0, height: 0 };
  }
  private canShowMainSubtitle(): boolean {
    return this.alive && this.visible && this.frameReady && this.state !== 'error' && !this.pipActive &&
      !this.locked && AppLock.permit() && this.ownerClient === AppService.client;
  }
  private windowStateChanged(): void { if (this.locked) { this.clearIntro(); this.clearTrickplay(); this.cancelGesture(); this.clearHide(); this.controlsVisible = true; } else if (this.visible) { this.restoreIntro(); this.restoreTrickplay(); } this.syncWindow(); }
  private clearHide(): void { if (this.hideTimer >= 0) { clearTimeout(this.hideTimer); this.hideTimer = -1; } }
  private showControls(): void {
    this.clearHide(); this.controlsVisible = true;
    if (this.alive && this.visible && this.immersive && !this.controlsLocked && !this.locked && !this.options && !this.busy && !this.message && this.state === 'playing') {
      this.hideTimer = setTimeout(() => { this.hideTimer = -1; if (this.alive && this.visible && this.immersive && !this.locked && !this.busy && !this.message && !this.options && !this.controlsLocked && this.state === 'playing') { this.controlsVisible = false; } }, 3000);
    }
  }
  private singleTap(): void {
    if (!this.alive || !this.visible || this.locked || this.pipActive || !this.immersive) { return; }
    if (this.controlsVisible && !this.controlsLocked && this.state === 'playing' && !this.options) { this.clearHide(); this.controlsVisible = false; }
    else { this.showControls(); }
  }
  private toggleImmersive(): void { if (this.controlsLocked || this.locked) { return; } this.cancelGesture(); this.immersive = !this.immersive; this.options = false; this.syncWindow(); this.showControls(); }
  private lockControls(): void { this.cancelGesture(); this.controlsLocked = !this.controlsLocked; this.options = false; this.system?.refreshAutoPiP(); this.showControls(); }
  private goBack(): void { if (!this.onBackPress()) { router.back(); } }
  private beginPan(x: number, y: number): void { this.cancelGesture(); if (this.canGesture() && this.insideGesture(x, y)) { this.panX = x; this.panY = y; this.clearHide(); } }
  private updatePan(dx: number, dy: number): void {
    if (!this.canGesture() || this.panX < 0 || !Number.isFinite(dx) || !Number.isFinite(dy)) { return; }
    if (!this.panMode) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) { return; }
      const x = this.panX; const y = this.panY;
      if (Math.abs(dy) > Math.abs(dx)) {
        this.panMode = this.ui.vertical === false ? 'ignored' : x < this.surfaceWidth * 0.4 ? 'brightness' : x > this.surfaceWidth * 0.6 ? 'volume' : 'ignored';
        this.displayAnchor = this.panMode === 'brightness' ? this.window?.brightness ?? this.windowBrightness : this.volume;
      } else {
        this.beginSeek(x, y); this.panMode = 'seek'; this.panX = x; this.panY = y;
      }
    }
    if (this.panMode === 'seek') { this.previewSeek(dx); }
    else if (this.panMode === 'brightness') { this.changeBrightness(Math.max(0.05, Math.min(1, this.displayAnchor - dy / Math.max(1, this.surfaceHeight)))); }
    else if (this.panMode === 'volume') { this.changeVolume(Math.max(0, Math.min(1, this.displayAnchor - dy / Math.max(1, this.surfaceHeight)))); }
  }
  private endPan(): void {
    const mode = this.panMode; const value = this.brightnessTarget;
    if (mode === 'seek') { this.endSeek(); }
    else { this.cancelGesture(); if (mode === 'brightness' && this.canGesture()) { this.changeBrightness(value, true); } }
    this.showControls();
  }
  private saveDisplay(brightness: boolean, value: number): void {
    if (!this.alive || this.locked || !AppLock.permit() || this.ownerClient !== AppService.client || !AppService.experience) { return; }
    try {
      const options = playerOptions(AppService.experience.snapshot().playerUi);
      if (brightness) { if (!options.rememberBrightness) { return; } options.brightness = value; }
      else { options.dimOpacity = value; }
      AppService.experience.update((state: ExperienceState) => { state.playerUi = options; }); this.ui = options;
    } catch (e) { this.message = text('player_display_save_failed'); this.showControls(); }
  }
  private async changeBrightness(value: number, remember: boolean = false): Promise<void> {
    if (!this.alive || !this.visible || this.locked || !AppLock.permit() || this.controlsLocked || this.pipActive || !Number.isFinite(value)) { return; }
    value = Math.max(0.05, Math.min(1, value)); this.brightnessTarget = value; const revision = ++this.brightnessRevision;
    if (!await this.window?.setBrightness(value) || !this.alive || this.locked || this.ownerClient !== AppService.client || revision !== this.brightnessRevision) { return; }
    this.windowBrightness = value;
    if (this.panMode === 'brightness') { this.gestureHint = text('player_brightness_value', Math.round(value * 100)); }
    if (remember) { this.saveDisplay(true, value); }
  }
  private changeVolume(value: number): void {
    if (!this.alive || !this.visible || this.locked || !AppLock.permit() || this.controlsLocked || this.pipActive || !Number.isFinite(value)) { return; }
    value = Math.max(0, Math.min(1, value));
    if (this.controller?.setVolume(value)) { this.volume = value; if (this.panMode === 'volume') { this.gestureHint = text('player_volume_value', Math.round(value * 100)); } }
  }
  private changeDim(value: number): void { if (!this.locked && !this.controlsLocked && Number.isFinite(value)) { this.dimOpacity = Math.max(0.1, Math.min(0.9, value)); this.saveDisplay(false, this.dimOpacity); } }

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
        Column({ space: 8 }) {
          if (!this.immersive) { this.playerHeader() }
          Flex({ direction: this.viewportWidth > this.viewportHeight ? FlexDirection.Row : FlexDirection.Column,
            alignItems: ItemAlign.Stretch }) {
          Stack({ alignContent: Alignment.Center }) {
            XComponent({ id: 'playbackSurface', type: XComponentType.SURFACE, controller: this.surface })
              .width(UiLayout.videoFrame(this.surfaceWidth, this.surfaceHeight, this.videoAspect, this.zoomed).width)
              .height(UiLayout.videoFrame(this.surfaceWidth, this.surfaceHeight, this.videoAspect, this.zoomed).height)
              .onLoad(() => { this.surfaceId = this.surface.getXComponentSurfaceId(); this.surface.publish(); if (this.state !== 'error') { this.controller?.open(this.route, this.surfaceId); } })
            if (!this.frameReady) { Column() {}.id('playbackFrameCover').width('100%').height('100%').backgroundColor('#000000').hitTestBehavior(HitTestMode.None) }
            if (this.styledFrame && this.canShowMainSubtitle()) {
              Stack({ alignContent: Alignment.TopStart }) {
                Image(this.styledFrame.bitmap).id('playbackAssSubtitle').objectFit(ImageFit.Fill)
                  .width(this.styledBounds().width).height(this.styledBounds().height)
                  .position({ x: this.styledBounds().left, y: this.styledBounds().top })
              }.width('100%').height('100%').clip(true).hitTestBehavior(HitTestMode.None)
            }
            if (this.night && !this.pipActive) { Column() {}.width('100%').height('100%').backgroundColor('#000000').opacity(this.dimOpacity).hitTestBehavior(HitTestMode.None) }
            if (this.subtitle && this.canShowMainSubtitle() && (!this.immersive || !this.controlsVisible)) {
              Column() {
                this.plainSubtitle()
              }.width('100%').height('100%').justifyContent(FlexAlign.End).alignItems(HorizontalAlign.Center)
                .padding({ bottom: 16 }).hitTestBehavior(HitTestMode.None)
            }
            if (this.positionedSubtitles.length && this.canShowMainSubtitle()) {
              Stack({ alignContent: Alignment.TopStart }) {
                ForEach(this.positionedSubtitles, (cue: PositionedSubtitle) => {
                  PositionedCaption({ cue: cue, captionStyle: this.captionStyle,
                    fontSize: 20 * (this.captionStyle.system ? this.captionStyle.scale : 1),
                    canvasWidth: this.surfaceWidth, canvasHeight: this.surfaceHeight, identifier: `playbackPositionedSubtitle-${cue.id}` })
                }, (cue: PositionedSubtitle): string => JSON.stringify(cue))
              }.width('100%').height('100%').clip(true).hitTestBehavior(HitTestMode.None)
            }
            if (this.gestureHint) { Text(this.gestureHint).fontSize(16).fontColor('#FFFFFF').backgroundColor('#BB0D1924').padding(12).borderRadius(12).hitTestBehavior(HitTestMode.None) }
            Column() {}.width('100%').height('100%')
            .gesture(GestureGroup(GestureMode.Exclusive,
              PinchGesture({ fingers: 2 }).onActionStart(() => this.cancelGesture()).onActionUpdate((event: GestureEvent) => this.pinch(event.scale)),
              LongPressGesture({ fingers: 1, duration: 500 }).onAction((event: GestureEvent) => { const finger = event.fingerList[0]; if (finger) { this.holdSpeed(finger.localX, finger.localY); } })
                .onActionEnd(() => this.cancelGesture()).onActionCancel(() => this.cancelGesture()),
              PanGesture({ fingers: 1, direction: PanDirection.All, distance: 12 })
                .onActionStart((event: GestureEvent) => { const finger = event.fingerList[0]; if (finger) { this.beginPan(finger.localX - event.offsetX, finger.localY - event.offsetY); this.updatePan(event.offsetX, event.offsetY); } })
                .onActionUpdate((event: GestureEvent) => this.updatePan(event.offsetX, event.offsetY)).onActionEnd(() => this.endPan()).onActionCancel(() => this.cancelGesture()),
              TapGesture({ count: 2, fingers: 1 }).onAction((event: GestureEvent) => { const finger = event.fingerList[0]; if (finger) { this.doubleTap(finger.localX, finger.localY); } }),
              TapGesture({ count: 1, fingers: 1 }).onAction(() => this.singleTap())
            ))
            if (this.immersive && !this.controlsVisible && this.canSkipIntro()) {
              Column() { Blank().layoutWeight(1).hitTestBehavior(HitTestMode.None)
                Row() { Blank().layoutWeight(1).hitTestBehavior(HitTestMode.None)
                  BrandButton({ label: $r('app.string.player_skip_intro'), icon: $r('app.media.player_next'), compact: true, onSelect: () => this.skipIntro() })
                    .width(this.fontScale > 1.2 || this.viewportWidth < 400 ? '100%' : 220)
                }.width('100%')
              }.width('100%').height('100%').padding(16).hitTestBehavior(HitTestMode.Transparent)
            }
            if (this.immersive && this.controlsVisible && !this.pipActive) {
              Flex({ direction: FlexDirection.Column, alignItems: ItemAlign.Center }) {
                Column() { this.playerHeader() }.width('100%').flexShrink(0)
                Blank().flexGrow(1).flexShrink(1).hitTestBehavior(HitTestMode.None)
                if (this.subtitle && this.canShowMainSubtitle()) {
                  Column() { this.plainSubtitle() }.width('100%').alignItems(HorizontalAlign.Center)
                    .padding({ bottom: 8 }).flexShrink(0).hitTestBehavior(HitTestMode.None)
                }
                this.playbackControls()
              }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent)
            }
            if (this.thumbnail && this.canScrub() && (this.sliderPreview >= 0 || this.seekPreview >= 0)) {
              Column({ space: 4 }) {
                Image(this.thumbnail).width(160).height(90).objectFit(ImageFit.Contain).borderRadius(8)
                  .accessibilityText($r('app.string.player_trickplay_frame')).onComplete(() => this.preview.rendered()).onError(() => this.preview.hide())
                Text(this.clock(this.thumbnailTime)).fontSize(12).fontColor('#FFFFFF').backgroundColor('#BB0D1924').padding(4)
              }.width('100%').height('100%').justifyContent(FlexAlign.Start).alignItems(HorizontalAlign.Center)
                .padding({ top: this.immersive ? 64 : 16 }).hitTestBehavior(HitTestMode.None)
            }
          }.layoutWeight(1).backgroundColor('#000000')
            .clip(true)
            .margin({ right: !this.immersive && this.viewportWidth > this.viewportHeight ? 12 : 0, bottom: this.immersive || this.viewportWidth > this.viewportHeight ? 0 : 8 })
            .onAreaChange((_old: Area, area: Area) => { this.surfaceWidth = Number.parseFloat(String(area.width)); this.surfaceHeight = Number.parseFloat(String(area.height)); })
          if (!this.immersive) { this.playbackControls() }
          }.width('100%').layoutWeight(1)
        }.width('100%').height('100%').backgroundColor((this.amoled ? '#000000' : this.palette.background))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => {
      this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height));
    })
  }

  @Builder
  private plainSubtitle() {
    Column() {
      if (this.subtitleRuns.length) {
        RichCaption({ runs: this.subtitleRuns, captionStyle: this.captionStyle, fontSize: 20 * (this.captionStyle.system ? this.captionStyle.scale : 1),
          identifier: 'playbackTextSubtitle', revision: this.subtitleRevision }).width('100%')
      } else {
      Text(this.subtitle).id('playbackTextSubtitle')
        .fontSize(this.captionStyle.system ? `${20 * this.captionStyle.scale}vp` : 20).fontColor(this.captionStyle.foreground).textAlign(TextAlign.Center)
        .fontFamily(this.captionStyle.family).textShadow(captionShadows(this.captionStyle.edge))
        .backgroundColor(this.captionStyle.background).padding(8).width('100%')
      }
    }.width('94%').padding(4).backgroundColor(this.captionStyle.window).hitTestBehavior(HitTestMode.None)
  }

  @Builder
  private playerHeader() {
    Row({ space: 12 }) {
      Button({ type: ButtonType.Normal }) {
        Image($r('app.media.menu_back')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined)).width(24).height(24).accessibilityLevel('no')
      }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? '#000000' : this.palette.surface))
        .enabled(!this.controlsLocked).accessibilityText($r('app.string.back')).onClick(() => this.goBack())
      Text(this.route.item.Name).fontColor('#F2F3FA').fontSize(18).fontWeight(FontWeight.Medium)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
      Button({ type: ButtonType.Normal }) {
        Image(this.controlsLocked ? $r('app.media.menu_unlock') : $r('app.media.menu_lock')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined))
          .width(24).height(24).accessibilityLevel('no')
      }.width(44).height(44).padding(0).borderRadius(14)
        .backgroundColor(this.controlsLocked ? this.palette.action : (this.amoled ? '#000000' : this.palette.surface))
        .accessibilityText(this.controlsLocked ? $r('app.string.controls_unlock') : $r('app.string.controls_lock'))
        .onClick(() => this.lockControls())
      Button({ type: ButtonType.Normal }) {
        Image(this.immersive ? $r('app.media.player_exit_fullscreen') : $r('app.media.player_fullscreen')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined)).width(24).height(24).accessibilityLevel('no')
      }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? '#000000' : this.palette.surface)).enabled(!this.controlsLocked)
        .accessibilityText(this.immersive ? $r('app.string.player_exit_fullscreen') : $r('app.string.player_fullscreen')).onClick(() => this.toggleImmersive())
    }.padding(12).width('100%').backgroundColor(this.immersive ? '#B30D1924' : (this.amoled ? '#000000' : this.palette.background))
  }

  @Builder
  private playbackControls() {
    Scroll() {
      Column({ space: 12 }) {
        if (!this.controlsLocked) {
          if (this.canSkipIntro()) { BrandButton({ label: $r('app.string.player_skip_intro'), icon: $r('app.media.player_next'), onSelect: () => this.skipIntro() }) }
          Column({ space: 12 }) {
            if (this.state !== 'error') {
            Row({ space: 8 }) {
              Text(this.clock(this.playbackPosition)).fontColor(this.palette.muted).fontSize(12).flexShrink(0)
              Slider({ value: this.sliderPreview >= 0 ? this.sliderPreview : this.playbackPosition, min: 0, max: Math.max(1, this.duration), step: 1000 })
                .layoutWeight(1).selectedColor(this.palette.accent).trackColor((this.amoled ? '#000000' : this.palette.surface))
                .blockColor(this.palette.accent).enabled(!this.busy && this.duration > 0)
                .accessibilityText($r('app.string.player_seek'))
                .onChange((value: number, mode: SliderChangeMode) => this.sliderSeek(value, mode))
              Text(this.clock(this.duration)).fontColor(this.palette.muted).fontSize(12).flexShrink(0)
            }.width('100%')
            }
            Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
              Column() {
                BrandButton({ label: this.state === 'error' ? $r('app.string.player_retry') : this.state === 'playing' ? $r('app.string.pause') : $r('app.string.play'),
                  icon: this.state === 'playing' ? $r('app.media.player_pause') : $r('app.media.detail_play'), primary: true,
                  available: this.state === 'error' ? this.canRetry() : !this.busy && ['prepared', 'playing', 'paused', 'completed', 'released'].includes(this.state),
                  onSelect: () => { this.toggle(); } })
              }.width(this.controlWidth >= 360 && this.fontScale < 1.5 ? '48%' : '100%').margin({ bottom: 8 })
              Column() {
                BrandButton({ label: $r('app.string.playback_options'), icon: $r('app.media.menu_settings'), primary: this.options,
                  onSelect: () => { this.options = !this.options; this.showControls(); } })
              }.width(this.controlWidth >= 360 && this.fontScale < 1.5 ? '48%' : '100%').margin({ bottom: 8 })
            }.width('100%')
          }.width('100%').padding(12).borderRadius(20).backgroundColor((this.amoled ? '#000000' : this.palette.raised))
          if (this.options) {
            this.displayOptions()
            this.systemOptions()
            this.mediaOptions()
            this.languageOptions()
            this.queueOptions()
          }
        } else {
          Text($r('app.string.player_locked_hint')).fontSize(14).fontColor(this.palette.muted).width('100%')
        }
        if (this.busy) { BrandState({ label: $r('app.string.playback_loading'), loading: true }) }
        if (this.message) { Text(this.message).fontColor(this.palette.danger).fontSize(12).width('100%') }
        if (this.state === 'error') { Text($r('app.string.player_failure_hint')).fontColor(this.palette.muted).fontSize(12).width('100%') }
        if (this.reportMessage) { Text(this.reportMessage).fontColor(this.palette.danger).fontSize(12).width('100%') }
        Text(this.route.offline ? $r('app.string.offline_playback') : $r('app.string.direct_play_hint'))
          .fontColor(this.palette.muted).fontSize(12).width('100%')
      }.padding({ left: 12, right: 12, bottom: 12 }).width('100%').alignItems(HorizontalAlign.Start)
    }.width(this.immersive ? '100%' : this.viewportWidth > this.viewportHeight ? Math.min(320, this.viewportWidth * 0.45) : '100%')
      .height(this.immersive ? Math.min(this.viewportHeight * 0.68, this.options ? this.viewportHeight * 0.68 : UiLayout.playerControls(this.viewportHeight, this.fontScale, false)) : this.viewportWidth > this.viewportHeight ? '100%' : UiLayout.playerControls(this.viewportHeight, this.fontScale, this.options && !this.controlsLocked))
      .constraintSize({ minHeight: 44 }).flexShrink(this.immersive ? 1 : 0)
      .align(Alignment.TopStart).onTouch(() => this.showControls()).onAreaChange((_old: Area, area: Area) => { this.controlWidth = Number.parseFloat(String(area.width)); })
  }

  @Builder
  systemOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_system_group'), icon: $r('app.media.player_background') })
      BrandButton({ label: this.pipActive ? $r('app.string.pip_exit') : $r('app.string.pip_enter'),
        icon: this.pipActive ? $r('app.media.player_pip_exit') : $r('app.media.player_pip'), primary: this.pipActive,
        available: this.systemReady && this.pipSupported && !this.busy && ['prepared', 'playing', 'paused'].includes(this.state),
        onSelect: () => { if (this.pipActive) { this.system?.stopPiP(); } else { this.system?.startPiP(); } } })
      if (!this.pipSupported) { Text($r('app.string.pip_unavailable')).fontColor(this.palette.muted).fontSize(12) }
      Row({ space: 12 }) {
        Text($r('app.string.background_playback')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.backgroundEnabled }).enabled(this.systemReady)
          .selectedColor(this.palette.action).switchPointColor(this.palette.accent)
          .accessibilityText($r('app.string.background_playback')).onChange((value: boolean) => { this.system?.setBackground(value); })
      }.width('100%')
      Text($r('app.string.background_playback_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
    }.padding(16).width('100%').borderRadius(20).backgroundColor((this.amoled ? '#000000' : this.palette.raised)).alignItems(HorizontalAlign.Start)
  }

  @Builder
  mediaOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_media_group'), icon: $r('app.media.nav_library_active') })
      Row({ space: 12 }) {
        Text($r('app.string.player_intro_skipper')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.introEnabled).enabled(!this.busy && !this.settingsBusy).selectedColor(this.palette.action)
          .accessibilityText($r('app.string.player_intro_skipper')).onChange((enabled: boolean) => this.changeIntro(enabled))
      }.width('100%')
      Text($r('app.string.player_intro_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
      Row({ space: 8 }) {
        Text($r('app.string.player_trickplay')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.trickplayEnabled).selectedColor(this.palette.action)
          .accessibilityText($r('app.string.player_trickplay')).onChange((enabled: boolean) => this.changeTrickplay(enabled))
      }.width('100%')
      Text($r('app.string.player_trickplay_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
      if (!this.route.offline && this.route.sources.length > 0) {
        PlayerChoice({ label: $r('app.string.media_source'), icon: $r('app.media.nav_library_active'),
          choices: this.route.sources.map((source: MediaSource, index: number): SelectOption => ({ value: source.Name || `${source.Container || text('media_source')} ${index + 1}` })),
          selected: this.route.sources.findIndex((source: MediaSource) => source.Id === this.route.mediaSourceId),
          available: !this.busy && !this.settingsBusy, onSelect: (index: number) => { this.source(index); } })
      }
      if (this.audio.length) {
        PlayerChoice({ label: $r('app.string.audio_track'), icon: $r('app.media.player_audio'),
          choices: this.audio.map((track: TrackChoice): SelectOption => ({ value: track.label })),
          selected: this.audio.findIndex((track: TrackChoice) => track.key === this.audioKey),
          available: !this.busy && !this.settingsBusy, onSelect: (index: number) => { this.track(this.audio[index].key, true); } })
      } else {
        BrandHeading({ label: $r('app.string.audio_track'), icon: $r('app.media.player_audio') })
        BrandState({ label: $r('app.string.no_audio_tracks'), icon: $r('app.media.player_audio') })
      }
      PlayerChoice({ label: $r('app.string.subtitle_track'), icon: $r('app.media.player_subtitle'),
        choices: [{ value: text('subtitles_off') }, ...this.subtitles.map((track: TrackChoice): SelectOption => ({ value: track.label }))],
        selected: this.subtitles.findIndex((track: TrackChoice) => track.key === this.subtitleKey) + 1,
        available: !this.busy && !this.settingsBusy, onSelect: (index: number) => { this.track(index === 0 ? '' : this.subtitles[index - 1].key, false); } })
      Text($r('app.string.subtitle_format_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
    }.padding(16).width('100%').borderRadius(20).backgroundColor((this.amoled ? '#000000' : this.palette.raised)).alignItems(HorizontalAlign.Start)
  }

  @Builder
  languageOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.playback_language_preferences'), icon: $r('app.media.menu_settings') })
      Text($r('app.string.preferred_audio_language')).fontColor(this.palette.muted).fontSize(14)
      TextInput({ text: this.audioLanguage, placeholder: text('playback_language_placeholder') })
        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(63).fontSize(14).fontColor('#F2F3FA')
        .placeholderColor(this.palette.muted).backgroundColor((this.amoled ? '#000000' : this.palette.surface))
        .enabled(!this.settingsBusy && !this.busy).onChange((value: string) => { this.audioLanguage = value; })
      Text($r('app.string.preferred_subtitle_language')).fontColor(this.palette.muted).fontSize(14)
      TextInput({ text: this.subtitleLanguage, placeholder: text('playback_language_placeholder') })
        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(63).fontSize(14).fontColor('#F2F3FA')
        .placeholderColor(this.palette.muted).backgroundColor((this.amoled ? '#000000' : this.palette.surface))
        .enabled(!this.settingsBusy && !this.busy && !this.subtitlesOff).onChange((value: string) => { this.subtitleLanguage = value; })
      Row({ space: 12 }) {
        Text($r('app.string.preferred_subtitles_off')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.subtitlesOff }).enabled(!this.settingsBusy && !this.busy)
          .selectedColor(this.palette.action).switchPointColor(this.palette.accent)
          .accessibilityText($r('app.string.preferred_subtitles_off')).onChange((value: boolean) => { this.subtitlesOff = value; })
      }.width('100%')
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        Column() {
          BrandButton({ label: $r('app.string.save_playback_preferences'), icon: $r('app.media.menu_save'), primary: true,
            available: !this.settingsBusy && !this.busy, onSelect: () => { this.savePreferences(); } })
        }.width(this.controlWidth >= 480 && this.fontScale < 1.5 ? '48%' : '100%').margin({ bottom: 8 })
        Column() {
          BrandButton({ label: $r('app.string.reset_playback_preferences'), icon: $r('app.media.menu_reset'),
            available: !this.settingsBusy && !this.busy, onSelect: () => { this.savePreferences(true); } })
        }.width(this.controlWidth >= 480 && this.fontScale < 1.5 ? '48%' : '100%').margin({ bottom: 8 })
      }.width('100%')
      Text($r('app.string.playback_preferences_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
      if (this.settingsBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.settingsMessage) { Text(this.settingsMessage).fontColor(this.palette.warm).fontSize(12).width('100%') }
    }.padding(16).width('100%').borderRadius(20).backgroundColor((this.amoled ? '#000000' : this.palette.raised)).alignItems(HorizontalAlign.Start)
  }

  @Builder
  private displayOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_display_group'), icon: $r('app.media.menu_settings') })
      Text($r('app.string.player_brightness_value', Math.round(this.windowBrightness * 100))).fontColor('#F2F3FA').fontSize(14).width('100%')
      Slider({ value: this.windowBrightness * 100, min: 5, max: 100, step: 1 }).width('100%').selectedColor(this.palette.accent)
        .accessibilityText($r('app.string.player_window_brightness')).onChange((value: number, mode: SliderChangeMode) => { this.changeBrightness(value / 100, mode === SliderChangeMode.End || mode === SliderChangeMode.Click); })
      Text($r('app.string.player_volume_value', Math.round(this.volume * 100))).fontColor('#F2F3FA').fontSize(14).width('100%')
      Slider({ value: this.volume * 100, min: 0, max: 100, step: 1 }).width('100%').selectedColor(this.palette.accent)
        .accessibilityText($r('app.string.player_relative_volume')).onChange((value: number) => this.changeVolume(value / 100))
      Text($r('app.string.player_relative_volume_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
      Row({ space: 12 }) {
        Text($r('app.string.player_night_mode')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.night }).selectedColor(this.palette.action).accessibilityText($r('app.string.player_night_mode'))
          .onChange((value: boolean) => { this.night = value; this.showControls(); })
      }.width('100%')
      Text($r('app.string.player_dim_value', Math.round(this.dimOpacity * 100))).fontColor(this.palette.muted).fontSize(12).width('100%')
      Slider({ value: this.dimOpacity * 100, min: 10, max: 90, step: 1 }).width('100%').selectedColor(this.palette.accent)
        .accessibilityText($r('app.string.player_dim_opacity')).onChange((value: number, mode: SliderChangeMode) => { if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) { this.changeDim(value / 100); } })
    }.padding(16).width('100%').borderRadius(20).backgroundColor((this.amoled ? '#000000' : this.palette.raised)).alignItems(HorizontalAlign.Start)
  }

  @Builder
  queueOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_queue_group'), icon: $r('app.media.player_speed') })
      Text($r('app.string.gesture_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        ForEach([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], (speed: number) => {
          Column() {
            Button(`${speed}×`).labelStyle({ maxLines: 1, overflow: TextOverflow.Ellipsis }).fontSize(14).fontColor('#F2F3FA')
              .width('100%').constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale) }).borderRadius(14)
              .backgroundColor(this.speed === speed ? this.palette.action : (this.amoled ? '#000000' : this.palette.surface))
              .accessibilityText(`${speed}×`).onClick(() => this.changeSpeed(speed))
          }.width(this.controlWidth >= 360 && this.fontScale < 1.5 ? '31%' : '48%').margin({ bottom: 8 })
        })
      }.width('100%')
      if (this.route.item.Type === 'Episode') {
        Row({ space: 12 }) {
          Text($r('app.string.auto_next')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
          Toggle({ type: ToggleType.Switch, isOn: this.autoNext }).selectedColor(this.palette.action)
            .switchPointColor(this.palette.accent).accessibilityText($r('app.string.auto_next'))
            .enabled(this.autoNextReady).onChange((value: boolean) => { this.changeAutoNext(value ? 'on' : 'off'); })
        }.width('100%')
        Text(this.autoNextMode === 'server' ? $r('app.string.auto_next_server') : $r('app.string.auto_next_local')).fontColor(this.palette.muted).fontSize(12).width('100%')
        BrandButton({ label: $r('app.string.auto_next_follow'), icon: $r('app.media.menu_sync'), available: !this.busy,
          onSelect: () => this.changeAutoNext('server') })
          BrandButton({ label: $r('app.string.previous_episode'), icon: $r('app.media.player_previous'),
            available: !this.busy && this.state !== 'released', onSelect: () => { this.system?.previous(); } })
        BrandButton({ label: $r('app.string.next_episode'), icon: $r('app.media.player_next'),
          available: !this.busy && this.state !== 'released', onSelect: () => { this.system?.next(); } })
      }
    }.padding(16).width('100%').borderRadius(20).backgroundColor((this.amoled ? '#000000' : this.palette.raised)).alignItems(HorizontalAlign.Start)
  }
}
