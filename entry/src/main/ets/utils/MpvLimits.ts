// Shared MPV bridge boundaries. Native entrypoints still validate independently;
// native-mpv-entry and mpv-engine regressions use independent boundary expectations.
export class MpvBridgeLimits {
  static readonly minPlatformApi: number = 15;
  static readonly maxSurfaceDimensionPx: number = 8192;
}
