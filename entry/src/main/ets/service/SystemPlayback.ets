import { BackgroundLease } from './BackgroundLease';
import { AppLock } from './AppLock';
import common from '@ohos.app.ability.common';
import avSession from '@ohos.multimedia.avsession';
import backgroundTaskManager from '@ohos.resourceschedule.backgroundTaskManager';
import wantAgent, { WantAgent } from '@ohos.app.ability.wantAgent';
import PiPWindow from '@ohos.PiPWindow';
import { PlaybackRoute } from '../model/Models';
import { text } from '../utils/Strings';
import { ProductIdentity } from '../utils/ProductIdentity';
import { PlaybackController, PlaybackStatus } from './PlaybackController';
import { EMPTY_SUBTITLE_RUNS, SubtitleRun, EMPTY_POSITIONED_SUBTITLES, PositionedSubtitle } from '../utils/InlineSubtitle';
import { PiPSubtitleController } from '../components/PiPSubtitle';
import { StyledSubtitleFrame } from '../utils/StyledSubtitle';

export interface SystemPlayerState { ready: boolean; backgroundEnabled: boolean; pipSupported: boolean; pipActive: boolean }
export interface SystemPlayerView {
  changed: (state: SystemPlayerState) => void;
  error: (message: string) => void;
  next: () => Promise<void>;
  previous?: () => Promise<void>;
  canNavigate?: () => boolean;
  stopped: () => void;
}

// One owner per UIAbility. Page exit and ability destruction tear down the same resources.
export class SystemPlayback {
  static current: SystemPlayback | undefined = undefined;
  private static sessionHandoff: Promise<void> = Promise.resolve();
  private autoPiP: () => boolean;
  private autoQueued: boolean = false;
  private autoArmed: boolean = false;
  private autoRetryAt: number = 0;
  private autoWait: (() => void) | undefined = undefined;
  private context: common.UIAbilityContext;
  private controller: PlaybackController;
  private surface: XComponentController;
  private view: SystemPlayerView;
  private session: avSession.AVSession | undefined = undefined;
  private agent: WantAgent | undefined = undefined;
  private pip: PiPWindow.PiPController | undefined = undefined;
  private captions: PiPSubtitleController | undefined = undefined;
  private subtitleText: string = '';
  private subtitleRuns: SubtitleRun[] = EMPTY_SUBTITLE_RUNS;
  private positionedSubtitles: PositionedSubtitle[] = EMPTY_POSITIONED_SUBTITLES;
  private styledFrame: StyledSubtitleFrame | undefined;
  private ready: boolean = false;
  private disposed: boolean = false;
  private hidden: boolean = false;
  private backgroundEnabled: boolean = false;
  private taskActive: boolean = false;
  private taskWanted: boolean = false;
  private pipSupported: boolean = false;
  private pipActive: boolean = false;
  private pipStarting: boolean = false;
  private restoring: boolean = false;
  private preferenceRevision: number = 0;
  private commandRevision: number = 0;
  private playIntent: boolean = true;
  private initialization: Promise<void> | undefined = undefined;
  private closing: Promise<void> | undefined = undefined;
  private tasks: Promise<void> = Promise.resolve();
  private pipWork: Promise<void> = Promise.resolve();
  private latest: PlaybackStatus;
  private pending: PlaybackStatus | undefined = undefined;
  private publication: Promise<void> | undefined = undefined;
  private lastPublication: number = 0;

  constructor(context: common.UIAbilityContext, controller: PlaybackController, surface: XComponentController, route: PlaybackRoute, view: SystemPlayerView, autoPiP: () => boolean = () => false) {
    this.autoPiP = autoPiP;
    this.context = context; this.controller = controller; this.surface = surface; this.view = view;
    this.latest = { route: route, state: 'loading', position: 0, duration: (route.item.RunTimeTicks ?? 0) / 10000, speed: 1, width: 0, height: 0 };
    try { this.pipSupported = canIUse('SystemCapability.Window.SessionManager') && PiPWindow.isPiPEnabled(); } catch (e) { this.pipSupported = false; }
    this.emit();
  }

  get canContinue(): boolean { return !this.disposed && this.ready && this.taskActive && (this.backgroundEnabled || this.pipActive || this.pipStarting); }
  get canAutoAdvance(): boolean { return !this.disposed && this.playIntent; }
  get isClosed(): boolean { return this.disposed; }

