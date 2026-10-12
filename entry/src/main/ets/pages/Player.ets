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
  @State autoNext: boolean = true;
  @State busy: boolean = false;
  @State systemReady: boolean = false;
  @State backgroundEnabled: boolean = false;
  @State pipSupported: boolean = false;
  @State pipActive: boolean = false;
  @State controlsLocked: boolean = false;
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
    this.showPreferences(AppService.playbackPreferences.snapshot());
    this.settingsMessage = AppService.playbackPreferences.issue ? text(AppService.playbackPreferences.issue) : '';
    this.controller = new PlaybackController(AppService.client, {
      state: (state: string) => { if (this.alive) { this.state = state; this.system?.sync(true); } },
      time: (position: number, duration: number) => { if (this.alive) { this.playbackPosition = position; this.duration = duration; this.speed = this.controller?.snapshot().speed ?? 1; this.system?.sync(); if (this.route.offline && Date.now() - this.lastOfflineSave > 10000) { this.saveOffline(); } } },
      tracks: (audio: TrackChoice[], subtitles: TrackChoice[], audioKey: string, subtitleKey: string) => {
        if (this.alive) { this.audio = audio; this.subtitles = subtitles; this.audioKey = audioKey; this.subtitleKey = subtitleKey; }
      },
      subtitle: (value: string) => { if (this.alive) { this.subtitle = value; this.system?.updateSubtitle(value); } },
      error: (message: string) => { if (this.alive) { this.message = message; } },
      reportError: (failed: boolean) => { if (this.alive) { this.reportMessage = failed ? text('progress_not_saved') : ''; } },
      complete: () => { this.completed(); },
      beforePlay: async () => { if (!AppLock.permit()) { return false; } return this.system ? this.system.permitPlay() : this.visible; },
      interrupted: () => { this.system?.pause(); }
    }, () => AppService.playbackPreferences.snapshot());
    this.connectSystem();
  }

  private showPreferences(value: PlaybackPreferences): void {
    this.audioLanguage = value.audioLanguage; this.subtitleLanguage = value.subtitleLanguage; this.subtitlesOff = value.subtitlesOff;
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
  aboutToDisappear(): void { this.saveOffline(); this.alive = false; ++this.loadRevision; if (this.system) { this.system.dispose(); } else { this.controller?.close(); } }
  onPageHide(): void { this.saveOffline(); this.visible = false; if (this.system) { this.system.background(); } else { this.controller?.pause(); } }
  onPageShow(): void { this.visible = true; if (this.system) { this.system.foreground(); } else { this.controller?.show(); } }

  private async completed(): Promise<void> {
    if (this.finished || !this.alive) { return; }
    this.finished = true; this.saveOffline(true);
    if (this.route.offline) { try { await AppService.edit(this.route.item, false, true, true); } catch (e) { this.reportMessage = text('progress_not_saved'); } }
    if (this.autoNext && (this.visible || this.system?.canContinue) && this.route.item.Type === 'Episode') { await this.next(true); }
    else { await this.system?.queueEnded(); }
  }

  private async next(automatic: boolean = false): Promise<void> {
    if (this.busy || !this.alive) { return; }
    this.busy = true; this.message = ''; const transition = ++this.loadRevision;
    try {
      const route = await AppService.nextPlayback(this.route);
      if (!this.alive || transition !== this.loadRevision || !this.system?.canAutoAdvance || (!this.visible && !this.system?.canContinue) || (automatic && !this.autoNext)) {
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
    this.busy = true; this.message = ''; const transition = ++this.loadRevision;
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

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column({ space: 10 }) {
      Row() {
        Button($r('app.string.back')).enabled(!this.controlsLocked).backgroundColor($r('app.color.brand_surface')).onClick(() => router.back())
        Text(this.route.item.Name).fontColor('#F2F3FA').fontSize(18).maxLines(2).layoutWeight(1).margin({ left: 12 })
      }.padding(12).width('100%')
      Stack({ alignContent: Alignment.Bottom }) {
        XComponent({ id: 'playbackSurface', type: XComponentType.SURFACE, controller: this.surface })
          .width('100%').height('100%')
          .onLoad(() => { this.surfaceId = this.surface.getXComponentSurfaceId(); this.controller?.open(this.route, this.surfaceId); })
        if (this.subtitle) {
          Text(this.subtitle).fontSize(20).fontColor('#FFFFFF').textAlign(TextAlign.Center)
            .backgroundColor('#99000000').padding(8).margin({ bottom: 16 }).width('94%')
        }
      }.width('100%').layoutWeight(1)
      if (!this.controlsLocked) {
      Row({ space: 8 }) {
        Text(this.clock(this.playbackPosition)).fontColor('#FFFFFF').fontSize(12)
        Slider({ value: this.playbackPosition, min: 0, max: Math.max(1, this.duration), step: 1000 }).layoutWeight(1)
          .enabled(!this.busy && this.duration > 0)
          .onChange((value: number, mode: SliderChangeMode) => { if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) { this.controller?.seek(value); } })
        Text(this.clock(this.duration)).fontColor('#FFFFFF').fontSize(12)
      }.padding({ left: 12, right: 12 })
      Row({ space: 8 }) {
        Button(this.state === 'playing' ? $r('app.string.pause') : $r('app.string.play')).enabled(!this.busy && ['prepared', 'playing', 'paused', 'completed', 'released'].includes(this.state))
          .onClick(() => { this.toggle(); })
        Button($r('app.string.playback_options')).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.options = !this.options; })
        if (this.route.item.Type === 'Episode') { Button($r('app.string.next_episode')).enabled(!this.busy && this.state !== 'released').onClick(() => { this.system?.next(); }) }
      }
        Button($r('app.string.controls_lock')).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.controlsLocked = true; this.options = false; })
      } else {
        Button($r('app.string.controls_unlock')).backgroundColor($r('app.color.brand_action')).onClick(() => { this.controlsLocked = false; })
      }
      if (this.options && !this.controlsLocked) {
        Scroll() {
          Column({ space: 10 }) {
            Button(this.pipActive ? $r('app.string.pip_exit') : $r('app.string.pip_enter'))
              .enabled(this.systemReady && this.pipSupported && !this.busy && ['prepared', 'playing', 'paused'].includes(this.state))
              .onClick(() => { if (this.pipActive) { this.system?.stopPiP(); } else { this.system?.startPiP(); } })
            if (!this.pipSupported) { Text($r('app.string.pip_unavailable')).fontColor($r('app.color.brand_muted')).fontSize(12) }
            Row({ space: 12 }) {
              Text($r('app.string.background_playback')).fontColor('#FFFFFF')
              Toggle({ type: ToggleType.Switch, isOn: this.backgroundEnabled }).enabled(this.systemReady)
                .onChange((value: boolean) => { this.system?.setBackground(value); })
            }
            Text($r('app.string.background_playback_hint')).fontColor($r('app.color.brand_muted')).fontSize(12)
            if (!this.route.offline && this.route.sources.length > 0) {
              Text($r('app.string.media_source')).fontColor($r('app.color.brand_muted'))
              Select(this.route.sources.map((source: MediaSource, index: number)  : SelectOption => ({ value: source.Name || `${source.Container || text('media_source')} ${index + 1}` })))
                .selected(this.route.sources.findIndex((source: MediaSource) => source.Id === this.route.mediaSourceId)).enabled(!this.busy)
                .onSelect((index: number) => { this.source(index); })
            }
            Text($r('app.string.audio_track')).fontColor($r('app.color.brand_muted'))
            if (this.audio.length) {
              Select(this.audio.map((track: TrackChoice)  : SelectOption => ({ value: track.label })))
                .selected(this.audio.findIndex((track: TrackChoice) => track.key === this.audioKey)).enabled(!this.busy)
                .onSelect((index: number) => { this.track(this.audio[index].key, true); })
            } else { Text($r('app.string.no_audio_tracks')).fontColor($r('app.color.brand_muted')).fontSize(12) }
            Text($r('app.string.subtitle_track')).fontColor($r('app.color.brand_muted'))
            Select([{ value: text('subtitles_off') }, ...this.subtitles.map((track: TrackChoice)  : SelectOption => ({ value: track.label }))])
              .selected(this.subtitles.findIndex((track: TrackChoice) => track.key === this.subtitleKey) + 1).enabled(!this.busy)
              .onSelect((index: number) => { this.track(index === 0 ? '' : this.subtitles[index - 1].key, false); })
            Text($r('app.string.subtitle_format_hint')).fontColor($r('app.color.brand_muted')).fontSize(12)
            Text($r('app.string.playback_language_preferences')).fontColor('#FFFFFF')
            Text($r('app.string.preferred_audio_language')).fontColor($r('app.color.brand_muted'))
            TextInput({ text: this.audioLanguage, placeholder: text('playback_language_placeholder') }).maxLength(63)
              .enabled(!this.settingsBusy).onChange((value: string) => { this.audioLanguage = value; })
            Text($r('app.string.preferred_subtitle_language')).fontColor($r('app.color.brand_muted'))
            TextInput({ text: this.subtitleLanguage, placeholder: text('playback_language_placeholder') }).maxLength(63)
              .enabled(!this.settingsBusy && !this.subtitlesOff).onChange((value: string) => { this.subtitleLanguage = value; })
            Row({ space: 12 }) {
              Text($r('app.string.preferred_subtitles_off')).fontColor('#FFFFFF')
              Toggle({ type: ToggleType.Switch, isOn: this.subtitlesOff }).enabled(!this.settingsBusy)
                .onChange((value: boolean) => { this.subtitlesOff = value; })
            }
            Row({ space: 8 }) {
              Button($r('app.string.save_playback_preferences')).enabled(!this.settingsBusy && !this.busy).onClick(() => { this.savePreferences(); })
              Button($r('app.string.reset_playback_preferences')).enabled(!this.settingsBusy && !this.busy).onClick(() => { this.savePreferences(true); })
            }
            Text($r('app.string.playback_preferences_hint')).fontColor($r('app.color.brand_muted')).fontSize(12)
            if (this.settingsMessage) { Text(this.settingsMessage).fontColor('#FFCF8F').fontSize(12) }
            Row({ space: 8 }) {
              ForEach([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], (speed: number) => {
                Button(`${speed}×`).backgroundColor(this.speed === speed ? $r('app.color.brand_action') : $r('app.color.brand_surface'))
                  .onClick(() => { this.speed = speed; this.controller?.setSpeed(speed); this.system?.sync(true); })
              })
            }
            if (this.route.item.Type === 'Episode') {
              Row({ space: 12 }) {
                Text($r('app.string.auto_next')).fontColor('#FFFFFF')
                Toggle({ type: ToggleType.Switch, isOn: this.autoNext }).onChange((value: boolean) => { this.autoNext = value; })
              }
            }
          }.padding(12).width('100%')
        }.height(250).width('100%')
      }
      if (this.busy) { Text($r('app.string.playback_loading')).fontColor($r('app.color.brand_muted')) }
      if (this.message) { Text(this.message).fontColor('#FF9F9F').fontSize(12).padding(8) }
      if (this.reportMessage) { Text(this.reportMessage).fontColor('#FF9F9F').fontSize(12) }
      Text(this.route.offline ? $r('app.string.offline_playback') : $r('app.string.direct_play_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).padding(8)
    }.width('100%').height('100%').backgroundColor('#000000')
      }
    }.width('100%').height('100%')
  }
}
