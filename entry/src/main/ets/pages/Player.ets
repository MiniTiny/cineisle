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
import { PlaybackController } from '../service/PlaybackController';
import { PlaybackPreferences } from '../utils/PlaybackPreferences';
import { SystemPlayback, SystemPlayerState } from '../service/SystemPlayback';

@Entry
@Component
struct Player {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @State controlWidth: number = 360;
  @State surfaceWidth: number = 360;
  @State surfaceHeight: number = 200;
  @State videoAspect: number = 16 / 9;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State route: PlaybackRoute = new PlaybackRoute();
  @State message: string = '';
  @State reportMessage: string = '';
  @State speed: number = 1;
  @State state: string = 'loading';
  @State playbackPosition: number = 0;
  @State duration: number = 0;
  @State subtitle: string = '';
  @State audio: TrackChoice[] = [];
  @State subtitles: TrackChoice[] = [];
  @State audioKey: string = '';
  @State subtitleKey: string = '';
  @State options: boolean = false;
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
  private surface: XComponentController = new XComponentController();
  private surfaceId: string = '';
  private controller: PlaybackController | undefined = undefined;
  private system: SystemPlayback | undefined = undefined;
  private alive: boolean = false;
  private visible: boolean = true;
  private loadRevision: number = 0;
  private finished: boolean = false;

