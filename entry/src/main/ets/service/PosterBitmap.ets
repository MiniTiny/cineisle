import image from '@ohos.multimedia.image';

interface DecodeJob { bytes: ArrayBuffer; width: number; allowed: () => boolean; resolve: (value: image.PixelMap) => void; reject: (error: Error) => void }
let active = 0;
const waiting: DecodeJob[] = [];
export function decodePoster(bytes: ArrayBuffer, width: number, allowed: () => boolean): Promise<image.PixelMap> {
  return new Promise<image.PixelMap>((resolve, reject) => {
    if (waiting.length >= 64 || !allowed()) { reject(new Error('poster_cancelled')); return; }
    waiting.push({ bytes: bytes, width: width, allowed: allowed, resolve: resolve, reject: reject }); drain();
  });
}
function drain(): void {
  while (active < 3 && waiting.length) { const job = waiting.shift()!; if (!job.allowed()) { job.reject(new Error('poster_cancelled')); continue; } ++active; run(job); }
}
async function run(job: DecodeJob): Promise<void> {
  let source: image.ImageSource | undefined; let bitmap: image.PixelMap | undefined;
  try {
    source = image.createImageSource(job.bytes); const info = await source.getImageInfo();
    const w = info.size.width; const h = info.size.height;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || w > 32768 || h > 32768 || w * h > 16000000) { throw new Error('poster_invalid'); }
    if (!job.allowed()) { throw new Error('poster_cancelled'); }
    const scale = Math.min(1, job.width / w, job.width * 2 / h);
    bitmap = await source.createPixelMap({ desiredSize: { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) }, editable: false });
    if (!job.allowed()) { throw new Error('poster_cancelled'); }
    job.resolve(bitmap); bitmap = undefined;
  } catch (e) { if (bitmap) { await bitmap.release().catch(() => {}); } job.reject(e as Error); }
  finally { try { await source?.release(); } catch (e) { /* Native decoder already released. */ } --active; drain(); }
}
