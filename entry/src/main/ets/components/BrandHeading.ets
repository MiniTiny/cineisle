import { UiPalette } from '../utils/UiPalette';
@Component
export struct BrandHeading {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @Prop label: ResourceStr;
  @Prop icon: Resource;
  build() {
    Row({ space: 10 }) {
      Row() { Image(this.icon).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined)).width(20).height(20).accessibilityLevel('no') }
        .width(32).height(32).justifyContent(FlexAlign.Center).flexShrink(0)
        .backgroundColor(this.palette.selected).borderRadius(10)
      Text(this.label).fontSize(16).fontWeight(FontWeight.Medium).fontColor(this.palette.foreground).layoutWeight(1)
    }.width('100%')
  }
}
