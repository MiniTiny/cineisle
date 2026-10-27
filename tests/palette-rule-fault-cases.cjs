const recipes = [
  {
    "id": "swatches--1",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "maximumSwatches: number = 16",
    "replacement": "maximumSwatches: number = 15",
    "name": "attach palette swatches 16",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "swatches-1",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "maximumSwatches: number = 16",
    "replacement": "maximumSwatches: number = 17",
    "name": "attach palette swatches 17",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "swatch-remove",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "colors.length > DynamicPaletteRules.maximumSwatches",
    "replacement": "false",
    "name": "pure palette swatches 17",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "swatch-compare",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "colors.length > DynamicPaletteRules.maximumSwatches",
    "replacement": "colors.length >= DynamicPaletteRules.maximumSwatches",
    "name": "attach palette swatches 16",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "swatch-consumer",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "colors.length > DynamicPaletteRules.maximumSwatches",
    "replacement": "colors.length > DynamicPaletteRules.maximumSwatches + 1",
    "name": "attach palette swatches 17",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "steps--1",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "maximumContrastAdjustments: number = 32",
    "replacement": "maximumContrastAdjustments: number = 31",
    "name": "private readable adjustment budget is exactly 32 with a bounded oracle",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "steps-1",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "maximumContrastAdjustments: number = 32",
    "replacement": "maximumContrastAdjustments: number = 33",
    "name": "private readable adjustment budget is exactly 32 with a bounded oracle",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "readable-cap-remove",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "i < DynamicPaletteRules.maximumContrastAdjustments && backgrounds.some",
    "replacement": "true && backgrounds.some",
    "name": "private readable adjustment budget is exactly 32 with a bounded oracle",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "readable-cap-compare",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "i < DynamicPaletteRules.maximumContrastAdjustments && backgrounds.some",
    "replacement": "i <= DynamicPaletteRules.maximumContrastAdjustments && backgrounds.some",
    "name": "private readable adjustment budget is exactly 32 with a bounded oracle",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "action-cap-remove",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "i < DynamicPaletteRules.maximumContrastAdjustments && ['#F2F3FA'",
    "replacement": "true && ['#F2F3FA'",
    "name": "private action adjustment budget is independently 32 with a bounded oracle",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "action-cap-compare",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "i < DynamicPaletteRules.maximumContrastAdjustments && ['#F2F3FA'",
    "replacement": "i <= DynamicPaletteRules.maximumContrastAdjustments && ['#F2F3FA'",
    "name": "private action adjustment budget is independently 32 with a bounded oracle",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "contrast-4.25",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "minimumContrast: number = 4.5",
    "replacement": "minimumContrast: number = 4.25",
    "name": "private readable actual contrast #737373",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "contrast-4.75",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "minimumContrast: number = 4.5",
    "replacement": "minimumContrast: number = 4.75",
    "name": "private readable actual contrast #777777",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "blend-0.11",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "contrastBlendStep: number = 0.12",
    "replacement": "contrastBlendStep: number = 0.11",
    "name": "private readable actual contrast #737373",
    "suite": "palette-rule-contract.test.cjs"
  },
  {
    "id": "blend-0.13",
    "file": "entry/src/main/ets/utils/DynamicPalette.ts",
    "old": "contrastBlendStep: number = 0.12",
    "replacement": "contrastBlendStep: number = 0.13",
    "name": "private readable actual contrast #737373",
    "suite": "palette-rule-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "wallpaper-read",
    "name": "attach palette swatches 16",
    "suite": "palette-rule-contract.test.cjs",
    "scope": "wallpaper-contract",
    "nativeInit": "wallpaper"
  },
  {
    "phase": "preferences-open",
    "name": "attach palette swatches 16",
    "suite": "palette-rule-contract.test.cjs",
    "scope": "wallpaper-contract",
    "nativeInit": "preferences"
  },
  {
    "phase": "window-bars",
    "name": "attach palette swatches 16",
    "suite": "palette-rule-contract.test.cjs",
    "scope": "wallpaper-contract",
    "requiredCalls": {
      "wallpaper-read": 1
    }
  },
  {
    "phase": "storage-publish",
    "name": "attach palette swatches 16",
    "suite": "palette-rule-contract.test.cjs",
    "scope": "wallpaper-contract",
    "requiredCalls": {
      "window-bars": 1
    }
  },
  {
    "phase": "palette-compile",
    "name": "private readable actual contrast #737373",
    "suite": "palette-rule-contract.test.cjs",
    "scope": "wallpaper-contract"
  },
  {
    "phase": "ui-compile",
    "name": "published palette reaches actual SDK Settings semantic color bindings",
    "suite": "palette-rule-contract.test.cjs",
    "scope": "wallpaper-contract",
    "requiredCalls": {
      "window-bars": 1
    }
  },
  {
    "phase": "setup",
    "name": "pure palette swatches 16",
    "suite": "palette-rule-contract.test.cjs",
    "scope": "wallpaper-contract"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'wallpaper-contract',fixture:'tests/wallpaper-contract-fixture.cjs',earlyPhase:'window-bars',earlyOld:'try { await test.action(check); }',earlyReplacement:"try { f.trace().call('window-bars',()=>{}); await test.action(check); }",selfFaults:[{id:'native-wallpaper-observer-remove',phase:'wallpaper-read',file:'tests/wallpaper-contract-fixture.cjs',old:"async type => f.trace().call('wallpaper-read', async () => {",replacement:"async type => ((phase,operation)=>operation())('wallpaper-read', async () => {",status:'detected'},{id:'native-preferences-observer-remove',phase:'preferences-open',file:'tests/wallpaper-contract-fixture.cjs',old:"async (...args) => f.trace().call('preferences-open', async () => {",replacement:"async (...args) => ((phase,operation)=>operation())('preferences-open', async () => {",status:'detected'}]};
