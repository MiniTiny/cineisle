import { DynamicPalette } from './DynamicPalette';

export class UiPalette {
  dynamic: boolean = false;
  background: ResourceColor = $r('app.color.brand_background');
  surface: ResourceColor = $r('app.color.brand_surface');
  raised: ResourceColor = $r('app.color.brand_surface_raised');
  selected: ResourceColor = $r('app.color.brand_selected');
  accent: ResourceColor = $r('app.color.brand_accent');
  action: ResourceColor = $r('app.color.brand_action');
  muted: ResourceColor = $r('app.color.brand_muted');
  warm: ResourceColor = $r('app.color.brand_warm');
  danger: ResourceColor = $r('app.color.brand_danger');
  foreground: ResourceColor = '#F2F3FA';
  onAction: ResourceColor = '#F2F3FA';
  amoledBackground: ResourceColor = '#000000';
  // API 12 SVG colorFilter tints strokes without filling the original outline geometry.
  filter(color?: ResourceColor): ColorFilter | undefined {
    if (!this.dynamic || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) { return undefined; }
    const r = Number.parseInt(color.slice(1, 3), 16) / 255; const g = Number.parseInt(color.slice(3, 5), 16) / 255; const b = Number.parseInt(color.slice(5, 7), 16) / 255;
    return new ColorFilter([0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0]);
  }
}
export function uiPalette(value?: DynamicPalette): UiPalette {
  const palette = new UiPalette();
  if (value) { palette.dynamic = true; palette.background = value.background; palette.surface = value.surface; palette.raised = value.raised; palette.selected = value.selected; palette.accent = value.accent; palette.action = value.action; palette.muted = value.muted; palette.warm = value.warm; palette.danger = value.danger; }
  return palette;
}
