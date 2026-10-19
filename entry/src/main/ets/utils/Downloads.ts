export interface DownloadNetwork { mobile: boolean; roaming: boolean }
export function validDownloadNetwork(value: DownloadNetwork): boolean {
  return !!value && typeof value.mobile === 'boolean' && typeof value.roaming === 'boolean';
}
export function downloadNetwork(mobile: boolean = false, roaming: boolean = false): DownloadNetwork {
  return { mobile: mobile, roaming: mobile && roaming };
}
