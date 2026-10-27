// Product choices are independent of SDK enum values and native decoder speed bounds.
export enum PlaybackRate {
  Half = 0.5,
  ThreeQuarters = 0.75,
  Normal = 1,
  OneAndQuarter = 1.25,
  OneAndHalf = 1.5,
  OneAndThreeQuarters = 1.75,
  Double = 2
}
export function playbackRates(): number[] {
  return [PlaybackRate.Half, PlaybackRate.ThreeQuarters, PlaybackRate.Normal, PlaybackRate.OneAndQuarter,
    PlaybackRate.OneAndHalf, PlaybackRate.OneAndThreeQuarters, PlaybackRate.Double];
}
export function isPlaybackRate(value: number): boolean {
  return playbackRates().includes(value);
}
export function normalizePlaybackRate(value: number): number {
  return isPlaybackRate(value) ? value : PlaybackRate.Normal;
}
