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
import { errorText, text } from '../utils/Strings';
import { deviceNameValue } from '../utils/DeviceOptions';
import { PlayerOptions, playerOptions, validPlayerOptions } from '../utils/PlayerOptions';
import { NetworkOptions, NetworkPolicy, validNetworkOptions } from '../utils/NetworkOptions';
import { NetworkPreferences } from '../service/NetworkPreferences';
@Entry
@Component
struct Settings {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') @Watch('deviceLockChanged') locked: boolean = true;
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
  @State deviceDraft: string = '';
  @State deviceSaved: string = '';
  @State deviceLoaded: boolean = false;
  @State deviceBusy: boolean = false;
  @State deviceMessage: string = '';
  @State requestSeconds: string = '30';
  @State connectSeconds: string = '6';
  @State readSeconds: string = '10';
  @State autoCache: boolean = true;
  @State networkBusy: boolean = false;
  @State networkMessage: string = '';
  private networkRevision: number = 0;
  private deviceRevision: number = 0;
  private deviceVisible: boolean = false;
  private owner: string = '';
  private ownerClient: JellyfinClient | undefined;
  aboutToAppear(): void { this.ownerClient = AppService.client; const state = AppService.experience?.snapshot(); this.downloadMobile = state?.downloadMobile ?? false; this.downloadRoaming = this.downloadMobile && (state?.downloadRoaming ?? false); this.offline = state?.offline ?? false; this.remember = state?.rememberDownloadSource ?? true; this.preference = state?.sourcePreference ?? ''; this.protected = AppLock.enabled; this.owner = AppService.client?.session.userId ?? ''; }
  onPageShow(): void {
    if (this.ownerClient !== AppService.client) { this.onPageHide(); router.back(); return; }
    this.deviceVisible = true;
    this.loadNetworkDraft();
    this.playerUi = playerOptions(AppService.experience?.snapshot().playerUi);
    this.seekBack = (this.playerUi.back / 1000).toString(); this.seekForward = (this.playerUi.forward / 1000).toString();
    this.loadDeviceName();
  }
  onPageHide(): void { this.deviceVisible = false; ++this.networkRevision; this.invalidateDevice(); }
  aboutToDisappear(): void { this.onPageHide(); }
  private invalidateDevice(): void { ++this.deviceRevision; this.deviceLoaded = false; this.deviceBusy = false; }
  private deviceLockChanged(): void { if (this.locked) { ++this.networkRevision; this.invalidateDevice(); } }
  private loadNetworkDraft(): void {
    const value = NetworkPolicy.snapshot(); this.requestSeconds = (value.requestMs / 1000).toString();
    this.connectSeconds = (value.connectMs / 1000).toString(); this.readSeconds = (value.readMs / 1000).toString(); this.autoCache = value.autoCache;
    this.networkMessage = NetworkPreferences.issue ? text(NetworkPreferences.issue) : '';
  }
  private async saveApiNetwork(reset: boolean = false): Promise<void> {
    if (this.networkBusy || !this.deviceVisible || this.locked || !AppLock.permit() || this.ownerClient !== AppService.client) { return; }
    const next: NetworkOptions = reset ? new NetworkOptions() : { requestMs: Number(this.requestSeconds) * 1000,
      connectMs: Number(this.connectSeconds) * 1000, readMs: Number(this.readSeconds) * 1000, autoCache: this.autoCache };
    if ((!reset && ![this.requestSeconds, this.connectSeconds, this.readSeconds].every((v: string) => /^[0-9]{1,3}$/.test(v))) || !validNetworkOptions(next)) {
      this.networkMessage = text('network_options_invalid'); return;
    }
    const revision = this.networkRevision; const client = this.ownerClient;
    const allowed = (): boolean => this.deviceVisible && !this.locked && AppLock.permit() && revision === this.networkRevision && client === this.ownerClient && client === AppService.client;
    this.networkBusy = true; this.networkMessage = '';
    try { await NetworkPreferences.save(next, allowed); if (allowed()) { this.loadNetworkDraft(); this.networkMessage = text('network_options_saved'); } }
    catch (e) { if (allowed()) { this.networkMessage = errorText(e as Error); } }
    finally { this.networkBusy = false; }
  }
  private deviceCurrent(client: JellyfinClient, revision: number, id: string): boolean {
    return this.deviceVisible && revision === this.deviceRevision && client === this.ownerClient && client === AppService.client && client.session.deviceId === id;
  }
  private devicePermit(client: JellyfinClient, revision: number, id: string): boolean {
    return this.deviceCurrent(client, revision, id) && !this.locked && AppLock.permit() && !this.offline && !(AppService.experience?.snapshot().offline ?? false);
  }
  private async loadDeviceName(): Promise<void> {
    const client = this.ownerClient;
    if (!client || this.deviceBusy || !this.devicePermit(client, this.deviceRevision, client.session.deviceId)) { return; }
    const id = client.session.deviceId; const revision = ++this.deviceRevision;
    this.deviceBusy = true; this.deviceLoaded = false; this.deviceMessage = '';
    try {
      const name = await client.deviceName(() => this.devicePermit(client, revision, id));
      if (!this.devicePermit(client, revision, id)) { return; }
      this.deviceSaved = name; this.deviceDraft = name; this.deviceLoaded = true;
    } catch (e) { if (this.deviceCurrent(client, revision, id)) { this.deviceMessage = errorText(e as Error); } }
    finally { if (this.deviceCurrent(client, revision, id)) { this.deviceBusy = false; } }
  }
  private async saveDeviceName(): Promise<void> {
    const client = this.ownerClient;
    if (!client || this.deviceBusy || !this.deviceLoaded || !this.devicePermit(client, this.deviceRevision, client.session.deviceId)) { return; }
    let name: string;
    try { name = deviceNameValue(this.deviceDraft); }
    catch (e) { this.deviceMessage = errorText(e as Error); return; }
    const id = client.session.deviceId; const revision = ++this.deviceRevision;
    this.deviceBusy = true; this.deviceLoaded = false; this.deviceMessage = '';
    try {
      await client.updateDeviceName(name, () => this.devicePermit(client, revision, id));
      if (!this.devicePermit(client, revision, id)) { return; }
      const confirmed = await client.deviceName(() => this.devicePermit(client, revision, id));
      if (!this.devicePermit(client, revision, id)) { return; }
      if (confirmed !== name) { throw new Error('device_name_not_confirmed'); }
      this.deviceSaved = confirmed; this.deviceDraft = confirmed; this.deviceLoaded = true; this.deviceMessage = text('device_name_saved');
    } catch (e) {
      if (this.deviceCurrent(client, revision, id)) { this.deviceMessage = text('device_name_save_failed') + ' · ' + errorText(e as Error); }
    } finally { if (this.deviceCurrent(client, revision, id)) { this.deviceBusy = false; } }
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
  private networkField(label: Resource, key: number) {
    this.fieldCaption(label)
    TextInput({ text: key === 0 ? this.requestSeconds : key === 1 ? this.connectSeconds : this.readSeconds }).type(InputType.Number).maxLength(3).accessibilityText(label)
      .height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).borderRadius(12).enabled(!this.networkBusy && !this.locked)
      .onChange((v: string) => { if (key === 0) { this.requestSeconds = v; } else if (key === 1) { this.connectSeconds = v; } else { this.readSeconds = v; } })
  }
  @Builder
  private apiNetworkSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.api_network_group'), icon: $r('app.media.menu_server') })
      Text($r('app.string.api_network_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
      this.networkField($r('app.string.network_request_seconds'), 0)
      this.networkField($r('app.string.network_connect_seconds'), 1)
      this.networkField($r('app.string.network_read_seconds'), 2)
      Row({ space: 12 }) {
        Text($r('app.string.network_auto_cache')).fontSize(14).fontColor('#F2F3FA').layoutWeight(1)
        Checkbox().select(this.autoCache).enabled(!this.networkBusy && !this.locked).selectedColor($r('app.color.brand_action'))
          .accessibilityText($r('app.string.network_auto_cache')).onChange((v: boolean) => { this.autoCache = v; })
      }.width('100%')
      Text($r('app.string.network_cache_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
      BrandButton({ label: $r('app.string.network_options_save'), icon: $r('app.media.menu_save'), primary: true, available: !this.networkBusy && !this.locked, onSelect: () => this.saveApiNetwork() })
      BrandButton({ label: $r('app.string.network_options_reset'), icon: $r('app.media.menu_reset'), available: !this.networkBusy && !this.locked, onSelect: () => this.saveApiNetwork(true) })
      if (this.networkBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.networkMessage) { Text(this.networkMessage).fontSize(12).fontColor($r('app.color.brand_warm')).width('100%') }
    }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
  }
  @Builder
  private deviceSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.device_name_group'), icon: $r('app.media.menu_accounts') })
      Text($r('app.string.device_name_hint')).fontSize(12).fontColor($r('app.color.brand_muted')).width('100%')
      if (this.deviceLoaded) { Text($r('app.string.device_name_current', this.deviceSaved || text('device_name_default'))).fontSize(14).fontColor('#F2F3FA').width('100%') }
      else { Text($r('app.string.device_name_unknown')).fontSize(12).fontColor($r('app.color.brand_warm')).width('100%') }
      this.fieldCaption($r('app.string.device_name_label'))
      TextInput({ text: this.deviceDraft, placeholder: $r('app.string.device_name_default') }).type(InputType.Normal).maxLength(64)
        .height(UiLayout.buttonHeight(this.fontScale)).fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).backgroundColor($r('app.color.brand_surface')).borderRadius(12)
        .enabled(this.deviceLoaded && !this.deviceBusy && !this.offline).accessibilityText($r('app.string.device_name_label'))
        .onChange((value: string) => { if (this.deviceLoaded && !this.deviceBusy && !this.offline && !this.locked && AppLock.permit()) { this.deviceDraft = value; this.deviceMessage = ''; } })
      BrandButton({ label: $r('app.string.device_name_refresh'), icon: $r('app.media.menu_sync'), available: !this.deviceBusy && !this.offline, onSelect: () => this.loadDeviceName() })
      BrandButton({ label: $r('app.string.device_name_save'), icon: $r('app.media.menu_save'), primary: true,
        available: this.deviceLoaded && !this.deviceBusy && !this.offline && this.deviceDraft !== this.deviceSaved, onSelect: () => this.saveDeviceName() })
      if (this.deviceBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.offline) { Text($r('app.string.device_name_online_required')).fontSize(12).fontColor($r('app.color.brand_warm')).width('100%') }
      if (this.deviceMessage) { Text(this.deviceMessage).fontSize(12).fontColor($r('app.color.brand_warm')).width('100%') }
    }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
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
                this.deviceSettings()
              this.apiNetworkSettings()
              this.playerSettings()
              Column({ space: 12 }) {
                BrandHeading({ label: $r('app.string.offline_group'), icon: $r('app.media.menu_offline') })
                Row({ space: 12 }) {
                  Text($r('app.string.offline_mode')).fontColor('#F2F3FA').fontSize(14).layoutWeight(1)
                  Checkbox().select(this.offline).selectedColor($r('app.color.brand_action')).flexShrink(0)
                      .accessibilityText($r('app.string.offline_mode')).onChange((value: boolean) => { this.offline = value; this.save(); if (value) { this.invalidateDevice(); } })
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
