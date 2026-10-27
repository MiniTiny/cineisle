const recipes=[
  {
    "id": "minimumPercent-drift-0.99",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "minimumPercent: number = 1",
    "replacement": "minimumPercent: number = 0.99",
    "name": "caption preference native-read scale 0.99",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "minimumPercent-drift-1.01",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "minimumPercent: number = 1",
    "replacement": "minimumPercent: number = 1.01",
    "name": "caption preference native-save scale 1",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "maximumPercent-drift-199.99",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "maximumPercent: number = 200",
    "replacement": "maximumPercent: number = 199.99",
    "name": "caption preference sdk scale 200",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "maximumPercent-drift-200.01",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "maximumPercent: number = 200",
    "replacement": "maximumPercent: number = 200.01",
    "name": "caption preference native-read scale 200.01",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "minimum-remove",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value >= CaptionScaleRules.minimumPercent",
    "replacement": "true",
    "name": "caption preference native-save scale 0.99",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "maximum-remove",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value <= CaptionScaleRules.maximumPercent",
    "replacement": "true",
    "name": "caption preference sdk scale 200.01",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "minimum-compare",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value >= CaptionScaleRules.minimumPercent",
    "replacement": "value > CaptionScaleRules.minimumPercent",
    "name": "caption preference native-read scale 1",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "maximum-compare",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "value <= CaptionScaleRules.maximumPercent",
    "replacement": "value < CaptionScaleRules.maximumPercent",
    "name": "caption preference native-save scale 200",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "finite-remove",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "Number.isFinite(value)",
    "replacement": "true",
    "name": "caption preference lower malformed 100",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "fractional-reject",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "Number.isFinite(value)",
    "replacement": "Number.isInteger(value)",
    "name": "caption preference sdk scale 1.5",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "scale-validator-remove",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "CaptionScaleRules.valid(value.fontScale)",
    "replacement": "true",
    "name": "caption preference lower scale 200.01",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "scale-default-low",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "fontScale: number = 100",
    "replacement": "fontScale: number = 99",
    "name": "caption preference actual SDK initial values",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "scale-default-high",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "fontScale: number = 100",
    "replacement": "fontScale: number = 101",
    "name": "caption preference actual SDK preset true",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "native-color-default",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "family: string = 'default';\n  foreground: CaptionColor = '#FFFFFFFF'",
    "replacement": "family: string = 'default';\n  foreground: CaptionColor = '#FFFF0000'",
    "name": "caption preference actual SDK initial values",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "native-band-default",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "background: CaptionColor = '#99000000'",
    "replacement": "background: CaptionColor = '#AA000000'",
    "name": "caption preference actual SDK preset false",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "native-window-default",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "window: CaptionColor = '#00000000';\n  edge: string = 'none'",
    "replacement": "window: CaptionColor = '#FF000000';\n  edge: string = 'none'",
    "name": "caption preference actual SDK initial values",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "render-band-default",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "defaultSubtitleBackground: string = '#99000000'",
    "replacement": "defaultSubtitleBackground: string = '#AA000000'",
    "name": "caption preference defaults preserve raw shape and rendering fallback",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "foreground-fallback",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "?? copy.foreground",
    "replacement": "?? '#FF000000'",
    "name": "caption preference defaults preserve raw shape and rendering fallback",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "background-fallback",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "?? copy.background",
    "replacement": "?? '#FF000000'",
    "name": "caption preference defaults preserve raw shape and rendering fallback",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "window-fallback",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "?? copy.window",
    "replacement": "?? '#FF000000'",
    "name": "caption preference defaults preserve raw shape and rendering fallback",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "preset-yellow-flip",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "if (yellow)",
    "replacement": "if (!yellow)",
    "name": "caption preference actual SDK preset true",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "preset-enabled-remove",
    "file": "entry/src/main/ets/utils/CaptionStyle.ts",
    "old": "config.enabled = true;\n  if (yellow)",
    "replacement": "config.enabled = false;\n  if (yellow)",
    "name": "caption preference actual SDK preset false",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "native-read-guard-remove",
    "file": "entry/src/main/ets/service/SystemCaptions.ets",
    "old": "if (!validCaptionConfig(config)) { throw new Error('caption_invalid'); }",
    "replacement": "if (false) { throw new Error('caption_invalid'); }",
    "name": "caption preference native-read scale 0.99",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "id": "preset-preview-remove",
    "file": "entry/src/main/ets/pages/CaptionSettings.ets",
    "old": "this.windowColor = String(config.window); this.changed();",
    "replacement": "this.windowColor = String(config.window);",
    "name": "caption preference actual SDK preset true",
    "suite": "caption-preference-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "caption preference native-read scale 1",
    "phase": "caption-manager",
    "nativeInit": true,
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "name": "caption preference native-read scale 1",
    "phase": "native-style-read",
    "requiredCalls": {
      "caption-manager": 1
    },
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "name": "caption preference native-save scale 1",
    "phase": "caption-style-written",
    "requiredCalls": {
      "native-style-read": 2,
      "caption-style-write": 1
    },
    "details": {
      "writes": 1
    },
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "name": "caption preference actual SDK initial values",
    "phase": "ui-compile",
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "name": "caption preference sdk scale 200",
    "phase": "ui-render",
    "requiredCalls": {
      "ui-compile": 1
    },
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "name": "caption preference sdk scale 200",
    "phase": "caption-style-write",
    "requiredCalls": {
      "native-style-read": 2
    },
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "name": "caption preference lower scale 1",
    "phase": "setup",
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  },
  {
    "name": "caption preference sdk scale 1",
    "phase": "caption-manager",
    "nativeInit": true,
    "scope": "caption-preference",
    "suite": "caption-preference-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'caption-preference',extraScopes:['entry/src/main/resources'],fixture:'tests/caption-preference-fixture.cjs',earlyPhase:'caption-style-written',earlyOld:'try{await test.action(check,time);',earlyReplacement:"try{f.trace().call('caption-style-written',()=>{});await test.action(check,time);",selfFaults:[{id:'native-manager-init-capture',phase:'caption-manager',file:'tests/caption-preference-fixture.cjs',old:"f.trace().call('caption-manager',()=>{",replacement:"((phase,operation)=>operation())('caption-manager',()=>{",status:'detected'}]};
