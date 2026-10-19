export class PlayerOptions {
  introSkipper?: boolean;
  gestures: boolean = true;
  seek: boolean = true;
  zoom: boolean = true;
  startMaximized: boolean = false;
  back: number = 5000;
  forward: number = 15000;
  autoPiP: boolean = false;
  vertical?: boolean = true;
  rememberBrightness?: boolean = false;
  brightness?: number = -1;
  dimOpacity?: number = 0.6;
}
export function validPlayerOptions(value: PlayerOptions): boolean {
  return !!value && (value.introSkipper === undefined || typeof value.introSkipper === 'boolean') && [value.gestures, value.seek, value.zoom, value.startMaximized, value.autoPiP].every((v: boolean) => typeof v === 'boolean') &&
    [value.back, value.forward].every((v: number) => Number.isSafeInteger(v) && v >= 1000 && v <= 300000 && v % 1000 === 0) &&
    (value.vertical === undefined || typeof value.vertical === 'boolean') && (value.rememberBrightness === undefined || typeof value.rememberBrightness === 'boolean') &&
    (value.brightness === undefined || value.brightness === -1 || (Number.isFinite(value.brightness) && value.brightness >= 0.05 && value.brightness <= 1)) &&
    (value.dimOpacity === undefined || (Number.isFinite(value.dimOpacity) && value.dimOpacity >= 0.1 && value.dimOpacity <= 0.9));
}
export function playerOptions(value?: PlayerOptions): PlayerOptions {
  const result = value && validPlayerOptions(value) ? JSON.parse(JSON.stringify(value)) as PlayerOptions : new PlayerOptions();
  result.introSkipper = result.introSkipper ?? true;
  result.vertical = result.vertical ?? true; result.rememberBrightness = result.rememberBrightness ?? false;
  result.brightness = result.brightness ?? -1; result.dimOpacity = result.dimOpacity ?? 0.6;
  return result;
}
