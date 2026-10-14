import { BrandHeading } from './BrandHeading';
import { MediaItem, Person } from '../model/Models';
import { detailMetadata, DetailRow } from '../utils/DetailPresentation';
import { AppService } from '../service/AppService';
@Component
export struct DetailMetadataPanel {
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @Prop item: MediaItem;
  @Prop sourceId: string = '';
  @Prop stacked: boolean = false;
  onPerson: (person: Person) => void = () => {};
  private rows(technical: boolean): DetailRow[] {
    return detailMetadata(this.item, this.sourceId).rows.filter((row: DetailRow) => ['size', 'video', 'audio', 'subtitles'].includes(row.key) === technical);
  }
  @Builder
  private metadataRows(technical: boolean) {
    ForEach(this.rows(technical), (row: DetailRow) => {
      Flex({ direction: this.stacked ? FlexDirection.Column : FlexDirection.Row, alignItems: ItemAlign.Start }) {
        Text(row.label).fontSize(13).fontColor($r('app.color.brand_muted')).width(this.stacked ? '100%' : 88)
          .margin(this.stacked ? { bottom: 6 } : { right: 14 })
        Text(row.value).fontSize(14).fontColor('#F2F3FA').lineHeight(22).width(this.stacked ? '100%' : undefined).layoutWeight(this.stacked ? 0 : 1)
      }.width('100%')
    }, (row: DetailRow) => row.key + ':' + row.value)
  }
  build() {
    Column({ space: 18 }) {
      if (this.item.Overview?.trim() || this.rows(false).length) {
        Column({ space: 14 }) {
          BrandHeading({ label: $r('app.string.detail_story'), icon: $r('app.media.detail_film') })
          if (this.item.Overview?.trim()) {
            Text(this.item.Overview).fontColor('#F2F3FA').fontSize(15).lineHeight(24).width('100%')
          }
          this.metadataRows(false)
        }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
      }
      if (detailMetadata(this.item, this.sourceId).chips.length || this.rows(true).length) {
        Column({ space: 14 }) {
          BrandHeading({ label: $r('app.string.detail_technical'), icon: $r('app.media.nav_library_active') })
          Flex({ wrap: FlexWrap.Wrap }) {
            ForEach(detailMetadata(this.item, this.sourceId).chips, (chip: string) => {
              Text(chip).fontSize(12).fontColor($r('app.color.brand_accent')).padding({ left: 12, right: 12, top: 6, bottom: 6 })
                .backgroundColor($r('app.color.brand_selected')).borderRadius(12).margin({ right: 8, bottom: 8 })
            }, (chip: string) => chip)
          }.width('100%')
          this.metadataRows(true)
        }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
      }
      if (detailMetadata(this.item).actors.length) {
        Column({ space: 14 }) {
          BrandHeading({ label: $r('app.string.cast'), icon: $r('app.media.nav_user_active') })
          ForEach(detailMetadata(this.item).actors, (person: Person) => {
            Button({ type: ButtonType.Normal }) {
              Row({ space: 12 }) {
                Image(AppService.client?.image(person.Id, person.PrimaryImageTag) ?? '').alt($r('app.media.nav_user_muted'))
                  .width(48).height(48).objectFit(ImageFit.Cover).borderRadius(24).flexShrink(0).backgroundColor($r('app.color.brand_surface')).accessibilityLevel('no')
                Column({ space: 6 }) {
                  Text(person.Name).fontColor('#F2F3FA').fontSize(14).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
                  if (person.Role) { Text(person.Role).fontColor($r('app.color.brand_muted')).fontSize(12).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%') }
                }.layoutWeight(1).alignItems(HorizontalAlign.Start)
                Image($r('app.media.menu_chevron')).width(20).height(20).flexShrink(0).accessibilityLevel('no')
              }.width('100%').constraintSize({ minHeight: Math.max(64, 56 * this.fontScale) + 16 }).padding(12).hitTestBehavior(HitTestMode.None)
            }.width('100%').constraintSize({ minHeight: Math.max(64, 56 * this.fontScale) + 16 }).padding(0).borderRadius(16).backgroundColor($r('app.color.brand_surface'))
              .accessibilityText(person.Name).onClick(() => this.onPerson(person))
          }, (person: Person) => person.Id + ':' + person.Name + ':' + (person.Role ?? '') + ':' + (person.PrimaryImageTag ?? ''))
        }.width('100%').padding(16).borderRadius(20).backgroundColor($r('app.color.brand_surface_raised')).alignItems(HorizontalAlign.Start)
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}
