const recipes=[
  {
    "id": "back-default",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "back: number = 5000",
    "replacement": "back: number = 6000",
    "name": "media settings actual SDK draft defaults",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "forward-default",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "forward: number = 15000",
    "replacement": "forward: number = 16000",
    "name": "media settings actual SDK draft defaults",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "mpv-hw-default",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "return { hwdec: 'ohcodec', vo: 'gpu-next' };",
    "replacement": "return { hwdec: 'no', vo: 'gpu-next' };",
    "name": "media settings actual SDK draft defaults",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "mpv-vo-default",
    "file": "entry/src/main/ets/utils/MpvOptions.ts",
    "old": "return { hwdec: 'ohcodec', vo: 'gpu-next' };",
    "replacement": "return { hwdec: 'ohcodec', vo: 'gpu' };",
    "name": "media settings actual SDK draft defaults",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "minBrightness-drift-0.04",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minBrightness: number = 0.05",
    "replacement": "minBrightness: number = 0.04",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "minBrightness-drift-0.06",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minBrightness: number = 0.05",
    "replacement": "minBrightness: number = 0.06",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "maxBrightness-drift-0.99",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxBrightness: number = 1",
    "replacement": "maxBrightness: number = 0.99",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "maxBrightness-drift-1.01",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxBrightness: number = 1",
    "replacement": "maxBrightness: number = 1.01",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "minDimOpacity-drift-0.09",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minDimOpacity: number = 0.1",
    "replacement": "minDimOpacity: number = 0.09",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "minDimOpacity-drift-0.11",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minDimOpacity: number = 0.1",
    "replacement": "minDimOpacity: number = 0.11",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "maxDimOpacity-drift-0.89",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxDimOpacity: number = 0.9",
    "replacement": "maxDimOpacity: number = 0.89",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "id": "maxDimOpacity-drift-0.91",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxDimOpacity: number = 0.9",
    "replacement": "maxDimOpacity: number = 0.91",
    "name": "media settings actual Player slider boundaries and units",
    "suite": "media-settings-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "media settings actual SDK draft defaults",
    "phase": "ui-compile",
    "scope": "media-settings",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "name": "media settings actual Player slider boundaries and units",
    "phase": "ui-render",
    "requiredCalls": {
      "ui-compile": 1
    },
    "scope": "media-settings",
    "suite": "media-settings-contract.test.cjs"
  },
  {
    "name": "media settings actual SDK draft defaults",
    "phase": "setup",
    "scope": "media-settings",
    "suite": "media-settings-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'media-settings',extraScopes:['entry/src/main/resources'],fixture:'tests/media-settings-fixture.cjs',earlyPhase:'ui-render',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('ui-render',()=>{});await t.action(check);"};
