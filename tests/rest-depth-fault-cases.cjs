const recipes=[
  {
    "id": "depth-lower",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "maximumValidationDepth: number = 128",
    "replacement": "maximumValidationDepth: number = 127",
    "name": "response JSON depth mixed 128",
    "suite": "rest-depth-contract.test.cjs"
  },
  {
    "id": "depth-higher",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "maximumValidationDepth: number = 128",
    "replacement": "maximumValidationDepth: number = 129",
    "name": "response JSON depth mixed 129",
    "suite": "rest-depth-contract.test.cjs"
  },
  {
    "id": "depth-compare",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "depth > NativeJsonLimits.maximumValidationDepth",
    "replacement": "depth >= NativeJsonLimits.maximumValidationDepth",
    "name": "body JSON depth object 128",
    "suite": "rest-depth-contract.test.cjs"
  },
  {
    "id": "depth-response-guard-remove",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "depth > NativeJsonLimits.maximumValidationDepth",
    "replacement": "false",
    "name": "response JSON depth array 129",
    "suite": "rest-depth-contract.test.cjs"
  },
  {
    "id": "depth-recovery-guard-remove",
    "file": "entry/src/main/ets/api/NativeHttpTransport.ets",
    "old": "depth > NativeJsonLimits.maximumValidationDepth",
    "replacement": "false",
    "name": "recovery identity JSON depth 129",
    "suite": "rest-depth-contract.test.cjs"
  }
];
const controls=[
  {
    "phase": "http-create",
    "name": "response JSON depth mixed 128",
    "suite": "rest-depth-contract.test.cjs",
    "scope": "rest-depth",
    "nativeInit": true
  },
  {
    "phase": "http-create",
    "name": "recovery identity JSON depth 128",
    "suite": "rest-depth-contract.test.cjs",
    "scope": "rest-depth",
    "nativeInit": 2,
    "requiredCalls": {
      "http-create": 2,
      "response": 1
    }
  },
  {
    "phase": "response",
    "name": "response JSON depth array 128",
    "suite": "rest-depth-contract.test.cjs",
    "scope": "rest-depth",
    "requiredCalls": {
      "http-create": 1
    }
  },
  {
    "phase": "http-destroy",
    "name": "response JSON depth array 128",
    "suite": "rest-depth-contract.test.cjs",
    "scope": "rest-depth",
    "requiredCalls": {
      "response": 1
    }
  },
  {
    "phase": "setup",
    "name": "body JSON depth array 128",
    "suite": "rest-depth-contract.test.cjs",
    "scope": "rest-depth"
  }
];
module.exports={recipes,controls,scope:'rest-depth',fixture:'tests/rest-depth-fixture.cjs',earlyPhase:'http-destroy',earlyOld:'try{await test.action(check);',earlyReplacement:"try{f.trace().call('http-destroy',()=>{});await test.action(check);",selfFaults:[{id:'native-http-init-capture',phase:'http-create',file:'tests/catalog-contract-fixture.cjs',old:"http.createHttp=()=>trace.call('http-create',()=>{",replacement:"http.createHttp=()=>((phase,operation)=>operation())('http-create',()=>{",status:'detected'}]};
