export interface WallpaperColor { red: number; green: number; blue: number; alpha: number }
export interface DynamicPalette { seed: string; background: string; surface: string; raised: string; selected: string; accent: string; action: string; muted: string; warm: string; danger: string }
function channels(color: string): number[] { return [1, 3, 5].map((i: number) => Number.parseInt(color.slice(i, i + 2), 16)); }
function hex(values: number[]): string { return '#' + values.map((n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function blend(a: string, b: string, weight: number): string { const from = channels(a); const to = channels(b); return hex(from.map((n: number, i: number) => n + (to[i] - n) * weight)); }
export function colorLuminance(color: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) { throw new Error('palette_color_invalid'); }
  const c = channels(color).map((n: number) => { const s = n / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
export function colorContrast(a: string, b: string): number { const x = colorLuminance(a); const y = colorLuminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function readable(foreground: string, backgrounds: string[]): string {
  let value = foreground;
  for (let i = 0; i < 32 && backgrounds.some((background: string) => colorContrast(value, background) < 4.5); ++i) { value = blend(value, '#FFFFFF', 0.12); }
  return value;
}
// CineIsle dark tones derived from system wallpaper RGB; not an Android Material/HCT implementation.
export function wallpaperPalette(colors: WallpaperColor[]): DynamicPalette | undefined {
  if (!Array.isArray(colors) || !colors.length || colors.length > 16) { return undefined; }
  const color = colors.find((c: WallpaperColor) => !!c && [c.red, c.green, c.blue, c.alpha].every((n: number) => Number.isInteger(n) && n >= 0 && n <= 255) && c.alpha === 255);
  if (!color) { return undefined; }
  const seed = hex([color.red, color.green, color.blue]);
  const background = blend('#080D12', seed, 0.035); const surface = blend('#101317', seed, 0.10); const raised = blend('#0F151B', seed, 0.06); const selected = blend(surface, seed, 0.15);
  const surfaces = [background, surface, raised, selected, '#000000', '#0D1924'];
  const accent = readable(blend(seed, '#FFFFFF', 0.72), surfaces); const muted = readable(blend(accent, '#718388', 0.30), surfaces);
  const warm = readable('#F4CF8B', surfaces); const danger = readable('#FF9F9F', surfaces);
  let action = blend('#061012', seed, 0.32);
  for (let i = 0; i < 32 && ['#F2F3FA', accent, muted, warm, danger].some((fg: string) => colorContrast(fg, action) < 4.5); ++i) { action = blend(action, '#000000', 0.12); }
  return { seed: seed, background: background, surface: surface, raised: raised, selected: selected, accent: accent, action: action, muted: muted, warm: warm, danger: danger };
}
