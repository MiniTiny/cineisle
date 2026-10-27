// Jellyfin positions use 100 ns ticks. Keep the second and millisecond units tied to one tick scale.
export class JellyfinTime {
  static readonly ticksPerMillisecond: number = 10000;
  static readonly millisecondsPerSecond: number = 1000;
  static readonly ticksPerSecond: number = JellyfinTime.ticksPerMillisecond * JellyfinTime.millisecondsPerSecond;
}
