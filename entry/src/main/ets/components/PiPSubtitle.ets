import { NodeController, BuilderNode, FrameNode } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';

export class PiPSubtitleParams {
  text: string;
  fontSize: number;
  maxLines: number;
  bottom: number;
  constructor(text: string, fontSize: number, maxLines: number, bottom: number) {
    this.text = text; this.fontSize = fontSize; this.maxLines = maxLines; this.bottom = bottom;
  }
}

@Builder
function pipSubtitleBuilder(params: PiPSubtitleParams) {
  Stack({ alignContent: Alignment.Bottom }) {
    if (params.text) {
      Text(params.text).fontColor('#FFFFFF').fontSize(params.fontSize).textAlign(TextAlign.Center)
        .maxLines(params.maxLines).textOverflow({ overflow: TextOverflow.Ellipsis })
        .backgroundColor('#AA000000').borderRadius(4).padding({ left: 6, right: 6, top: 3, bottom: 3 })
        .margin({ bottom: params.bottom }).width('94%')
    }
  }.width('100%').height('100%').hitTestBehavior(HitTestMode.None)
}

// A PiP window has its own UIContext. Never attach the page's existing subtitle node here.
export class PiPSubtitleController extends NodeController {
  private node: BuilderNode<[PiPSubtitleParams]> | undefined = undefined;
  private context: UIContext | undefined = undefined;
  private value: string = '';
  private fontSize: number = 14;
  private maxLines: number = 4;
  private bottom: number = 8;
  private closed: boolean = false;
  private failed: boolean = false;
  private failure: () => void;

  constructor(failure: () => void) { super(); this.failure = failure; }
  get isReleased(): boolean { return this.node === undefined; }

  private params(): PiPSubtitleParams { return new PiPSubtitleParams(this.value, this.fontSize, this.maxLines, this.bottom); }
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
      this.failed = false; return frame;
    } catch (e) { this.reportFailure(); this.releaseNode(); return null; }
  }

  setText(value: string): void {
    if (this.closed || value === this.value) { return; }
    this.value = value; this.update();
  }

  aboutToResize(size: Size): void {
    if (this.closed || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) { return; }
    const fontSize = Math.max(10, Math.min(18, Math.round(size.width * 0.05)));
    const maxLines = Math.max(1, Math.min(4, Math.floor(size.height * 0.45 / (fontSize * 1.4))));
    const bottom = Math.max(6, Math.min(12, Math.round(size.height * 0.05)));
    if (fontSize === this.fontSize && maxLines === this.maxLines && bottom === this.bottom) { return; }
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
    try { this.node?.dispose(); this.node = undefined; this.context = undefined; return true; }
    catch (e) { this.reportFailure(); return false; }
  }

  dispose(): void {
    if (!this.closed) { this.setText(''); this.closed = true; }
    this.value = ''; this.releaseNode();
  }
}
