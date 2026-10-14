import { ComponentContent } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import { BrandButton } from './BrandButton';
import { errorText } from '../utils/Strings';

export interface BrandDialogOptions extends AlertDialogParam {
  buttons?: AlertDialogButtonOptions[];
  confirm?: AlertDialogButtonBaseOptions;
  buttonDirection?: DialogButtonDirection;
}
export interface CompactDialogData {
  title: ResourceStr;
  message: ResourceStr;
  width: number;
  height: number;
  actions: AlertDialogButtonBaseOptions[];
  choose: (index: number) => void;
  release: () => void;
}
@Component
export struct CompactDialog {
  @Prop data: CompactDialogData;
  aboutToDisappear(): void { this.data.release(); }
  @Builder
  private actions() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      ForEach(this.data.actions, (action: AlertDialogButtonBaseOptions, index: number) => {
        Column() {
          BrandButton({ label: action.value, icon: index === 0 && this.data.actions.length > 1 ? $r('app.media.menu_cancel') : $r('app.media.nav_check_active'),
            focus: index === 0, destructive: (action.fontColor as Resource)?.id === $r('app.color.brand_danger').id,
            onSelect: () => this.data.choose(index) })
        }.width(this.data.width >= 600 && this.data.actions.length > 1 ? '48%' : '100%')
      })
    }.width('100%')
  }
  build() {
    Column({ space: 12 }) {
      if (this.data.width >= 600) {
        Text(this.data.title).fontSize(16).fontWeight(FontWeight.Bold).fontColor('#F2F3FA').width('100%')
        Scroll() { Text(this.data.message).fontSize(14).lineHeight(22).fontColor($r('app.color.brand_muted')).width('100%') }
          .width('100%').layoutWeight(1).align(Alignment.TopStart)
        this.actions()
      } else {
        Scroll() {
          Column({ space: 12 }) {
            Text(this.data.title).fontSize(16).fontWeight(FontWeight.Bold).fontColor('#F2F3FA').width('100%')
            Text(this.data.message).fontSize(14).lineHeight(22).fontColor($r('app.color.brand_muted')).width('100%')
            this.actions()
          }.width('100%')
        }.width('100%').layoutWeight(1).align(Alignment.TopStart)
      }
    }.width(Math.min(720, this.data.width - 32)).height(this.data.height * 0.9).padding(16)
      .backgroundColor($r('app.color.brand_surface_raised')).borderRadius(20).id('CineIsleCompactDialog')
  }
}
@Builder
function compactDialogBuilder(data: CompactDialogData) { CompactDialog({ data: data }) }

export function showBrandDialog(context: () => UIContext, options: BrandDialogOptions, width: number, height: number): void {
  if (height >= 440) {
    if (options.buttons) { AlertDialog.show(options as AlertDialogParamWithOptions); }
    else { AlertDialog.show(options as AlertDialogParamWithConfirm); }
    return;
  }
  const ui = context(); const prompt = ui.getPromptAction();
  const actions: AlertDialogButtonBaseOptions[] = options.buttons ?? (options.confirm ? [options.confirm] : []);
  let closing = false; let released = false;
  const release = (): void => { if (!released) { released = true; setTimeout(() => content.dispose(), 0); } };
  const data: CompactDialogData = { title: options.title ?? '', message: options.message, width: width, height: height, actions: actions, release: release,
    choose: (index: number) => {
      if (closing || released || !Number.isInteger(index) || index < 0 || index >= actions.length) { return; }
      closing = true;
      prompt.closeCustomDialog(content).then(() => { release(); actions[index].action(); }).catch((e: Error) => { prompt.showToast({ message: errorText(e) }); });
    } };
  const content = new ComponentContent(ui, wrapBuilder(compactDialogBuilder), data);
  prompt.openCustomDialog(content, { alignment: DialogAlignment.Center, autoCancel: true })
    .catch((e: Error) => { content.dispose(); prompt.showToast({ message: errorText(e) }); });
}
