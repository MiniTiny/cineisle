// Viewport dimensions are vp; text scale follows the application configuration.
export interface VideoFrame { width: number; height: number }
export class UiLayout {
  static scale(value: number | undefined): number { return value !== undefined && Number.isFinite(value) && value > 0 ? Math.min(3.2, Math.max(1, value)) : 1; }
  static buttonHeight(scale: number): number { return 40 * UiLayout.scale(scale); }
  static headerHeight(scale: number): number { return Math.max(56, UiLayout.buttonHeight(scale) + 8); }
  static navHeight(scale: number): number { return Math.max(80, 50 + 16 * UiLayout.scale(scale)); }
  static columns(width: number, scale: number): string {
    const available = Number.isFinite(width) && width > 0 ? width : 360;
    const count = Math.max(1, Math.min(6, Math.floor((available - 20) / (100 * UiLayout.scale(scale) + 12))));
    return Array.from({ length: count }, () => '1fr').join(' ');
  }
  static separateFilters(height: number, landscape: boolean): boolean { return !landscape || height >= 440; }
  static filters(height: number, scale: number): number { return Math.min(210 * UiLayout.scale(scale), Math.max(44, (height - UiLayout.headerHeight(scale) - UiLayout.navHeight(scale) - 48) * 0.45)); }
  static playerControls(height: number, scale: number, options: boolean): number { return Math.min(Math.max(48, (height - UiLayout.headerHeight(scale) - 36) * 0.6), (options ? 380 : 150) * UiLayout.scale(scale)); }
  static videoFrame(width: number, height: number, aspect: number): VideoFrame {
    const w = Number.isFinite(width) && width > 0 ? width : 1;
    const h = Number.isFinite(height) && height > 0 ? height : 1;
    const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
    const fittedWidth = Math.min(w, h * ratio);
    return { width: fittedWidth, height: fittedWidth / ratio };
  }
  static shelfWidth(width: number, wide: boolean, scale: number = 1): number { return Math.min(wide ? 240 : 120 * UiLayout.scale(scale), Math.max(100, width - 40)); }
  static shelfHeight(width: number, scale: number, wide: boolean): number {
    return UiLayout.shelfWidth(width, wide, scale) * (wide ? 9 / 16 : 3 / 2) + (wide ? 84 : 64) * UiLayout.scale(scale) + 12;
  }
}
