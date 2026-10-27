const recipes=[
  {
    "id": "minimumTimeoutMs-drift--1",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "minimumTimeoutMs: number = 1000",
    "replacement": "minimumTimeoutMs: number = 999",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "minimumTimeoutMs-drift-1",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "minimumTimeoutMs: number = 1000",
    "replacement": "minimumTimeoutMs: number = 1001",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "maximumTimeoutMs-drift--1",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "maximumTimeoutMs: number = 120000",
    "replacement": "maximumTimeoutMs: number = 119999",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "maximumTimeoutMs-drift-1",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "maximumTimeoutMs: number = 120000",
    "replacement": "maximumTimeoutMs: number = 120001",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "min-compare",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "value >= NetworkOptionRules.minimumTimeoutMs",
    "replacement": "value > NetworkOptionRules.minimumTimeoutMs",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "max-compare",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "value <= NetworkOptionRules.maximumTimeoutMs",
    "replacement": "value < NetworkOptionRules.maximumTimeoutMs",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "min-remove",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "value >= NetworkOptionRules.minimumTimeoutMs",
    "replacement": "true",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "max-remove",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "value <= NetworkOptionRules.maximumTimeoutMs",
    "replacement": "true",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "integer-remove",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "Number.isInteger(value)",
    "replacement": "true",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "step-remove",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "value % NetworkOptionRules.timeoutStepMs === 0",
    "replacement": "true",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "step-drift-999",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "timeoutStepMs: number = 1000",
    "replacement": "timeoutStepMs: number = 999",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "step-drift-1001",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "timeoutStepMs: number = 1000",
    "replacement": "timeoutStepMs: number = 1001",
    "name": "network options independent range and step boundaries",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "validator-remove",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "NetworkOptionRules.timeoutInRange(n) && NetworkOptionRules.timeoutOnStep(n)",
    "replacement": "true",
    "name": "network options stored requestMs 0",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "requestMs-default",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "requestMs: number = 30000",
    "replacement": "requestMs: number = 31000",
    "name": "network options actual SDK initial fields derive fixed defaults",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "connectMs-default",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "connectMs: number = 6000",
    "replacement": "connectMs: number = 7000",
    "name": "network options actual SDK initial fields derive fixed defaults",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "readMs-default",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "readMs: number = 10000",
    "replacement": "readMs: number = 11000",
    "name": "network options actual SDK initial fields derive fixed defaults",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "cache-default",
    "file": "entry/src/main/ets/utils/NetworkOptions.ts",
    "old": "autoCache: boolean = true",
    "replacement": "autoCache: boolean = false",
    "name": "network options actual SDK initial fields derive fixed defaults",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "http-connect-drift",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "connectTimeout: policy.connectMs",
    "replacement": "connectTimeout: policy.connectMs + 1000",
    "name": "network options actual HTTP connectMs 1000",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "http-read-drift",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "readTimeout: policy.readMs",
    "replacement": "readTimeout: policy.readMs + 1000",
    "name": "network options actual HTTP readMs 120000",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "id": "http-deadline-drift",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "options, policy.requestMs);",
    "replacement": "options, policy.requestMs + 1000);",
    "name": "network options actual HTTP requestMs 1000",
    "suite": "network-options-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "network options stored requestMs 1000",
    "phase": "prefs-open",
    "nativeInit": "prefs",
    "scope": "network-options",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "name": "network options stored requestMs 1000",
    "phase": "prefs-get",
    "requiredCalls": {
      "prefs-open": 1
    },
    "scope": "network-options",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "name": "network options stored requestMs 1000",
    "phase": "prefs-flush",
    "requiredCalls": {
      "prefs-put": 1
    },
    "scope": "network-options",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "name": "network options actual HTTP connectMs 1000",
    "phase": "http-create",
    "nativeInit": true,
    "requiredCalls": {
      "prefs-flush": 1
    },
    "scope": "network-options",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "name": "network options actual HTTP connectMs 1000",
    "phase": "request",
    "requiredCalls": {
      "prefs-flush": 1,
      "http-create": 1
    },
    "scope": "network-options",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "name": "network options actual SDK initial fields derive fixed defaults",
    "phase": "ui-compile",
    "scope": "network-options",
    "suite": "network-options-contract.test.cjs"
  },
  {
    "name": "network options lower requestMs 1000",
    "phase": "setup",
    "scope": "network-options",
    "suite": "network-options-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'network-options',extraScopes:['entry/src/main/resources'],fixture:'tests/network-options-fixture.cjs',earlyPhase:'prefs-flush',earlyOld:'try{await test.action(check,time);',earlyReplacement:"try{f.trace().call('prefs-flush',()=>{});await test.action(check,time);",selfFaults:[{id:'native-prefs-init-capture',phase:'prefs-open',file:'tests/network-options-fixture.cjs',old:"f.trace().call('prefs-open',async()=>{",replacement:"((phase,operation)=>operation())('prefs-open',async()=>{",status:'detected'}]};
