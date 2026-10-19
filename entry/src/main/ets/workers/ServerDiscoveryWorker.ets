import worker, { MessageEvents } from '@ohos.worker';
import socket from '@ohos.net.socket';
import { DiscoveredServer, DiscoveryEvent, discoveryDuration, discoveryPacket, discoveryPacketLimit, discoveryServerLimit } from '../utils/ServerDiscovery';

const port = worker.workerPort;
let udp: socket.UDPSocket | undefined;
let started = false;
let closed = false;
let sent = false;
let timer = -1;
let packets = 0;
const servers: DiscoveredServer[] = [];
const identities = new Set<string>();

async function finish(type: string, code: string = '', limited: boolean = false): Promise<void> {
  if (closed) { return; } closed = true;
  if (timer >= 0) { clearTimeout(timer); timer = -1; }
  try { udp?.off('message'); udp?.off('error'); udp?.off('close'); } catch (e) { /* Closing still runs. */ }
  try { await udp?.close(); } catch (e) { /* Host also enforces a termination deadline. */ }
  port.postMessage({ type: type, servers: servers, limited: limited, code: code } as DiscoveryEvent);
}
function receive(event: socket.SocketMessageInfo): void {
  if (closed) { return; } ++packets;
  const candidate = discoveryPacket(event.message);
  if (candidate) {
    const key = candidate.id + '|' + candidate.address;
    if (!identities.has(key)) {
      identities.add(key); servers.push(candidate);
      port.postMessage({ type: 'progress', servers: [...servers] } as DiscoveryEvent);
    }
  }
  if (packets >= discoveryPacketLimit || servers.length >= discoveryServerLimit) { finish('complete', '', true); }
}
async function start(): Promise<void> {
  if (started || closed) { return; } started = true;
  timer = setTimeout(() => finish(sent ? 'complete' : 'error', sent ? '' : 'discovery_failed'), discoveryDuration);
  try {
    udp = socket.constructUDPSocketInstance();
    udp.on('message', receive); udp.on('error', () => finish('error', 'discovery_failed'));
    udp.on('close', () => { if (!closed) { finish('error', 'discovery_failed'); } });
    await udp.bind({ address: '0.0.0.0', family: 1, port: 0 }); if (closed) { return; }
    await udp.setExtraOptions({ broadcast: true }); if (closed) { return; }
    // Fixed Android dependency org.jellyfin.sdk 1.4.6 uses this IPv4 broadcast and payload.
    await udp.send({ data: 'who is JellyfinServer?', address: { address: '255.255.255.255', family: 1, port: 7359 } });
    if (!closed) { sent = true; }
  } catch (e) { finish('error', 'discovery_failed'); }
}
port.onmessage = (event: MessageEvents): void => {
  const message = event.data as DiscoveryEvent;
  if (message?.type === 'cancel') { finish('cancelled', 'discovery_cancelled'); }
  else if (message?.type === 'start') { start(); }
};
