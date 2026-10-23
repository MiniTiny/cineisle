// V2 byte framing is a persisted format; quotas are a separate product constraint.
export class AccountVaultFormat {
  static readonly version: number = 2;
  static readonly partAliasPrefix: string = 'cineisle.sessions.';
  static readonly maxPartBytes: number = 1000;
  static readonly maxParts: number = 64;
  static readonly maxBytes: number = AccountVaultFormat.maxPartBytes * AccountVaultFormat.maxParts;
}

export class AccountLimits {
  static readonly maxServers: number = 20;
  static readonly maxAccounts: number = 40;
  static readonly maxAddresses: number = 8;
  static readonly maxAddressCodeUnits: number = 2048;
  static readonly maxServerNameCodeUnits: number = 120;
}
