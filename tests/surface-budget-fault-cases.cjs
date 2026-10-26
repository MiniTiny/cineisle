const recipes=[
  {
    "id": "dimension-drift-8191",
    "file": "entry/src/main/ets/utils/SurfaceGeometry.ts",
    "old": "maximumDimensionPx: number = 8192",
    "replacement": "maximumDimensionPx: number = 8191",
    "name": "surface budget independent controller width 8192",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "id": "dimension-drift-8193",
    "file": "entry/src/main/ets/utils/SurfaceGeometry.ts",
    "old": "maximumDimensionPx: number = 8192",
    "replacement": "maximumDimensionPx: number = 8193",
    "name": "surface budget independent controller width 8193",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "id": "dimension-max-compare",
    "file": "entry/src/main/ets/utils/SurfaceGeometry.ts",
    "old": "value <= SurfaceGeometry.maximumDimensionPx",
    "replacement": "value < SurfaceGeometry.maximumDimensionPx",
    "name": "surface budget independent callback height 8192",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "id": "dimension-max-remove",
    "file": "entry/src/main/ets/utils/SurfaceGeometry.ts",
    "old": "value <= SurfaceGeometry.maximumDimensionPx",
    "replacement": "true",
    "name": "surface budget actual page height 8193",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "id": "dimension-zero-compare",
    "file": "entry/src/main/ets/utils/SurfaceGeometry.ts",
    "old": "value > 0",
    "replacement": "value >= 0",
    "name": "surface budget independent controller width 0",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "id": "dimension-integer-remove",
    "file": "entry/src/main/ets/utils/SurfaceGeometry.ts",
    "old": "Number.isSafeInteger(value)",
    "replacement": "true",
    "name": "surface budget independent callback width 1.5",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "id": "callback-guard-remove",
    "file": "entry/src/main/ets/service/PlaybackSurface.ets",
    "old": "!SurfaceGeometry.valid(rect.surfaceWidth, rect.surfaceHeight)",
    "replacement": "false",
    "name": "surface budget independent callback height 8193",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "id": "controller-guard-remove",
    "file": "entry/src/main/ets/service/PlaybackController.ets",
    "old": "!SurfaceGeometry.valid(width, height)",
    "replacement": "false",
    "name": "surface budget independent controller width 8193",
    "suite": "surface-budget-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "surface budget independent controller width 8192",
    "phase": "av-create",
    "nativeInit": true,
    "requiredCalls": {
      "sdk-declarations": 1
    },
    "scope": "playback-timing",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "name": "surface budget independent controller width 8192",
    "phase": "engine-size",
    "requiredCalls": {
      "av-create": 1,
      "sdk-declarations": 1
    },
    "details": {
      "width": 8192,
      "height": 16
    },
    "scope": "playback-timing",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "name": "surface budget actual page width 8192",
    "phase": "disk-file-open",
    "scope": "playback-timing",
    "suite": "surface-budget-contract.test.cjs"
  },
  {
    "name": "surface budget independent callback width 8192",
    "phase": "setup",
    "scope": "playback-timing",
    "suite": "surface-budget-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'playback-timing',fixture:'tests/surface-budget-fixture.cjs',earlyPhase:'engine-size',earlyOld:'try{await test.action(check,time);',earlyReplacement:"try{f.trace().call('engine-size',()=>{});await test.action(check,time);",selfFaults:[{id:'native-AV-init-capture',phase:'av-create',file:'tests/playback-rate-fixture.cjs',old:"trace.call('av-create',async()=>{",replacement:"((phase,operation)=>operation())('av-create',async()=>{",status:'detected'}]};
