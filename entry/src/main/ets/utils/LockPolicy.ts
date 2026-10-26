export interface LockSecret { version: number; iterations: number; salt: number[]; hash: number[] }

// Strict V1 decoding intentionally retains the original KDF and parameters.
export class LockSecretV1 {
  static readonly version: number = 1;
  static readonly assetAlias: string = 'cineisle.app.lock.v1';
  static readonly kdfSpecName: string = 'PBKDF2';
  static readonly kdfAlgorithm: string = 'PBKDF2|SHA256';
  static readonly iterations: number = 210000;
  static readonly saltBytes: number = 16;
  static readonly keyBytes: number = 32;

  static valid(secret: LockSecret): boolean {
    return !!secret && secret.version === LockSecretV1.version && secret.iterations === LockSecretV1.iterations &&
      Array.isArray(secret.salt) && secret.salt.length === LockSecretV1.saltBytes &&
      Array.isArray(secret.hash) && secret.hash.length === LockSecretV1.keyBytes &&
      [...secret.salt, ...secret.hash].every((value: number) => Number.isInteger(value) && value >= 0 && value <= 255);
  }
}

export class AppLockPolicy {
  static readonly maxFailures: number = 5;
  static readonly failureDelayMs: number = 30000;
  static readonly backgroundGraceMs: number = 15 * 60 * 1000;
  static readonly minPinDigits: number = 6;
  static readonly maxPinDigits: number = 12;
  static readonly pinPattern: RegExp = new RegExp(`^\\d{${AppLockPolicy.minPinDigits},${AppLockPolicy.maxPinDigits}}$`);
}
