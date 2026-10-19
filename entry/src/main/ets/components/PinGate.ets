import { BrandButton } from './BrandButton';
import { BrandHeading } from './BrandHeading';
import { BrandState } from './BrandState';
import { UiLayout } from '../utils/UiLayout';
import { AppLock } from '../service/AppLock';
import { errorText } from '../utils/Strings';
@Component
export struct PinGate {
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State pin: string = '';
  @State busy: boolean = false;
  @State message: string = '';
  private async unlock(): Promise<void> {
    if (this.busy || this.pin.length < 6) { return; } this.busy = true; const pin = this.pin; this.pin = '';
    try { if (!await AppLock.unlock(pin)) { this.message = getContext(this).resourceManager.getStringSync($r('app.string.lock_pin_wrong').id); } }
    catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
  }
  build() {
    Scroll() {
    Column({ space: 20 }) {
      Image($r('app.media.app_icon')).width(76).height(76).accessibilityLevel('no')
      Text($r('app.string.app_name')).fontColor('#F2F3FA').fontSize(28).fontWeight(FontWeight.Bold).width('100%')
      BrandHeading({ label: $r('app.string.app_lock'), icon: $r('app.media.menu_lock') })
      Text($r('app.string.lock_pin')).fontColor($r('app.color.brand_muted')).fontSize(12).width('100%')
      TextInput({ text: this.pin, placeholder: $r('app.string.lock_pin') }).height(UiLayout.buttonHeight(this.fontScale)).type(InputType.NUMBER_PASSWORD).maxLength(12).enabled(!this.busy)
        .fontColor('#F2F3FA').placeholderColor($r('app.color.brand_muted')).borderRadius(12).backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_surface'))).onChange((value: string) => { this.pin = value; }).onSubmit(() => this.unlock())
      BrandButton({ label: $r('app.string.lock_unlock'), icon: $r('app.media.menu_unlock'), primary: true, available: !this.busy && this.pin.length >= 6, onSelect: () => this.unlock() })
      if (this.busy) { BrandState({ label: $r('app.string.loading'), loading: true }) }
      if (this.message || AppLock.fault) { Text(this.message || $r('app.string.lock_storage_failed')).fontColor($r('app.color.brand_danger')).fontSize(13) }
    }.padding(28).width('100%').backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_background')))
    }.width('100%').height('100%').align(Alignment.TopStart).backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_background')))
  }
}
