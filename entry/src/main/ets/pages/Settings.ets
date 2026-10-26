import { AppLockPolicy } from '../utils/LockPolicy';
import { AppRoutes } from '../utils/Navigation';
import { SettingsToggle } from '../components/SettingsToggle';
import { UiPalette } from '../utils/UiPalette';
import { AppearancePreferences } from '../service/AppearancePreferences';
import { AppearanceOptions } from '../utils/Appearance';
import { LanguagePreferences } from '../service/LanguagePreferences';
import { UiLanguage, UI_LANGUAGES, uiLanguageCaption } from '../utils/UiLanguage';
import common from '@ohos.app.ability.common';
import { BrandState } from '../components/BrandState';
import { showBrandDialog } from '../components/CompactDialog';
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
import { deviceNameValue, DeviceNameRules } from '../utils/DeviceOptions';
import { PlayerOptionRules, PlayerOptions, playerOptions, validPlayerOptions } from '../utils/PlayerOptions';
import { NetworkOptions, NetworkPolicy, validNetworkOptions } from '../utils/NetworkOptions';
import { NetworkPreferences } from '../service/NetworkPreferences';
import { PosterCache } from '../service/PosterCache';
import { PosterOptions, validPosterOptions } from '../utils/PosterOptions';
import { EngineChoice, engineChoiceCaption } from '../utils/EngineChoice';
import { EnginePreferences } from '../service/EnginePreferences';
import { PlaybackEngines } from '../service/PlaybackEngines';
import { MpvPreferences } from '../service/MpvPreferences';
import { MpvHardware, MpvVideo, MPV_HARDWARE_MODES, MPV_VIDEO_OUTPUTS, defaultMpvOptions, mpvHardwareCaption } from '../utils/MpvOptions';
@Entry
@Component
struct Settings {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @StorageLink('cineIsleLocked') @Watch('deviceLockChanged') locked: boolean = true;
  @StorageLink('cineIslePaletteStatus') paletteStatus: string = 'dynamic_colors_loading';
  @State appearance: AppearanceOptions = new AppearanceOptions();
  @State appearanceBusy: boolean = false;
  @State appearanceMessage: string = '';
  private appearanceRevision: number = 0;
  @State languageDraft: UiLanguage = 'system';
  @State languageSaved: UiLanguage = 'system';
  @State languageBusy: boolean = false;
  @State languageMessage: string = '';
  private languageRevision: number = 0;
  @State offline: boolean = false;
  @State remember: boolean = true;
  @State preference: string = '';
  @State downloadMobile: boolean = false;
  @State downloadRoaming: boolean = false;
  @State playerUi: PlayerOptions = new PlayerOptions();
  @State engineChoice: EngineChoice = 'native';
  @State engineKnown: boolean = false;
  @State engineBusy: boolean = false;
  @State engineMessage: string = '';
  @State mpvOffered: boolean = false;
  private engineRevision: number = 0;
  @State mpvHardware: MpvHardware = defaultMpvOptions().hwdec;
  @State mpvVideo: MpvVideo = defaultMpvOptions().vo;
  @State mpvSavedHardware: MpvHardware = defaultMpvOptions().hwdec;
  @State mpvSavedVideo: MpvVideo = defaultMpvOptions().vo;
  @State mpvOptionsKnown: boolean = false;
  @State mpvOptionsBusy: boolean = false;
  @State mpvOptionsMessage: string = '';
  private mpvOptionsRevision: number = 0;
  @State seekBack: string = (new PlayerOptions().back / 1000).toString();
  @State seekForward: string = (new PlayerOptions().forward / 1000).toString();
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
  @State requestSeconds: string = (new NetworkOptions().requestMs / 1000).toString();
  @State connectSeconds: string = (new NetworkOptions().connectMs / 1000).toString();
  @State readSeconds: string = (new NetworkOptions().readMs / 1000).toString();
  @State autoCache: boolean = new NetworkOptions().autoCache;
  @State networkBusy: boolean = false;
  @State networkMessage: string = '';
  @State posterEnabled: boolean = new PosterOptions().enabled;
  @State posterCapacity: string = new PosterOptions().maxMb.toString();
  @State posterBytes: number = 0;
  @State posterFiles: number = 0;
  @State posterKnown: boolean = false;
  @State posterBusy: boolean = false;
  @State posterMessage: string = '';
  private posterRevision: number = 0;
  private networkRevision: number = 0;
  private deviceRevision: number = 0;
  private deviceVisible: boolean = false;
  private owner: string = '';
  private ownerClient: JellyfinClient | undefined;
  aboutToAppear(): void { this.ownerClient = AppService.client; const state = AppService.experience?.snapshot(); this.downloadMobile = state?.downloadMobile ?? false; this.downloadRoaming = this.downloadMobile && (state?.downloadRoaming ?? false); this.offline = state?.offline ?? false; this.remember = state?.rememberDownloadSource ?? true; this.preference = state?.sourcePreference ?? ''; this.protected = AppLock.enabled; this.owner = AppService.client?.session.userId ?? ''; }
  onPageShow(): void {
    if (this.ownerClient !== AppService.client) { this.onPageHide(); router.back(); return; }
    this.deviceVisible = true;
    this.loadAppearance();
    this.loadLanguage();
    this.loadNetworkDraft();
    this.loadPosters();
    this.loadEngine();
    this.playerUi = playerOptions(AppService.experience?.snapshot().playerUi);
    this.seekBack = (this.playerUi.back / 1000).toString(); this.seekForward = (this.playerUi.forward / 1000).toString();
    this.loadDeviceName();
  }
  onPageHide(): void { this.deviceVisible = false; ++this.engineRevision; this.engineBusy = false; ++this.mpvOptionsRevision; this.mpvOptionsBusy = false; ++this.appearanceRevision; this.appearanceBusy = false; ++this.languageRevision; this.languageBusy = false; ++this.networkRevision; this.invalidatePosters(); this.invalidateDevice(); }
  aboutToDisappear(): void { this.onPageHide(); }
  private appearancePermit(revision: number): boolean { return revision === this.appearanceRevision && this.deviceVisible && !this.locked && AppLock.permit() && this.ownerClient === AppService.client; }
  private async loadAppearance(): Promise<void> {
    const revision = ++this.appearanceRevision; this.appearanceBusy = true;
    try { await AppearancePreferences.load(getContext(this) as common.UIAbilityContext); if (this.appearancePermit(revision)) { this.appearance = AppearancePreferences.snapshot(); this.appearanceMessage = ''; } }
    catch (e) { if (this.appearancePermit(revision)) { this.appearanceMessage = errorText(e as Error); } }
    finally { if (revision === this.appearanceRevision) { this.appearanceBusy = false; } }
  }
  private async saveAppearance(amoled: boolean, extra: boolean, dynamic?: boolean): Promise<void> {
    if (this.appearanceBusy || !this.appearancePermit(this.appearanceRevision)) { return; }
    const revision = ++this.appearanceRevision; this.appearanceBusy = true; this.appearanceMessage = '';
    try { const result = await AppearancePreferences.save({ amoled: amoled, extraInfo: extra, dynamicColors: dynamic ?? this.appearance.dynamicColors ?? true }, () => this.appearancePermit(revision)); if (this.appearancePermit(revision)) { this.appearance = result; this.appearanceMessage = text('appearance_saved'); } }
    catch (e) { if (this.appearancePermit(revision)) { this.appearanceMessage = errorText(e as Error); } }
    finally { if (revision === this.appearanceRevision) { this.appearanceBusy = false; } }
  }

