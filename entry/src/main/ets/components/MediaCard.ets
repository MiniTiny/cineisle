import { UiPalette } from '../utils/UiPalette';
import { UiLayout } from '../utils/UiLayout';
import { MediaItem } from '../model/Models';
import { CachedImage } from './CachedImage';
import { playbackPercent, posterTarget } from '../utils/MediaPresentation';

@Component
export struct MediaCard {
  @StorageLink('cineIslePalette') palette: UiPalette = new UiPalette();
  @StorageLink('cineIsleFontScale') fontScale: number = 1;
  @Prop item: MediaItem;
  @Prop wide: boolean = false;
  onSelect: (item: MediaItem) => void = () => {};
  onPlay: ((item: MediaItem) => void) | undefined = undefined;
  onReason: ((item: MediaItem) => void) | undefined = undefined;

  private typeLabel(): Resource {
    switch (this.item.Type) {
      case 'Movie': return $r('app.string.media_movie');
      case 'Series': return $r('app.string.media_series');
      case 'Episode': return $r('app.string.media_episode');
      case 'Season': return $r('app.string.media_season');
      case 'BoxSet': return $r('app.string.media_collection');
      default: return $r('app.string.media_video');
    }
  }

  build() {
    Column({ space: 4 }) {
      Stack() {
        CachedImage({ imageId: posterTarget(this.item, this.wide).id, tag: posterTarget(this.item, this.wide).tag ?? '',
          backdrop: posterTarget(this.item, this.wide).backdrop, pixelWidth: this.wide ? 1280 : 480, label: this.item.Name })
          .width('100%').aspectRatio(this.wide ? 16 / 9 : 2 / 3)
        if (this.item.UserData?.Played) {
          Row() {
            Blank()
            Image($r('app.media.nav_check_active')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.accent : undefined)).width(22).height(22).padding(3).backgroundColor(this.palette.selected).borderRadius(11)
              .accessibilityText($r('app.string.watched_indicator'))
          }.width('100%').padding(8).position({ x: 0, y: 0 })
        }
        if (this.wide && playbackPercent(this.item) > 0) {
          Column() {
            Blank()
            Progress({ value: playbackPercent(this.item), total: 100, type: ProgressType.Linear })
              .color(this.palette.accent).backgroundColor(this.palette.selected).height(4).width('92%').margin({ bottom: 8 })
          }.width('100%').height('100%').position({ x: 0, y: 0 }).hitTestBehavior(HitTestMode.None)
        }
        if (this.wide && this.onPlay) {
          Column() {
            Blank()
            Row() {
              Blank()
              Button({ type: ButtonType.Circle }) {
                Image($r('app.media.detail_play')).colorFilter(this.palette.filter(this.palette.dynamic ? this.palette.onAction : undefined)).width(22).height(22)
              }.width(40).height(UiLayout.buttonHeight(this.fontScale)).padding(8).backgroundColor(this.palette.action)
                .accessibilityText($r('app.string.play')).onClick(() => this.onPlay?.(this.item))
            }.width('100%').padding(12)
          }.width('100%').height('100%').position({ x: 0, y: 0 })
        }
      }.width('100%').aspectRatio(this.wide ? 16 / 9 : 2 / 3)
      Text(this.wide ? this.item.SeriesName ?? this.item.Name : this.item.Name)
        .fontSize(14).fontColor(this.palette.foreground).maxLines(2).height(40 * this.fontScale)
        .textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
      if (this.wide && this.item.Type === 'Episode') {
        Text(this.item.ParentIndexNumber !== undefined && this.item.IndexNumber !== undefined ?
          $r('app.string.episode_label', this.item.ParentIndexNumber, this.item.IndexNumber, this.item.Name) : this.item.Name)
          .fontSize(12).fontColor(this.palette.muted).height(32 * this.fontScale).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%')
      } else if (!this.wide) {
        Row() {
          Text(this.item.ProductionYear?.toString() ?? this.typeLabel()).fontSize(12).fontColor(this.palette.muted)
          Blank()
          if (this.item.CommunityRating) { Text(this.item.CommunityRating.toFixed(1)).fontSize(12).fontColor(this.palette.warm) }
        }.width('100%')
      }
    }.width('100%').alignItems(HorizontalAlign.Start).onClick(() => this.onSelect(this.item))
      .gesture(LongPressGesture().onAction(() => this.onReason?.(this.item)))
  }
}
