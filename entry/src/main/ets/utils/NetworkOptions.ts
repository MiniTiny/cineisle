// Application-wide API metadata policy. Media engines and system downloads have their own transports.
export class NetworkOptions {
  requestMs: number = 30000;
  connectMs: number = 6000;
  readMs: number = 10000;
  autoCache: boolean = true;
}
export function validNetworkOptions(value: NetworkOptions): boolean {
  return !!value && typeof value.autoCache === 'boolean' && [value.requestMs, value.connectMs, value.readMs]
    .every((n: number) => Number.isInteger(n) && n >= 1000 && n <= 120000 && n % 1000 === 0);
}
export function copyNetworkOptions(value: NetworkOptions): NetworkOptions {
  return { requestMs: value.requestMs, connectMs: value.connectMs, readMs: value.readMs, autoCache: value.autoCache };
}
export class NetworkPolicy {
  private static value: NetworkOptions = new NetworkOptions();
  static networkAvailable: (() => boolean) | undefined;
  static snapshot(): NetworkOptions { return copyNetworkOptions(NetworkPolicy.value); }
  static publish(value: NetworkOptions): void {
    if (!validNetworkOptions(value)) { throw new Error('network_options_invalid'); }
    NetworkPolicy.value = copyNetworkOptions(value);
  }
  static cacheAllowed(manual: boolean = false): boolean { return manual || NetworkPolicy.value.autoCache; }
  static cacheRequired(): boolean {
    try { return NetworkPolicy.value.autoCache && NetworkPolicy.networkAvailable?.() === false; }
    catch (e) { return false; }
  }
}
