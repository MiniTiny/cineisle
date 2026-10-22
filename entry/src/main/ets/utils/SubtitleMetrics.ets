import text from '@ohos.graphics.text';
import { UIContext } from '@ohos.arkui.UIContext';
import { SubtitleRun, SubtitleBaseline } from './InlineSubtitle';
import { CaptionRenderStyle } from './CaptionStyle';

// Scoped to one caption view. Pixel size is part of the key, including the owning window's fp scale.
export class SubtitleMetrics {
  private ascents: Map<string, number> = new Map<string, number>();

  offset(run: SubtitleRun, style: CaptionRenderStyle, baseSize: number, context: UIContext, fontScale?: number): number {
    let offset = 0;
    for (const step of run.baselines ?? []) {
      const size = style.system ? context.vp2px(baseSize * step.sizeScale) : fontScale === undefined ? context.fp2px(baseSize * step.sizeScale) : context.vp2px(baseSize * step.sizeScale * fontScale);
      offset += step.direction * Math.trunc(this.ascent(step, step.family || style.family, size) / 2);
    }
    return offset;
  }

  private ascent(step: SubtitleBaseline, family: string, size: number): number {
    const key = JSON.stringify([family, size, step.bold, step.italic]);
    const known = this.ascents.get(key);
    if (known !== undefined) { return known; }
    const builder = new text.ParagraphBuilder({}, text.FontCollection.getGlobalInstance());
    builder.pushStyle({ fontSize: size, fontFamilies: family.split(',').map((value: string): string => value.trim()),
      fontWeight: step.bold ? text.FontWeight.W700 : text.FontWeight.W400,
      fontStyle: step.italic ? text.FontStyle.ITALIC : text.FontStyle.NORMAL });
    builder.addText('M'); builder.popStyle();
    const paragraph = builder.build(); paragraph.layoutSync(100000);
    const metrics = Array.from(paragraph.getLineMetrics()[0].runMetrics.values())[0].fontMetrics;
    const ascent = -metrics.ascent;
    if (!Number.isFinite(ascent) || ascent <= 0) { throw new Error('subtitle_failed'); }
    if (this.ascents.size >= 128) { this.ascents.clear(); }
    this.ascents.set(key, ascent);
    return ascent;
  }
}
