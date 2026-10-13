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
      Row() {
        Text(this.title()).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#F2F3FA')
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1)
        if (this.section.libraryId) {
          Button($r('app.string.view_all'), { type: ButtonType.Normal }).labelStyle({ maxLines: 2, overflow: TextOverflow.Clip }).constraintSize({ minHeight: UiLayout.buttonHeight(this.fontScale), maxWidth: '100%' }).fontSize(13).fontColor($r('app.color.brand_accent'))
            .backgroundColor(Color.Transparent).height(UiLayout.buttonHeight(this.fontScale)).onClick(() => this.onLibrary(this.section))
        }
      }.width('100%').padding({ left: 20, right: 12 })
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
