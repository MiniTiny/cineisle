const recipes = [
  {
    "id": "response-limit--1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maximumDeviceResponseNameCodeUnits: number = 1024",
    "replacement": "maximumDeviceResponseNameCodeUnits: number = 1023",
    "name": "client device response ascii 1024",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "response-limit-1",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maximumDeviceResponseNameCodeUnits: number = 1024",
    "replacement": "maximumDeviceResponseNameCodeUnits: number = 1025",
    "name": "client device response ascii 1025",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "guard-remove",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "value.CustomName.length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "replacement": "false",
    "name": "page device response ascii 1025",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "compare",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "value.CustomName.length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "replacement": "value.CustomName.length >= JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "name": "page device response ascii 1024",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "codepoint",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "value.CustomName.length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "replacement": "Array.from(value.CustomName).length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "name": "client device response unicode 1025",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "bytes",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "value.CustomName.length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "replacement": "new TextEncoder().encode(value.CustomName).length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "name": "client device response unicode 1024",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "trim-before",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "value.CustomName.length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "replacement": "value.CustomName.trim().length > JellyfinClient.maximumDeviceResponseNameCodeUnits",
    "name": "page device response raw whitespace 1025",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "input-limit-confusion",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "maximumDeviceResponseNameCodeUnits: number = 1024",
    "replacement": "maximumDeviceResponseNameCodeUnits: number = 64",
    "name": "client device response ascii 1023",
    "suite": "device-response-contract.test.cjs"
  },
  {
    "id": "response-normalization",
    "file": "entry/src/main/ets/service/JellyfinClient.ets",
    "old": "return value.CustomName ?? '';",
    "replacement": "return value.CustomName?.trim() ?? '';",
    "name": "page device response null id",
    "suite": "device-response-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "http-create",
    "name": "page device response ascii 1024",
    "suite": "device-response-contract.test.cjs",
    "scope": "device-contract",
    "nativeInit": true
  },
  {
    "phase": "http-create",
    "name": "page device response ascii 1024",
    "suite": "device-response-contract.test.cjs",
    "scope": "device-contract",
    "nativeInit": 2,
    "requiredCalls": {
      "http-create": 2,
      "version": 1
    }
  },
  {
    "phase": "device-read",
    "name": "page device response ascii 1024",
    "suite": "device-response-contract.test.cjs",
    "scope": "device-contract",
    "requiredCalls": {
      "version": 1
    }
  },
  {
    "phase": "ui-compile",
    "name": "page device response ascii 1024",
    "suite": "device-response-contract.test.cjs",
    "scope": "device-contract"
  },
  {
    "phase": "setup",
    "name": "client device response ascii 1024",
    "suite": "device-response-contract.test.cjs",
    "scope": "device-contract"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'device-contract',fixture:'tests/device-contract-fixture.cjs',earlyPhase:'device-read',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('device-read',()=>{});await test.action(check);",selfFaults:[{id:'native-http-init-capture',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"http.createHttp=()=>trace.call('http-create',()=>{",replacement:"http.createHttp=()=>((phase,operation)=>operation())('http-create',()=>{",status:'detected'}]};
