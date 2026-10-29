// Application-wide API metadata policy. Media engines and system downloads have their own transports.
export class NetworkOptions {
  requestMs: number = 30000;
  connectMs: number = 6000;
  readMs: number = 10000;
  autoCache: boolean = true;
}
// User-selectable API timeout range and whole-second granularity.
export class NetworkOptionRules {
  static readonly maximumTimeoutDraftDigits: number = 3;
  // Text grammar remains distinct from the timeout range and whole-second step.
  static validTimeoutDraft(value: string): boolean {
    return new RegExp('^[0-9]{1,' + NetworkOptionRules.maximumTimeoutDraftDigits + '}$').test(value);
  }
  static readonly minimumTimeoutMs: number = 1000;
  static readonly maximumTimeoutMs: number = 120000;
  static readonly timeoutStepMs: number = 1000;
  static timeoutInRange(value: number): boolean {
    return Number.isInteger(value) && value >= NetworkOptionRules.minimumTimeoutMs && value <= NetworkOptionRules.maximumTimeoutMs;
  }
  static timeoutOnStep(value: number): boolean { return value % NetworkOptionRules.timeoutStepMs === 0; }
}
export function validNetworkOptions(value: NetworkOptions): boolean {
  return !!value && typeof value.autoCache === 'boolean' && [value.requestMs, value.connectMs, value.readMs]
    .every((n: number) => NetworkOptionRules.timeoutInRange(n) && NetworkOptionRules.timeoutOnStep(n));
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
