import asset from '@ohos.security.asset';
import util from '@ohos.util';
import { BusinessError } from '@ohos.base';
import { Session } from '../model/Models';
import { ProductIdentity } from '../utils/ProductIdentity';
import { AccountVault, AccountSummary, ServerProfile, emptyVault, addresses, validSession, validateVault, sessionKey, withAddresses } from '../utils/Accounts';
interface VaultIndex { version: number; generation: string; parts: number }
// Credentials remain in Asset. Each part is <=1000 bytes; the small root is committed last.
export class SessionStore {
  private static work: Promise<void> = Promise.resolve();
  private static run<T>(operation: () => Promise<T>): Promise<T> {
    const result = SessionStore.work.then(operation); SessionStore.work = result.then(() => {}, () => {}); return result;
  }
  private static credential(value: Session): Session {
    const session = new Session(); session.server = value.server; session.serverId = value.serverId; session.userId = value.userId;
    session.userName = value.userName; session.token = value.token; session.deviceId = value.deviceId; return session;
  }
  private static alias(value: string): Uint8Array { return new util.TextEncoder().encodeInto(value); }
  private static part(index: VaultIndex, n: number): string { return `cineisle.sessions.${index.generation}.${n}`; }
  private static async read(alias: string): Promise<Uint8Array | undefined> {
    const query: asset.AssetMap = new Map(); query.set(asset.Tag.ALIAS, SessionStore.alias(alias)); query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    try { const result = await asset.query(query); return result.length ? result[0].get(asset.Tag.SECRET) as Uint8Array : undefined; }
    catch (e) { if ((e as BusinessError).code === 24000002) { return undefined; } throw new Error('session_read_failed'); }
  }
  private static async put(alias: string, bytes: Uint8Array): Promise<void> {
    const attrs: asset.AssetMap = new Map(); attrs.set(asset.Tag.ALIAS, SessionStore.alias(alias)); attrs.set(asset.Tag.SECRET, bytes);
    attrs.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_UNLOCKED); attrs.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    try { await asset.add(attrs); } catch (e) { throw new Error('session_save_failed'); }
  }
  private static async removeAsset(alias: string): Promise<void> {
    const attrs: asset.AssetMap = new Map(); attrs.set(asset.Tag.ALIAS, SessionStore.alias(alias));
    try { await asset.remove(attrs); } catch (e) { if ((e as BusinessError).code !== 24000002) { throw new Error('session_clear_failed'); } }
  }
  private static index(value: VaultIndex): boolean { return !!value && value.version === 2 && typeof value.generation === 'string' && /^[a-zA-Z0-9-]+$/.test(value.generation) && Number.isInteger(value.parts) && value.parts > 0 && value.parts <= 64; }
  private static async readVault(): Promise<AccountVault> {
    const root = await SessionStore.read(ProductIdentity.SESSION_ALIAS); if (!root) { return emptyVault(); }
    try {
      const index = JSON.parse(new util.TextDecoder().decodeToString(root)) as VaultIndex;
      if (!SessionStore.index(index)) {
        const old = JSON.parse(new util.TextDecoder().decodeToString(root)) as Session;
        if (!validSession(old)) { throw new Error('session_read_failed'); }
        const vault = emptyVault(); vault.accounts = [SessionStore.credential(old)]; vault.active = sessionKey(old);
        vault.servers = [{ id: old.serverId, name: old.serverName ?? '', addresses: addresses(old.addresses ?? [old.server]), preferred: old.server }];
        await SessionStore.writeVault(vault); return vault;
      }
      const parts: Uint8Array[] = []; let size = 0;
      for (let i = 0; i < index.parts; i++) { const bytes = await SessionStore.read(SessionStore.part(index, i)); if (!bytes || !bytes.length || bytes.length > 1000) { throw new Error('session_read_failed'); } parts.push(bytes); size += bytes.length; }
      const joined = new Uint8Array(size); let offset = 0; parts.forEach((part: Uint8Array) => { joined.set(part, offset); offset += part.length; });
      const vault = JSON.parse(new util.TextDecoder().decodeToString(joined)) as AccountVault; validateVault(vault); vault.accounts = vault.accounts.map(SessionStore.credential); return vault;
    } catch (e) { if ((e as Error).message === 'session_save_failed') { throw e as Error; } throw new Error('session_read_failed'); }
  }
  private static async writeVault(vault: AccountVault): Promise<void> {
    if (vault.servers.length > 20 || vault.accounts.length > 40) { throw new Error('account_store_full'); }
    validateVault(vault); const bytes = new util.TextEncoder().encodeInto(JSON.stringify(vault)); if (bytes.length > 64000) { throw new Error('account_store_full'); }
    const oldRoot = await SessionStore.read(ProductIdentity.SESSION_ALIAS);
    let old: VaultIndex | undefined = undefined;
    if (oldRoot) { try { const value = JSON.parse(new util.TextDecoder().decodeToString(oldRoot)) as VaultIndex; if (SessionStore.index(value)) { old = value; } } catch (e) {} }
    const index: VaultIndex = { version: 2, generation: util.generateRandomUUID(), parts: Math.ceil(bytes.length / 1000) }; let written = 0;
    try {
      for (let n = 0; n < index.parts; n++) { await SessionStore.put(SessionStore.part(index, n), bytes.slice(n * 1000, (n + 1) * 1000)); written++; }
      await SessionStore.put(ProductIdentity.SESSION_ALIAS, new util.TextEncoder().encodeInto(JSON.stringify(index)));
    } catch (e) { for (let n = 0; n < written; n++) { try { await SessionStore.removeAsset(SessionStore.part(index, n)); } catch (ignored) {} } throw e as Error; }
    if (old && old.generation !== index.generation) { for (let n = 0; n < old.parts; n++) { try { await SessionStore.removeAsset(SessionStore.part(old, n)); } catch (ignored) {} } }
  }
  static load(): Promise<Session | undefined> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); const active = vault.accounts.find((s: Session) => sessionKey(s) === vault.active); return active ? withAddresses(active, vault) : undefined; }); }
  static list(): Promise<AccountSummary[]> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); return vault.accounts.map((s: Session): AccountSummary => ({ key: sessionKey(s), serverId: s.serverId, userId: s.userId, userName: s.userName, serverName: vault.servers.find((v: ServerProfile) => v.id === s.serverId)!.name, address: withAddresses(s, vault).server, active: sessionKey(s) === vault.active })); }); }
  static servers(): Promise<ServerProfile[]> { return SessionStore.run(async () => (await SessionStore.readVault()).servers); }
  static get(key: string): Promise<Session> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); const session = vault.accounts.find((s: Session) => sessionKey(s) === key); if (!session) { throw new Error('account_not_found'); } return withAddresses(session, vault); }); }
  static save(session: Session): Promise<void> {
    return SessionStore.run(async () => {
      if (!validSession(session)) { throw new Error('login_response_invalid'); } const vault = await SessionStore.readVault();
      let server = vault.servers.find((s: ServerProfile) => s.id === session.serverId);
      if (!server) { server = { id: session.serverId, name: session.serverName ?? '', addresses: addresses(session.addresses ?? [session.server]), preferred: session.server }; vault.servers.push(server); }
      else { server.addresses = addresses(Array.from(new Set([...server.addresses, ...(session.addresses ?? [session.server]), session.server]))); server.preferred = session.server; }
      const copy = SessionStore.credential(session);
      vault.accounts = [...vault.accounts.filter((s: Session) => sessionKey(s) !== sessionKey(copy)), copy]; vault.active = sessionKey(copy); await SessionStore.writeVault(vault);
    });
  }
  static select(key: string): Promise<void> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); if (!vault.accounts.some((s: Session) => sessionKey(s) === key)) { throw new Error('account_not_found'); } vault.active = key; await SessionStore.writeVault(vault); }); }
  static updateServer(server: ServerProfile): Promise<void> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); const normalized: ServerProfile = { id: server.id, name: server.name.trim().slice(0, 120), addresses: addresses(server.addresses), preferred: server.preferred }; vault.servers = [...vault.servers.filter((s: ServerProfile) => s.id !== server.id), normalized]; await SessionStore.writeVault(vault); }); }
  static rememberAddress(serverId: string, address: string): Promise<void> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); const server = vault.servers.find((s: ServerProfile) => s.id === serverId); if (!server || !server.addresses.includes(address)) { return; } server.preferred = address; vault.accounts.forEach((s: Session) => { if (s.serverId === serverId) { s.server = address; } }); await SessionStore.writeVault(vault); }); }
  static remove(key: string): Promise<void> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); vault.accounts = vault.accounts.filter((s: Session) => sessionKey(s) !== key); if (vault.active === key) { vault.active = ''; } await SessionStore.writeVault(vault); }); }
  static removeServer(id: string): Promise<void> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); vault.servers = vault.servers.filter((s: ServerProfile) => s.id !== id); vault.accounts = vault.accounts.filter((s: Session) => s.serverId !== id); if (!vault.accounts.some((s: Session) => sessionKey(s) === vault.active)) { vault.active = ''; } await SessionStore.writeVault(vault); }); }
  static clear(): Promise<void> { return SessionStore.run(async () => { const vault = await SessionStore.readVault(); vault.accounts = vault.accounts.filter((s: Session) => sessionKey(s) !== vault.active); vault.active = ''; await SessionStore.writeVault(vault); }); }
  static reset(): Promise<void> {
    return SessionStore.run(async () => {
      const bytes = await SessionStore.read(ProductIdentity.SESSION_ALIAS); let index: VaultIndex | undefined = undefined;
      if (bytes) { try { const value = JSON.parse(new util.TextDecoder().decodeToString(bytes)) as VaultIndex; if (SessionStore.index(value)) { index = value; } } catch (e) {} }
      await SessionStore.removeAsset(ProductIdentity.SESSION_ALIAS);
      if (index) { for (let n = 0; n < index.parts; n++) { try { await SessionStore.removeAsset(SessionStore.part(index, n)); } catch (e) {} } }
    });
  }

}
