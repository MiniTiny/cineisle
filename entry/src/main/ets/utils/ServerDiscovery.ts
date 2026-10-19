import url from '@ohos.url';
import util from '@ohos.util';
import { normalizeServer } from './Protocol';

export interface DiscoveredServer { id: string; name: string; address: string }
export interface DiscoveryResult { servers: DiscoveredServer[]; limited: boolean }
export interface DiscoveryEvent { type: string; servers?: DiscoveredServer[]; limited?: boolean; code?: string }
interface DiscoveryPacket { Id: string; Name: string; Address: string }
export const discoveryDuration: number = 8000;
export const discoveryServerLimit: number = 16;
export const discoveryPacketLimit: number = 64;

export function discoveryAddress(value: string): string {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) { throw new Error('invalid_server'); }
  const parsed = new url.URL(normalizeServer(value));
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) { throw new Error('invalid_server'); }
  return parsed.toString().replace(/\/+$/, '');
}

// UDP announcements are untrusted hints; never start HTTP requests or copy credentials here.
export function discoveryPacket(message: ArrayBuffer): DiscoveredServer | undefined {
  if (!message || message.byteLength === 0 || message.byteLength > 8192) { return undefined; }
  try {
    const source = new util.TextDecoder('utf-8', { fatal: true }).decodeToString(new Uint8Array(message));
    const value = JSON.parse(source) as DiscoveryPacket;
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.Id !== 'string' ||
      !/^[a-zA-Z0-9-]{1,128}$/.test(value.Id) || typeof value.Name !== 'string' || typeof value.Address !== 'string') { return undefined; }
    const address = discoveryAddress(value.Address);
    const name = value.Name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 128) || address;
    return { id: value.Id, name: name, address: address };
  } catch (e) { return undefined; }
}
