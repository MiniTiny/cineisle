import { SubtitleRun } from '../utils/InlineSubtitle';
import { CaptionRenderStyle } from '../utils/CaptionStyle';
import { captionShadows } from '../utils/CaptionUI';
import { NativeCaption } from './NativeCaption';

// Main and PiP share text semantics; scripted captions use per-window native typography.
@Component
export struct RichCaption {
  @Prop runs: SubtitleRun[] = [];
  @Prop captionStyle: CaptionRenderStyle = new CaptionRenderStyle();
  @Prop fontSize: number = 20;
  @Prop limit: number = 1000;
  @Prop identifier: string = '';
  @Prop revision: string = '';
  @Prop padX: number = 8;
  @Prop padY: number = 8;
  @Prop radius: number = 0;
  @Prop stretch: boolean = true;
  @Prop availableWidth: number = 0;

  @Builder
  private caption(overlay: boolean) {
    Text() {
      ForEach(this.runs, (run: SubtitleRun) => {
        Span(run.text).fontWeight(run.bold ? FontWeight.Bold : FontWeight.Normal)
          .fontSize(this.captionStyle.system ? `${this.fontSize * (run.sizeScale ?? 1)}vp` : this.fontSize * (run.sizeScale ?? 1))
          .fontStyle(run.italic ? FontStyle.Italic : FontStyle.Normal)
          .decoration({ type: overlay ? (run.strike && run.underline ? TextDecorationType.LineThrough : TextDecorationType.None) :
            (run.underline ? TextDecorationType.Underline : run.strike ? TextDecorationType.LineThrough : TextDecorationType.None),
            color: run.color || this.captionStyle.foreground })
          .fontColor(overlay ? Color.Transparent : run.color || this.captionStyle.foreground)
          .fontFamily(run.family || this.captionStyle.family)
      }, (run: SubtitleRun, index: number): string => `${index}:${JSON.stringify(run)}`)
    }.id(overlay ? `${this.identifier}-decoration` : this.identifier).fontSize(this.captionStyle.system ? `${this.fontSize}vp` : this.fontSize)
      .fontColor(this.captionStyle.foreground).fontFamily(this.captionStyle.family).textAlign(TextAlign.Center)
      .textShadow(captionShadows(overlay ? 'none' : this.captionStyle.edge)).maxLines(this.limit).textOverflow({ overflow: TextOverflow.Ellipsis })
      .backgroundColor(overlay ? Color.Transparent : this.captionStyle.background).borderRadius(this.radius)
      .padding({ left: this.padX, right: this.padX, top: this.padY, bottom: this.padY })
      .constraintSize({ maxWidth: '100%' }).width(this.stretch ? '100%' : undefined)
      .accessibilityLevel(overlay ? 'no' : 'auto').hitTestBehavior(overlay ? HitTestMode.None : HitTestMode.Default)
  }

  build() {
    if (this.runs.some((run: SubtitleRun): boolean => !!run.baselines?.length || !!run.background)) {
      NativeCaption({ runs: this.runs, captionStyle: this.captionStyle, fontSize: this.fontSize, limit: this.limit,
        identifier: this.identifier, revision: this.revision, padX: this.padX, padY: this.padY, radius: this.radius, stretch: this.stretch, availableWidth: this.availableWidth })
    } else if (this.runs.some((run: SubtitleRun): boolean => run.underline && !!run.strike)) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.caption(false)
        this.caption(true)
      }.constraintSize({ maxWidth: '100%' }).width(this.stretch ? '100%' : undefined)
    } else {
      this.caption(false)
    }
  }
}
