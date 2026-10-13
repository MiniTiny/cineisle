import { UiLayout } from '../utils/UiLayout';
@Component
export struct DetailAction {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @Prop label: Resource;
  @Prop icon: Resource;
  @Prop available: boolean = true;
  @Prop destructive: boolean = false;
  onSelect: () => void = () => {};
  build() {
    Button({ type: ButtonType.Normal }) {
      Column({ space: 6 }) {
        Image(this.icon).width(22).height(22)
        Text(this.label).fontSize(11).fontColor(this.destructive ? $r('app.color.brand_danger') : $r('app.color.brand_accent'))
          .width('100%').textAlign(TextAlign.Center).maxLines(2).height(28 * this.fontScale).textOverflow({ overflow: TextOverflow.Ellipsis })
      }.width('100%')
    }.width(72 * this.fontScale).height(36 + 28 * this.fontScale).padding(4).margin({ right: 8, bottom: 8 }).borderRadius(16)
      .backgroundColor($r('app.color.brand_surface')).enabled(this.available).opacity(this.available ? 1 : 0.5)
      .accessibilityText(this.label).onClick(this.onSelect)
  }
}
