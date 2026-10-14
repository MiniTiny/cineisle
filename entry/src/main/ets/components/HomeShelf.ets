import { BrandHeading } from './BrandHeading';
import { BrandButton } from './BrandButton';
import { UiLayout } from '../utils/UiLayout';
import { HomeSection, MediaItem } from '../model/Models';
import { MediaCard } from './MediaCard';

@Component
export struct HomeShelf {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @State viewportWidth: number = 360;
  @State viewportHeight: number = 800;
  @Prop section: HomeSection;
  onSelect: (item: MediaItem) => void = () => {};
  onLibrary: (section: HomeSection) => void = () => {};
  onPlay: (item: MediaItem) => void = () => {};

  private title(): ResourceStr {
    if (this.section.kind === 'resume') { return $r('app.string.continue_watching'); }
    if (this.section.kind === 'nextup') { return $r('app.string.next_up'); }
    if (this.section.kind === 'cached') { return this.section.name || $r('app.string.cached_media'); }
    return $r('app.string.latest_library', this.section.name);
  }

  build() {
    Column({ space: 12 }) {
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Center }) {
        Column() { BrandHeading({ label: this.title(), icon: this.section.kind === 'resume' ? $r('app.media.detail_play') : this.section.kind === 'nextup' ? $r('app.media.player_next') : $r('app.media.nav_library_active') }) }
          .width(this.fontScale > 1 || this.viewportWidth < 360 || !this.section.libraryId ? '100%' : '65%')
        if (this.section.libraryId) {
          Column() { BrandButton({ label: $r('app.string.view_all'), icon: $r('app.media.menu_chevron'), compact: true, onSelect: () => this.onLibrary(this.section) }) }
            .width(this.fontScale > 1 || this.viewportWidth < 360 ? '100%' : '33%').margin({ top: 8 })
        }
      }.width('100%').padding({ left: 20, right: 20 })
      List({ space: 16 }) {
        ForEach(this.section.items, (item: MediaItem) => {
          ListItem() {
            MediaCard({ item: item, wide: this.section.kind === 'resume' || this.section.kind === 'nextup', onSelect: this.onSelect, onPlay: this.onPlay })
          }.width(UiLayout.shelfWidth(this.viewportWidth, this.section.kind === 'resume' || this.section.kind === 'nextup', this.fontScale))
        }, (item: MediaItem) => `${item.Id}|${JSON.stringify(item)}`)
      }.listDirection(Axis.Horizontal).height(UiLayout.shelfHeight(this.viewportWidth, this.fontScale, this.section.kind === 'resume' || this.section.kind === 'nextup'))
        .width('100%').padding({ left: 20, right: 20 }).scrollBar(BarState.Off)
    }.width('100%').alignItems(HorizontalAlign.Start).onAreaChange((_old: Area, area: Area) => { this.viewportWidth = Number.parseFloat(String(area.width)); })
  }
}
