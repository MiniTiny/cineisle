export type MpvHardware = 'no' | 'ohcodec' | 'ohcodec-copy';
export type MpvVideo = 'gpu-next' | 'gpu';
export interface MpvOptions { hwdec: MpvHardware; vo: MpvVideo }
export const MPV_HARDWARE_MODES: MpvHardware[] = ['no', 'ohcodec', 'ohcodec-copy'];
export const MPV_VIDEO_OUTPUTS: MpvVideo[] = ['gpu-next', 'gpu'];
export function defaultMpvOptions(): MpvOptions { return { hwdec: 'ohcodec', vo: 'gpu-next' }; }
export function validMpvOptions(value: MpvOptions): boolean {
  if (!value) { return false; }
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('hwdec') && keys.includes('vo') && MPV_HARDWARE_MODES.includes(value.hwdec) && MPV_VIDEO_OUTPUTS.includes(value.vo);
}
export function copyMpvOptions(value: MpvOptions): MpvOptions { return { hwdec: value.hwdec, vo: value.vo }; }
export function decodeMpvOptions(raw: string): MpvOptions | undefined {
  if (raw === '') { return defaultMpvOptions(); }
  if (raw.length > 1024) { return undefined; }
  try { const value = JSON.parse(raw) as MpvOptions; return validMpvOptions(value) ? copyMpvOptions(value) : undefined; }
  catch (_) { return undefined; }
}
export function mpvHardwareCaption(value: MpvHardware): string {
  return value === 'no' ? 'mpv_hardware_software' : value === 'ohcodec-copy' ? 'mpv_hardware_copy' : 'mpv_hardware_ohcodec';
}
