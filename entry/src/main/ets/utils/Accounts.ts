import { Session } from '../model/Models';
import { accountKey, normalizeServer } from './Protocol';
export interface ServerProfile { id: string; name: string; addresses: string[]; preferred: string }
export interface AccountSummary { key: string; serverId: string; userId: string; userName: string; serverName: string; address: string; active: boolean }
export interface AccountVault { version: number; servers: ServerProfile[]; accounts: Session[]; active: string }
export function emptyVault(): AccountVault { return { version: 2, servers: [], accounts: [], active: '' }; }
export function sessionKey(session: Session): string { return accountKey(session.serverId, session.userId); }
export function addresses(values: string[]): string[] {
  if (!Array.isArray(values) || !values.length || values.length > 8 || values.some((v: string) => typeof v !== 'string' || v.length > 2048)) { throw new Error('invalid_server'); }
  return Array.from(new Set(values.map(normalizeServer)));
}
export function validSession(session: Session): boolean {
  try {
    return !!session && typeof session.server === 'string' && normalizeServer(session.server) === session.server && !!sessionKey(session) &&
      typeof session.userName === 'string' && typeof session.deviceId === 'string' && !!session.deviceId && typeof session.token === 'string' && !!session.token &&
      !/["\r\n]/.test(session.token + session.deviceId);
  } catch (e) { return false; }
}
export function validateVault(vault: AccountVault): void {
  if (!vault || vault.version !== 2 || !Array.isArray(vault.servers) || !Array.isArray(vault.accounts) || vault.servers.length > 20 || vault.accounts.length > 40 || typeof vault.active !== 'string') { throw new Error('session_read_failed'); }
  const ids = new Set<string>(), urls = new Set<string>(), keys = new Set<string>();
  vault.servers.forEach((s: ServerProfile) => {
    if (!s || typeof s.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(s.id) || ids.has(s.id) || typeof s.name !== 'string' || s.name.length > 120 || !Array.isArray(s.addresses) || !s.addresses.includes(s.preferred)) { throw new Error('session_read_failed'); }
    ids.add(s.id); const list = addresses(s.addresses); if (list.length !== s.addresses.length || list.some((v: string, i: number) => v !== s.addresses[i])) { throw new Error('session_read_failed'); }
    list.forEach((url: string) => { if (urls.has(url)) { throw new Error('server_address_conflict'); } urls.add(url); });
  });
  vault.accounts.forEach((s: Session) => { if (!validSession(s) || !ids.has(s.serverId) || keys.has(sessionKey(s))) { throw new Error('session_read_failed'); } keys.add(sessionKey(s)); });
  if (vault.active && !keys.has(vault.active)) { throw new Error('session_read_failed'); }
}
export function withAddresses(session: Session, vault: AccountVault): Session {
  const copy = JSON.parse(JSON.stringify(session)) as Session; const server = vault.servers.find((s: ServerProfile) => s.id === copy.serverId)!;
  copy.addresses = [...server.addresses]; copy.server = server.preferred; copy.serverName = server.name;
  return copy;
}
