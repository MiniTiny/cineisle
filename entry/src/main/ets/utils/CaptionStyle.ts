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
// Native caption scale is a percentage; fractional values remain valid.
export class CaptionScaleRules {
  static readonly minimumPercent: number = 1;
  static readonly maximumPercent: number = 200;
  static valid(value: number): boolean {
    return Number.isFinite(value) && value >= CaptionScaleRules.minimumPercent && value <= CaptionScaleRules.maximumPercent;
  }
}
export function captionPreset(yellow: boolean): CaptionConfig {
  const config = new CaptionConfig(); config.enabled = true;
  if (yellow) { config.foreground = '#FFFFFF00'; }
  return config;
}
export class CaptionSnapshot {
  available: boolean = false;
  config: CaptionConfig = new CaptionConfig();
  issue: string = 'caption_unavailable';
}
// Non-system subtitles retain a per-view backing, independent of native preference defaults.
const defaultSubtitleBackground: string = '#99000000';
export class CaptionRenderStyle {
  system: boolean = false;
  scale: number = 1;
  foreground: CaptionColor = '#FFFFFFFF';
  background: CaptionColor = defaultSubtitleBackground;
  window: CaptionColor = '#00000000';
  family: string = 'sans-serif';
  edge: string = 'none';
}
// Native values, display resources and render font aliases form one ordered choice contract.
export interface CaptionFamilyChoice { value: string; caption: string; renderFamily: string }
export interface CaptionEdgeChoice { value: string; caption: string }
export const CAPTION_FAMILY_CHOICES: CaptionFamilyChoice[] = [
  { value: 'default', caption: 'caption_family_default', renderFamily: 'sans-serif' },
  { value: 'monospacedSerif', caption: 'caption_family_mono_serif', renderFamily: 'serif-monospace' },
  { value: 'serif', caption: 'caption_family_serif', renderFamily: 'serif' },
  { value: 'monospacedSansSerif', caption: 'caption_family_mono_sans', renderFamily: 'monospace' },
  { value: 'sansSerif', caption: 'caption_family_sans', renderFamily: 'sans-serif' },
  { value: 'casual', caption: 'caption_family_casual', renderFamily: 'casual' },
  { value: 'cursive', caption: 'caption_family_cursive', renderFamily: 'cursive' },
  { value: 'smallCapitals', caption: 'caption_family_small_caps', renderFamily: 'sans-serif-smallcaps' },
];
export const CAPTION_EDGE_CHOICES: CaptionEdgeChoice[] = [
  { value: 'none', caption: 'caption_edge_none' },
  { value: 'raised', caption: 'caption_edge_raised' },
  { value: 'depressed', caption: 'caption_edge_depressed' },
  { value: 'uniform', caption: 'caption_edge_uniform' },
  { value: 'dropShadow', caption: 'caption_edge_shadow' },
];
export const CAPTION_FAMILIES: string[] = CAPTION_FAMILY_CHOICES.map((choice: CaptionFamilyChoice): string => choice.value);
export const CAPTION_EDGES: string[] = CAPTION_EDGE_CHOICES.map((choice: CaptionEdgeChoice): string => choice.value);
// Native caption getters return ArkUI color strings. Preserve their channel order; do not convert them as CSS RGBA.
export function captionColor(value: CaptionColor): string | undefined {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < -2147483648 || value > 4294967295) { return undefined; }
    return '#' + (value >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value.toUpperCase() : undefined;
}
export function validCaptionConfig(value: CaptionConfig): boolean {
  return !!value && typeof value.enabled === 'boolean' && CaptionScaleRules.valid(value.fontScale) &&
    CAPTION_FAMILIES.includes(value.family) && CAPTION_EDGES.includes(value.edge) && captionColor(value.foreground) !== undefined &&
    captionColor(value.background) !== undefined && captionColor(value.window) !== undefined;
}
export function copyCaptionConfig(value: CaptionConfig): CaptionConfig {
  const copy = new CaptionConfig(); copy.enabled = value.enabled; copy.fontScale = value.fontScale; copy.family = value.family;
  copy.foreground = captionColor(value.foreground) ?? copy.foreground; copy.background = captionColor(value.background) ?? copy.background;
  copy.window = captionColor(value.window) ?? copy.window; copy.edge = value.edge; return copy;
}
export function sameCaptionConfig(one: CaptionConfig, two: CaptionConfig): boolean {
  return one.enabled === two.enabled && one.fontScale === two.fontScale && one.family === two.family && one.edge === two.edge &&
    captionColor(one.foreground) === captionColor(two.foreground) && captionColor(one.background) === captionColor(two.background) && captionColor(one.window) === captionColor(two.window);
}
export function captionRenderStyle(config: CaptionConfig, background: string = defaultSubtitleBackground): CaptionRenderStyle {
  const style = new CaptionRenderStyle(); style.background = background;
  if (!validCaptionConfig(config) || !config.enabled) { return style; }
  style.system = true;
  style.scale = config.fontScale / 100; style.foreground = captionColor(config.foreground)!; style.background = captionColor(config.background)!;
  style.window = captionColor(config.window)!; style.edge = config.edge;
  const families: string[] = CAPTION_FAMILY_CHOICES.map((choice: CaptionFamilyChoice): string => choice.renderFamily);
  style.family = families[CAPTION_FAMILIES.indexOf(config.family)]; return style;
}
