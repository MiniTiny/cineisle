module.exports = {
  "recipes": [
    {
      "id": "lower-1",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "minimumNativeNetworkErrorCode: number = 2300000",
      "replacement": "minimumNativeNetworkErrorCode: number = 2299999",
      "name": "request native code below lower",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "lower+1",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "minimumNativeNetworkErrorCode: number = 2300000",
      "replacement": "minimumNativeNetworkErrorCode: number = 2300001",
      "name": "request native code at lower",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "upper-1",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "exclusiveNativeNetworkErrorCodeLimit: number = 2400000",
      "replacement": "exclusiveNativeNetworkErrorCodeLimit: number = 2399999",
      "name": "client native code below upper",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "upper+1",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "exclusiveNativeNetworkErrorCodeLimit: number = 2400000",
      "replacement": "exclusiveNativeNetworkErrorCodeLimit: number = 2400001",
      "name": "client native code at upper",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "lower-comparator",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "code >= minimumNativeNetworkErrorCode",
      "replacement": "code > minimumNativeNetworkErrorCode",
      "name": "text native code at lower",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "upper-comparator",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "code < exclusiveNativeNetworkErrorCodeLimit",
      "replacement": "code <= exclusiveNativeNetworkErrorCodeLimit",
      "name": "request native code at upper",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "classification-remove",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "code !== undefined && code >= minimumNativeNetworkErrorCode && code < exclusiveNativeNetworkErrorCodeLimit",
      "replacement": "false",
      "name": "client native code at lower",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "lower-guard-remove",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "code !== undefined && code >= minimumNativeNetworkErrorCode && code < exclusiveNativeNetworkErrorCodeLimit",
      "replacement": "code !== undefined && code < exclusiveNativeNetworkErrorCodeLimit",
      "name": "request native code below lower",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "upper-guard-remove",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "code !== undefined && code >= minimumNativeNetworkErrorCode && code < exclusiveNativeNetworkErrorCodeLimit",
      "replacement": "code !== undefined && code >= minimumNativeNetworkErrorCode",
      "name": "text native code at upper",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "coercion-drift",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "code !== undefined && code >= minimumNativeNetworkErrorCode && code < exclusiveNativeNetworkErrorCodeLimit",
      "replacement": "typeof code === 'number' && code !== undefined && code >= minimumNativeNetworkErrorCode && code < exclusiveNativeNetworkErrorCodeLimit",
      "name": "client native code string lower",
      "suite": "native-http-error-contract.test.cjs"
    },
    {
      "id": "destroy-remove",
      "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
      "old": "finally { connection.destroy(); }",
      "replacement": "finally {}",
      "name": "request native code at lower",
      "suite": "native-http-error-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "http-create",
      "name": "request native code at lower",
      "suite": "native-http-error-contract.test.cjs",
      "scope": "native-http-error",
      "nativeInit": "create",
      "requiredCalls": {
        "entry": 1
      }
    },
    {
      "phase": "http-request",
      "name": "client native code at lower",
      "suite": "native-http-error-contract.test.cjs",
      "scope": "native-http-error",
      "nativeInit": "request",
      "requiredCalls": {
        "http-create": 1,
        "entry": 1
      }
    },
    {
      "phase": "http-destroy",
      "name": "text native code at lower",
      "suite": "native-http-error-contract.test.cjs",
      "scope": "native-http-error",
      "nativeInit": "destroy",
      "requiredCalls": {
        "http-request": 1,
        "http-create": 1
      }
    },
    {
      "phase": "setup",
      "name": "request native code at lower",
      "suite": "native-http-error-contract.test.cjs",
      "scope": "native-http-error"
    }
  ],
  "scope": "native-http-error",
  "extraScopes": [
    "entry/src/main/resources"
  ],
  "fixture": "tests/native-http-error-fixture.cjs",
  "earlyPhase": "http-request",
  "earlyOld": "const transport = new Transport(session); transport.endpointChanged",
  "earlyReplacement": "trace.call('http-request', () => {}); const transport = new Transport(session); transport.endpointChanged",
  "selfFaults": [
    {
      "id": "request-body-observer-remove",
      "phase": "http-request",
      "file": "tests/native-http-error-fixture.cjs",
      "old": "trace.call('http-request', () => {",
      "replacement": "((phase, operation) => operation())('http-request', () => {",
      "status": "detected"
    }
  ]
};
