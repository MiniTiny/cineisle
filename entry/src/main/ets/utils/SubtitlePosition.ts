// SubRip/Media3 fractional view anchors. Explicit cues do not participate in default control avoidance.
export function subtitleColumn(alignment: number): number { return (alignment - 1) % 3; }
export function subtitleRow(alignment: number): number { return 2 - Math.floor((alignment - 1) / 3); }
export function subtitleFraction(anchor: number): number { return anchor === 0 ? 0.08 : anchor === 2 ? 0.92 : 0.5; }
export function subtitleTop(alignment: number, height: number, measured: number): number {
  const row = subtitleRow(alignment);
  return Math.max(0, Math.min(Math.max(0, height - measured), height * subtitleFraction(row) - measured * row / 2));
}
