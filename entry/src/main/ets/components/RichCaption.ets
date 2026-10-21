import { SubtitleRun } from '../utils/InlineSubtitle';
import { CaptionRenderStyle } from '../utils/CaptionStyle';
import { captionShadows } from '../utils/CaptionUI';

// Both the main page and the independent PiP node build native Span text from the same runs.
@Component
export struct RichCaption {
  @Prop runs: SubtitleRun[] = [];
  @Prop captionStyle: CaptionRenderStyle = new CaptionRenderStyle();
  @Prop fontSize: number = 20;
  @Prop limit: number = 1000;
  @Prop identifier: string = '';
  @Prop padX: number = 8;
  @Prop padY: number = 8;
  @Prop radius: number = 0;
  @Prop stretch: boolean = true;

  build() {
    Text() {
      ForEach(this.runs, (run: SubtitleRun) => {
        Span(run.text).fontWeight(run.bold ? FontWeight.Bold : FontWeight.Normal)
          .fontStyle(run.italic ? FontStyle.Italic : FontStyle.Normal)
          .decoration({ type: run.underline ? TextDecorationType.Underline : TextDecorationType.None,
            color: run.color || this.captionStyle.foreground })
          .fontColor(run.color || this.captionStyle.foreground)
          .fontFamily(run.family || this.captionStyle.family)
      }, (run: SubtitleRun, index: number): string => `${index}:${JSON.stringify(run)}`)
    }.id(this.identifier).fontSize(this.captionStyle.system ? `${this.fontSize}vp` : this.fontSize)
      .fontColor(this.captionStyle.foreground).fontFamily(this.captionStyle.family).textAlign(TextAlign.Center)
      .textShadow(captionShadows(this.captionStyle.edge)).maxLines(this.limit).textOverflow({ overflow: TextOverflow.Ellipsis })
      .backgroundColor(this.captionStyle.background).borderRadius(this.radius)
      .padding({ left: this.padX, right: this.padX, top: this.padY, bottom: this.padY })
      .constraintSize({ maxWidth: '100%' }).width(this.stretch ? '100%' : undefined)
  }
}