  aboutToAppear(): void {
    this.route = router.getParams() as PlaybackRoute;
    if (!this.route?.url || !this.route.item?.Id) { router.back(); return; }
    this.alive = true;
    if (this.route.item.Type === 'Episode') { this.restoreAutoNext(); }
    this.showPreferences(AppService.playbackPreferences.snapshot());
    this.settingsMessage = AppService.playbackPreferences.issue ? text(AppService.playbackPreferences.issue) : '';
    this.controller = new PlaybackController(AppService.client, {
      state: (state: string) => { if (this.alive) { this.state = state; if (!['playing', 'prepared'].includes(state)) { this.cancelGesture(); } this.system?.sync(true); } },
      time: (position: number, duration: number) => { if (this.alive) { this.playbackPosition = position; this.duration = duration; const status = this.controller?.snapshot(); this.speed = status?.speed ?? 1; if (status && status.width > 0 && status.height > 0) { this.videoAspect = status.width / status.height; } this.system?.sync(); if (this.route.offline && Date.now() - this.lastOfflineSave > 10000) { this.saveOffline(); } } },
      tracks: (audio: TrackChoice[], subtitles: TrackChoice[], audioKey: string, subtitleKey: string) => {
        if (this.alive) { this.audio = audio; this.subtitles = subtitles; this.audioKey = audioKey; this.subtitleKey = subtitleKey; }
      },
      subtitle: (value: string) => { if (this.alive) { this.subtitle = value; this.system?.updateSubtitle(value); } },
      error: (message: string) => { if (this.alive) { this.message = message; } },
      reportError: (failed: boolean) => { if (this.alive) { this.reportMessage = failed ? text('progress_not_saved') : ''; } },
      complete: () => { this.completed(); },
      beforePlay: async () => { if (!AppLock.permit()) { return false; } return this.system ? this.system.permitPlay() : this.visible; },
      interrupted: () => { this.cancelGesture(); this.system?.pause(); }
    }, () => AppService.playbackPreferences.snapshot());
    this.connectSystem();
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
      changed: (state: SystemPlayerState) => { if (this.alive) { this.systemReady = state.ready; this.backgroundEnabled = state.backgroundEnabled; this.pipSupported = state.pipSupported; this.pipActive = state.pipActive; } },
      error: (message: string) => { if (this.alive) { this.message = message; } },
      next: async () => { await this.next(); },
      stopped: () => { if (this.alive) { ++this.loadRevision; this.busy = false; this.state = 'released'; this.system = undefined; } }
    });
    this.system.initialize();
  }

  private async toggle(): Promise<void> {
    this.finished = false;
    if (this.state === 'released') { this.connectSystem(); await this.controller?.open(this.route, this.surfaceId); }
    else if (this.state === 'playing') { await this.system?.pause(); }
    else { await this.system?.play(); }
  }

  private saveOffline(completed: boolean = false): void {
    if (!this.route.offline || !this.alive) { return; }
    try { AppService.recordOfflinePosition(this.route.item, this.playbackPosition, completed); this.lastOfflineSave = Date.now(); }
    catch (e) { this.reportMessage = text('progress_not_saved'); }
  }
  onBackPress(): boolean { return this.controlsLocked; }
  aboutToDisappear(): void { this.cancelGesture(); this.saveOffline(); this.alive = false; ++this.loadRevision; if (this.system) { this.system.dispose(); } else { this.controller?.close(); } }
  onPageHide(): void { this.cancelGesture(); this.saveOffline(); this.visible = false; if (this.system) { this.system.background(); } else { this.controller?.pause(); } }
  onPageShow(): void { this.visible = true; if (this.system) { this.system.foreground(); } else { this.controller?.show(); } }

  private async completed(): Promise<void> {
    if (this.finished || !this.alive) { return; }
    this.cancelGesture(); this.finished = true; this.saveOffline(true);
    if (this.route.offline) { try { await AppService.edit(this.route.item, false, true, true); } catch (e) { this.reportMessage = text('progress_not_saved'); } }
    if (this.autoNextReady && this.autoNext && (this.visible || this.system?.canContinue) && this.route.item.Type === 'Episode') { await this.next(true); }
    else { await this.system?.queueEnded(); }
  }

  private async next(automatic: boolean = false): Promise<void> {
    if (this.busy || !this.alive) { return; }
    this.cancelGesture(); this.busy = true; this.message = ''; const transition = ++this.loadRevision;
    try {
      const route = await AppService.nextPlayback(this.route);
      if (!this.alive || transition !== this.loadRevision || !this.system?.canAutoAdvance || (!this.visible && !this.system?.canContinue) || (automatic && (!this.autoNextReady || !this.autoNext))) {
        if (automatic) { await this.system?.queueEnded(); } return;
      }
      if (!route) { this.message = text('queue_finished'); await this.system?.queueEnded(); return; }
      this.route = route; this.finished = false; this.reportMessage = '';
      await this.controller?.open(route, this.surfaceId, 0);
    } catch (e) { if (this.alive && transition === this.loadRevision) { this.message = text('next_episode_failed'); await this.system?.queueEnded(); } }
    finally { if (this.alive && transition === this.loadRevision) { this.busy = false; } }
  }

  private async source(index: number): Promise<void> {
    const source = this.route.sources[index];
    if (!source || this.busy || source.Id === this.route.mediaSourceId) { return; }
    this.cancelGesture(); this.busy = true; this.message = ''; const transition = ++this.loadRevision;
    try {
      const route = await AppService.playback(this.route.item, source.Id);
      if (!this.alive || transition !== this.loadRevision || this.system?.isClosed) { return; }
      const position = this.playbackPosition; const paused = this.state !== 'playing';
      this.route = route; this.finished = false; this.reportMessage = '';
      await this.controller?.open(route, this.surfaceId, position, paused);
    } catch (e) { if (this.alive && transition === this.loadRevision) { this.message = text('source_switch_failed'); } }
    finally { if (this.alive && transition === this.loadRevision) { this.busy = false; } }
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
    return this.alive && this.visible && !this.locked && !this.controlsLocked && !this.busy && !this.settingsBusy && !this.pipActive &&
      ['prepared', 'playing', 'paused', 'completed'].includes(this.state);
  }
  private insideGesture(x: number, y: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) && x >= 24 && x <= this.surfaceWidth - 24 && y >= 24 && y <= this.surfaceHeight - 24;
  }
  private cancelGesture(): void {
    const previous = this.heldSpeed; this.heldSpeed = 0; this.seekAnchor = -1; this.seekPreview = -1; this.gestureHint = '';
    if (previous > 0) { this.speed = previous; this.controller?.setSpeed(previous); this.system?.sync(true); }
  }
  private changeSpeed(speed: number): void { this.cancelGesture(); this.speed = speed; this.controller?.setSpeed(speed); this.system?.sync(true); }
  private doubleTap(x: number, y: number): void {
    if (!this.canGesture() || !this.insideGesture(x, y)) { return; }
    this.cancelGesture();
    if (x >= this.surfaceWidth * 0.4 && x <= this.surfaceWidth * 0.6) { this.toggle(); return; }
    if (!Number.isFinite(this.duration) || this.duration <= 0) { return; }
    this.controller?.seek(Math.max(0, Math.min(this.duration, this.playbackPosition + (x < this.surfaceWidth * 0.4 ? -5000 : 15000))));
  }
  private beginSeek(x: number, y: number): void {
    if (!this.canGesture() || !this.insideGesture(x, y) || !Number.isFinite(this.duration) || this.duration <= 0) { return; }
    this.cancelGesture(); this.seekAnchor = this.playbackPosition; this.seekPreview = this.playbackPosition;
  }
  private previewSeek(offset: number): void {
    if (!this.canGesture()) { this.cancelGesture(); return; }
    if (this.seekAnchor < 0 || !Number.isFinite(offset)) { return; }
    this.seekPreview = Math.max(0, Math.min(this.duration, this.seekAnchor + offset * 90000 / Math.max(1, this.surfaceWidth)));
    this.gestureHint = text('gesture_seek_preview', this.clock(this.seekPreview));
  }
  private endSeek(): void {
    const position = this.seekPreview; const allowed = this.canGesture(); this.cancelGesture();
    if (allowed && position >= 0) { this.controller?.seek(position); }
  }
  private holdSpeed(x: number, y: number): void {
    if (!this.canGesture() || !this.insideGesture(x, y) || this.state !== 'playing' || this.heldSpeed > 0) { return; }
    this.cancelGesture(); this.heldSpeed = this.speed; this.speed = 2; this.controller?.setSpeed(2); this.gestureHint = text('gesture_speed_hold'); this.system?.sync(true);
  }
  private pinch(scale: number): void {
    if (!this.canGesture() || !Number.isFinite(scale) || scale <= 0) { return; }
    this.cancelGesture(); if (Math.abs(scale - 1) > 0.1) { this.zoomed = scale > 1; }
  }

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
        Column({ space: 8 }) {
          Row({ space: 12 }) {
            Button({ type: ButtonType.Normal }) {
              Image($r('app.media.menu_back')).width(24).height(24).accessibilityLevel('no')
            }.width(44).height(44).padding(0).borderRadius(14).backgroundColor($r('app.color.brand_surface'))
              .enabled(!this.controlsLocked).accessibilityText($r('app.string.back')).onClick(() => router.back())
            Text(this.route.item.Name).fontColor('#F2F3FA').fontSize(18).fontWeight(FontWeight.Medium)
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
            Button({ type: ButtonType.Normal }) {
              Image(this.controlsLocked ? $r('app.media.menu_unlock') : $r('app.media.menu_lock'))
                .width(24).height(24).accessibilityLevel('no')
            }.width(44).height(44).padding(0).borderRadius(14)
              .backgroundColor(this.controlsLocked ? $r('app.color.brand_action') : $r('app.color.brand_surface'))
              .accessibilityText(this.controlsLocked ? $r('app.string.controls_unlock') : $r('app.string.controls_lock'))
              .onClick(() => { this.cancelGesture(); this.controlsLocked = !this.controlsLocked; if (this.controlsLocked) { this.options = false; } })
          }.padding(12).width('100%')
          Flex({ direction: this.viewportWidth > this.viewportHeight ? FlexDirection.Row : FlexDirection.Column,
            alignItems: ItemAlign.Stretch }) {
          Stack({ alignContent: Alignment.Center }) {
            XComponent({ id: 'playbackSurface', type: XComponentType.SURFACE, controller: this.surface })
              .width(UiLayout.videoFrame(this.surfaceWidth, this.surfaceHeight, this.videoAspect, this.zoomed).width)
              .height(UiLayout.videoFrame(this.surfaceWidth, this.surfaceHeight, this.videoAspect, this.zoomed).height)
              .onLoad(() => { this.surfaceId = this.surface.getXComponentSurfaceId(); this.controller?.open(this.route, this.surfaceId); })
            if (this.subtitle) {
              Column() {
                Text(this.subtitle).fontSize(20).fontColor('#FFFFFF').textAlign(TextAlign.Center)
                  .backgroundColor('#99000000').padding(8).width('94%')
              }.width('100%').height('100%').justifyContent(FlexAlign.End).alignItems(HorizontalAlign.Center)
                .padding({ bottom: 16 }).hitTestBehavior(HitTestMode.None)
            }
            if (this.gestureHint) { Text(this.gestureHint).fontSize(16).fontColor('#FFFFFF').backgroundColor('#BB0D1924').padding(12).borderRadius(12).hitTestBehavior(HitTestMode.None) }
          }.layoutWeight(1).backgroundColor('#000000')
            .clip(true)
            .gesture(GestureGroup(GestureMode.Exclusive,
              PinchGesture({ fingers: 2 }).onActionStart(() => this.cancelGesture()).onActionUpdate((event: GestureEvent) => this.pinch(event.scale)),
              LongPressGesture({ fingers: 1, duration: 500 }).onAction((event: GestureEvent) => { const finger = event.fingerList[0]; if (finger) { this.holdSpeed(finger.localX, finger.localY); } })
                .onActionEnd(() => this.cancelGesture()).onActionCancel(() => this.cancelGesture()),
              PanGesture({ fingers: 1, direction: PanDirection.Horizontal, distance: 12 })
                .onActionStart((event: GestureEvent) => { const finger = event.fingerList[0]; if (finger) { this.beginSeek(finger.localX - event.offsetX, finger.localY); this.previewSeek(event.offsetX); } })
                .onActionUpdate((event: GestureEvent) => this.previewSeek(event.offsetX)).onActionEnd(() => this.endSeek()).onActionCancel(() => this.cancelGesture()),
              TapGesture({ count: 2, fingers: 1 }).onAction((event: GestureEvent) => { const finger = event.fingerList[0]; if (finger) { this.doubleTap(finger.localX, finger.localY); } })
            ))
            .margin({ right: this.viewportWidth > this.viewportHeight ? 12 : 0, bottom: this.viewportWidth > this.viewportHeight ? 0 : 8 })
            .onAreaChange((_old: Area, area: Area) => { this.surfaceWidth = Number.parseFloat(String(area.width)); this.surfaceHeight = Number.parseFloat(String(area.height)); })
          Scroll() {
            Column({ space: 12 }) {
              if (!this.controlsLocked) {
                Column({ space: 12 }) {
                  Row({ space: 8 }) {
                    Text(this.clock(this.playbackPosition)).fontColor($r('app.color.brand_muted')).fontSize(12).flexShrink(0)
                    Slider({ value: this.playbackPosition, min: 0, max: Math.max(1, this.duration), step: 1000 })
                      .layoutWeight(1).selectedColor($r('app.color.brand_accent')).trackColor($r('app.color.brand_surface'))
                      .blockColor($r('app.color.brand_accent')).enabled(!this.busy && this.duration > 0)
                      .accessibilityText($r('app.string.player_seek'))
                      .onChange((value: number, mode: SliderChangeMode) => {
                        if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) { this.controller?.seek(value); }
                      })
                    Text(this.clock(this.duration)).fontColor($r('app.color.brand_muted')).fontSize(12).flexShrink(0)
                  }.width('100%')
                  Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
                    Column() {
                      BrandButton({ label: this.state === 'playing' ? $r('app.string.pause') : $r('app.string.play'),
                        icon: this.state === 'playing' ? $r('app.media.player_pause') : $r('app.media.detail_play'), primary: true,
                        available: !this.busy && ['prepared', 'playing', 'paused', 'completed', 'released'].includes(this.state),
                        onSelect: () => { this.toggle(); } })
                    }.width(this.controlWidth >= 360 && this.fontScale < 1.5 ? '48%' : '100%').margin({ bottom: 8 })
                    Column() {
                      BrandButton({ label: $r('app.string.playback_options'), icon: $r('app.media.menu_settings'), primary: this.options,
                        onSelect: () => { this.options = !this.options; } })
                    }.width(this.controlWidth >= 360 && this.fontScale < 1.5 ? '48%' : '100%').margin({ bottom: 8 })
                  }.width('100%')
                }.width('100%').padding(12).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised'))
                if (this.options) {
                  this.systemOptions()
                  this.mediaOptions()
                  this.languageOptions()
                  this.queueOptions()
                }
              } else {
                Text($r('app.string.player_locked_hint')).fontSize(14).fontColor($r('app.color.brand_muted')).width('100%')
              }
              if (this.busy) { BrandState({ label: $r('app.string.playback_loading'), loading: true }) }
              if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(12).width('100%') }
              if (this.reportMessage) { Text(this.reportMessage).fontColor($r('app.color.brand_danger')).fontSize(12).width('100%') }
              Text(this.route.offline ? $r('app.string.offline_playback') : $r('app.string.direct_play_hint'))
                .fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
            }.padding({ left: 12, right: 12, bottom: 12 }).width('100%').alignItems(HorizontalAlign.Start)
          }.width(this.viewportWidth > this.viewportHeight ? Math.min(320, this.viewportWidth * 0.45) : '100%')
            .height(this.viewportWidth > this.viewportHeight ? '100%' : UiLayout.playerControls(this.viewportHeight, this.fontScale, this.options && !this.controlsLocked))
            .align(Alignment.TopStart).onAreaChange((_old: Area, area: Area) => { this.controlWidth = Number.parseFloat(String(area.width)); })
          }.width('100%').layoutWeight(1)
        }.width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => {
      this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height));
    })
  }

  @Builder
  systemOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_system_group'), icon: $r('app.media.player_background') })
      BrandButton({ label: this.pipActive ? $r('app.string.pip_exit') : $r('app.string.pip_enter'),
        icon: this.pipActive ? $r('app.media.player_pip_exit') : $r('app.media.player_pip'), primary: this.pipActive,
        available: this.systemReady && this.pipSupported && !this.busy && ['prepared', 'playing', 'paused'].includes(this.state),
        onSelect: () => { if (this.pipActive) { this.system?.stopPiP(); } else { this.system?.startPiP(); } } })
      if (!this.pipSupported) { Text($r('app.string.pip_unavailable')).fontColor($r('app.color.brand_muted')).fontSize(12) }
      Row({ space: 12 }) {
        Text($r('app.string.background_playback')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.backgroundEnabled }).enabled(this.systemReady)
          .selectedColor($r('app.color.brand_action')).switchPointColor($r('app.color.brand_accent'))
          .accessibilityText($r('app.string.background_playback')).onChange((value: boolean) => { this.system?.setBackground(value); })
      }.width('100%')
      Text($r('app.string.background_playback_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
    }.padding(16).width('100%').borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
  }

  @Builder
  mediaOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_media_group'), icon: $r('app.media.nav_library_active') })
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
      Text($r('app.string.subtitle_format_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
    }.padding(16).width('100%').borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
  }

  @Builder
  languageOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.playback_language_preferences'), icon: $r('app.media.menu_settings') })
      Text($r('app.string.preferred_audio_language')).fontColor($r('app.color.brand_muted')).fontSize(14)
      TextInput({ text: this.audioLanguage, placeholder: text('playback_language_placeholder') })
        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(63).fontSize(14).fontColor('#F2F3FA')
        .placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface'))
        .enabled(!this.settingsBusy && !this.busy).onChange((value: string) => { this.audioLanguage = value; })
      Text($r('app.string.preferred_subtitle_language')).fontColor($r('app.color.brand_muted')).fontSize(14)
      TextInput({ text: this.subtitleLanguage, placeholder: text('playback_language_placeholder') })
        .height(UiLayout.buttonHeight(this.fontScale)).maxLength(63).fontSize(14).fontColor('#F2F3FA')
        .placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface'))
        .enabled(!this.settingsBusy && !this.busy && !this.subtitlesOff).onChange((value: string) => { this.subtitleLanguage = value; })
      Row({ space: 12 }) {
        Text($r('app.string.preferred_subtitles_off')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.subtitlesOff }).enabled(!this.settingsBusy && !this.busy)
          .selectedColor($r('app.color.brand_action')).switchPointColor($r('app.color.brand_accent'))
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
      Text($r('app.string.playback_preferences_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
      if (this.settingsBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.settingsMessage) { Text(this.settingsMessage).fontColor($r('app.color.brand_warm')).fontSize(12).width('100%') }
    }.padding(16).width('100%').borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
  }

  @Builder
  queueOptions() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_queue_group'), icon: $r('app.media.player_speed') })
      Text($r('app.string.gesture_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
        ForEach([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], (speed: number) => {
          Column() {
            Button(`${speed}×`).labelStyle({ maxLines: 1, overflow: TextOverflow.Ellipsis }).fontSize(14).fontColor('#F2F3FA')
              .width('100%').constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale) }).borderRadius(14)
              .backgroundColor(this.speed === speed ? $r('app.color.brand_action') : $r('app.color.brand_surface'))
              .accessibilityText(`${speed}×`).onClick(() => this.changeSpeed(speed))
          }.width(this.controlWidth >= 360 && this.fontScale < 1.5 ? '31%' : '48%').margin({ bottom: 8 })
        })
      }.width('100%')
      if (this.route.item.Type === 'Episode') {
        Row({ space: 12 }) {
          Text($r('app.string.auto_next')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
          Toggle({ type: ToggleType.Switch, isOn: this.autoNext }).selectedColor($r('app.color.brand_action'))
            .switchPointColor($r('app.color.brand_accent')).accessibilityText($r('app.string.auto_next'))
            .enabled(this.autoNextReady).onChange((value: boolean) => { this.changeAutoNext(value ? 'on' : 'off'); })
        }.width('100%')
        Text(this.autoNextMode === 'server' ? $r('app.string.auto_next_server') : $r('app.string.auto_next_local')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
        BrandButton({ label: $r('app.string.auto_next_follow'), icon: $r('app.media.menu_sync'), available: !this.busy,
          onSelect: () => this.changeAutoNext('server') })
        BrandButton({ label: $r('app.string.next_episode'), icon: $r('app.media.player_next'),
          available: !this.busy && this.state !== 'released', onSelect: () => { this.system?.next(); } })
      }
    }.padding(16).width('100%').borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
  }
}
