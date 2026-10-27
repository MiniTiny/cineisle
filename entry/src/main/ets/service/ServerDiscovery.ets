import worker, { MessageEvents } from '@ohos.worker';
import { DiscoveryProbe } from './DiscoveryProbe';
import { JellyfinClient } from './JellyfinClient';
import { DiscoveredServer, DiscoveryEvent, DiscoveryResult, discoveryAddress, discoveryServerLimit, DiscoveryPacketLimits } from '../utils/ServerDiscovery';

export class ServerDiscovery {
  private static readonly workerCancelGraceMs: number = 1000;
  private static readonly workerWatchdogMs: number = 10000;
  private revision: number = 0;
  private stop: ((code: string) => void) | undefined;
  private released: Promise<void> = Promise.resolve();
  private probe: DiscoveryProbe | undefined;
  cancel(): void { ++this.revision; this.stop?.('discovery_cancelled'); this.probe?.cancel(); this.probe = undefined; }
  async start(update: (servers: DiscoveredServer[]) => void): Promise<DiscoveryResult> {
    this.cancel(); const revision = this.revision; await this.released;
    if (revision !== this.revision) { throw new Error('discovery_cancelled'); }
    return new Promise<DiscoveryResult>((resolve, reject) => {
      let thread: worker.ThreadWorker;
      try { thread = new worker.ThreadWorker('entry/ets/workers/ServerDiscoveryWorker.ets', { name: 'server-discovery' }); }
      catch (e) { reject(new Error('discovery_failed')); return; }
      let releaseDone: () => void = () => {};
      this.released = new Promise<void>((done) => { releaseDone = done; });
      let settled = false; let closed = false; let stopping = false; let watchdog = -1; let grace = -1;
      const settle = (code: string, value?: DiscoveryResult): void => {
        if (settled) { return; } settled = true;
        if (watchdog >= 0) { clearTimeout(watchdog); watchdog = -1; }
        if (code) { reject(new Error(code)); } else { resolve(value!); }
      };
      const release = (): void => {
        if (closed) { return; } closed = true;
        if (grace >= 0) { clearTimeout(grace); grace = -1; }
        if (this.stop === stop) { this.stop = undefined; }
        try { thread.terminate(); } catch (e) { /* Already exited. */ } releaseDone();
      };
      const stop = (code: string): void => {
        settle(code); if (stopping || closed) { return; } stopping = true;
        grace = setTimeout(release, ServerDiscovery.workerCancelGraceMs);
        try { thread.postMessage({ type: 'cancel' } as DiscoveryEvent); } catch (e) { release(); }
      };
      this.stop = stop;
      watchdog = setTimeout(() => stop('discovery_failed'), ServerDiscovery.workerWatchdogMs);
      thread.onmessage = (message: MessageEvents): void => {
        const event = message.data as DiscoveryEvent;
        if (closed || !event) { return; }
        if (event.type === 'progress') {
          if (!settled && revision === this.revision && Array.isArray(event.servers)) { update(event.servers.slice(0, discoveryServerLimit)); }
        } else if (['complete', 'error', 'cancelled'].includes(event.type)) {
          if (revision === this.revision && !settled) {
            if (event.type === 'complete' && Array.isArray(event.servers)) { settle('', { servers: event.servers.slice(0, discoveryServerLimit), limited: event.limited === true }); }
            else { settle(event.type === 'cancelled' ? 'discovery_cancelled' : 'discovery_failed'); }
          }
          release();
        }
      };
      thread.onerror = () => { settle('discovery_failed'); release(); };
      thread.onmessageerror = () => { settle('discovery_failed'); release(); };
      thread.onexit = () => { settle('discovery_failed'); release(); };
      try { thread.postMessage({ type: 'start' } as DiscoveryEvent); }
      catch (e) { settle('discovery_failed'); release(); }
    });
  }
  async verify(candidate: DiscoveredServer): Promise<DiscoveredServer> {
    this.cancel(); const revision = this.revision; await this.released;
    if (revision !== this.revision) { throw new Error('discovery_cancelled'); }
    const address = discoveryAddress(candidate.address);
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(candidate.id)) { throw new Error('discovery_verify_failed'); }
    const probe = new DiscoveryProbe(address); this.probe = probe;
    try {
      const info = await JellyfinClient.inspectServer(address, probe);
      if (revision !== this.revision) { throw new Error('discovery_cancelled'); }
      if (info.Id !== candidate.id) { throw new Error('server_identity_mismatch'); }
      return { id: info.Id, address: address, name: (info.ServerName || candidate.name).slice(0, DiscoveryPacketLimits.maxNameCodeUnits) };
    } catch (e) {
      const code = (e as Error).message;
      if (revision !== this.revision || code === 'discovery_cancelled') { throw new Error('discovery_cancelled'); }
      throw new Error(['server_identity_mismatch', 'discovery_verify_timeout'].includes(code) ? code : 'discovery_verify_failed');
    } finally { probe.cancel(); if (this.probe === probe) { this.probe = undefined; } }
  }
}
