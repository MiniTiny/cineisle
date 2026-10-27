const recipes = [
  {
    "id": "secret-budget--1",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "maximumSecretCodeUnits: number = 512",
    "replacement": "maximumSecretCodeUnits: number = 511",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "secret-budget-1",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "maximumSecretCodeUnits: number = 512",
    "replacement": "maximumSecretCodeUnits: number = 513",
    "name": "page QuickConnect secret ascii 513",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "secret-remove",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "state.Secret.length > QuickConnectLogin.maximumSecretCodeUnits",
    "replacement": "false",
    "name": "facade QuickConnect secret ascii 513",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "secret-compare",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "state.Secret.length > QuickConnectLogin.maximumSecretCodeUnits",
    "replacement": "state.Secret.length >= QuickConnectLogin.maximumSecretCodeUnits",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "secret-codepoints",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "state.Secret.length > QuickConnectLogin.maximumSecretCodeUnits",
    "replacement": "Array.from(state.Secret).length > QuickConnectLogin.maximumSecretCodeUnits",
    "name": "facade QuickConnect secret unicode 513",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "secret-bytes",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "state.Secret.length > QuickConnectLogin.maximumSecretCodeUnits",
    "replacement": "new TextEncoder().encode(state.Secret).length > QuickConnectLogin.maximumSecretCodeUnits",
    "name": "page QuickConnect secret unicode 512",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "secret-trim-before",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "state.Secret.length > QuickConnectLogin.maximumSecretCodeUnits",
    "replacement": "state.Secret.trim().length > QuickConnectLogin.maximumSecretCodeUnits",
    "name": "page QuickConnect secret raw spaces 513",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "secret-consumer",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "state.Secret.length > QuickConnectLogin.maximumSecretCodeUnits",
    "replacement": "state.Secret.length > QuickConnectLogin.maximumSecretCodeUnits + 1",
    "name": "facade QuickConnect secret ascii 513",
    "suite": "quick-secret-contract.test.cjs"
  },
  {
    "id": "stored-secret-trim",
    "file": "entry/src/main/ets/service/QuickConnectLogin.ets",
    "old": "this.secret = state.Secret;",
    "replacement": "this.secret = state.Secret.trim();",
    "name": "facade QuickConnect secret opaque controls",
    "suite": "quick-secret-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "http-create",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret",
    "nativeInit": 1
  },
  {
    "phase": "http-create",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret",
    "nativeInit": 2,
    "requiredCalls": {
      "version": 1,
      "http-create": 2
    }
  },
  {
    "phase": "http-create",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret",
    "nativeInit": 3,
    "requiredCalls": {
      "version": 1,
      "quick-enabled": 1,
      "http-create": 3
    }
  },
  {
    "phase": "http-create",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret",
    "nativeInit": 4,
    "requiredCalls": {
      "quick-initiate": 1,
      "http-create": 4
    }
  },
  {
    "phase": "quick-initiate",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret",
    "requiredCalls": {
      "quick-enabled": 1
    }
  },
  {
    "phase": "quick-state",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret",
    "requiredCalls": {
      "quick-initiate": 1
    }
  },
  {
    "phase": "ui-compile",
    "name": "page QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret"
  },
  {
    "phase": "setup",
    "name": "facade QuickConnect secret ascii 512",
    "suite": "quick-secret-contract.test.cjs",
    "scope": "quick-secret"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'quick-secret',fixture:'tests/quick-secret-fixture.cjs',earlyPhase:'quick-state',earlyOld:'try { await test.action(check); }',earlyReplacement:"try { f.trace().call('quick-state',()=>{}); await test.action(check); }",selfFaults:[{id:'native-http-init-observer-remove',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"http.createHttp=()=>trace.call('http-create',()=>{",replacement:"http.createHttp=()=>((phase,operation)=>operation())('http-create',()=>{",status:'detected'}]};
