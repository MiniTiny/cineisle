@Component
export struct BrandHeading {
  @Prop label: Resource;
  @Prop icon: Resource;
  build() {
    Row({ space: 10 }) {
      Row() { Image(this.icon).width(20).height(20).accessibilityLevel('no') }
        .width(32).height(32).justifyContent(FlexAlign.Center).flexShrink(0)
        .backgroundColor($r('app.color.brand_selected')).borderRadius(10)
      Text(this.label).fontSize(16).fontWeight(FontWeight.Medium).fontColor('#F2F3FA').layoutWeight(1)
    }.width('100%')
  }
}
