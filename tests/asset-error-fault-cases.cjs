module.exports = {
  "recipes": [
    {
      "id": "lock-query-lower",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { AppLock.secret",
      "replacement": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND - 1) { AppLock.secret",
      "name": "lock-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-query-upper",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { AppLock.secret",
      "replacement": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND + 1) { AppLock.secret",
      "name": "lock-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-query-guard-remove",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { AppLock.secret",
      "replacement": "if (false) { AppLock.secret",
      "name": "lock-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-query-loose-compare",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { AppLock.secret",
      "replacement": "if ((e as BusinessError).code == asset.ErrorCode.NOT_FOUND) { AppLock.secret",
      "name": "lock-query preserves string 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-query-bypass-sdk-enum",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { AppLock.secret",
      "replacement": "if ((e as BusinessError).code === 24000002) { AppLock.secret",
      "name": "lock-query consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs"
    },
    {
      "id": "lock-remove-lower",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('lock_storage_failed'); }",
      "replacement": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND - 1) { throw new Error('lock_storage_failed'); }",
      "name": "lock-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-remove-upper",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('lock_storage_failed'); }",
      "replacement": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND + 1) { throw new Error('lock_storage_failed'); }",
      "name": "lock-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-remove-guard-remove",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('lock_storage_failed'); }",
      "replacement": "if (true) { throw new Error('lock_storage_failed'); }",
      "name": "lock-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-remove-loose-compare",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('lock_storage_failed'); }",
      "replacement": "if ((e as BusinessError).code != asset.ErrorCode.NOT_FOUND) { throw new Error('lock_storage_failed'); }",
      "name": "lock-remove preserves string 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "lock-remove-bypass-sdk-enum",
      "file": "entry/src/main/ets/service/AppLock.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('lock_storage_failed'); }",
      "replacement": "if ((e as BusinessError).code !== 24000002) { throw new Error('lock_storage_failed'); }",
      "name": "lock-remove consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs"
    },
    {
      "id": "session-query-lower",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { return undefined; }",
      "replacement": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND - 1) { return undefined; }",
      "name": "session-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-query-upper",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { return undefined; }",
      "replacement": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND + 1) { return undefined; }",
      "name": "session-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-query-guard-remove",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { return undefined; }",
      "replacement": "if (false) { return undefined; }",
      "name": "session-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-query-loose-compare",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { return undefined; }",
      "replacement": "if ((e as BusinessError).code == asset.ErrorCode.NOT_FOUND) { return undefined; }",
      "name": "session-query preserves string 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-query-bypass-sdk-enum",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code === asset.ErrorCode.NOT_FOUND) { return undefined; }",
      "replacement": "if ((e as BusinessError).code === 24000002) { return undefined; }",
      "name": "session-query consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs"
    },
    {
      "id": "session-remove-lower",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('session_clear_failed'); }",
      "replacement": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND - 1) { throw new Error('session_clear_failed'); }",
      "name": "session-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-remove-upper",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('session_clear_failed'); }",
      "replacement": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND + 1) { throw new Error('session_clear_failed'); }",
      "name": "session-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-remove-guard-remove",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('session_clear_failed'); }",
      "replacement": "if (true) { throw new Error('session_clear_failed'); }",
      "name": "session-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-remove-loose-compare",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('session_clear_failed'); }",
      "replacement": "if ((e as BusinessError).code != asset.ErrorCode.NOT_FOUND) { throw new Error('session_clear_failed'); }",
      "name": "session-remove preserves string 24000002",
      "suite": "asset-error-contract.test.cjs"
    },
    {
      "id": "session-remove-bypass-sdk-enum",
      "file": "entry/src/main/ets/service/SessionStore.ets",
      "old": "if ((e as BusinessError).code !== asset.ErrorCode.NOT_FOUND) { throw new Error('session_clear_failed'); }",
      "replacement": "if ((e as BusinessError).code !== 24000002) { throw new Error('session_clear_failed'); }",
      "name": "session-remove consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "asset-query",
      "name": "lock-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs",
      "scope": "asset-error",
      "nativeInit": "query",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "alias": "cineisle.app.lock.v1"
      }
    },
    {
      "phase": "enum-read",
      "name": "lock-query consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs",
      "scope": "asset-error",
      "nativeInit": "enum",
      "requiredCalls": {
        "entry": 1,
        "asset-query": 1
      },
      "details": {
        "value": 24000002
      }
    },
    {
      "phase": "asset-remove",
      "name": "lock-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs",
      "scope": "asset-error",
      "nativeInit": "remove",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "alias": "cineisle.app.lock.v1"
      }
    },
    {
      "phase": "enum-read",
      "name": "lock-remove consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs",
      "scope": "asset-error",
      "nativeInit": "enum",
      "requiredCalls": {
        "entry": 1,
        "asset-remove": 1
      },
      "details": {
        "value": 24000002
      }
    },
    {
      "phase": "asset-query",
      "name": "session-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs",
      "scope": "asset-error",
      "nativeInit": "query",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "alias": "cineisle.current.session"
      }
    },
    {
      "phase": "enum-read",
      "name": "session-query consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs",
      "scope": "asset-error",
      "nativeInit": "enum",
      "requiredCalls": {
        "entry": 1,
        "asset-query": 1
      },
      "details": {
        "value": 24000002
      }
    },
    {
      "phase": "asset-remove",
      "name": "session-remove preserves number 24000002",
      "suite": "asset-error-contract.test.cjs",
      "scope": "asset-error",
      "nativeInit": "remove",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "alias": "cineisle.current.session"
      }
    },
    {
      "phase": "enum-read",
      "name": "session-remove consumes SDK NOT_FOUND",
      "suite": "asset-enum-binding.test.cjs",
      "scope": "asset-error",
      "nativeInit": "enum",
      "requiredCalls": {
        "entry": 1,
        "asset-remove": 1
      },
      "details": {
        "value": 24000002
      }
    },
    {
      "phase": "setup",
      "name": "lock-query preserves number 24000002",
      "suite": "asset-error-contract.test.cjs",
      "scope": "asset-error"
    }
  ],
  "scope": "asset-error",
  "extraScopes": [
    "entry/src/main/resources"
  ],
  "fixture": "tests/asset-error-fixture.cjs",
  "earlyPhase": "asset-remove",
  "earlyOld": "const before = bytes(); trace.call('entry', () => {});",
  "earlyReplacement": "const before = bytes(); trace.call('asset-remove', () => {}); trace.call('entry', () => {});",
  "selfFaults": [
    {
      "id": "api-body-observer-remove",
      "phase": "asset-query",
      "file": "tests/asset-error-fixture.cjs",
      "old": "trace.call('asset-' + phase, async () => {",
      "replacement": "((phase, operation) => operation())('asset-' + phase, async () => {",
      "status": "detected"
    },
    {
      "id": "enum-body-observer-remove",
      "phase": "enum-read",
      "file": "tests/asset-error-fixture.cjs",
      "old": "trace.call('enum-read', () => {",
      "replacement": "((phase, operation) => operation())('enum-read', () => {",
      "status": "detected"
    }
  ]
};
