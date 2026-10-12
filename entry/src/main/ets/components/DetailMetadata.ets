import { MediaItem, Person } from '../model/Models';
import { detailMetadata, DetailRow } from '../utils/DetailPresentation';
import { AppService } from '../service/AppService';
@Component
export struct DetailMetadataPanel {
  @Prop item: MediaItem;
  @Prop sourceId: string = '';
  onPerson: (person: Person) => void = () => {};
  build() {
    Column({ space: 16 }) {
      if (detailMetadata(this.item, this.sourceId).chips.length) {
        Flex({ wrap: FlexWrap.Wrap }) {
          ForEach(detailMetadata(this.item, this.sourceId).chips, (chip: string) => {
            Text(chip).fontSize(12).fontColor($r('app.color.brand_accent')).padding({ left: 12, right: 12, top: 6, bottom: 6 })
              .backgroundColor($r('app.color.brand_selected')).borderRadius(12).margin({ right: 8, bottom: 8 })
          }, (chip: string) => chip)
        }.width('100%')
      }
      if (this.item.Overview?.trim()) {
        Text(this.item.Overview).fontColor('#BDC5D6').fontSize(15).lineHeight(24).width('100%')
      }
      ForEach(detailMetadata(this.item, this.sourceId).rows, (row: DetailRow) => {
        Row({ space: 14 }) {
          Text(row.label).fontSize(13).fontColor($r('app.color.brand_muted')).width(56).align(Alignment.Top)
          Text(row.value).fontSize(14).fontColor('#F2F3FA').lineHeight(22).layoutWeight(1)
        }.width('100%').alignItems(VerticalAlign.Top)
      }, (row: DetailRow) => row.key + ':' + row.value)
      if (detailMetadata(this.item).actors.length) {
        Text($r('app.string.cast')).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#F2F3FA').width('100%')
        List({ space: 16 }) {
          ForEach(detailMetadata(this.item).actors, (person: Person) => {
            ListItem() {
              Column({ space: 6 }) {
                Image(AppService.client?.image(person.Id, person.PrimaryImageTag) ?? '').alt($r('app.media.nav_user_muted'))
                  .width(80).height(80).objectFit(ImageFit.Cover).borderRadius(40).backgroundColor($r('app.color.brand_surface'))
                Text(person.Name).fontColor('#F2F3FA').fontSize(12).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).width(88)
                if (person.Role) { Text(person.Role).fontColor($r('app.color.brand_muted')).fontSize(11).maxLines(1).width(88) }
              }.onClick(() => this.onPerson(person))
            }
          }, (person: Person) => person.Id + ':' + person.Name + ':' + (person.Role ?? '') + ':' + (person.PrimaryImageTag ?? ''))
        }.listDirection(Axis.Horizontal).height(126).width('100%').scrollBar(BarState.Off)
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}
