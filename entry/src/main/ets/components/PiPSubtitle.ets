import { NodeController, BuilderNode, FrameNode } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import { SystemCaptions } from '../service/SystemCaptions';
import { CaptionRenderStyle, captionRenderStyle } from '../utils/CaptionStyle';
import { captionShadows } from '../utils/CaptionUI';
import { StyledSubtitleFrame, StyledSubtitleBounds, styledSubtitleBounds } from '../utils/StyledSubtitle';

export class PiPSubtitleParams {
  text: string;
  fontSize: number;
  maxLines: number;
  bottom: number;
  style: CaptionRenderStyle;
  frame: StyledSubtitleFrame | undefined;
  bounds: StyledSubtitleBounds | undefined;
  constructor(text: string, fontSize: number, maxLines: number, bottom: number, style: CaptionRenderStyle) {
    this.text = text; this.fontSize = fontSize; this.maxLines = maxLines; this.bottom = bottom; this.style = style;
  }
}

@Builder
function pipSubtitleBuilder(params: PiPSubtitleParams) {
  Stack({ alignContent: Alignment.Bottom }) {
    if (params.frame && params.bounds) {
      Stack({ alignContent: Alignment.TopStart }) {
        Image(params.frame.bitmap).id('pipAssSubtitle').objectFit(ImageFit.Fill)
          .width(params.bounds.width).height(params.bounds.height).position({ x: params.bounds.left, y: params.bounds.top })
      }.width('100%').height('100%').clip(true)
    }
    if (params.text) {
      Column() {
        Text(params.text).fontColor(params.style.foreground).fontSize(params.style.system ? `${params.fontSize}vp` : params.fontSize).textAlign(TextAlign.Center)
          .fontFamily(params.style.family).textShadow(captionShadows(params.style.edge))
          .maxLines(params.maxLines).textOverflow({ overflow: TextOverflow.Ellipsis })
          .backgroundColor(params.style.background).borderRadius(4).padding({ left: 6, right: 6, top: 3, bottom: 3 }).width('100%')
      }.padding(2).backgroundColor(params.style.window).margin({ bottom: params.bottom }).width('94%')
    }
  }.width('100%').height('100%').hitTestBehavior(HitTestMode.None)
}

// A PiP window has its own UIContext. Never attach the page's existing subtitle node here.
export class PiPSubtitleController extends NodeController {
  private node: BuilderNode<[PiPSubtitleParams]> | undefined = undefined;
  private context: UIContext | undefined = undefined;
  private value: string = '';
  private frame: StyledSubtitleFrame | undefined;
  private width: number = 0;
  private fontSize: number = 14;
  private maxLines: number = 4;
  private bottom: number = 8;
  private closed: boolean = false;
  private failed: boolean = false;
  private stopCaptions: (() => void) | undefined = undefined;
  private style: CaptionRenderStyle = captionRenderStyle(SystemCaptions.snapshot().config, '#AA000000');
  private height: number = 0;
  private failure: () => void;

  constructor(failure: () => void) { super(); this.failure = failure; }
  get isReleased(): boolean { return this.node === undefined; }

  private params(): PiPSubtitleParams {
    const size = this.fontSize * this.style.scale;
    const lines = this.height > 0 ? Math.max(1, Math.min(this.maxLines, Math.floor(this.height * 0.45 / (size * 1.4)))) : this.maxLines;
    const params = new PiPSubtitleParams(this.value, size, lines, this.bottom, this.style);
    params.frame = this.frame;
    params.bounds = this.frame ? styledSubtitleBounds(this.frame, this.width, this.height, false) : undefined;
    return params;
  }
  private reportFailure(): void { if (!this.failed) { this.failed = true; this.failure(); } }

  makeNode(context: UIContext): FrameNode | null {
    if (this.closed) { return null; }
    if (!context) { this.reportFailure(); return null; }
    // A new container may belong to a different window instance, even when reusing PiPController.
    if (!this.releaseNode()) { return null; }
    try {
      this.context = context; this.node = new BuilderNode<[PiPSubtitleParams]>(context);
      this.node.build(wrapBuilder(pipSubtitleBuilder), this.params());
      const frame = this.node.getFrameNode();
      if (!frame) { throw new Error('subtitle_node_unavailable'); }
      this.stopCaptions = SystemCaptions.observe((state) => { if (!this.closed && this.node) { const style = captionRenderStyle(state.config, '#AA000000'); if (JSON.stringify(style) !== JSON.stringify(this.style)) { this.style = style; this.update(); } } });
      this.failed = false; return frame;
    } catch (e) { this.reportFailure(); this.releaseNode(); return null; }
  }

  setText(value: string): void {
    if (this.closed || value === this.value) { return; }
    this.value = value; this.update();
  }

  setFrame(frame: StyledSubtitleFrame | undefined): void {
    if (this.closed || frame === this.frame) { return; }
    this.frame = frame; this.update();
  }

  aboutToResize(size: Size): void {
    if (this.closed || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) { return; }
    const previousHeight = this.height; const previousWidth = this.width; this.height = size.height; this.width = size.width;
    const fontSize = Math.max(10, Math.min(18, Math.round(size.width * 0.05)));
    const maxLines = Math.max(1, Math.min(4, Math.floor(size.height * 0.45 / (fontSize * 1.4))));
    const bottom = Math.max(6, Math.min(12, Math.round(size.height * 0.05)));
    if (fontSize === this.fontSize && maxLines === this.maxLines && bottom === this.bottom && previousHeight === size.height && previousWidth === size.width) { return; }
    this.fontSize = fontSize; this.maxLines = maxLines; this.bottom = bottom; this.update();
  }

  private update(): void {
    const node = this.node; const context = this.context;
    if (!node || !context) { return; }
    try { context.runScopedTask(() => { node.update(this.params()); }); this.failed = false; }
    catch (e) { this.reportFailure(); }
  }

  aboutToDisappear(): void { this.releaseNode(); }

  private releaseNode(): boolean {
    this.stopCaptions?.(); this.stopCaptions = undefined;
    try { this.node?.dispose(); this.node = undefined; this.context = undefined; return true; }
    catch (e) { this.reportFailure(); return false; }
  }

  dispose(): void {
    if (!this.closed) { this.setText(''); this.setFrame(undefined); this.closed = true; }
    this.value = ''; this.frame = undefined; this.releaseNode();
  }
}
