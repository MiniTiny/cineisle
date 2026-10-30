export interface NativeAssHandle { readonly native: boolean }
export interface NativeAssFrame {
  changed: boolean;
  present: boolean;
  canvasWidth: number;
  canvasHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
  rgba: ArrayBuffer;
}
export const create: (document: string, defaultFont: string, defaultFamily: string,
  fontConfiguration?: string) => Promise<NativeAssHandle>;
export const render: (handle: NativeAssHandle, milliseconds: number, width: number, height: number,
  videoWidth: number, videoHeight: number) => Promise<NativeAssFrame>;
export const close: (handle: NativeAssHandle) => void;

export interface NativeCaptionRun {
  text: string; family: string; size: number; baseline: number; color: number; background?: number;
  bold: boolean; italic: boolean; underline: boolean; strike: boolean;
}
export interface NativeCaptionShadow { color: number; x: number; y: number; radius: number; }
export interface NativeCaptionParagraphSpan { start: number; end: number; kind: 'start' | 'center' | 'end' | 'bullet' | 'quote'; }
export interface NativeCaptionParagraphStyle { size: number; color: number; }
export interface NativeCaptionRequest {
  revision?: string;
  paragraphs?: NativeCaptionParagraphSpan[];
  paragraphStyle?: NativeCaptionParagraphStyle;
  width: number; maxLines: number; intrinsic: boolean; runs: NativeCaptionRun[]; shadows: NativeCaptionShadow[];
}
export interface NativeCaptionFrame {
  width: number; height: number; layoutWidth: number; layoutHeight: number; halo: number; rgba: ArrayBuffer;
}
export const renderCaption: (request: NativeCaptionRequest) => Promise<NativeCaptionFrame>;
