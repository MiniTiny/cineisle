import image from '@ohos.multimedia.image';

export interface StyledSubtitleFrame {
  bitmap: image.PixelMap;
  canvasWidth: number;
  canvasHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface StyledSubtitleSession {
  render(milliseconds: number, videoWidth: number, videoHeight: number): void;
  clear(): void;
  close(): void;
}
export interface StyledSubtitleBounds { left: number; top: number; width: number; height: number }

export function styledSubtitleBounds(frame: StyledSubtitleFrame, width: number, height: number, cover: boolean): StyledSubtitleBounds | undefined {
  if (![width, height, frame.canvasWidth, frame.canvasHeight, frame.width, frame.height].every((n: number) => Number.isFinite(n) && n > 0)) {
    return undefined;
  }
  const scale = cover ? Math.max(width / frame.canvasWidth, height / frame.canvasHeight) : Math.min(width / frame.canvasWidth, height / frame.canvasHeight);
  return { left: (width - frame.canvasWidth * scale) / 2 + frame.left * scale,
    top: (height - frame.canvasHeight * scale) / 2 + frame.top * scale, width: frame.width * scale, height: frame.height * scale };
}
