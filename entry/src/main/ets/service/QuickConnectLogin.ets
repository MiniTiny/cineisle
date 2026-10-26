import { QuickConnectResult } from '../api/generated/Models';
import { JellyfinClient } from './JellyfinClient';
// Only the display code leaves this controller. Secret and token never enter UI state or disk.
interface QuickHttpError extends Error { status?: number }
export class QuickConnectLogin {
  private static readonly validityMs: number = 5 * 60 * 1000;
  static readonly pollIntervalMs: number = 5000;
  private client: JellyfinClient | undefined = undefined;
  private secret: string = '';
  private code: string = '';
  private expires: number = 0;
  private lastPoll: number = 0;
  private revision: number = 0;
  private checking: boolean = false;
  cancel(): void { ++this.revision; this.client = undefined; this.secret = ''; this.code = ''; this.expires = 0; this.lastPoll = 0; }
  async begin(server: string, expectedServerId: string = '', candidates: string[] = []): Promise<string> {
    this.cancel(); const revision = this.revision;
    const client = await JellyfinClient.quickClient(server, expectedServerId, candidates);
    try { if (!await client.quickEnabled()) { throw new Error('quick_connect_disabled'); } }
    catch (e) { if (['login_expired', 'permission_denied'].includes((e as Error).message)) { throw new Error('quick_connect_disabled'); } throw e as Error; }
    if (revision !== this.revision) { throw new Error('quick_connect_cancelled'); }
    let state: QuickConnectResult;
    try { state = await client.quickInitiate(); }
    catch (e) { if (['login_expired', 'permission_denied'].includes((e as Error).message)) { throw new Error('quick_connect_disabled'); } throw e as Error; }
    if (revision !== this.revision) { throw new Error('quick_connect_cancelled'); }
    if (typeof state?.Code !== 'string' || !/^[A-Za-z0-9]{6}$/.test(state.Code) || typeof state.Secret !== 'string' || !state.Secret || state.Secret.length > 512 || typeof state.Authenticated !== 'boolean') { throw new Error('api_response_invalid'); }
    this.client = client; this.secret = state.Secret; this.code = state.Code; this.expires = Date.now() + QuickConnectLogin.validityMs; return this.code;
  }
  async poll(): Promise<JellyfinClient | undefined> {
    const client = this.client; const revision = this.revision;
    if (!client || !this.secret) { throw new Error('quick_connect_cancelled'); }
    if (Date.now() >= this.expires) { this.cancel(); throw new Error('quick_connect_expired'); }
    if (this.checking || (this.lastPoll && Date.now() - this.lastPoll < QuickConnectLogin.pollIntervalMs)) { return undefined; }
    this.checking = true; this.lastPoll = Date.now();
    try {
      const state = await client.quickState(this.secret);
      if (revision !== this.revision) { throw new Error('quick_connect_cancelled'); }
      if (typeof state?.Authenticated !== 'boolean' || (state.Secret != null && state.Secret !== this.secret) || (state.Code != null && state.Code !== this.code)) { throw new Error('api_response_invalid'); }
      if (!state.Authenticated) { return undefined; }
      await client.quickAuthenticate(this.secret);
      if (revision !== this.revision) { throw new Error('quick_connect_cancelled'); }
      this.cancel(); return client;
    } catch (e) {
      if (['login_expired', 'permission_denied'].includes((e as Error).message) || [404, 410].includes((e as QuickHttpError).status ?? 0)) { this.cancel(); throw new Error('quick_connect_expired'); }
      throw e as Error;
    } finally { this.checking = false; }
  }
}
