@Component
export struct BrandState {
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @Prop label: ResourceStr;
  @Prop icon: Resource = $r('app.media.nav_library_active');
  @Prop loading: boolean = false;
  build() {
    if (this.loading) {
      Row({ space: 10 }) {
        LoadingProgress().width(24).height(24).color($r('app.color.brand_accent')).flexShrink(0).accessibilityLevel('no')
        Text(this.label).fontSize(13).fontColor($r('app.color.brand_muted')).layoutWeight(1)
      }.width('100%').padding(12).borderRadius(16).backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_surface_raised')))
    } else {
      Column({ space: 12 }) {
        Row() { Image(this.icon).width(28).height(28).accessibilityLevel('no') }
          .width(52).height(52).borderRadius(16).backgroundColor($r('app.color.brand_selected')).justifyContent(FlexAlign.Center)
        Text(this.label).fontSize(14).fontColor($r('app.color.brand_muted')).width('100%').textAlign(TextAlign.Center)
      }.width('100%').padding(20).borderRadius(20).backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_surface_raised')))
    }
  }
}