  private async loadLanguage(): Promise<void> {
    const revision = ++this.languageRevision; this.languageBusy = true;
    const allowed = (): boolean => revision === this.languageRevision && this.deviceVisible && !this.locked && this.ownerClient === AppService.client;
    try {
      await LanguagePreferences.attach(getContext(this) as common.UIAbilityContext);
      if (allowed()) { this.languageDraft = LanguagePreferences.snapshot(); this.languageSaved = this.languageDraft; this.languageMessage = ''; }
    } catch (e) { if (allowed()) { this.languageMessage = errorText(e as Error); } }
    finally { if (revision === this.languageRevision) { this.languageBusy = false; } }
  }
  private async saveLanguage(): Promise<void> {
    if (this.languageBusy || !this.deviceVisible || this.locked || !AppLock.permit() || this.ownerClient !== AppService.client) { return; }
    const revision = ++this.languageRevision; const choice = this.languageDraft; this.languageBusy = true; this.languageMessage = '';
    const allowed = (): boolean => revision === this.languageRevision && this.deviceVisible && !this.locked && AppLock.permit() && this.ownerClient === AppService.client;
    try { await LanguagePreferences.save(choice, allowed); if (allowed()) { this.languageSaved = choice; this.languageMessage = text('ui_language_saved'); } }
    catch (e) { if (allowed()) { this.languageMessage = errorText(e as Error); } }
    finally { if (revision === this.languageRevision) { this.languageBusy = false; } }
  }