  private emit(): void { this.view.changed({ ready: this.ready, backgroundEnabled: this.backgroundEnabled, pipSupported: this.pipSupported, pipActive: this.pipActive }); }

  updateSubtitle(value: string, runs: SubtitleRun[] = EMPTY_SUBTITLE_RUNS, positioned: PositionedSubtitle[] = EMPTY_POSITIONED_SUBTITLES): void {
    if (this.disposed) { return; }
    this.subtitleText = value; this.subtitleRuns = runs; this.positionedSubtitles = positioned; this.captions?.setText(value, runs, positioned);
  }

  updateStyledSubtitle(frame: StyledSubtitleFrame | undefined): void {
    if (this.disposed) { return; }
    this.styledFrame = frame; this.captions?.setFrame(frame);
  }

  initialize(): Promise<void> {
    if (!this.initialization) {
      // Multiple new pages can capture the same predecessor while its disposal is pending.
      // Serialize the complete ownership handoff, including native creation and activation.
      const operation = SystemPlayback.sessionHandoff.then(() => this.createSession());
      this.initialization = operation;
      SystemPlayback.sessionHandoff = operation.then(() => {}, () => {});
    }
    return this.initialization;
  }

  private async createSession(): Promise<void> {
    if (this.disposed) { return; }
    try {
      const previous = SystemPlayback.current;
      if (previous && previous !== this) { await previous.dispose(); if (previous.taskActive || previous.pip || previous.session || (previous.captions && !previous.captions.isReleased)) { throw new Error('system_playback_cleanup_failed'); } }
      if (this.disposed) { return; }
      SystemPlayback.current = this;
      if (!canIUse('SystemCapability.Multimedia.AVSession.Core')) { throw new Error('session_unavailable'); }
      // API 12 audio sessions provide lock-screen controls for background listening to the movie.
      const session = await avSession.createAVSession(this.context, ProductIdentity.CLIENT_NAME, 'audio');
      this.session = session;
      if (this.disposed) { return; }
      this.agent = await wantAgent.getWantAgent({ wants: [{ bundleName: this.context.abilityInfo.bundleName, abilityName: this.context.abilityInfo.name }],
        operationType: wantAgent.OperationType.START_ABILITY, requestCode: 0, wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG] });
      if (this.disposed) { return; }
      session.on('play', () => { this.play(); });
      session.on('pause', () => { this.pause(); });
      session.on('stop', () => { this.stop(); });
      session.on('seek', (position: number) => { if (!this.disposed) { this.controller.seek(position); this.sync(true); } });
      session.on('fastForward', (amount?: number) => { this.skip(amount ?? 15000); });
      session.on('rewind', (amount?: number) => { this.skip(-(amount ?? 15000)); });
      session.on('setSpeed', (speed: number) => {
        if (this.disposed) { return; }
        if (![0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(speed)) { this.view.error(text('speed_failed')); return; }
        this.controller.setSpeed(speed); this.sync(true);
      });
      if (this.latest.route.item.Type === 'Episode') {
        session.on('playNext', () => { this.next(); });
        if (this.view.previous) { session.on('playPrevious', () => { this.previous(); }); }
      }
      await session.setLaunchAbility(this.agent);
      await session.setAVMetadata(this.metadata(this.latest));
      await session.setAVPlaybackState(this.playbackState(this.latest));
      if (this.disposed) { return; }
      await session.activate();
      if (this.disposed) { return; }
      this.ready = true; this.emit(); this.sync(true);
    } catch (e) {
      if (!this.disposed) {
        this.ready = false; this.view.error(text('session_unavailable')); this.emit();
        const session = this.session; this.session = undefined;
        if (session) { try { await session.destroy(); } catch (error) { this.session = session; this.view.error(text('system_playback_cleanup_failed')); } }
      }
    }
  }

  private metadata(status: PlaybackStatus): avSession.AVMetadata {
    // Do not send authenticated artwork URLs, credentials, or stream URLs to system metadata.
    return { assetId: status.route.item.Id, title: status.route.item.Name, artist: status.route.item.SeriesName ?? '', duration: Math.max(0, status.duration) };
  }

