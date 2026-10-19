export type CaptionColor = number | string;
export class CaptionConfig {
  enabled: boolean = false;
  fontScale: number = 100;
  family: string = 'default';
  foreground: CaptionColor = '#FFFFFFFF';
  background: CaptionColor = '#99000000';
  window: CaptionColor = '#00000000';
  edge: string = 'none';
}
export class CaptionSnapshot {
  available: boolean = false;
  config: CaptionConfig = new CaptionConfig();
  issue: string = 'caption_unavailable';
}
export class CaptionRenderStyle {
  system: boolean = false;
  scale: number = 1;
  foreground: CaptionColor = '#FFFFFFFF';
  background: CaptionColor = '#99000000';
  window: CaptionColor = '#00000000';
  family: string = 'sans-serif';
  edge: string = 'none';
}
export const CAPTION_FAMILIES: string[] = ['default', 'monospacedSerif', 'serif', 'monospacedSansSerif', 'sansSerif', 'casual', 'cursive', 'smallCapitals'];
export const CAPTION_EDGES: string[] = ['none', 'raised', 'depressed', 'uniform', 'dropShadow'];
// Native caption getters return ArkUI color strings. Preserve their channel order; do not convert them as CSS RGBA.
export function captionColor(value: CaptionColor): string | undefined {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < -2147483648 || value > 4294967295) { return undefined; }
    return '#' + (value >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value.toUpperCase() : undefined;
}
export function validCaptionConfig(value: CaptionConfig): boolean {
  return !!value && typeof value.enabled === 'boolean' && Number.isFinite(value.fontScale) && value.fontScale >= 1 && value.fontScale <= 200 &&
    CAPTION_FAMILIES.includes(value.family) && CAPTION_EDGES.includes(value.edge) && captionColor(value.foreground) !== undefined &&
    captionColor(value.background) !== undefined && captionColor(value.window) !== undefined;
}
export function copyCaptionConfig(value: CaptionConfig): CaptionConfig {
  const copy = new CaptionConfig(); copy.enabled = value.enabled; copy.fontScale = value.fontScale; copy.family = value.family;
  copy.foreground = captionColor(value.foreground) ?? '#FFFFFFFF'; copy.background = captionColor(value.background) ?? '#99000000';
  copy.window = captionColor(value.window) ?? '#00000000'; copy.edge = value.edge; return copy;
}
export function sameCaptionConfig(one: CaptionConfig, two: CaptionConfig): boolean {
  return one.enabled === two.enabled && one.fontScale === two.fontScale && one.family === two.family && one.edge === two.edge &&
    captionColor(one.foreground) === captionColor(two.foreground) && captionColor(one.background) === captionColor(two.background) && captionColor(one.window) === captionColor(two.window);
}
export function captionRenderStyle(config: CaptionConfig, background: string = '#99000000'): CaptionRenderStyle {
  const style = new CaptionRenderStyle(); style.background = background;
  if (!validCaptionConfig(config) || !config.enabled) { return style; }
  style.system = true;
  style.scale = config.fontScale / 100; style.foreground = captionColor(config.foreground)!; style.background = captionColor(config.background)!;
  style.window = captionColor(config.window)!; style.edge = config.edge;
  const families: string[] = ['sans-serif', 'serif-monospace', 'serif', 'monospace', 'sans-serif', 'casual', 'cursive', 'sans-serif-smallcaps'];
  style.family = families[CAPTION_FAMILIES.indexOf(config.family)]; return style;
}
