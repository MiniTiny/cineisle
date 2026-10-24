// Optional Intro Skipper budgets, shared by cache truncation and read validation.
export class IntroLimits {
  static readonly maxCacheEntries: number = 512;
  static readonly maxResponseCodeUnits: number = 16384;
}
export interface IntroSegment { start: number; end: number; show: number; hide: number }
export interface IntroEntry { id: string; segment: IntroSegment; touched: number }
export interface IntroTicket { result: Promise<IntroSegment | undefined>; cancel: () => void }
interface IntroWire { IntroStart: number; IntroEnd: number; ShowSkipPromptAt: number; HideSkipPromptAt: number }
const maximum = 48 * 60 * 60 * 1000;
export function validIntro(value: IntroSegment): boolean {
  return !!value && [value.start, value.end, value.show, value.hide].every((n: number) => Number.isSafeInteger(n) && n >= 0 && n <= maximum) &&
    value.end > value.start && value.hide > value.show && value.show < value.end;
}
export function introFromJson(source: string): IntroSegment | undefined {
  if (!source || source.length > IntroLimits.maxResponseCodeUnits) { return undefined; }
  try {
    const value = JSON.parse(source) as IntroWire;
    if (!value || Array.isArray(value) || [value.IntroStart, value.IntroEnd, value.ShowSkipPromptAt, value.HideSkipPromptAt].some((n: number) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n * 1000 > maximum)) { return undefined; }
    const segment: IntroSegment = { start: Math.round(value.IntroStart * 1000), end: Math.round(value.IntroEnd * 1000), show: Math.round(value.ShowSkipPromptAt * 1000), hide: Math.round(value.HideSkipPromptAt * 1000) };
    return validIntro(segment) ? segment : undefined;
  } catch (e) { return undefined; }
}
export function validIntroEntries(entries: IntroEntry[]): boolean {
  const ids = new Set<string>();
  return Array.isArray(entries) && entries.length <= IntroLimits.maxCacheEntries && entries.every((entry: IntroEntry) => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(entry.id) || ids.has(entry.id) || !validIntro(entry.segment) || !Number.isSafeInteger(entry.touched) || entry.touched < 0) { return false; }
    ids.add(entry.id); return true;
  });
}
export function introTarget(segment: IntroSegment | undefined, position: number, duration: number): number | undefined {
  return segment && validIntro(segment) && Number.isFinite(position) && Number.isFinite(duration) && segment.end < duration && position >= 0 &&
    position > segment.show && position < Math.min(segment.hide, segment.end) ? segment.end : undefined;
}