  private playbackState(status: PlaybackStatus): avSession.AVPlaybackState {
    let state = avSession.PlaybackState.PLAYBACK_STATE_BUFFERING;
    if (status.state === 'playing') { state = avSession.PlaybackState.PLAYBACK_STATE_PLAY; }
    else if (status.state === 'paused') { state = avSession.PlaybackState.PLAYBACK_STATE_PAUSE; }
    else if (status.state === 'prepared') { state = avSession.PlaybackState.PLAYBACK_STATE_PREPARE; }
    else if (status.state === 'completed') { state = avSession.PlaybackState.PLAYBACK_STATE_COMPLETED; }
    else if (status.state === 'released' || status.state === 'stopped') { state = avSession.PlaybackState.PLAYBACK_STATE_STOP; }
    else if (status.state === 'error') { state = avSession.PlaybackState.PLAYBACK_STATE_ERROR; }
    return { state: state, speed: status.speed, position: { elapsedTime: Math.max(0, status.position), updateTime: Date.now() } };
  }

  sync(force: boolean = false): void {
    if (this.disposed) { return; }
    const status = this.controller.snapshot();
    // Until the surface opens, the controller still has its empty default route.
    // Keep the requested media identity used to initialize this system session.
    if (!status.route.item.Id) { return; }
    const changed = status.state !== this.latest.state || status.route.item.Id !== this.latest.route.item.Id || status.route.mediaSourceId !== this.latest.route.mediaSourceId;
    this.latest = status;
    if (changed && status.state === 'playing') { this.playIntent = true; }
    if (changed && (status.state === 'paused' || status.state === 'error' || status.state === 'released')) {
      this.playIntent = false; ++this.commandRevision; this.setTask(false);
    }
    if (this.pip && this.pipActive) {
      try {
        this.pip.updatePiPControlStatus(PiPWindow.PiPControlType.VIDEO_PLAY_PAUSE,
          status.state === 'playing' ? PiPWindow.PiPControlStatus.PLAY : PiPWindow.PiPControlStatus.PAUSE);
        if (status.width > 0 && status.height > 0) { this.pip.updateContentSize(status.width, status.height); }
      } catch (e) { this.view.error(text('pip_failed')); }
    }
    this.refreshAutoPiP();
    if (!this.ready || (!force && !changed && Date.now() - this.lastPublication < 1000)) { return; }
    this.lastPublication = Date.now(); this.pending = status;
    if (!this.publication) { this.publication = this.publish().finally(() => {
      this.publication = undefined;
      if (this.pending && !this.disposed) { this.sync(true); }
    }); }
  }

  private async publish(): Promise<void> {
    const session = this.session;
    while (this.pending && session && !this.disposed) {
      const status = this.pending; this.pending = undefined;
      try {
        await session.setAVMetadata(this.metadata(status));
        if (this.disposed) { return; }
        await session.setAVPlaybackState(this.playbackState(status));
      } catch (e) { if (!this.disposed) { this.view.error(text('session_update_failed')); } }
    }
  }

  private setTask(wanted: boolean): Promise<boolean> {
    this.taskWanted = wanted;
    const operation = this.tasks.then(async (): Promise<boolean> => {
      try {
        if (this.taskWanted && !this.disposed && this.ready && this.agent && !this.taskActive) {
          if (!canIUse('SystemCapability.ResourceSchedule.BackgroundTaskManager.ContinuousTask')) { throw new Error('background_unavailable'); }
          await BackgroundLease.set(this.context, backgroundTaskManager.BackgroundMode.AUDIO_PLAYBACK, true);
          this.taskActive = true;
        }
        if (this.taskActive && (!this.taskWanted || this.disposed)) {
          await BackgroundLease.set(this.context, backgroundTaskManager.BackgroundMode.AUDIO_PLAYBACK, false); this.taskActive = false;
        }
      } catch (e) { if (!this.disposed || this.taskActive) { this.view.error(text(this.taskWanted ? 'background_unavailable' : 'background_stop_failed')); } }
      return this.taskActive && this.taskWanted && !this.disposed;
    });
    this.tasks = operation.then(() => {}); return operation;
  }

  async setBackground(enabled: boolean): Promise<void> {
    const revision = ++this.preferenceRevision;
    if (this.disposed) { return; }
    if (enabled) {
      await this.initialize();
      if (this.disposed || revision !== this.preferenceRevision) { return; }
      this.backgroundEnabled = true;
      const playing = this.controller.snapshot().state === 'playing';
      const granted = !playing || await this.setTask(true);
      if (this.disposed || revision !== this.preferenceRevision) { return; }
      if (!granted) { this.backgroundEnabled = false; }
      if (!this.ready) { this.backgroundEnabled = false; }
    } else {
      this.backgroundEnabled = false;
      ++this.commandRevision;
      if (this.hidden && !this.pipActive && !await this.controller.hide(false)) { await this.stop(); return; }
      await this.setTask(this.pipActive && this.controller.snapshot().state === 'playing');
    }
    if (this.disposed || revision !== this.preferenceRevision) { return; }
    if (this.hidden && !await this.controller.hide(this.canContinue)) { await this.stop(); return; }
    this.emit();
  }