  private invalidateDevice(): void { ++this.deviceRevision; this.deviceLoaded = false; this.deviceBusy = false; }
  private deviceLockChanged(): void { if (this.locked) { ++this.engineRevision; this.engineBusy = false; ++this.mpvOptionsRevision; this.mpvOptionsBusy = false; ++this.appearanceRevision; this.appearanceBusy = false; ++this.languageRevision; this.languageBusy = false; ++this.networkRevision; this.invalidatePosters(); this.invalidateDevice(); } }
  private enginePermit(revision: number): boolean {
    return revision === this.engineRevision && this.deviceVisible && !this.locked && AppLock.permit() && this.ownerClient === AppService.client;
  }
  private async loadEngine(): Promise<void> {
    const revision = ++this.engineRevision; this.engineBusy = true; this.mpvOffered = PlaybackEngines.canOfferMpv();
    try {
      await EnginePreferences.load(getContext(this) as common.UIAbilityContext);
      if (this.enginePermit(revision)) { this.engineChoice = EnginePreferences.snapshot(); this.engineKnown = EnginePreferences.known(); this.engineMessage = EnginePreferences.issue ? text(EnginePreferences.issue) : ''; }
        if (this.enginePermit(revision) && this.engineChoice === 'mpv' && this.mpvOffered) { await this.loadMpvOptions(); }
    } catch (e) { if (this.enginePermit(revision)) { this.engineKnown = false; this.engineMessage = errorText(e as Error); } }
    finally { if (revision === this.engineRevision) { this.engineBusy = false; } }
  }
  private async saveEngine(choice: EngineChoice): Promise<void> {
    if (this.engineBusy || !this.enginePermit(this.engineRevision) || (choice === 'mpv' && !this.mpvOffered)) { return; }
    const revision = ++this.engineRevision; this.engineBusy = true; this.engineMessage = '';
    ++this.mpvOptionsRevision; this.mpvOptionsBusy = false;
    try {
      await PlaybackEngines.validate(choice);
      await EnginePreferences.save(choice, () => this.enginePermit(revision));
      if (this.enginePermit(revision)) { this.engineChoice = choice; this.engineKnown = true; this.engineMessage = text('engine_saved'); }
        if (this.enginePermit(revision) && choice === 'mpv') { await this.loadMpvOptions(); }
    } catch (e) { if (this.enginePermit(revision)) { this.engineKnown = EnginePreferences.known(); this.engineChoice = EnginePreferences.snapshot(); this.engineMessage = errorText(e as Error); } }
    finally { if (revision === this.engineRevision) { this.engineBusy = false; } }
  }
  private mpvOptionsPermit(revision: number): boolean {
    return revision === this.mpvOptionsRevision && this.deviceVisible && !this.locked && AppLock.permit() &&
      this.ownerClient === AppService.client && this.engineKnown && this.engineChoice === 'mpv' && this.mpvOffered;
  }
  private async loadMpvOptions(): Promise<void> {
    const revision = ++this.mpvOptionsRevision; this.mpvOptionsBusy = true;
    try {
      await MpvPreferences.load(getContext(this) as common.UIAbilityContext);
      if (this.mpvOptionsPermit(revision)) {
        const value = MpvPreferences.requireOptions(); this.mpvHardware = value.hwdec; this.mpvVideo = value.vo;
        this.mpvSavedHardware = value.hwdec; this.mpvSavedVideo = value.vo; this.mpvOptionsKnown = true; this.mpvOptionsMessage = '';
      }
    } catch (e) { if (this.mpvOptionsPermit(revision)) { this.mpvOptionsKnown = false; this.mpvOptionsMessage = errorText(e as Error); } }
    finally { if (revision === this.mpvOptionsRevision) { this.mpvOptionsBusy = false; } }
  }
  private async saveMpvOptions(): Promise<void> {
    if (this.mpvOptionsBusy || this.engineBusy || !this.mpvOptionsPermit(this.mpvOptionsRevision)) { return; }
    const revision = ++this.mpvOptionsRevision; this.mpvOptionsBusy = true; this.mpvOptionsMessage = '';
    try {
      const saved = await MpvPreferences.save({ hwdec: this.mpvHardware, vo: this.mpvVideo }, () => this.mpvOptionsPermit(revision));
      if (this.mpvOptionsPermit(revision)) {
        this.mpvSavedHardware = saved.hwdec; this.mpvSavedVideo = saved.vo; this.mpvOptionsKnown = true; this.mpvOptionsMessage = text('mpv_options_saved');
      }
    } catch (e) { if (this.mpvOptionsPermit(revision)) { this.mpvOptionsKnown = MpvPreferences.known(); this.mpvOptionsMessage = errorText(e as Error); } }
    finally { if (revision === this.mpvOptionsRevision) { this.mpvOptionsBusy = false; } }
  }
  private invalidatePosters(): void { ++this.posterRevision; this.posterBusy = false; this.posterKnown = false; }
  private posterPermit(revision: number, cache: PosterCache): boolean {
    return this.deviceVisible && revision === this.posterRevision && !this.locked && AppLock.permit() && this.ownerClient === AppService.client && cache === AppService.posters;
  }
  private async posterUsage(cache: PosterCache, revision: number): Promise<void> {
    try { const usage = await cache.usage(); if (this.posterPermit(revision, cache)) { this.posterBytes = usage.bytes; this.posterFiles = usage.files; this.posterKnown = true; if (usage.issue) { const message = text(usage.issue); this.posterMessage = this.posterMessage ? this.posterMessage + ' · ' + message : message; } } }
    catch (e) { if (this.posterPermit(revision, cache)) { this.posterKnown = false; this.posterMessage = this.posterMessage ? this.posterMessage + ' · ' + text('poster_cache_unavailable') : text('poster_cache_unavailable'); } }
  }
  private async loadPosters(): Promise<void> {
    const cache = AppService.posters; if (!cache || this.posterBusy || !this.posterPermit(this.posterRevision, cache)) { return; }
    const revision = this.posterRevision; this.posterBusy = true;
    const value = cache.snapshot(); this.posterEnabled = value.enabled; this.posterCapacity = value.maxMb.toString();
    await this.posterUsage(cache, revision); if (revision === this.posterRevision) { this.posterBusy = false; }
  }
  private async savePosters(): Promise<void> {
    const cache = AppService.posters; if (!cache || this.posterBusy || !this.posterPermit(this.posterRevision, cache)) { return; }
    const next: PosterOptions = { enabled: this.posterEnabled, maxMb: this.posterEnabled ? Number(this.posterCapacity) : cache.snapshot().maxMb };
    if ((this.posterEnabled && !/^[0-9]{1,3}$/.test(this.posterCapacity)) || !validPosterOptions(next)) { this.posterMessage = text('poster_options_invalid'); return; }
    const revision = this.posterRevision; this.posterBusy = true; this.posterMessage = '';
    try { const value = await cache.save(next, () => this.posterPermit(revision, cache)); if (this.posterPermit(revision, cache)) { this.posterEnabled = value.enabled; this.posterCapacity = value.maxMb.toString(); this.posterMessage = text('poster_options_saved'); } }
    catch (e) { if (this.posterPermit(revision, cache)) { this.posterMessage = text((e as Error).message === 'poster_options_restore_failed' ? 'poster_options_restore_failed' : 'poster_options_save_failed'); } }
    finally { await this.posterUsage(cache, revision); if (revision === this.posterRevision) { this.posterBusy = false; } }
  }
  private clearPosters(): void {
    const cache = AppService.posters; const revision = this.posterRevision;
    if (!cache || this.posterBusy || !this.posterPermit(revision, cache)) { return; }
    showBrandDialog(() => this.getUIContext(), { width: this.viewportHeight < 440 ? Math.min(720, this.viewportWidth - 32) : undefined, height: this.viewportHeight < 440 ? '90%' : undefined,
      backgroundColor: (this.amoled ? this.palette.amoledBackground : this.palette.raised), backgroundBlurStyle: BlurStyle.NONE, cornerRadius: 20, title: text('poster_cache_clear'), message: text('poster_cache_clear_confirm'),
      buttons: [{ defaultFocus: true, value: text('cancel'), fontColor: this.palette.accent, action: () => {} },
        { value: text('confirm'), fontColor: this.palette.warm, action: async () => {
          if (this.posterBusy || !this.posterPermit(revision, cache)) { return; } this.posterBusy = true; this.posterMessage = '';
          try { await cache.clear(() => this.posterPermit(revision, cache)); if (this.posterPermit(revision, cache)) { this.posterMessage = text('poster_cache_cleared'); } }
          catch (e) { if (this.posterPermit(revision, cache)) { this.posterMessage = text('poster_cache_clear_failed'); } }
          finally { await this.posterUsage(cache, revision); if (revision === this.posterRevision) { this.posterBusy = false; } }
        } }] }, this.viewportWidth, this.viewportHeight);
  }
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
    else if (key === 'trickplay') { next.trickplay = enabled; }
    else if (key === 'intro') { next.introSkipper = enabled; }
    else if (key === 'vertical') { next.vertical = enabled; }
    else if (key === 'brightness') { next.rememberBrightness = enabled; if (!enabled) { next.brightness = PlayerOptionRules.systemBrightness; } }
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
    Text(label).fontColor(this.palette.muted).fontSize(12).width('100%')
  }

  @Builder
  private appearanceSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.appearance_group'), icon: $r('app.media.menu_settings') })
      SettingsToggle({ label: $r('app.string.dynamic_colors'), selected: this.appearance.dynamicColors ?? true, available: !this.appearanceBusy,
        onChange: (value: boolean) => this.saveAppearance(this.appearance.amoled, this.appearance.extraInfo, value) })
      Text($r('app.string.dynamic_colors_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      Text(text(this.paletteStatus)).fontSize(12).fontColor(this.palette.warm).width('100%')
      SettingsToggle({ label: $r('app.string.appearance_amoled'), selected: this.appearance.amoled, available: !this.appearanceBusy,
        onChange: (value: boolean) => this.saveAppearance(value, this.appearance.extraInfo) })
      Text($r('app.string.appearance_amoled_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      SettingsToggle({ label: $r('app.string.appearance_extra_info'), selected: this.appearance.extraInfo, available: !this.appearanceBusy,
        onChange: (value: boolean) => this.saveAppearance(this.appearance.amoled, value) })
      Text($r('app.string.appearance_extra_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      if (this.appearanceBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.appearanceMessage) { Text(this.appearanceMessage).fontSize(12).fontColor(this.palette.warm).width('100%') }
    }.width('100%').padding(16).borderRadius(20).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.raised)
  }

  @Builder
  private languageSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.ui_language_group'), icon: $r('app.media.menu_settings') })
      Text($r('app.string.ui_language_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      Select(UI_LANGUAGES.map((choice: UiLanguage): SelectOption => ({ value: uiLanguageCaption(choice, text('ui_language_system')) })))
        .selected(UI_LANGUAGES.indexOf(this.languageDraft))
        .value(uiLanguageCaption(this.languageDraft, text('ui_language_system'))).fontColor(this.palette.foreground).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface))
        .height(UiLayout.buttonHeight(this.fontScale)).width('100%').accessibilityText($r('app.string.ui_language_group')).enabled(!this.languageBusy)
        .onSelect((index: number) => { if (!this.languageBusy && !this.locked && index >= 0 && index < UI_LANGUAGES.length && Number.isInteger(index)) { this.languageDraft = UI_LANGUAGES[index]; } })
      BrandButton({ label: $r('app.string.ui_language_save'), icon: $r('app.media.menu_save'), primary: true,
        available: !this.languageBusy && this.languageDraft !== this.languageSaved, onSelect: () => this.saveLanguage() })
      if (this.languageBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.languageMessage) { Text(this.languageMessage).fontSize(12).fontColor(this.palette.warm).width('100%') }
    }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
  }

  @Builder
  private posterSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.poster_cache_group'), icon: $r('app.media.menu_offline') })
      Text($r('app.string.poster_cache_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      SettingsToggle({ label: $r('app.string.poster_cache_enabled'), selected: this.posterEnabled, available: !this.posterBusy,
        onChange: (v: boolean) => { this.posterEnabled = v; } })
      this.fieldCaption($r('app.string.poster_cache_capacity'))
      TextInput({ text: this.posterCapacity }).type(InputType.Number).maxLength(3).height(UiLayout.buttonHeight(this.fontScale)).fontColor(this.palette.foreground)
        .backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(this.posterEnabled && !this.posterBusy).accessibilityText($r('app.string.poster_cache_capacity'))
        .onChange((v: string) => { this.posterCapacity = v; })
      if (this.posterKnown) { Text($r('app.string.poster_cache_usage', (this.posterBytes / 1048576).toFixed(2), this.posterFiles)).fontSize(12).fontColor(this.palette.muted).width('100%') }
      else { Text($r('app.string.poster_cache_unknown')).fontSize(12).fontColor(this.palette.muted).width('100%') }
      BrandButton({ label: $r('app.string.poster_options_save'), icon: $r('app.media.menu_save'), primary: true, available: !this.posterBusy, onSelect: () => this.savePosters() })
      BrandButton({ label: $r('app.string.poster_cache_clear'), icon: $r('app.media.menu_reset'), available: !this.posterBusy, onSelect: () => this.clearPosters() })
      if (this.posterBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.posterMessage) { Text(this.posterMessage).fontSize(12).fontColor(this.palette.warm).width('100%') }
    }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
  }
  @Builder
  private networkField(label: Resource, key: number) {
    this.fieldCaption(label)
    TextInput({ text: key === 0 ? this.requestSeconds : key === 1 ? this.connectSeconds : this.readSeconds }).type(InputType.Number).maxLength(3).accessibilityText(label)
      .height(UiLayout.buttonHeight(this.fontScale)).fontColor(this.palette.foreground).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.networkBusy && !this.locked)
      .onChange((v: string) => { if (key === 0) { this.requestSeconds = v; } else if (key === 1) { this.connectSeconds = v; } else { this.readSeconds = v; } })
  }
  @Builder
  private apiNetworkSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.api_network_group'), icon: $r('app.media.menu_server') })
      Text($r('app.string.api_network_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      this.networkField($r('app.string.network_request_seconds'), 0)
      this.networkField($r('app.string.network_connect_seconds'), 1)
      this.networkField($r('app.string.network_read_seconds'), 2)
      SettingsToggle({ label: $r('app.string.network_auto_cache'), selected: this.autoCache, available: !this.networkBusy && !this.locked,
        onChange: (v: boolean) => { this.autoCache = v; } })
      Text($r('app.string.network_cache_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      BrandButton({ label: $r('app.string.network_options_save'), icon: $r('app.media.menu_save'), primary: true, available: !this.networkBusy && !this.locked, onSelect: () => this.saveApiNetwork() })
      BrandButton({ label: $r('app.string.network_options_reset'), icon: $r('app.media.menu_reset'), available: !this.networkBusy && !this.locked, onSelect: () => this.saveApiNetwork(true) })
      if (this.networkBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.networkMessage) { Text(this.networkMessage).fontSize(12).fontColor(this.palette.warm).width('100%') }
    }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
  }
  @Builder
  private deviceSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.device_name_group'), icon: $r('app.media.menu_accounts') })
      Text($r('app.string.device_name_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      if (this.deviceLoaded) { Text($r('app.string.device_name_current', this.deviceSaved || text('device_name_default'))).fontSize(14).fontColor(this.palette.foreground).width('100%') }
      else { Text($r('app.string.device_name_unknown')).fontSize(12).fontColor(this.palette.warm).width('100%') }
      this.fieldCaption($r('app.string.device_name_label'))
      TextInput({ text: this.deviceDraft, placeholder: $r('app.string.device_name_default') }).type(InputType.Normal).maxLength(DeviceNameRules.maximumInputCodeUnits)
        .height(UiLayout.buttonHeight(this.fontScale)).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12)
        .enabled(this.deviceLoaded && !this.deviceBusy && !this.offline).accessibilityText($r('app.string.device_name_label'))
        .onChange((value: string) => { if (this.deviceLoaded && !this.deviceBusy && !this.offline && !this.locked && AppLock.permit()) { this.deviceDraft = value; this.deviceMessage = ''; } })
      BrandButton({ label: $r('app.string.device_name_refresh'), icon: $r('app.media.menu_sync'), available: !this.deviceBusy && !this.offline, onSelect: () => this.loadDeviceName() })
      BrandButton({ label: $r('app.string.device_name_save'), icon: $r('app.media.menu_save'), primary: true,
        available: this.deviceLoaded && !this.deviceBusy && !this.offline && this.deviceDraft !== this.deviceSaved, onSelect: () => this.saveDeviceName() })
      if (this.deviceBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.offline) { Text($r('app.string.device_name_online_required')).fontSize(12).fontColor(this.palette.warm).width('100%') }
      if (this.deviceMessage) { Text(this.deviceMessage).fontSize(12).fontColor(this.palette.warm).width('100%') }
    }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
  }

  @Builder
  private mpvSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.mpv_options_title'), icon: $r('app.media.detail_play') })
      Text(this.mpvOptionsKnown ? text('mpv_options_current', text(mpvHardwareCaption(this.mpvSavedHardware)), this.mpvSavedVideo) : text('mpv_options_unknown')).fontSize(14).fontColor(this.palette.foreground).width('100%')
      Text($r('app.string.mpv_hardware_label')).fontSize(14).fontColor(this.palette.foreground).width('100%')
      Select(MPV_HARDWARE_MODES.map((mode: MpvHardware): SelectOption => ({ value: text(mpvHardwareCaption(mode)) })))
        .selected(MPV_HARDWARE_MODES.indexOf(this.mpvHardware)).value(text(mpvHardwareCaption(this.mpvHardware)))
        .fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface).width('100%')
        .enabled(!this.mpvOptionsBusy && !this.engineBusy && !this.locked).accessibilityText($r('app.string.mpv_hardware_label'))
        .onSelect((index: number) => { if (Number.isInteger(index) && index >= 0 && index < MPV_HARDWARE_MODES.length) { this.mpvHardware = MPV_HARDWARE_MODES[index]; } })
      Text($r('app.string.mpv_video_label')).fontSize(14).fontColor(this.palette.foreground).width('100%')
      Select(MPV_VIDEO_OUTPUTS.map((output: MpvVideo): SelectOption => ({ value: output }))).selected(MPV_VIDEO_OUTPUTS.indexOf(this.mpvVideo)).value(this.mpvVideo)
        .fontColor(this.palette.foreground).backgroundColor(this.amoled ? this.palette.amoledBackground : this.palette.surface).width('100%')
        .enabled(!this.mpvOptionsBusy && !this.engineBusy && !this.locked).accessibilityText($r('app.string.mpv_video_label'))
        .onSelect((index: number) => { if (Number.isInteger(index) && index >= 0 && index < MPV_VIDEO_OUTPUTS.length) { this.mpvVideo = MPV_VIDEO_OUTPUTS[index]; } })
      Text($r('app.string.mpv_options_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      Text($r('app.string.mpv_audio_fixed')).fontSize(12).fontColor(this.palette.muted).width('100%')
      BrandButton({ label: $r('app.string.mpv_options_save'), icon: $r('app.media.menu_save'),
        available: !this.mpvOptionsBusy && !this.engineBusy && !this.locked, onSelect: () => this.saveMpvOptions() })
      if (this.mpvOptionsBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.mpvOptionsMessage) { Text(this.mpvOptionsMessage).fontSize(12).fontColor(this.palette.warm).width('100%') }
    }.width('100%')
  }
  @Builder
  private playerSettings() {
    Column({ space: 12 }) {
      BrandHeading({ label: $r('app.string.engine_title'), icon: $r('app.media.detail_play') })
      Text(this.engineKnown ? text('engine_current', text(engineChoiceCaption(this.engineChoice))) : text('engine_unknown')).fontSize(14).fontColor(this.palette.foreground).width('100%')
      Text($r('app.string.engine_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
      BrandButton({ label: $r('app.string.engine_native'), icon: $r('app.media.detail_play'), primary: this.engineKnown && this.engineChoice === 'native', available: !this.engineBusy && !this.locked,
        onSelect: () => this.saveEngine('native') })
      BrandButton({ label: $r('app.string.engine_mpv'), icon: $r('app.media.detail_play'), primary: this.engineKnown && this.engineChoice === 'mpv', available: this.mpvOffered && !this.engineBusy && !this.locked,
        onSelect: () => this.saveEngine('mpv') })
      if (!this.mpvOffered) { Text($r('app.string.engine_mpv_requires_api')).fontSize(12).fontColor(this.palette.muted).width('100%') }
      if (this.engineBusy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.engineMessage) { Text(this.engineMessage).fontSize(12).fontColor(this.palette.warm).width('100%') }
        if (this.engineKnown && this.engineChoice === 'mpv' && this.mpvOffered) { this.mpvSettings(); }
      BrandHeading({ label: $r('app.string.player_gesture_preferences'), icon: $r('app.media.player_speed') })
      SettingsToggle({ label: $r('app.string.player_gestures_enabled'), selected: this.playerUi.gestures,
        onChange: (value: boolean) => this.savePlayer('gestures', value) })
      SettingsToggle({ label: $r('app.string.player_seek_gesture'), selected: this.playerUi.seek, available: this.playerUi.gestures,
        onChange: (value: boolean) => this.savePlayer('seek', value) })
      SettingsToggle({ label: $r('app.string.player_zoom_gesture'), selected: this.playerUi.zoom, available: this.playerUi.gestures,
        onChange: (value: boolean) => this.savePlayer('zoom', value) })
      SettingsToggle({ label: $r('app.string.player_start_maximized'), selected: this.playerUi.startMaximized,
        onChange: (value: boolean) => this.savePlayer('maximized', value) })
      SettingsToggle({ label: $r('app.string.player_vertical_gesture'), selected: this.playerUi.vertical ?? true, available: this.playerUi.gestures,
        onChange: (value: boolean) => this.savePlayer('vertical', value) })
      SettingsToggle({ label: $r('app.string.player_remember_brightness'), selected: this.playerUi.rememberBrightness ?? false,
        onChange: (value: boolean) => this.savePlayer('brightness', value) })
      this.fieldCaption($r('app.string.player_back_seconds'))
      TextInput({ text: this.seekBack }).type(InputType.Number).maxLength(3).height(UiLayout.buttonHeight(this.fontScale)).fontColor(this.palette.foreground)
        .backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).accessibilityText($r('app.string.player_back_seconds')).onChange((value: string) => { this.seekBack = value; })
      this.fieldCaption($r('app.string.player_forward_seconds'))
      TextInput({ text: this.seekForward }).type(InputType.Number).maxLength(3).height(UiLayout.buttonHeight(this.fontScale)).fontColor(this.palette.foreground)
        .backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).accessibilityText($r('app.string.player_forward_seconds')).onChange((value: string) => { this.seekForward = value; })
      BrandButton({ label: $r('app.string.player_save_steps'), icon: $r('app.media.menu_save'), onSelect: () => this.savePlayer() })
      SettingsToggle({ label: $r('app.string.player_auto_pip'), selected: this.playerUi.autoPiP,
        onChange: (value: boolean) => this.savePlayer('pip', value) })
      SettingsToggle({ label: $r('app.string.player_intro_skipper'), selected: this.playerUi.introSkipper ?? true,
        onChange: (value: boolean) => this.savePlayer('intro', value) })
      Text($r('app.string.player_intro_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
      Row({ space: 8 }) {
        Text($r('app.string.player_trickplay')).fontColor(this.palette.foreground).fontSize(14).layoutWeight(1)
        Checkbox().select(this.playerUi.trickplay ?? true).selectedColor(this.palette.action)
          .accessibilityText($r('app.string.player_trickplay')).onChange((enabled: boolean) => this.savePlayer('trickplay', enabled))
      }.width('100%')
      Text($r('app.string.player_trickplay_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
      Text($r('app.string.player_ui_preferences_hint')).fontSize(12).fontColor(this.palette.muted).width('100%')
    }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
  }

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
        Column({ space: 14 }) {
          BrandHeader({ label: $r('app.string.settings'), onBack: () => router.back() })
          Scroll() {
            Column({ space: 18 }) {
              this.appearanceSettings()
              this.languageSettings()
              this.deviceSettings()
              this.apiNetworkSettings()
              this.posterSettings()
              BrandButton({ label: $r('app.string.caption_settings_title'), icon: $r('app.media.player_subtitle'), onSelect: () => { router.pushUrl({ url: AppRoutes.captionSettings }); } })
              this.playerSettings()
              Column({ space: 12 }) {
                BrandHeading({ label: $r('app.string.offline_group'), icon: $r('app.media.menu_offline') })
                Row({ space: 12 }) {
                  Text($r('app.string.offline_mode')).fontColor(this.palette.foreground).fontSize(14).layoutWeight(1)
                  Checkbox().select(this.offline).selectedColor(this.palette.action).flexShrink(0)
                      .accessibilityText($r('app.string.offline_mode')).onChange((value: boolean) => { this.offline = value; this.save(); if (value) { this.invalidateDevice(); } })
                }.width('100%')
              }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
              Column({ space: 12 }) {
                BrandHeading({ label: $r('app.string.download_preferences'), icon: $r('app.media.detail_download') })
                Row({ space: 12 }) {
                  Text($r('app.string.download_mobile')).fontColor(this.palette.foreground).fontSize(14).layoutWeight(1)
                  Checkbox().select(this.downloadMobile).selectedColor(this.palette.action).flexShrink(0)
                    .accessibilityText($r('app.string.download_mobile')).onChange((value: boolean) => this.saveNetwork(value, this.downloadRoaming))
                }.width('100%')
                Row({ space: 12 }) {
                  Text($r('app.string.download_roaming')).fontColor(this.palette.foreground).fontSize(14).layoutWeight(1)
                  Checkbox().select(this.downloadRoaming).enabled(this.downloadMobile).selectedColor(this.palette.action).flexShrink(0)
                    .accessibilityText($r('app.string.download_roaming')).onChange((value: boolean) => this.saveNetwork(this.downloadMobile, value))
                }.width('100%')
                Text($r('app.string.download_network_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
                Row({ space: 12 }) {
                  Text($r('app.string.remember_source')).fontColor(this.palette.foreground).fontSize(14).layoutWeight(1)
                  Checkbox().select(this.remember).selectedColor(this.palette.action).flexShrink(0)
                    .accessibilityText($r('app.string.remember_source')).onChange((value: boolean) => { this.remember = value; this.save(); })
                }.width('100%')
                Text(this.preference || $r('app.string.source_default')).fontColor(this.palette.muted).fontSize(12).width('100%')
                BrandButton({ label: $r('app.string.clear_source_preference'), icon: $r('app.media.menu_reset'), onSelect: () => { this.preference = ''; this.save(); } })
                Text($r('app.string.download_location_hint')).fontColor(this.palette.muted).fontSize(12).width('100%')
              }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
              Column({ space: 12 }) {
                BrandHeading({ label: $r('app.string.app_lock'), icon: $r('app.media.menu_lock') })
                Text($r('app.string.lock_policy')).fontColor(this.palette.muted).fontSize(12).width('100%')
                if (this.protected) {
                  this.fieldCaption($r('app.string.lock_current_pin'))
                  TextInput({ text: this.currentPin, placeholder: $r('app.string.lock_current_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.currentPin = v; })
                }
                this.fieldCaption($r('app.string.lock_new_pin'))
                TextInput({ text: this.nextPin, placeholder: $r('app.string.lock_new_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.nextPin = v; })
                this.fieldCaption($r('app.string.lock_confirm_pin'))
                TextInput({ text: this.confirmation, placeholder: $r('app.string.lock_confirm_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(AppLockPolicy.maxPinDigits).fontColor(this.palette.foreground).placeholderColor(this.palette.muted).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface)).borderRadius(12).enabled(!this.busy).onChange((v: string) => { this.confirmation = v; })
                BrandButton({ label: $r('app.string.lock_save'), icon: $r('app.media.menu_save'), primary: true, available: !this.busy && this.nextPin.length >= AppLockPolicy.minPinDigits, onSelect: () => this.changeLock() })
                if (this.protected) {
                  BrandButton({ label: $r('app.string.lock_now'), icon: $r('app.media.menu_lock'), onSelect: () => AppLock.lock() })
                  BrandButton({ label: $r('app.string.lock_disable'), icon: $r('app.media.menu_unlock'), available: !this.busy, onSelect: () => this.changeLock(true) })
                }
                if (this.busy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
                if (this.message) { Text(this.message).fontColor(this.palette.danger).fontSize(13).width('100%') }
              }.width('100%').padding(16).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.raised)).borderRadius(20)
            }.width('100%').padding({ bottom: 12 })
          }.layoutWeight(1).width('100%').align(Alignment.TopStart)
        }.padding(20).width('100%').height('100%').backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.background))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
