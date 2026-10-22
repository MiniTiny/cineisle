import { PositionedSubtitle, SubtitleRun } from '../utils/InlineSubtitle';
import { CaptionRenderStyle } from '../utils/CaptionStyle';
import { subtitleColumn, subtitleFraction, subtitleTop } from '../utils/SubtitlePosition';
import { RichCaption } from './RichCaption';

// Measure in each window's own UIContext; never reuse main-window dimensions in PiP.
@Component
export struct PositionedCaption {
  @Prop cue: PositionedSubtitle = new PositionedSubtitle(0, '', [], 5);
  @Prop captionStyle: CaptionRenderStyle = new CaptionRenderStyle();
  @Prop fontSize: number = 20;
  @Prop canvasWidth: number = 0;
  @Prop canvasHeight: number = 0;
  @Prop identifier: string = '';
  @State measuredHeight: number = 0;

  build() {
    Column() {
      RichCaption({ runs: this.cue.runs.length ? this.cue.runs : [new SubtitleRun(this.cue.text)],
        captionStyle: this.captionStyle, fontSize: this.fontSize, identifier: this.identifier, revision: this.cue.revision,
        stretch: false, padX: 3, padY: 1, availableWidth: Math.max(1, this.canvasWidth * (subtitleColumn(this.cue.alignment) === 1 ? 1 : 0.92) - 4) })
    }.constraintSize({ maxWidth: Math.max(1, this.canvasWidth * (subtitleColumn(this.cue.alignment) === 1 ? 1 : 0.92)),
      maxHeight: Math.max(1, this.canvasHeight) }).padding(2).backgroundColor(this.captionStyle.window)
      .position({ x: `${subtitleFraction(subtitleColumn(this.cue.alignment)) * 100}%`,
        y: subtitleTop(this.cue.alignment, this.canvasHeight, this.measuredHeight) })
      .markAnchor({ x: `${subtitleColumn(this.cue.alignment) * 50}%`, y: 0 })
      .onAreaChange((_old: Area, area: Area) => {
        const height = Number.parseFloat(String(area.height));
        if (Number.isFinite(height) && Math.abs(height - this.measuredHeight) > 0.1) { this.measuredHeight = height; }
      }).opacity(this.measuredHeight > 0 ? 1 : 0).hitTestBehavior(HitTestMode.None)
  }
}
