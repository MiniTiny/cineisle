export interface OfflineStopState { position: number; played: boolean }

export function offlineStopState(position: number, duration: number): OfflineStopState | undefined {
  if (!Number.isFinite(position) || position < 0 || !Number.isFinite(duration) || duration < 1) { return undefined; }
  if (!Number.isSafeInteger(Math.round(position * 10000)) || !Number.isSafeInteger(Math.round(duration * 10000))) { return undefined; }
  // Match the frozen Android Long / Float expression, including integer truncation at 90.x%.
  const percentage = Math.trunc(Math.fround(Math.fround(Math.fround(position) / Math.fround(duration)) * 100));
  if (!Number.isFinite(percentage)) { return undefined; }
  return { position: percentage < 10 || percentage > 90 ? 0 : position, played: percentage > 90 };
}
