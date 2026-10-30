// Paragraph spans use UTF-16 ranges, independently of inline font/style runs.
export type SubtitleParagraphKind = 'start' | 'center' | 'end' | 'bullet' | 'quote';

export class SubtitleParagraphLimits {
  static readonly maximumSpansPerCue: number = 4096;
  static readonly maximumActiveSpans: number = 4096;
}

export class SubtitleParagraphSpan {
  constructor(public start: number, public end: number, public kind: SubtitleParagraphKind) {}
}

export const EMPTY_SUBTITLE_PARAGRAPHS: SubtitleParagraphSpan[] = [];

export function shiftSubtitleParagraphs(spans: SubtitleParagraphSpan[], offset: number): SubtitleParagraphSpan[] {
  return spans.map((span: SubtitleParagraphSpan): SubtitleParagraphSpan =>
    new SubtitleParagraphSpan(span.start + offset, span.end + offset, span.kind));
}
