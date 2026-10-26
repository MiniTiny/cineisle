import { UiPalette } from '../utils/UiPalette';
@Component
export struct BrandHeader {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
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
        Image($r('app.media.menu_back')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined)).width(24).height(24).accessibilityLevel('no')
      }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface))
        .accessibilityText($r('app.string.back')).onClick(this.onBack)
      Text(this.label).fontSize(22).fontWeight(FontWeight.Bold).fontColor(this.palette.foreground).layoutWeight(1)
      if (this.searchable) {
        Button({ type: ButtonType.Normal }) {
          Image($r('app.media.nav_search_muted')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.muted : undefined)).width(24).height(24).accessibilityLevel('no')
        }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface))
          .accessibilityText($r('app.string.search_hint')).onClick(this.onSearch)
      }
      if (this.refreshable) {
        Button({ type: ButtonType.Normal }) {
          Image($r('app.media.menu_sync')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined)).width(24).height(24).accessibilityLevel('no')
        }.width(44).height(44).padding(0).borderRadius(14).backgroundColor((this.amoled ? this.palette.amoledBackground : this.palette.surface))
          .enabled(this.available).opacity(this.available ? 1 : 0.5).accessibilityText($r('app.string.refresh')).onClick(this.onRefresh)
      }
    }.width('100%')
  }
}
