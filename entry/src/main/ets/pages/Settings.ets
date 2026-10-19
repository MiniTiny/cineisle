import { BrandState } from '../components/BrandState';
import { UiLayout } from '../utils/UiLayout';
import { BrandButton } from '../components/BrandButton';
import { BrandHeading } from '../components/BrandHeading';
import { BrandHeader } from '../components/BrandHeader';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { AppService } from '../service/AppService';
import { AppLock } from '../service/AppLock';
import { ExperienceState } from '../utils/Experience';
import { JellyfinClient } from '../service/JellyfinClient';
import { errorText } from '../utils/Strings';
import { PlayerOptions, playerOptions, validPlayerOptions } from '../utils/PlayerOptions';
@Entry
@Component
struct Settings {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State offline: boolean = false;
  @State remember: boolean = true;
  @State preference: string = '';
  @State downloadMobile: boolean = false;
  @State downloadRoaming: boolean = false;
  @State playerUi: PlayerOptions = new PlayerOptions();
  @State seekBack: string = '5';
  @State seekForward: string = '15';
  @State currentPin: string = '';
  @State nextPin: string = '';
  @State confirmation: string = '';
  @State protected: boolean = false;
  @State message: string = '';
  @State busy: boolean = false;
  private owner: string = '';
  private ownerClient: JellyfinClient | undefined;
  aboutToAppear(): void { this.ownerClient = AppService.client; const state = AppService.experience?.snapshot(); this.downloadMobile = state?.downloadMobile ?? false; this.downloadRoaming = this.downloadMobile && (state?.downloadRoaming ?? false); this.offline = state?.offline ?? false; this.remember = state?.rememberDownloadSource ?? true; this.preference = state?.sourcePreference ?? ''; this.protected = AppLock.enabled; this.owner = AppService.client?.session.userId ?? ''; }
  onPageShow(): void {
    if (this.ownerClient !== AppService.client) { router.back(); return; }
    this.playerUi = playerOptions(AppService.experience?.snapshot().playerUi);
    this.seekBack = (this.playerUi.back / 1000).toString(); this.seekForward = (this.playerUi.forward / 1000).toString();
  }
  private savePlayer(key: string = '', enabled: boolean = false): void {
    if (this.ownerClient !== AppService.client || !AppService.experience) { return; }
    const next = playerOptions(AppService.experience.snapshot().playerUi);
    if (key === 'gestures') { next.gestures = enabled; }
    else if (key === 'seek') { next.seek = enabled; }
    else if (key === 'zoom') { next.zoom = enabled; }
    else if (key === 'maximized') { next.startMaximized = enabled; }
    else if (key === 'pip') { next.autoPiP = enabled; }
    else if (key === 'vertical') { next.vertical = enabled; }
    else if (key === 'brightness') { next.rememberBrightness = enabled; if (!enabled) { next.brightness = -1; } }
    else { next.back = Number(this.seekBack) * 1000; next.forward = Number(this.seekForward) * 1000; }
    if (!validPlayerOptions(next)) { this.message = getContext(this).resourceManager.getStringSync($r('app.string.player_steps_invalid').id); return; }
    try {
      AppService.experience.update((state: ExperienceState) => { state.playerUi = next; }); this.playerUi = next; this.message = '';
    } catch (e) { this.message = errorText(e as Error); }
  }
  private save(): void {
    try { AppService.experience?.update((state: ExperienceState) => { state.offline = this.offline; state.rememberDownloadSource = this.remember; state.sourcePreference = this.preference; }); }
    catch (e) { this.message = errorText(e as Error); }
  }
  private saveNetwork(mobile: boolean, roaming: boolean): void {
    if (this.ownerClient !== AppService.client || !AppService.experience) { return; }
    try {
      AppService.experience.update((state: ExperienceState) => { state.downloadMobile = mobile; state.downloadRoaming = mobile && roaming; });
      this.downloadMobile = mobile; this.downloadRoaming = mobile && roaming; this.message = '';
    } catch (e) { this.message = errorText(e as Error); }
  }
  private async changeLock(disable: boolean = false): Promise<void> {
    if (this.busy) { return; }
    if (!disable && this.nextPin !== this.confirmation) { this.message = getContext(this).resourceManager.getStringSync($r('app.string.lock_pin_mismatch').id); return; }
    this.busy = true;
    try { await AppLock.configure(this.currentPin, disable ? '' : this.nextPin); this.protected = AppLock.enabled; this.message = ''; }
    catch (e) { this.message = errorText(e as Error); }
    finally { this.currentPin = ''; this.nextPin = ''; this.confirmation = ''; this.busy = false; }
  }
  @Builder
  private fieldCaption(label: Resource) {
    Text(label).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
  }

