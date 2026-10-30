import { SubtitleRun } from '../utils/InlineSubtitle';
import { EMPTY_SUBTITLE_PARAGRAPHS, SubtitleParagraphSpan } from '../utils/SubtitleParagraph';
import { CaptionRenderStyle } from '../utils/CaptionStyle';
import { CaptionRasterizer, CaptionPicture, captionRequest } from '../utils/CaptionRasterizer';
import { SubtitleMetrics } from '../utils/SubtitleMetrics';
import { CaptionRenderLimits } from '../utils/SubtitleLimits';
import { text } from '../utils/Strings';

// Each main/PiP instance owns its UIContext, measured width, asynchronous jobs and pixel-map references.
@Component
export struct NativeCaption {
  @Prop @Watch('schedule') runs: SubtitleRun[] = [];
  @Prop @Watch('schedule') paragraphs: SubtitleParagraphSpan[] = EMPTY_SUBTITLE_PARAGRAPHS;
  @Prop @Watch('schedule') captionStyle: CaptionRenderStyle = new CaptionRenderStyle();
  @Prop @Watch('schedule') fontSize: number = 20;
  @Prop @Watch('schedule') limit: number = CaptionRenderLimits.maxLines;
  @Prop @Watch('schedule') availableWidth: number = 0;
  @Prop identifier: string = '';
  @Prop @Watch('schedule') revision: string = '';
  @Prop padX: number = 8;
  @Prop padY: number = 8;
  @Prop radius: number = 0;
  @Prop stretch: boolean = true;
  @StorageLink('cineIsleFontScale') @Watch('schedule') fontScale: number = 1;
  @State picture: CaptionPicture | undefined = undefined;
  @State issue: boolean = false;
  @State measuredWidth: number = 0;
  private visible: boolean = false;
  private desiredKey: string = '';
  private metrics: SubtitleMetrics = new SubtitleMetrics();
  private raster: CaptionRasterizer | undefined;

  aboutToAppear(): void {
    this.visible = true;
    this.desiredKey = '';
    this.raster = new CaptionRasterizer((picture: CaptionPicture | undefined) => { this.picture = picture; }, () => { this.issue = true; });
    this.schedule();
  }
  aboutToDisappear(): void { this.visible = false; this.raster?.close(); this.raster = undefined; }
  private schedule(): void {
    if (!this.visible || !this.raster) { return; }
    if (!this.runs.length) { this.issue = false; this.desiredKey = ''; this.raster.clear(); return; }
    const width = (this.stretch ? this.measuredWidth : this.availableWidth) - this.padX * 2;
    if (width <= 0) { return; }
    try {
      const request = captionRequest(this.runs, this.captionStyle, this.fontSize, width, this.limit, !this.stretch, this.getUIContext(), this.metrics, this.fontScale, this.revision, this.paragraphs);
      const key = JSON.stringify(request);
      if (key !== this.desiredKey) { this.desiredKey = key; this.issue = false; }
      this.raster.request(request);
    } catch (e) { this.raster.clear(); this.issue = true; }
  }
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.issue) {
        Text(text('subtitle_failed')).fontColor(this.captionStyle.foreground).fontSize(this.fontSize)
      } else if (this.picture) {
        Image(this.picture?.bitmap).id(`${this.identifier}-image`).objectFit(ImageFit.Fill)
          .width(`${this.picture?.width ?? 0}px`).height(`${this.picture?.height ?? 0}px`)
          .position({ x: this.getUIContext().px2vp(-(this.picture?.halo ?? 0)), y: this.getUIContext().px2vp(-(this.picture?.halo ?? 0)) })
          .accessibilityLevel('no').hitTestBehavior(HitTestMode.None)
      }
    }.id(this.identifier).width(this.stretch ? '100%' : this.getUIContext().px2vp(this.picture?.layoutWidth ?? 0) + this.padX * 2)
      .height(this.issue ? undefined : this.getUIContext().px2vp(this.picture?.layoutHeight ?? 0) + this.padY * 2)
      .backgroundColor(this.captionStyle.background).borderRadius(this.radius)
      .padding({ left: this.padX, right: this.padX, top: this.padY, bottom: this.padY })
      .accessibilityText(this.issue ? text('subtitle_failed') : this.runs.map((run: SubtitleRun): string => run.text).join(''))
      .opacity(this.picture || this.issue ? 1 : 0)
      .constraintSize({ maxWidth: '100%' }).hitTestBehavior(HitTestMode.None)
      .onAreaChange((_old: Area, area: Area) => {
        const width = Number.parseFloat(String(area.width));
        if (Number.isFinite(width) && Math.abs(width - this.measuredWidth) > 0.1) { this.measuredWidth = width; this.schedule(); }
      })
  }
}
