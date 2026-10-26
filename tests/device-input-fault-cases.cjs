const recipes=[
  {
    "id": "input-limit--1",
    "file": "entry/src/main/ets/utils/DeviceOptions.ts",
    "old": "maximumInputCodeUnits: number = 64",
    "replacement": "maximumInputCodeUnits: number = 63",
    "name": "client device input ascii 64",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "input-limit-1",
    "file": "entry/src/main/ets/utils/DeviceOptions.ts",
    "old": "maximumInputCodeUnits: number = 64",
    "replacement": "maximumInputCodeUnits: number = 65",
    "name": "client device input ascii 65",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "input-guard-remove",
    "file": "entry/src/main/ets/utils/DeviceOptions.ts",
    "old": "value.length > DeviceNameRules.maximumInputCodeUnits",
    "replacement": "false",
    "name": "lower device input ascii 65",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "input-compare",
    "file": "entry/src/main/ets/utils/DeviceOptions.ts",
    "old": "value.length > DeviceNameRules.maximumInputCodeUnits",
    "replacement": "value.length >= DeviceNameRules.maximumInputCodeUnits",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "input-trim-before-admission",
    "file": "entry/src/main/ets/utils/DeviceOptions.ts",
    "old": "value.length > DeviceNameRules.maximumInputCodeUnits",
    "replacement": "value.trim().length > DeviceNameRules.maximumInputCodeUnits",
    "name": "page device raw admission before trim 65",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "input-codepoint-units",
    "file": "entry/src/main/ets/utils/DeviceOptions.ts",
    "old": "value.length > DeviceNameRules.maximumInputCodeUnits",
    "replacement": "Array.from(value).length > DeviceNameRules.maximumInputCodeUnits",
    "name": "client device input unicode 65",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "input-byte-units",
    "file": "entry/src/main/ets/utils/DeviceOptions.ts",
    "old": "value.length > DeviceNameRules.maximumInputCodeUnits",
    "replacement": "new TextEncoder().encode(value).length > DeviceNameRules.maximumInputCodeUnits",
    "name": "client device input unicode 64",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "client-input-validation-remove",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "const value = deviceNameValue(name);",
    "replacement": "const value = name;",
    "name": "client device input ascii 65",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "SDK-input-argument--1",
    "file": "entry/src/main/ets/pages/Settings.ets",
    "old": ".maxLength(DeviceNameRules.maximumInputCodeUnits)",
    "replacement": ".maxLength(DeviceNameRules.maximumInputCodeUnits - 1)",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs"
  },
  {
    "id": "SDK-input-argument-1",
    "file": "entry/src/main/ets/pages/Settings.ets",
    "old": ".maxLength(DeviceNameRules.maximumInputCodeUnits)",
    "replacement": ".maxLength(DeviceNameRules.maximumInputCodeUnits + 1)",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs"
  }
];
const controls=[
  {
    "phase": "http-create",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs",
    "scope": "device-contract",
    "nativeInit": true
  },
  {
    "phase": "http-create",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs",
    "scope": "device-contract",
    "nativeInit": 2,
    "requiredCalls": {
      "http-create": 2,
      "version": 1
    }
  },
  {
    "phase": "http-create",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs",
    "scope": "device-contract",
    "nativeInit": 3,
    "requiredCalls": {
      "http-create": 3,
      "version": 1,
      "device-write": 1
    }
  },
  {
    "phase": "device-write",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs",
    "scope": "device-contract",
    "requiredCalls": {
      "version": 1
    }
  },
  {
    "phase": "device-read",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs",
    "scope": "device-contract",
    "requiredCalls": {
      "device-write": 1
    }
  },
  {
    "phase": "ui-compile",
    "name": "page device input ascii 64",
    "suite": "device-input-contract.test.cjs",
    "scope": "device-contract"
  },
  {
    "phase": "setup",
    "name": "lower device input ascii 64",
    "suite": "device-input-contract.test.cjs",
    "scope": "device-contract"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'device-contract',fixture:'tests/device-contract-fixture.cjs',earlyPhase:'device-read',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('device-read',()=>{});await test.action(check);",selfFaults:[{id:'native-http-init-capture',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"http.createHttp=()=>trace.call('http-create',()=>{",replacement:"http.createHttp=()=>((phase,operation)=>operation())('http-create',()=>{",status:'detected'}]};
