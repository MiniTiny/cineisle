const recipes=[
  {
    "id": "font-scale-drift-- 0.001",
    "file": "entry/src/main/ets/utils/SubtitleLimits.ts",
    "old": "maximumExplicitFontScale: number = 3",
    "replacement": "maximumExplicitFontScale: number = 3 - 0.001",
    "name": "lower explicit font scale app maximum",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "font-scale-drift-+ 0.001",
    "file": "entry/src/main/ets/utils/SubtitleLimits.ts",
    "old": "maximumExplicitFontScale: number = 3",
    "replacement": "maximumExplicitFontScale: number = 3 + 0.001",
    "name": "lower explicit font scale app above maximum",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "lower-font-scale-maximum-guard-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "fontScale > CaptionRenderLimits.maximumExplicitFontScale",
    "replacement": "false",
    "name": "lower explicit font scale app above maximum",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "lower-font-scale-NaN-guard-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "!Number.isFinite(fontScale)",
    "replacement": "false",
    "name": "lower explicit font scale app NaN",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "lower-font-scale-zero-guard-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "fontScale <= 0",
    "replacement": "false",
    "name": "lower explicit font scale app zero",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "sdk-font-scale-maximum-guard-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "fontScale > CaptionRenderLimits.maximumExplicitFontScale",
    "replacement": "false",
    "name": "sdk explicit font scale app above maximum",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "sdk-font-scale-NaN-guard-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "!Number.isFinite(fontScale)",
    "replacement": "false",
    "name": "sdk explicit font scale app NaN",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "sdk-font-scale-zero-guard-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "fontScale <= 0",
    "replacement": "false",
    "name": "sdk explicit font scale app zero",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "font-scale-compare",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "fontScale > CaptionRenderLimits.maximumExplicitFontScale",
    "replacement": "fontScale >= CaptionRenderLimits.maximumExplicitFontScale",
    "name": "lower explicit font scale app maximum",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "font-scale-undefined-fallback-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "fontScale !== undefined && (",
    "replacement": "true && (",
    "name": "lower explicit font scale app undefined",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "system-vp-unit-drift",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "style.system ? context.vp2px(size * (run.sizeScale ?? 1))",
    "replacement": "style.system ? context.fp2px(size * (run.sizeScale ?? 1))",
    "name": "lower explicit font scale system maximum",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "NativeCaption-default--1",
    "file": "entry/src/main/ets/components/NativeCaption.ets",
    "old": "limit: number = CaptionRenderLimits.maxLines",
    "replacement": "limit: number = CaptionRenderLimits.maxLines - 1",
    "name": "NativeCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "NativeCaption-default-1",
    "file": "entry/src/main/ets/components/NativeCaption.ets",
    "old": "limit: number = CaptionRenderLimits.maxLines",
    "replacement": "limit: number = CaptionRenderLimits.maxLines + 1",
    "name": "NativeCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "RichCaption-default--1",
    "file": "entry/src/main/ets/components/RichCaption.ets",
    "old": "limit: number = CaptionRenderLimits.maxLines",
    "replacement": "limit: number = CaptionRenderLimits.maxLines - 1",
    "name": "RichCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "RichCaption-default-1",
    "file": "entry/src/main/ets/components/RichCaption.ets",
    "old": "limit: number = CaptionRenderLimits.maxLines",
    "replacement": "limit: number = CaptionRenderLimits.maxLines + 1",
    "name": "RichCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "line-policy-drift-999",
    "file": "entry/src/main/ets/utils/SubtitleLimits.ts",
    "old": "maxLines: number = 1000",
    "replacement": "maxLines: number = 999",
    "name": "NativeCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "line-policy-drift-1001",
    "file": "entry/src/main/ets/utils/SubtitleLimits.ts",
    "old": "maxLines: number = 1000",
    "replacement": "maxLines: number = 1001",
    "name": "NativeCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "RichCaption-text-argument-drift",
    "file": "entry/src/main/ets/components/RichCaption.ets",
    "old": ".maxLines(this.limit)",
    "replacement": ".maxLines(this.limit - 1)",
    "name": "RichCaption default line limit reaches actual ArkUI text declaration",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "NativeCaption-render-argument-drift",
    "file": "entry/src/main/ets/components/NativeCaption.ets",
    "old": "this.fontSize, width, this.limit,",
    "replacement": "this.fontSize, width, this.limit - 1,",
    "name": "NativeCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "RichCaption-child-argument-drift",
    "file": "entry/src/main/ets/components/RichCaption.ets",
    "old": "fontSize: this.fontSize, limit: this.limit,",
    "replacement": "fontSize: this.fontSize, limit: this.limit - 1,",
    "name": "RichCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "line-bound-compare",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "maxLines > CaptionRenderLimits.maxLines",
    "replacement": "maxLines >= CaptionRenderLimits.maxLines",
    "name": "lower line admission 1000",
    "suite": "caption-entry-budget-contract.test.cjs"
  },
  {
    "id": "line-bound-guard-remove",
    "file": "entry/src/main/ets/utils/CaptionRasterizer.ets",
    "old": "maxLines > CaptionRenderLimits.maxLines",
    "replacement": "false",
    "name": "sdk line admission 1001",
    "suite": "caption-entry-budget-contract.test.cjs"
  }
];
const controls=[
  {
    "phase": "caption-render",
    "name": "sdk explicit font scale app maximum",
    "suite": "caption-entry-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "nativeInit": "caption-render",
    "requiredCalls": {
      "vp-convert": 1
    }
  },
  {
    "phase": "vp-convert",
    "name": "sdk explicit font scale app maximum",
    "suite": "caption-entry-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "ui-render": 1
    }
  },
  {
    "phase": "fp-convert",
    "name": "lower explicit font scale app undefined",
    "suite": "caption-entry-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "vp-convert": 1
    }
  },
  {
    "phase": "ui-render",
    "name": "sdk explicit font scale app maximum",
    "suite": "caption-entry-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "ui-compile": 1
    }
  },
  {
    "phase": "ui-compile",
    "name": "sdk explicit font scale app maximum",
    "suite": "caption-entry-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget"
  },
  {
    "phase": "paragraph-create",
    "name": "NativeCaption default line limit reaches native render call",
    "suite": "caption-entry-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "nativeInit": "paragraph",
    "requiredCalls": {
      "font-collection": 1
    }
  },
  {
    "phase": "setup",
    "name": "lower explicit font scale app maximum",
    "suite": "caption-entry-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'subtitle-metric-budget',fixture:'tests/subtitle-metric-budget-fixture.cjs',earlyPhase:'caption-render',earlyOld:'caption.aboutToAppear();',earlyReplacement:"trace.call('caption-render',()=>{});caption.aboutToAppear();",selfFaults:[{id:'native-caption-render-init-capture',phase:'caption-render',file:'tests/subtitle-metric-budget-fixture.cjs',old:"trace.call('caption-render',()=>{",replacement:"((phase,operation)=>operation())('caption-render',()=>{",status:'detected'},{id:'native-paragraph-init-capture',phase:'paragraph-create',file:'tests/subtitle-metric-budget-fixture.cjs',old:"return trace.call('paragraph-create',()=>{",replacement:"return ((phase,operation)=>operation())('paragraph-create',()=>{",status:'detected'}]};