  @Builder
  private playerSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.player_gesture_preferences'), icon: $r('app.media.player_speed') })
      Row({ space: 12 }) {
        Text($r('app.string.player_gestures_enabled')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.gestures).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.player_gestures_enabled')).onChange((value: boolean) => this.savePlayer('gestures', value))
      }.width('100%')
      Row({ space: 12 }) {
        Text($r('app.string.player_seek_gesture')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.seek).enabled(this.playerUi.gestures).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.player_seek_gesture')).onChange((value: boolean) => this.savePlayer('seek', value))
      }.width('100%')
      Row({ space: 12 }) {
        Text($r('app.string.player_zoom_gesture')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.zoom).enabled(this.playerUi.gestures).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.player_zoom_gesture')).onChange((value: boolean) => this.savePlayer('zoom', value))
      }.width('100%')
      Row({ space: 12 }) {
        Text($r('app.string.player_start_maximized')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.startMaximized).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.player_start_maximized')).onChange((value: boolean) => this.savePlayer('maximized', value))
      }.width('100%')
      Row({ space: 12 }) {
        Text($r('app.string.player_vertical_gesture')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.vertical ?? true).enabled(this.playerUi.gestures).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.player_vertical_gesture')).onChange((value: boolean) => this.savePlayer('vertical', value))
      }.width('100%')
      Row({ space: 12 }) {
        Text($r('app.string.player_remember_brightness')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.rememberBrightness ?? false).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.player_remember_brightness')).onChange((value: boolean) => this.savePlayer('brightness', value))
      }.width('100%')
      this.fieldCaption($r('app.string.player_back_seconds'))
      TextInput({ text: this.seekBack }).type(InputType.Number).maxLength(3).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA')
        .backgroundColor($r('app.color.brand_surface')).borderRadius(12).accessibilityText($r('app.string.player_back_seconds')).onChange((value: string) => { this.seekBack = value; })
      this.fieldCaption($r('app.string.player_forward_seconds'))
      TextInput({ text: this.seekForward }).type(InputType.Number).maxLength(3).height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA')
        .backgroundColor($r('app.color.brand_surface')).borderRadius(12).accessibilityText($r('app.string.player_forward_seconds')).onChange((value: string) => { this.seekForward = value; })
      BrandButton({ label: $r('app.string.player_save_steps'), icon: $r('app.media.menu_save'), onSelect: () => this.savePlayer() })
      Row({ space: 12 }) {
        Text($r('app.string.player_auto_pip')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.autoPiP).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.player_auto_pip')).onChange((value: boolean) => this.savePlayer('pip', value))
      }.width('100%')
      Text($r('app.string.player_ui_preferences_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
    }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
  }

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
        Column({ space: 14 }) {
          BrandHeader({ label: $r('app.string.settings'), onBack: () => router.back() })
          Scroll() {
            Column({ space: 18 }) {
              this.playerSettings()
              Column({ space: 12 }) {
                BrandHeading({ label: $r('app.string.offline_group'), icon: $r('app.media.menu_offline') })
                Row({ space: 12 }) {
                  Text($r('app.string.offline_mode')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
                  Checkbox().select(this.offline).selectedColor($r('app.color.brand_action')).flexShrink(0)
                    .accessibilityText($r('app.string.offline_mode')).onChange((value: boolean) => { this.offline = value; this.save(); })
                }.width('100%')
              }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
              Column({ space: 12 }) {
                BrandHeading({ label: $r('app.string.download_preferences'), icon: $r('app.media.detail_download') })
                Row({ space: 12 }) {
                  Text($r('app.string.download_mobile')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
                  Checkbox().select(this.downloadMobile).selectedColor($r('app.color.brand_action')).flexShrink(0)
                    .accessibilityText($r('app.string.download_mobile')).onChange((value: boolean) => this.saveNetwork(value, this.downloadRoaming))
                }.width('100%')
                Row({ space: 12 }) {
                  Text($r('app.string.download_roaming')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
                  Checkbox().select(this.downloadRoaming).enabled(this.downloadMobile).selectedColor($r('app.color.brand_action')).flexShrink(0)
                    .accessibilityText($r('app.string.download_roaming')).onChange((value: boolean) => this.saveNetwork(this.downloadMobile, value))
                }.width('100%')
                Text($r('app.string.download_network_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
                Row({ space: 12 }) {
                  Text($r('app.string.remember_source')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
                  Checkbox().select(this.remember).selectedColor($r('app.color.brand_action')).flexShrink(0)
                    .accessibilityText($r('app.string.remember_source')).onChange((value: boolean) => { this.remember = value; this.save(); })
                }.width('100%')
                Text(this.preference || $r('app.string.source_default')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
                BrandButton({ label: $r('app.string.clear_source_preference'), icon: $r('app.media.menu_reset'), onSelect: () => { this.preference = ''; this.save(); } })
                Text($r('app.string.download_location_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
              }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
              Column({ space: 12 }) {
                BrandHeading({ label: $r('app.string.app_lock'), icon: $r('app.media.menu_lock') })
                Text($r('app.string.lock_policy')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
                if (this.protected) {
                  this.fieldCaption($r('app.string.lock_current_pin'))
                  TextInput({ text: this.currentPin, placeholder: $r('app.string.lock_current_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(12).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.currentPin = v; })
                }
                this.fieldCaption($r('app.string.lock_new_pin'))
                TextInput({ text: this.nextPin, placeholder: $r('app.string.lock_new_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(12).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.nextPin = v; })
                this.fieldCaption($r('app.string.lock_confirm_pin'))
                TextInput({ text: this.confirmation, placeholder: $r('app.string.lock_confirm_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(12).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.confirmation = v; })
                BrandButton({ label: $r('app.string.lock_save'), icon: $r('app.media.menu_save'), primary: true, available: !this.busy && this.nextPin.length >= 6, onSelect: () => this.changeLock() })
                if (this.protected) {
                  BrandButton({ label: $r('app.string.lock_now'), icon: $r('app.media.menu_lock'), onSelect: () => AppLock.lock() })
                  BrandButton({ label: $r('app.string.lock_disable'), icon: $r('app.media.menu_unlock'), available: !this.busy, onSelect: () => this.changeLock(true) })
                }
                if (this.busy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
                if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(13).width('100%') }
              }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
            }.width('100%').padding({ bottom: 12 })
          }.layoutWeight(1).width('100%').align(Alignment.TopStart)
        }.padding(20).width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
