// Jellyscrub BIF v0 contract from the fixed Android baseline. Bytes stay compressed until scrubbing.
export const BIF_LIMIT = 16 * 1024 * 1024;
export interface BifFrame { time: number; offset: number; end: number }
export interface BifData { bytes: ArrayBuffer; frames: BifFrame[] }
export interface BifTicket { result: Promise<BifData | undefined>; cancel: () => void }
export interface BifTransfer { result: Promise<ArrayBuffer | undefined>; cancel: () => void }
export function bifWidth(json: string): number | undefined {
  try {
    if (json.length > 16384) { return undefined; }
    const value = JSON.parse(json) as BifManifest;
    if (!value || typeof value.Version !== 'string' || !value.Version.length || value.Version.length > 64 || !Array.isArray(value.WidthResolutions) || !value.WidthResolutions.length || value.WidthResolutions.length > 32 ||
      !value.WidthResolutions.every((w: number) => Number.isInteger(w) && w >= 32 && w <= 1920)) { return undefined; }
    const bounded = value.WidthResolutions.filter((w: number) => w <= 640);
    return bounded.length ? Math.max(...bounded) : Math.min(...value.WidthResolutions);
  } catch (e) { return undefined; }
}
interface BifManifest { Version: string; WidthResolutions: number[] }
export function parseBif(bytes: ArrayBuffer): BifData | undefined {
  try {
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 76 || bytes.byteLength > BIF_LIMIT) { return undefined; }
    const raw = new Uint8Array(bytes); const magic = [137, 66, 73, 70, 13, 10, 26, 10];
    if (!magic.every((v: number, i: number) => raw[i] === v)) { return undefined; }
    const view = new DataView(bytes); const count = view.getUint32(12, true); const multiplier = view.getUint32(16, true) || 1000;
    const tableEnd = 64 + count * 8;
    if (view.getUint32(8, true) !== 0 || count < 1 || count > 4096 || tableEnd + 4 > bytes.byteLength) { return undefined; }
    const first = view.getUint32(68, true); let payloadEnd = bytes.byteLength;
    // Some encoders append a terminal index slot; the baseline also accepts last-frame-to-EOF files.
    if (first >= tableEnd + 8 && view.getUint32(tableEnd, true) === 0xffffffff) {
      payloadEnd = view.getUint32(tableEnd + 4, true); if (payloadEnd !== bytes.byteLength) { return undefined; }
    }
    const frames: BifFrame[] = [];
    for (let i = 0; i < count; i++) {
      const time = view.getUint32(64 + i * 8, true) * multiplier;
      const offset = view.getUint32(68 + i * 8, true); const end = i + 1 < count ? view.getUint32(76 + i * 8, true) : payloadEnd;
      if (!Number.isSafeInteger(time) || time > 172800000 || (i > 0 && time <= frames[i - 1].time) || offset < tableEnd || end <= offset || end > bytes.byteLength || end - offset > 524288 ||
        raw[offset] !== 255 || raw[offset + 1] !== 216 || raw[end - 2] !== 255 || raw[end - 1] !== 217) { return undefined; }
      frames.push({ time: time, offset: offset, end: end });
    }
    return { bytes: bytes, frames: frames };
  } catch (e) { return undefined; }
}
export function bifFrame(data: BifData, position: number, duration: number): BifFrame | undefined {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || position < 0 || duration <= 0 || position > duration || !data.frames.length || position < data.frames[0].time) { return undefined; }
  let low = 0; let high = data.frames.length - 1;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (data.frames[mid].time <= position) { low = mid; } else { high = mid - 1; } }
  return data.frames[low];
}
