@Component
export struct BrandHeader {
  @StorageLink('cineIsleAmoled') amoled: boolean = false;
  @Prop label: ResourceStr;
  @Prop searchable: boolean = false;
  onSearch: () => void = () => {};
  @Prop refreshable: boolean = false;
  @Prop available: boolean = true;
  onRefresh: () => void = () => {};
  onBack: () => void = () => {};
  build() {
    Row({ space: 12 }) {
      Button({ type: ButtonType.Normal }) {
        Image($r('app.media.menu_back')).width(24).height(24).accessibilityLevel('no')
      }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_surface')))
        .accessibilityText($r('app.string.back')).onClick(this.onBack)
      Text(this.label).fontSize(22).fontWeight(FontWeight.Bold).fontColor('#F2F3FA').layoutWeight(1)
      if (this.searchable) {
        Button({ type: ButtonType.Normal }) {
          Image($r('app.media.nav_search_muted')).width(24).height(24).accessibilityLevel('no')
        }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_surface')))
          .accessibilityText($r('app.string.search_hint')).onClick(this.onSearch)
      }
      if (this.refreshable) {
        Button({ type: ButtonType.Normal }) {
          Image($r('app.media.menu_sync')).width(24).height(24).accessibilityLevel('no')
        }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? '#000000' : $r('app.color.brand_surface')))
          .enabled(this.available).opacity(this.available ? 1 : 0.5).accessibilityText($r('app.string.refresh')).onClick(this.onRefresh)
      }
    }.width('100%')
  }
}
