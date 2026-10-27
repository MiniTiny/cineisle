const recipes=[
  {
    "id": "settings-limit-decrease",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "maximumSerializedOptionsCodeUnits: number = 1024",
    "replacement": "maximumSerializedOptionsCodeUnits: number = 1023",
    "name": "store serialized code units leading 1024",
    "suite": "mpv-settings-budget-contract.test.cjs"
  },
  {
    "id": "settings-limit-increase",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "maximumSerializedOptionsCodeUnits: number = 1024",
    "replacement": "maximumSerializedOptionsCodeUnits: number = 1025",
    "name": "page serialized code units mixed 1025",
    "suite": "mpv-settings-budget-contract.test.cjs"
  },
  {
    "id": "settings-guard-remove",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "raw.length > maximumSerializedOptionsCodeUnits",
    "replacement": "false",
    "name": "store unicode parse admission 1025",
    "suite": "mpv-settings-budget-contract.test.cjs"
  },
  {
    "id": "settings-compare",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "raw.length > maximumSerializedOptionsCodeUnits",
    "replacement": "raw.length >= maximumSerializedOptionsCodeUnits",
    "name": "page serialized code units trailing 1024",
    "suite": "mpv-settings-budget-contract.test.cjs"
  },
  {
    "id": "settings-units-bytes",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "raw.length > maximumSerializedOptionsCodeUnits",
    "replacement": "new TextEncoder().encode(raw).length > maximumSerializedOptionsCodeUnits",
    "name": "store unicode parse admission 1024",
    "suite": "mpv-settings-budget-contract.test.cjs"
  },
  {
    "id": "settings-units-codepoints",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "raw.length > maximumSerializedOptionsCodeUnits",
    "replacement": "Array.from(raw).length > maximumSerializedOptionsCodeUnits",
    "name": "lower unicode parse admission 1025",
    "suite": "mpv-settings-budget-contract.test.cjs"
  }
];
const controls=[
  {
    "phase": "preferences-open",
    "name": "store serialized code units leading 1024",
    "suite": "mpv-settings-budget-contract.test.cjs",
    "scope": "mpv-settings-budget",
    "nativeInit": "mpv-settings"
  },
  {
    "phase": "preferences-read",
    "name": "store serialized code units leading 1024",
    "suite": "mpv-settings-budget-contract.test.cjs",
    "scope": "mpv-settings-budget",
    "requiredCalls": {
      "preferences-open": 1
    }
  },
  {
    "phase": "preferences-write",
    "name": "page explicit repair after oversized cold read writes canonical options and cold reload",
    "suite": "mpv-settings-budget-contract.test.cjs",
    "scope": "mpv-settings-budget",
    "requiredCalls": {
      "preferences-read": 1
    }
  },
  {
    "phase": "preferences-flush",
    "name": "page explicit repair after oversized cold read writes canonical options and cold reload",
    "suite": "mpv-settings-budget-contract.test.cjs",
    "scope": "mpv-settings-budget",
    "requiredCalls": {
      "preferences-write": 1
    }
  },
  {
    "phase": "options-json-parse",
    "name": "lower unicode parse admission 1024",
    "suite": "mpv-settings-budget-contract.test.cjs",
    "scope": "mpv-settings-budget"
  },
  {
    "phase": "ui-compile",
    "name": "page serialized code units mixed 1024",
    "suite": "mpv-settings-budget-contract.test.cjs",
    "scope": "mpv-settings-budget"
  },
  {
    "phase": "setup",
    "name": "empty legacy raw uses defaults without writing stored value",
    "suite": "mpv-settings-budget-contract.test.cjs",
    "scope": "mpv-settings-budget"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'mpv-settings-budget',fixture:'tests/mpv-settings-budget-fixture.cjs',earlyPhase:'preferences-flush',earlyOld:'const instance=await originalOpen(...args);',earlyReplacement:"trace.call('preferences-flush',()=>{});const instance=await originalOpen(...args);",selfFaults:[{id:'native-preferences-init-capture',phase:'preferences-open',file:'tests/mpv-settings-budget-fixture.cjs',old:"trace.call('preferences-open',async()=>{",replacement:"((phase,operation)=>operation())('preferences-open',async()=>{",status:'detected'}]};
