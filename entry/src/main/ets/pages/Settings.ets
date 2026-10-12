import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { AppService } from '../service/AppService';
import { AppLock } from '../service/AppLock';
import { ExperienceState } from '../utils/Experience';
import { errorText } from '../utils/Strings';
@Entry
@Component
struct Settings {
  @StorageLink('cineIsleLocked') locked: boolean = true;
  @State offline: boolean = false;
  @State remember: boolean = true;
  @State preference: string = '';
  @State currentPin: string = '';
  @State nextPin: string = '';
  @State confirmation: string = '';
  @State protected: boolean = false;
  @State message: string = '';
  @State busy: boolean = false;
  private owner: string = '';
  aboutToAppear(): void { const state = AppService.experience?.snapshot(); this.offline = state?.offline ?? false; this.remember = state?.rememberDownloadSource ?? true; this.preference = state?.sourcePreference ?? ''; this.protected = AppLock.enabled; this.owner = AppService.client?.session.userId ?? ''; }
  onPageShow(): void { if (this.owner !== (AppService.client?.session.userId ?? '')) { router.back(); } }
  private save(): void {
    try { AppService.experience?.update((state: ExperienceState) => { state.offline = this.offline; state.rememberDownloadSource = this.remember; state.sourcePreference = this.preference; }); }
    catch (e) { this.message = errorText(e as Error); }
  }
  private async changeLock(disable: boolean = false): Promise<void> {
    if (this.busy) { return; }
    if (!disable && this.nextPin !== this.confirmation) { this.message = getContext(this).resourceManager.getStringSync($r('app.string.lock_pin_mismatch').id); return; }
    this.busy = true;
    try { await AppLock.configure(this.currentPin, disable ? '' : this.nextPin); this.protected = AppLock.enabled; this.message = ''; }
    catch (e) { this.message = errorText(e as Error); }
    finally { this.currentPin = ''; this.nextPin = ''; this.confirmation = ''; this.busy = false; }
  }
  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
    Column({ space: 14 }) {
      Row({ space: 10 }) {
        Button($r('app.string.back')).backgroundColor($r('app.color.brand_surface')).onClick(() => router.back())
        Text($r('app.string.settings')).fontColor('#F2F3FA').fontSize(22)
      }.width('100%')
      Scroll() {
        Column({ space: 14 }) {
          Row() {
            Checkbox().select(this.offline).selectedColor($r('app.color.brand_action')).onChange((value: boolean) => { this.offline = value; this.save(); })
            Text($r('app.string.offline_mode')).fontColor('#F2F3FA')
          }.width('100%')
          Text($r('app.string.download_preferences')).fontColor('#F2F3FA').fontSize(18).width('100%')
          Row() {
            Checkbox().select(this.remember).selectedColor($r('app.color.brand_action')).onChange((value: boolean) => { this.remember = value; this.save(); })
            Text($r('app.string.remember_source')).fontColor('#F2F3FA').fontSize(14)
          }.width('100%')
          Text(this.preference || $r('app.string.source_default')).fontColor($r('app.color.brand_muted')).width('100%')
          Button($r('app.string.clear_source_preference')).backgroundColor($r('app.color.brand_surface')).onClick(() => { this.preference = ''; this.save(); })
          Text($r('app.string.download_location_hint')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
          Text($r('app.string.app_lock')).fontColor('#F2F3FA').fontSize(18).width('100%').margin({ top: 20 })
          Text($r('app.string.lock_policy')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
          if (this.protected) {
            TextInput({ text: this.currentPin, placeholder: $r('app.string.lock_current_pin') }).type(InputType.NUMBER_PASSWORD).maxLength(12).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onChange((v: string) => { this.currentPin = v; })
          }
          TextInput({ text: this.nextPin, placeholder: $r('app.string.lock_new_pin') }).type(InputType.NUMBER_PASSWORD).maxLength(12).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onChange((v: string) => { this.nextPin = v; })
          TextInput({ text: this.confirmation, placeholder: $r('app.string.lock_confirm_pin') }).type(InputType.NUMBER_PASSWORD).maxLength(12).fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onChange((v: string) => { this.confirmation = v; })
          Button($r('app.string.lock_save')).backgroundColor($r('app.color.brand_action')).enabled(!this.busy && this.nextPin.length >= 6).onClick(() => this.changeLock())
          if (this.protected) {
            Button($r('app.string.lock_now')).backgroundColor($r('app.color.brand_surface')).onClick(() => AppLock.lock())
            Button($r('app.string.lock_disable')).backgroundColor($r('app.color.brand_surface')).enabled(!this.busy).onClick(() => this.changeLock(true))
          }
          if (this.message) { Text(this.message).fontColor('#FF9F9F').fontSize(13).width('100%') }
        }.width('100%')
      }.layoutWeight(1).width('100%')
    }.padding(20).width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%')
  }
}