  async permitPlay(): Promise<boolean> {
    if (this.disposed || !AppLock.permit()) { return false; }
    const revision = this.commandRevision;
    await this.initialize();
    if (this.disposed || revision !== this.commandRevision || !AppLock.permit()) { return false; }
    if (this.backgroundEnabled || this.pipActive || this.pipStarting) {
      if (!await this.setTask(true)) { if (this.hidden) { await this.controller.hide(false); } return false; }
    } else if (this.hidden) { this.view.error(text('background_unavailable')); return false; }
    if (this.disposed || revision !== this.commandRevision || !AppLock.permit()) { return false; }
    if (this.hidden) { await this.controller.hide(this.canContinue); } else { this.controller.show(); }
    return true;
  }

  async play(): Promise<void> {
    if (!await this.permitPlay()) { return; }
    this.playIntent = true;
    if (!await this.controller.play()) { await this.setTask(false); }
    this.sync(true);
  }

  async pause(): Promise<void> {
    if (this.disposed) { return; }
    ++this.commandRevision; this.playIntent = false;
    this.setAutoStart(false);
    this.autoWait?.();
    if (!await this.controller.pausePlayback()) { await this.stop(); return; }
    await this.setTask(false); this.sync(true);
  }

  private skip(amount: number): void {
    if (!this.disposed && Number.isFinite(amount)) { this.controller.seek(this.controller.snapshot().position + amount); this.sync(true); }
  }

  async next(): Promise<void> { await this.navigate(false); }
  async previous(): Promise<void> { await this.navigate(true); }
  private async navigate(previous: boolean): Promise<void> {
    if (this.disposed || !AppLock.permit() || this.view.canNavigate?.() === false || (previous && !this.view.previous)) { return; }
    const revision = this.commandRevision;
    await this.initialize();
    if (this.disposed || revision !== this.commandRevision) { return; }
    if (this.hidden && !this.canContinue) {
      if ((!this.backgroundEnabled && !this.pipActive) || !await this.setTask(true)) { return; }
    }
    if (this.hidden && !await this.controller.hide(this.canContinue)) { return; }
    if (!this.disposed && revision === this.commandRevision && AppLock.permit() && this.view.canNavigate?.() !== false) {
      this.playIntent = true; if (previous) { await this.view.previous?.(); } else { await this.view.next(); }
    }
  }

  private wantsAutoPiP(): boolean {
    return !this.disposed && this.pipSupported && AppLock.permit() && this.autoPiP() && this.playIntent && this.controller.snapshot().state === 'playing';
  }
  private setAutoStart(enabled: boolean): boolean {
    if (!this.pip) { return false; }
    if (this.autoArmed === enabled) { return true; }
    try { this.pip.setAutoStartEnabled(enabled); this.autoArmed = enabled; return true; }
    catch (e) { this.view.error(text('auto_pip_failed')); return false; }
  }
  refreshAutoPiP(): void {
    if (this.disposed) { return; }
    const wanted = this.wantsAutoPiP() && !this.pipActive;
    if (!wanted) { this.setAutoStart(false); }
    if (!this.ready || !this.pipSupported || this.autoQueued) { return; }
    if (wanted && (this.autoArmed || Date.now() < this.autoRetryAt)) { return; }
    if (!wanted && (!this.taskActive || this.backgroundEnabled || this.pipActive || this.pipStarting)) { return; }
    this.autoQueued = true;
    const work = this.pipWork.then(async () => {
      try {
        if (this.wantsAutoPiP() && !this.hidden && !this.pipActive) {
          await this.ensurePiP();
          if (!this.wantsAutoPiP() || this.hidden) { return; }
          if (!await this.setTask(true)) { throw new Error('background_unavailable'); }
          if (this.wantsAutoPiP() && !this.hidden && !this.setAutoStart(true)) { throw new Error('auto_pip_failed'); }
        } else {
          this.setAutoStart(false);
          if (!this.backgroundEnabled && !this.pipActive && !this.pipStarting) { await this.setTask(false); }
        }
      } catch (e) {
        this.autoRetryAt = Date.now() + 30000;
        if (!this.disposed) { this.setAutoStart(false); this.view.error(text('auto_pip_failed'));
          if (!this.backgroundEnabled && !this.pipActive && !this.pipStarting) { await this.setTask(false); } }
      }
      finally { this.autoQueued = false; }
    });
    this.pipWork = work;
  }
  async background(): Promise<void> {
    if (this.disposed) { return; }
    this.hidden = true;
    // Native auto entry is armed while the main window is visible. Starting a new PiP from
    // onBackground is too late on devices that require a foreground main window.
    if (this.wantsAutoPiP() && this.autoArmed && !this.pipActive && !this.pipStarting) {
      this.pipStarting = true;
      let timer: number = -1;
      await new Promise<void>((resolve) => { this.autoWait = resolve; timer = setTimeout(resolve, 1200); });
      if (timer >= 0) { clearTimeout(timer); } this.autoWait = undefined;
      if (!this.pipActive) {
        this.pipStarting = false;
        if (this.hidden) { this.setAutoStart(false); if (!this.disposed && this.playIntent) { this.view.error(text('auto_pip_failed')); } }
      }
    }
    if (!this.disposed && this.hidden && !await this.controller.hide(this.canContinue)) { await this.stop(); }
    if (!this.disposed) { this.controller.setStyledSubtitleVisible(AppLock.permit() && this.pipActive); }
  }
  foreground(): void { if (!this.disposed) { this.hidden = false; this.autoWait?.(); this.controller.show(); this.refreshAutoPiP(); } }

