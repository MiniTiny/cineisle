@Component
export struct BrandButton {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @Prop label: Resource;
  @Prop icon: Resource;
  @Prop available: boolean = true;
  @Prop compact: boolean = false;
  @Prop primary: boolean = false;
  @Prop destructive: boolean = false;
  onSelect: () => void = () => {};
  build() {
    Button({ type: ButtonType.Normal }) {
      Row({ space: this.compact ? 8 : 10 }) {
        Image(this.icon).width(this.compact ? 20 : 22).height(this.compact ? 20 : 22).flexShrink(0).accessibilityLevel('no')
        Text(this.label).fontSize(14).fontWeight(FontWeight.Medium).layoutWeight(1).maxLines(2)
          .textAlign(TextAlign.Start).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontColor(this.destructive ? $r('app.color.brand_danger') : '#F2F3FA')
      }.width('100%').padding({ left: this.compact ? 10 : 14, right: this.compact ? 10 : 14, top: 8, bottom: 8 }).hitTestBehavior(HitTestMode.None)
    }.width('100%').constraintSize({ minHeight: Math.max(36, 32 * this.fontScale) + 16 }).padding(0).borderRadius(16)
      .backgroundColor(this.primary ? $r('app.color.brand_action') : $r('app.color.brand_surface'))
      .enabled(this.available).opacity(this.available ? 1 : 0.5).accessibilityText(this.label).onClick(this.onSelect)
  }
}
