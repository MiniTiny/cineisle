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
