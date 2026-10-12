import { AppLock } from '../service/AppLock';
import { errorText } from '../utils/Strings';
@Component
export struct PinGate {
  @State pin: string = '';
  @State busy: boolean = false;
  @State message: string = '';
  private async unlock(): Promise<void> {
    if (this.busy) { return; } this.busy = true; const pin = this.pin; this.pin = '';
    try { if (!await AppLock.unlock(pin)) { this.message = getContext(this).resourceManager.getStringSync($r('app.string.lock_pin_wrong').id); } }
    catch (e) { this.message = errorText(e as Error); } finally { this.busy = false; }
  }
  build() {
    Column({ space: 20 }) {
      Image($r('app.media.app_icon')).width(76).height(76)
      Text($r('app.string.app_name')).fontColor('#F2F3FA').fontSize(28)
      Text($r('app.string.lock_unlock')).fontColor($r('app.color.brand_muted')).fontSize(16)
      TextInput({ text: this.pin, placeholder: $r('app.string.lock_pin') }).type(InputType.NUMBER_PASSWORD).maxLength(12).enabled(!this.busy)
        .fontColor('#F2F3FA').backgroundColor($r('app.color.brand_surface')).onChange((value: string) => { this.pin = value; }).onSubmit(() => this.unlock())
      Button($r('app.string.lock_unlock')).backgroundColor($r('app.color.brand_action')).enabled(!this.busy && this.pin.length >= 6).onClick(() => this.unlock())
      if (this.message || AppLock.fault) { Text(this.message || $r('app.string.lock_storage_failed')).fontColor('#FF9F9F').fontSize(13) }
    }.padding(28).width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor($r('app.color.brand_background'))
  }
}