  async queueEnded(): Promise<void> { this.playIntent = false; this.setAutoStart(false); await this.setTask(false); this.sync(true); }

  private async ensurePiP(): Promise<void> {
    if (this.pip || this.disposed) { return; }
    const status = this.controller.snapshot();
    this.captions?.dispose();
    this.captions = new PiPSubtitleController(() => { this.view.error(text('pip_subtitle_failed')); });
    this.captions.setText(this.subtitleText, this.subtitleRuns, this.positionedSubtitles);
    this.captions.setFrame(this.styledFrame);
    const pip = await PiPWindow.create({ context: this.context, componentController: this.surface,
      templateType: PiPWindow.PiPTemplateType.VIDEO_PLAY, contentWidth: Math.max(1, status.width), contentHeight: Math.max(1, status.height),
      customUIController: this.captions,
      controlGroups: [status.route.item.Type === 'Episode' ? PiPWindow.VideoPlayControlGroup.VIDEO_PREVIOUS_NEXT : PiPWindow.VideoPlayControlGroup.FAST_FORWARD_BACKWARD] });
    this.pip = pip; pip.setAutoStartEnabled(false);
    if (this.disposed) { return; }
    pip.on('stateChange', (state: PiPWindow.PiPState) => {
      if (this.disposed) { return; }
      if (state === PiPWindow.PiPState.STARTED) {
        if (this.hidden && !this.pipStarting && !this.pipActive && !this.autoArmed) { pip.stopPiP().catch(() => {}); return; }
        this.pipActive = true; this.pipStarting = false; this.emit();
        this.autoWait?.();
        if (!AppLock.permit()) { this.pause().then(() => this.stopPiP()); }
        else if (this.controller.snapshot().state === 'playing') {
          this.setTask(true).then(async (granted: boolean) => { if (!granted && !this.disposed) { await this.pause(); await this.stopPiP(); } });
        }
      } else if (state === PiPWindow.PiPState.ABOUT_TO_RESTORE) { this.restoring = true; this.foreground(); }
      else if (state === PiPWindow.PiPState.STOPPED || state === PiPWindow.PiPState.ERROR) { this.pipStopped(state === PiPWindow.PiPState.ERROR); }
    });
    pip.on('controlPanelActionEvent', (event: PiPWindow.PiPActionEventType, status?: number) => {
      if (this.disposed) { return; }
      if (event === 'playbackStateChanged') { if (status === PiPWindow.PiPControlStatus.PLAY) { this.play(); } else { this.pause(); } }
      else if (event === 'nextVideo') { this.next(); }
      else if (event === 'previousVideo') { this.previous(); }
      else if (event === 'fastForward') { this.skip(15000); }
      else if (event === 'fastBackward') { this.skip(-15000); }
    });
    if (status.route.item.Type === 'Episode') {
      pip.setPiPControlEnabled(PiPWindow.PiPControlType.VIDEO_NEXT, true);
      pip.setPiPControlEnabled(PiPWindow.PiPControlType.VIDEO_PREVIOUS, !!this.view.previous);
    }
  }
  startPiP(automatic: boolean = false): Promise<void> {
    const operation = this.pipWork.then(async () => {
      if (this.disposed || this.pipActive || this.pipStarting || !AppLock.permit() || (automatic && !this.wantsAutoPiP())) { return; }
      if (!this.pipSupported || !['playing', 'paused', 'prepared'].includes(this.controller.snapshot().state)) { this.view.error(text('pip_unavailable')); return; }
      await this.initialize(); if (this.disposed || !this.ready) { return; }
      this.pipStarting = true;
      try {
        if (this.controller.snapshot().state === 'playing' && !await this.setTask(true)) { throw new Error('background_unavailable'); }
        await this.ensurePiP();
        if (this.disposed || !AppLock.permit() || (automatic && !this.wantsAutoPiP())) { this.pipStarting = false; return; }
        await this.pip?.startPiP();
        if (!this.disposed) { this.pipActive = true; this.pipStarting = false; this.sync(true); this.emit(); }
      } catch (e) {
        if (!this.disposed && !this.pipActive) {
          this.pipStarting = false; this.view.error(text('pip_failed')); this.captions?.aboutToDisappear();
          if (this.hidden && !this.backgroundEnabled) { await this.pause(); }
          await this.setTask(this.backgroundEnabled && this.controller.snapshot().state === 'playing'); this.emit();
        }
      }
    });
    this.pipWork = operation; return operation;
  }

