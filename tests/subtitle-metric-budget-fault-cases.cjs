const recipes=[
  {
    "id": "ascent-capacity--1",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "maximumCachedAscents: number = 128",
    "replacement": "maximumCachedAscents: number = 127",
    "name": "lower ascent cache entries 128",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "ascent-capacity-1",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "maximumCachedAscents: number = 128",
    "replacement": "maximumCachedAscents: number = 129",
    "name": "lower ascent cache entries 129",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "ascent-capacity-guard-remove",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "this.ascents.size >= SubtitleMetrics.maximumCachedAscents",
    "replacement": "false",
    "name": "lower ascent cache entries 129",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "ascent-capacity-compare",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "this.ascents.size >= SubtitleMetrics.maximumCachedAscents",
    "replacement": "this.ascents.size > SubtitleMetrics.maximumCachedAscents",
    "name": "lower ascent cache entries 129",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "ascent-clear-remove",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "this.ascents.clear();",
    "replacement": "void 0;",
    "name": "sdk ascent cache entries 129",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "measurement-width--1",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "measurementLayoutWidthPx: number = 100000",
    "replacement": "measurementLayoutWidthPx: number = 99999",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "measurement-width-1",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "measurementLayoutWidthPx: number = 100000",
    "replacement": "measurementLayoutWidthPx: number = 100001",
    "name": "sdk ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "measurement-layout-call-remove",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "paragraph.layoutSync(SubtitleMetrics.measurementLayoutWidthPx)",
    "replacement": "void 0",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "ascent-finite-guard-remove",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "!Number.isFinite(ascent)",
    "replacement": "false",
    "name": "invalid native ascent NaN is rejected and retry measures again",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "ascent-positive-compare",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "ascent <= 0",
    "replacement": "ascent < 0",
    "name": "invalid native ascent zero is rejected and retry measures again",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "ascent-validity-guard-remove",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "!Number.isFinite(ascent) || ascent <= 0",
    "replacement": "false",
    "name": "invalid native ascent zero is rejected and retry measures again",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-key-family",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "[family, size, step.bold, step.italic]",
    "replacement": "[size, step.bold, step.italic]",
    "name": "metric key separates family size weight style and shares opposite directions",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-key-size",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "[family, size, step.bold, step.italic]",
    "replacement": "[family, step.bold, step.italic]",
    "name": "window pixels font scale and system vp share only equal physical metric keys",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-key-weight",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "[family, size, step.bold, step.italic]",
    "replacement": "[family, size, step.italic]",
    "name": "metric key separates family size weight style and shares opposite directions",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-key-style",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "[family, size, step.bold, step.italic]",
    "replacement": "[family, size, step.bold]",
    "name": "metric key separates family size weight style and shares opposite directions",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-key-direction",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "[family, size, step.bold, step.italic]",
    "replacement": "[family, size, step.bold, step.italic, step.direction]",
    "name": "metric key separates family size weight style and shares opposite directions",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-view-cache-shared",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "private ascents: Map<string, number> = new Map<string, number>();",
    "replacement": "private static sharedAscents: Map<string, number> = new Map<string, number>();\n  private ascents: Map<string, number> = SubtitleMetrics.sharedAscents;",
    "name": "separate metric instances do not share caption view cache",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-clear-before-validation",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "const builder = new text.ParagraphBuilder",
    "replacement": "if (this.ascents.size >= SubtitleMetrics.maximumCachedAscents) { this.ascents.clear(); }\n    const builder = new text.ParagraphBuilder",
    "name": "failed candidate at full cache retains previous entries before validation succeeds",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  },
  {
    "id": "metric-family-key-normalize",
    "file": "entry/src/main/ets/utils/SubtitleMetrics.ets",
    "old": "JSON.stringify([family, size, step.bold, step.italic])",
    "replacement": "JSON.stringify([family.replace(/\\s/g, ''), size, step.bold, step.italic])",
    "name": "family key retains original spacing while native family list is trimmed",
    "suite": "subtitle-metric-budget-contract.test.cjs"
  }
];
const controls=[
  {
    "phase": "paragraph-create",
    "name": "lower ascent cache entries 128",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "nativeInit": "paragraph",
    "requiredCalls": {
      "font-collection": 1
    }
  },
  {
    "phase": "paragraph-layout",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "paragraph-build": 1
    },
    "details": {
      "width": 100000
    }
  },
  {
    "phase": "paragraph-metrics",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "paragraph-layout": 1
    }
  },
  {
    "phase": "font-collection",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget"
  },
  {
    "phase": "caption-render",
    "name": "sdk ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "paragraph-metrics": 1
    }
  },
  {
    "phase": "ui-compile",
    "name": "sdk ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget"
  },
  {
    "phase": "paragraph-style",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "paragraph-create": 1
    }
  },
  {
    "phase": "paragraph-build",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget",
    "requiredCalls": {
      "paragraph-pop": 1
    }
  },
  {
    "phase": "setup",
    "name": "lower ascent cache entries 127",
    "suite": "subtitle-metric-budget-contract.test.cjs",
    "scope": "subtitle-metric-budget"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'subtitle-metric-budget',fixture:'tests/subtitle-metric-budget-fixture.cjs',earlyPhase:'paragraph-metrics',earlyOld:'const builder=new Builder(...args);',earlyReplacement:"trace.call('paragraph-metrics',()=>{});const builder=new Builder(...args);",selfFaults:[{id:'native-paragraph-init-capture',phase:'paragraph-create',file:'tests/subtitle-metric-budget-fixture.cjs',old:"return trace.call('paragraph-create',()=>{",replacement:"return ((phase,operation)=>operation())('paragraph-create',()=>{",status:'detected'}]};
