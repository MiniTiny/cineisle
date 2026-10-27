import { LockSecret, LockSecretV1, AppLockPolicy } from '../utils/LockPolicy';
import asset from '@ohos.security.asset';
import crypto from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import { BusinessError } from '@ohos.base';

// Device-wide private gate. The Asset contains a random salt and PBKDF2 hash; never the PIN.
export class AppLock {
  // Literal StorageLink subscribers are checked against this publisher contract.
  private static readonly lockedStateKey: string = 'cineIsleLocked';

  static locked: boolean = true;
  static enabled: boolean = false;
  static fault: boolean = false;
  private static initialized: boolean = false;
  private static initialization: Promise<void> | undefined = undefined;
  private static secret: LockSecret | undefined = undefined;
  private static backgroundAt: number = 0;
  private static blockedUntil: number = 0;
  private static failures: number = 0;
  static changed: (() => void) | undefined = undefined;
  private static publish(value: boolean): void { AppLock.locked = value; AppStorage.setOrCreate(AppLock.lockedStateKey, value); AppLock.changed?.(); }
  private static alias(): Uint8Array { return new util.TextEncoder().encodeInto(LockSecretV1.assetAlias); }
  static async initialize(): Promise<void> {
    AppLock.initialized = false; AppLock.publish(true); const query: asset.AssetMap = new Map(); query.set(asset.Tag.ALIAS, AppLock.alias()); query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    try {
      const values = await asset.query(query);
      if (!values.length) { AppLock.secret = undefined; AppLock.enabled = false; AppLock.fault = false; AppLock.initialized = true; AppLock.publish(false); return; }
      const secret = JSON.parse(new util.TextDecoder().decodeToString(values[0].get(asset.Tag.SECRET) as Uint8Array)) as LockSecret;
      if (!LockSecretV1.valid(secret)) { throw new Error('lock_storage_failed'); }
      AppLock.secret = secret; AppLock.enabled = true; AppLock.fault = false; AppLock.initialized = true; AppLock.publish(true);
    } catch (e) {
      if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { AppLock.secret = undefined; AppLock.enabled = false; AppLock.fault = false; AppLock.initialized = true; AppLock.publish(false); return; }
      AppLock.fault = true; AppLock.publish(true); throw new Error('lock_storage_failed');
    }
  }
  static ensureInitialized(): Promise<void> {
    if (AppLock.initialized) { return Promise.resolve(); }
    if (!AppLock.initialization) { AppLock.initialization = AppLock.initialize().finally(() => { AppLock.initialization = undefined; }); }
    return AppLock.initialization;
  }
  private static async derive(pin: string, salt: number[], iterations: number): Promise<number[]> {
    const spec: crypto.PBKDF2Spec = { algName: LockSecretV1.kdfSpecName, password: pin, salt: new Uint8Array(salt), iterations: iterations, keySize: LockSecretV1.keyBytes };
    const value = await crypto.createKdf(LockSecretV1.kdfAlgorithm).generateSecret(spec); return Array.from(value.data);
  }
  static async verify(pin: string): Promise<boolean> {
    if (!AppLock.initialized || AppLock.fault || Date.now() < AppLock.blockedUntil) { return false; }
    const secret = AppLock.secret; if (!secret) { return !AppLock.enabled; }
    const hash = await AppLock.derive(pin, secret.salt, secret.iterations);
    let difference = hash.length ^ secret.hash.length;
    for (let index = 0; index < secret.hash.length; index++) { difference |= (hash[index] ?? 0) ^ secret.hash[index]; }
    if (difference) { if (++AppLock.failures >= AppLockPolicy.maxFailures) { AppLock.blockedUntil = Date.now() + AppLockPolicy.failureDelayMs; } return false; }
    AppLock.failures = 0; AppLock.blockedUntil = 0; return true;
  }
  static async unlock(pin: string): Promise<boolean> {
    if (!await AppLock.verify(pin)) { return false; } AppLock.publish(false); return true;
  }
  static async configure(current: string, next: string): Promise<void> {
    if (AppLock.fault || (AppLock.enabled && !await AppLock.verify(current))) { throw new Error('lock_pin_wrong'); }
    if (next && !AppLockPolicy.pinPattern.test(next)) { throw new Error('lock_pin_format'); }
    const attrs: asset.AssetMap = new Map(); attrs.set(asset.Tag.ALIAS, AppLock.alias());
    if (!next) {
      try { await asset.remove(attrs); } catch (e) { if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('lock_storage_failed'); } }
      AppLock.secret = undefined; AppLock.enabled = false;
    } else {
      const random = await crypto.createRandom().generateRandom(LockSecretV1.saltBytes); const salt = Array.from(random.data);
      const secret: LockSecret = { version: LockSecretV1.version, iterations: LockSecretV1.iterations, salt: salt, hash: await AppLock.derive(next, salt, LockSecretV1.iterations) };
      attrs.set(asset.Tag.SECRET, new util.TextEncoder().encodeInto(JSON.stringify(secret))); attrs.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_UNLOCKED); attrs.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
      await asset.add(attrs); AppLock.secret = secret; AppLock.enabled = true;
    }
    AppLock.publish(false);
  }
  static lock(): void { if (AppLock.enabled || AppLock.fault) { AppLock.publish(true); } }
  static background(): void { AppLock.backgroundAt = Date.now(); }
  static foreground(): void { if (AppLock.backgroundAt && Date.now() - AppLock.backgroundAt >= AppLockPolicy.backgroundGraceMs) { AppLock.lock(); } AppLock.backgroundAt = 0; }
  static permit(): boolean {
    if (AppLock.enabled && !AppLock.locked && AppLock.backgroundAt && Date.now() - AppLock.backgroundAt >= AppLockPolicy.backgroundGraceMs) { AppLock.lock(); }
    return AppLock.initialized && !AppLock.locked && !AppLock.fault;
  }
}