  private async pipStopped(failed: boolean): Promise<void> {
    this.pipActive = false; this.pipStarting = false;
    this.autoWait?.();
    this.captions?.aboutToDisappear();
    const restoring = this.restoring; this.restoring = false; this.emit();
    if (failed) { this.view.error(text('pip_failed')); }
    if (this.hidden && !restoring) { await this.pause(); }
    else { await this.setTask(this.backgroundEnabled && this.controller.snapshot().state === 'playing'); }
  }

  async stopPiP(): Promise<void> {
    this.setAutoStart(false);
    await this.pipWork;
    if (!this.disposed && this.pip && this.pipActive) {
      try { await this.pip.stopPiP(); }
      catch (e) { this.view.error(text('pip_failed')); }
    }
  }

  async stop(): Promise<void> { await this.dispose(); this.view.stopped(); }

  dispose(): Promise<void> {
    if (this.closing) { return this.closing.then(async () => {
      await this.releasePiP(); await this.releaseSession();
      this.captions?.dispose();
      if (this.taskActive) { await this.setTask(false); }
      this.clearOwner();
    }); }
    this.disposed = true; this.ready = false; this.backgroundEnabled = false; this.taskWanted = false; ++this.preferenceRevision; ++this.commandRevision;
    this.autoWait?.();
    this.controller.pausePlayback();
    this.subtitleText = ''; this.subtitleRuns = EMPTY_SUBTITLE_RUNS; this.positionedSubtitles = EMPTY_POSITIONED_SUBTITLES; this.styledFrame = undefined; this.captions?.dispose();
    this.emit(); this.closing = this.cleanup(); return this.closing;
  }

  private async cleanup(): Promise<void> {
    await this.initialization; await this.pipWork;
    await this.releasePiP();
    this.captions?.dispose();
    await this.controller.close(); await this.setTask(false);
    await this.publication;
    await this.releaseSession(); this.clearOwner();
  }

  private async releasePiP(): Promise<void> {
    if (this.pip) {
      try { this.pip.setAutoStartEnabled(false); this.pip.off('stateChange'); this.pip.off('controlPanelActionEvent');
        if (this.pipActive || this.pipStarting) { await this.pip.stopPiP(); }
          this.pip = undefined; this.autoArmed = false; this.pipActive = false; this.pipStarting = false; this.emit();
      } catch (e) { this.view.error(text('system_playback_cleanup_failed')); }
    }
  }

  private async releaseSession(): Promise<void> {
    const session = this.session;
    if (session) {
      try { await session.deactivate(); } catch (e) { /* It may never have reached activate. */ }
      try { await session.destroy(); this.session = undefined; } catch (e) { this.view.error(text('system_playback_cleanup_failed')); }
    }
  }

  private clearOwner(): void {
    if (SystemPlayback.current === this && !this.taskActive && !this.pip && !this.session && (!this.captions || this.captions.isReleased)) { SystemPlayback.current = undefined; }
  }
}
