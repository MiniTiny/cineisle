const recipes=[
  {
    "id": "minSeekMs-1",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minSeekMs: number = 1000;",
    "replacement": "minSeekMs: number = 999;",
    "name": "player rules independent seek range 999",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "minSeekMs1",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minSeekMs: number = 1000;",
    "replacement": "minSeekMs: number = 1001;",
    "name": "player rules independent seek range 1000",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "maxSeekMs-1",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxSeekMs: number = 300000;",
    "replacement": "maxSeekMs: number = 299999;",
    "name": "player rules independent seek range 300000",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "maxSeekMs1",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxSeekMs: number = 300000;",
    "replacement": "maxSeekMs: number = 300001;",
    "name": "player rules independent seek range 300001",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "seekStepMs-1",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "seekStepMs: number = 1000;",
    "replacement": "seekStepMs: number = 999;",
    "name": "player rules independent seek step 2000",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "seekStepMs1",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "seekStepMs: number = 1000;",
    "replacement": "seekStepMs: number = 1001;",
    "name": "player rules independent seek step 2000",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "seek-min-remove",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value >= PlayerOptionRules.minSeekMs",
    "replacement": "true",
    "name": "player rules independent seek range 999",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "seek-max-remove",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value <= PlayerOptionRules.maxSeekMs",
    "replacement": "true",
    "name": "player rules independent seek range 300001",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "seek-min-comparison",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value >= PlayerOptionRules.minSeekMs",
    "replacement": "value > PlayerOptionRules.minSeekMs",
    "name": "player rules independent seek range 1000",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "seek-max-comparison",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value <= PlayerOptionRules.maxSeekMs",
    "replacement": "value < PlayerOptionRules.maxSeekMs",
    "name": "player rules independent seek range 300000",
    "suite": "player-option-rules-contract.test.cjs"
  },
  {
    "id": "systemBrightness-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "systemBrightness: number = -1;",
    "replacement": "systemBrightness: number = -0.999;",
    "name": "player options raw defaults retain JSON shape",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "minBrightness-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minBrightness: number = 0.05;",
    "replacement": "minBrightness: number = 0.051000000000000004;",
    "name": "player options brightness 0.05",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "maxBrightness-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxBrightness: number = 1;",
    "replacement": "maxBrightness: number = 1.001;",
    "name": "player options brightness 1.000001",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "minDimOpacity-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minDimOpacity: number = 0.1;",
    "replacement": "minDimOpacity: number = 0.101;",
    "name": "player options dim 0.1",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "maxDimOpacity-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxDimOpacity: number = 0.9;",
    "replacement": "maxDimOpacity: number = 0.901;",
    "name": "player options dim 0.900001",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "defaultDimOpacity-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "defaultDimOpacity: number = 0.6;",
    "replacement": "defaultDimOpacity: number = 0.601;",
    "name": "player options raw defaults retain JSON shape",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "back-default",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "back: number = 5000;",
    "replacement": "back: number = 6000;",
    "name": "player options raw defaults retain JSON shape",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "forward-default",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "forward: number = 15000;",
    "replacement": "forward: number = 16000;",
    "name": "player options raw defaults retain JSON shape",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "validator-range-remove",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "PlayerOptionRules.validSeekRange(v) && PlayerOptionRules.validSeekStep(v)",
    "replacement": "PlayerOptionRules.validSeekStep(v)",
    "name": "player options back 0",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "validator-step-remove",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "PlayerOptionRules.validSeekRange(v) && PlayerOptionRules.validSeekStep(v)",
    "replacement": "PlayerOptionRules.validSeekRange(v)",
    "name": "player options actual Settings forward 1.5",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "normalize-brightness-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "result.brightness ?? defaults.brightness",
    "replacement": "result.brightness ?? 0.5",
    "name": "player options missing optional fields complete independently",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "normalize-dim-drift",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "result.dimOpacity ?? defaults.dimOpacity",
    "replacement": "result.dimOpacity ?? 0.5",
    "name": "player options missing optional fields complete independently",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "settings-sentinel-drift",
    "file": "entry/src/main/ets/pages/Settings.ets",
    "old": "next.brightness = PlayerOptionRules.systemBrightness",
    "replacement": "next.brightness = 0.5",
    "name": "player options actual Settings brightness off retains sentinel",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "brightness-clamp-remove",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": "value = Math.max(PlayerOptionRules.minBrightness, Math.min(PlayerOptionRules.maxBrightness, value));",
    "replacement": "value = value;",
    "name": "player display actual brightness 0",
    "suite": "player-display-contract.test.cjs"
  },
  {
    "id": "dim-clamp-remove",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": "this.dimOpacity = Math.max(PlayerOptionRules.minDimOpacity, Math.min(PlayerOptionRules.maxDimOpacity, value));",
    "replacement": "this.dimOpacity = value;",
    "name": "player display actual dim 0.900001",
    "suite": "player-display-contract.test.cjs"
  },
  {
    "id": "pan-min-drift",
    "file": "entry/src/main/ets/pages/Player.ets",
    "old": "Math.max(PlayerOptionRules.minBrightness, Math.min(PlayerOptionRules.maxBrightness, this.displayAnchor",
    "replacement": "Math.max(0.1, Math.min(PlayerOptionRules.maxBrightness, this.displayAnchor",
    "name": "player display actual pan 1000",
    "suite": "player-display-contract.test.cjs"
  },
  {
    "id": "window-validation-remove",
    "file": "entry/src/main/ets/service/PlaybackWindow.ets",
    "old": "!PlayerOptionRules.validBrightness(value)",
    "replacement": "false",
    "name": "player display independent window write 0.049999",
    "suite": "player-display-contract.test.cjs"
  },
  {
    "id": "window-validation-sentinel",
    "file": "entry/src/main/ets/service/PlaybackWindow.ets",
    "old": "!PlayerOptionRules.validBrightness(value)",
    "replacement": "(value < PlayerOptionRules.minBrightness || value > PlayerOptionRules.maxBrightness)",
    "name": "player display independent window write -1",
    "suite": "player-display-contract.test.cjs"
  },
  {
    "id": "window-read-comparison",
    "file": "entry/src/main/ets/service/PlaybackWindow.ets",
    "old": "return value >= 0 ? value",
    "replacement": "return value > 0 ? value",
    "name": "player display independent window read 0",
    "suite": "player-display-contract.test.cjs"
  },
  {
    "id": "brightness-min-compare",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value >= PlayerOptionRules.minBrightness",
    "replacement": "value > PlayerOptionRules.minBrightness",
    "name": "player options brightness 0.05",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "brightness-max-compare",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value <= PlayerOptionRules.maxBrightness",
    "replacement": "value < PlayerOptionRules.maxBrightness",
    "name": "player options brightness 1",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "dim-min-compare",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value >= PlayerOptionRules.minDimOpacity",
    "replacement": "value > PlayerOptionRules.minDimOpacity",
    "name": "player options dim 0.1",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "dim-max-compare",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "value <= PlayerOptionRules.maxDimOpacity",
    "replacement": "value < PlayerOptionRules.maxDimOpacity",
    "name": "player options dim 0.9",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "minBrightness-drift-down",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minBrightness: number = 0.05;",
    "replacement": "minBrightness: number = 0.049;",
    "name": "player options brightness 0.049999",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "maxBrightness-drift-down",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxBrightness: number = 1;",
    "replacement": "maxBrightness: number = 0.999;",
    "name": "player options brightness 1",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "minDimOpacity-drift-down",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "minDimOpacity: number = 0.1;",
    "replacement": "minDimOpacity: number = 0.099;",
    "name": "player options dim 0.099999",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "id": "maxDimOpacity-drift-down",
    "file": "entry/src/main/ets/utils/PlayerOptions.ts",
    "old": "maxDimOpacity: number = 0.9;",
    "replacement": "maxDimOpacity: number = 0.899;",
    "name": "player options dim 0.9",
    "suite": "player-options-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "player options actual Settings forward 300",
    "phase": "file-write",
    "scope": "player-options",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "name": "player options back 1000",
    "phase": "setup",
    "scope": "player-options",
    "suite": "player-options-contract.test.cjs"
  },
  {
    "name": "player display actual brightness 0.05",
    "phase": "window-get",
    "nativeInit": "window",
    "scope": "playback-timing",
    "suite": "player-display-contract.test.cjs"
  },
  {
    "name": "player display actual brightness 0.05",
    "phase": "option-file-write",
    "scope": "playback-timing",
    "suite": "player-display-contract.test.cjs",
    "requiredCalls": {
      "window-brightness": 1,
      "window-get": 1,
      "av-create": 1
    },
    "details": {
      "filename": "experience.json.tmp",
      "stage": "option-event", "brightness": 0.05
    }
  }
];
module.exports={recipes,controls,scope:'player-options',fixture:'tests/player-display-fixture.cjs',earlyPhase:'option-file-write',earlyOld:'try{await test.action(check,time);',earlyReplacement:"try{f.trace().call('option-file-write',()=>{});await test.action(check,time);",selfFaults:[{id:'window-init-capture',phase:'window-get',file:'tests/player-display-fixture.cjs',old:"f.trace().call('window-get',()=>{",replacement:"((phase,operation)=>operation())('window-get',()=>{"}]};
