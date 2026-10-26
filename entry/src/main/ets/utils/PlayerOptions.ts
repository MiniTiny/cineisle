// Product preference rules, shared by persistence validation and display controls.
export class PlayerOptionRules {
  static readonly minSeekMs: number = 1000;
  static readonly maxSeekMs: number = 300000;
  static readonly seekStepMs: number = 1000;
  static readonly systemBrightness: number = -1;
  static readonly minBrightness: number = 0.05;
  static readonly maxBrightness: number = 1;
  static readonly minDimOpacity: number = 0.1;
  static readonly maxDimOpacity: number = 0.9;
  static readonly defaultDimOpacity: number = 0.6;
  static validSeekRange(value: number): boolean {
    return Number.isSafeInteger(value) && value >= PlayerOptionRules.minSeekMs && value <= PlayerOptionRules.maxSeekMs;
  }
  static validSeekStep(value: number): boolean { return value % PlayerOptionRules.seekStepMs === 0; }
  static validBrightness(value: number): boolean {
    return value === PlayerOptionRules.systemBrightness || (Number.isFinite(value) && value >= PlayerOptionRules.minBrightness && value <= PlayerOptionRules.maxBrightness);
  }
  static validDimOpacity(value: number): boolean {
    return Number.isFinite(value) && value >= PlayerOptionRules.minDimOpacity && value <= PlayerOptionRules.maxDimOpacity;
  }
}

export class PlayerOptions {
  trickplay?: boolean;
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
  brightness?: number = PlayerOptionRules.systemBrightness;
  dimOpacity?: number = PlayerOptionRules.defaultDimOpacity;
}
export function validPlayerOptions(value: PlayerOptions): boolean {
  return !!value && (value.trickplay === undefined || typeof value.trickplay === 'boolean') && (value.introSkipper === undefined || typeof value.introSkipper === 'boolean') && [value.gestures, value.seek, value.zoom, value.startMaximized, value.autoPiP].every((v: boolean) => typeof v === 'boolean') &&
    [value.back, value.forward].every((v: number) => PlayerOptionRules.validSeekRange(v) && PlayerOptionRules.validSeekStep(v)) &&
    (value.vertical === undefined || typeof value.vertical === 'boolean') && (value.rememberBrightness === undefined || typeof value.rememberBrightness === 'boolean') &&
    (value.brightness === undefined || PlayerOptionRules.validBrightness(value.brightness)) &&
    (value.dimOpacity === undefined || PlayerOptionRules.validDimOpacity(value.dimOpacity));
}
export function playerOptions(value?: PlayerOptions): PlayerOptions {
  const result = value && validPlayerOptions(value) ? JSON.parse(JSON.stringify(value)) as PlayerOptions : new PlayerOptions();
  const defaults = new PlayerOptions();
  result.trickplay = result.trickplay ?? true;
  result.introSkipper = result.introSkipper ?? true;
  result.vertical = result.vertical ?? defaults.vertical; result.rememberBrightness = result.rememberBrightness ?? defaults.rememberBrightness;
  result.brightness = result.brightness ?? defaults.brightness; result.dimOpacity = result.dimOpacity ?? defaults.dimOpacity;
  return result;
}
