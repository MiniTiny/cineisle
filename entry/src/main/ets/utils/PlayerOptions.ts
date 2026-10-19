export class PlayerOptions {
  gestures: boolean = true;
  seek: boolean = true;
  zoom: boolean = true;
  startMaximized: boolean = false;
  back: number = 5000;
  forward: number = 15000;
  autoPiP: boolean = false;
}
export function validPlayerOptions(value: PlayerOptions): boolean {
  return !!value && [value.gestures, value.seek, value.zoom, value.startMaximized, value.autoPiP].every((v: boolean) => typeof v === 'boolean') &&
    [value.back, value.forward].every((v: number) => Number.isSafeInteger(v) && v >= 1000 && v <= 300000 && v % 1000 === 0);
}
export function playerOptions(value?: PlayerOptions): PlayerOptions {
  return value && validPlayerOptions(value) ? JSON.parse(JSON.stringify(value)) as PlayerOptions : new PlayerOptions();
}
