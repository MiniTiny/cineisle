export class PosterOptions { enabled: boolean = true; maxMb: number = 20; }
export interface PosterTarget { id: string; tag?: string; backdrop: boolean; width: number }
export interface PosterData { key: string; bytes: ArrayBuffer }
export interface PosterTicket { result: Promise<PosterData>; cancel: () => void }
export interface PosterTransfer { result: Promise<ArrayBuffer>; cancel: () => void }
export function validPosterOptions(value: PosterOptions): boolean {
  return !!value && typeof value.enabled === 'boolean' && Number.isInteger(value.maxMb) && value.maxMb >= 1 && value.maxMb <= 200;
}
export function validPosterTarget(value: PosterTarget): boolean {
  return /^[a-zA-Z0-9-]{1,128}$/.test(value.id) && (value.tag === undefined || (typeof value.tag === 'string' && value.tag.length <= 256 && !/[\u0000-\u001f]/.test(value.tag))) &&
    [160, 480, 1280].includes(value.width) && typeof value.backdrop === 'boolean';
}
export function rasterImage(bytes: ArrayBuffer): boolean {
  const b = new Uint8Array(bytes);
  return (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) ||
    (b.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n: number, i: number) => b[i] === n)) ||
    (b.length >= 12 && b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80);
}
export const posterByteLimit: number = 2 * 1024 * 1024;
