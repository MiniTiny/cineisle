import { UiLayout } from '../utils/UiLayout';
import { BrandButton } from '../components/BrandButton';
import { BrandHeading } from '../components/BrandHeading';
import { BrandHeader } from '../components/BrandHeader';
import { PinGate } from '../components/PinGate';
import router from '@ohos.router';
import { AppService } from '../service/AppService';
import { AppLock } from '../service/AppLock';
import { ExperienceState } from '../utils/Experience';
import { errorText } from '../utils/Strings';
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
  @Builder
  private fieldCaption(label: Resource) {
    Text(label).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
  }

  build() {
    Column() {
      if (this.locked) { PinGate() }
      else {
        Column({ space: 14 }) {
          BrandHeader({ label: $r('app.string.settings'), onBack: () => router.back() })
          Scroll() {
            Column({ space: 18 }) {
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
                if (this.message) { Text(this.message).fontColor($r('app.color.brand_danger')).fontSize(13).width('100%') }
              }.width('100%').padding(16).backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20)
            }.width('100%').padding({ bottom: 12 })
          }.layoutWeight(1).width('100%').align(Alignment.TopStart)
        }.padding(20).width('100%').height('100%').backgroundColor($r('app.color.brand_background'))
      }
    }.width('100%').height('100%').onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); this.viewportHeight = Number.parseFloat(String(area.height)); })
  }
}
