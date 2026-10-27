const recipes=[
  {
    "id": "family-drift--1",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "maximumFamilyCodeUnits: number = 128",
    "replacement": "maximumFamilyCodeUnits: number = 127",
    "name": "lower font family ascii 128",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "family-drift-1",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "maximumFamilyCodeUnits: number = 128",
    "replacement": "maximumFamilyCodeUnits: number = 129",
    "name": "lower font family ascii 129",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "family-guard-remove",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "family.length <= InlineSubtitleLimits.maximumFamilyCodeUnits",
    "replacement": "true",
    "name": "lower font family ascii 129",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "family-compare",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "family.length <= InlineSubtitleLimits.maximumFamilyCodeUnits",
    "replacement": "family.length < InlineSubtitleLimits.maximumFamilyCodeUnits",
    "name": "lower font family ascii 128",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "depth-drift--1",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "maximumMarkupDepth: number = 64",
    "replacement": "maximumMarkupDepth: number = 63",
    "name": "lower markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "depth-drift-1",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "maximumMarkupDepth: number = 64",
    "replacement": "maximumMarkupDepth: number = 65",
    "name": "lower markup depth 65 empty",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "depth-guard-remove",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "stack.length > InlineSubtitleLimits.maximumMarkupDepth",
    "replacement": "false",
    "name": "lower markup depth 65 empty",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "depth-compare",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "stack.length > InlineSubtitleLimits.maximumMarkupDepth",
    "replacement": "stack.length >= InlineSubtitleLimits.maximumMarkupDepth",
    "name": "lower markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "big-multiplier-- 0.01",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "bigMultiplier: number = 1.25",
    "replacement": "bigMultiplier: number = 1.25 - 0.01",
    "name": "lower baseline big multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "big-multiplier-+ 0.01",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "bigMultiplier: number = 1.25",
    "replacement": "bigMultiplier: number = 1.25 + 0.01",
    "name": "lower baseline big multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "big-metric-consumer",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "scale *= InlineSubtitleLimits.bigMultiplier",
    "replacement": "scale *= 1",
    "name": "lower baseline big multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "big-style-consumer",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "name === 'big' ? InlineSubtitleLimits.bigMultiplier",
    "replacement": "name === 'big' ? 1",
    "name": "lower baseline big multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "small-multiplier-- 0.01",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "smallMultiplier: number = 0.8",
    "replacement": "smallMultiplier: number = 0.8 - 0.01",
    "name": "lower baseline small multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "small-multiplier-+ 0.01",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "smallMultiplier: number = 0.8",
    "replacement": "smallMultiplier: number = 0.8 + 0.01",
    "name": "lower baseline small multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "small-metric-consumer",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "scale *= InlineSubtitleLimits.smallMultiplier",
    "replacement": "scale *= 1",
    "name": "lower baseline small multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "small-style-consumer",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": ": InlineSubtitleLimits.smallMultiplier;",
    "replacement": ": 1;",
    "name": "lower baseline small multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "minimum-drift-+ 0.000001",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "minimum: number = 0.125",
    "replacement": "minimum: number = 0.125 + 0.000001",
    "name": "shared run scale minimum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "minimum-drift-- 0.000001",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "minimum: number = 0.125",
    "replacement": "minimum: number = 0.125 - 0.000001",
    "name": "shared run scale below minimum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "minimum-guard-remove",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "value >= SubtitleRunScale.minimum",
    "replacement": "true",
    "name": "shared run scale below minimum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "minimum-compare",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "value >= SubtitleRunScale.minimum",
    "replacement": "value > SubtitleRunScale.minimum",
    "name": "shared run scale minimum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "maximum-drift-- 0.000001",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "maximum: number = 8",
    "replacement": "maximum: number = 8 - 0.000001",
    "name": "shared run scale maximum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "maximum-drift-+ 0.000001",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "maximum: number = 8",
    "replacement": "maximum: number = 8 + 0.000001",
    "name": "shared run scale above maximum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "maximum-guard-remove",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "value <= SubtitleRunScale.maximum",
    "replacement": "true",
    "name": "shared run scale above maximum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "maximum-compare",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "value <= SubtitleRunScale.maximum",
    "replacement": "value < SubtitleRunScale.maximum",
    "name": "shared run scale maximum",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "finite-guard-remove",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "Number.isFinite(value) && value >= SubtitleRunScale.minimum",
    "replacement": "true && value >= SubtitleRunScale.minimum",
    "name": "shared run scale numeric string",
    "suite": "subtitle-run-scale-contract.test.cjs"
  },
  {
    "id": "inline-upper-scale-call-remove",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "!SubtitleRunScale.valid(style.sizeScale)",
    "replacement": "false",
    "name": "controller relative big count 10",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "inline-lower-scale-call-remove",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "!SubtitleRunScale.valid(style.sizeScale)",
    "replacement": "false",
    "name": "lower relative small count 10",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "mpv-scale-call-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "!SubtitleRunScale.valid(scale)",
    "replacement": "false",
    "name": "adapter font size ratio source 64.001",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "family-raw-before-entity",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "family.length <= InlineSubtitleLimits.maximumFamilyCodeUnits",
    "replacement": "value.length <= InlineSubtitleLimits.maximumFamilyCodeUnits",
    "name": "lower font family entity 128",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "family-raw-before-trim",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "family.length <= InlineSubtitleLimits.maximumFamilyCodeUnits",
    "replacement": "value.length <= InlineSubtitleLimits.maximumFamilyCodeUnits",
    "name": "lower depth and family scope decoded trim",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "metric-traversal-reversed",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "for (let i = stack.length - 1; i > 0; i--)",
    "replacement": "for (let i = 1; i < stack.length; i++)",
    "name": "lower baseline big multiplier",
    "suite": "inline-budget-contract.test.cjs"
  },
  {
    "id": "style-rounding-drift",
    "file": "entry/src/main/ets/utils/InlineSubtitle.ts",
    "old": "style.sizeScale *= name === 'big' ? InlineSubtitleLimits.bigMultiplier : InlineSubtitleLimits.smallMultiplier;",
    "replacement": "style.sizeScale = Number((style.sizeScale * (name === 'big' ? InlineSubtitleLimits.bigMultiplier : InlineSubtitleLimits.smallMultiplier)).toFixed(12));",
    "name": "lower repeated multiplication and reversed metric traversal stay exact",
    "suite": "inline-budget-contract.test.cjs"
  }
];
const controls=[
  {
    "phase": "http-create",
    "name": "controller markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs",
    "scope": "inline-budget",
    "nativeInit": true
  },
  {
    "phase": "http-create",
    "name": "controller markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs",
    "scope": "inline-budget",
    "nativeInit": 2,
    "requiredCalls": {
      "http-create": 2,
      "subtitle-response": 1
    }
  },
  {
    "phase": "player-create",
    "name": "controller markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs",
    "scope": "inline-budget",
    "nativeInit": "inline-player"
  },
  {
    "phase": "subtitle-response",
    "name": "controller markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs",
    "scope": "inline-budget",
    "requiredCalls": {
      "http-create": 1
    }
  },
  {
    "phase": "http-destroy",
    "name": "controller markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs",
    "scope": "inline-budget",
    "requiredCalls": {
      "subtitle-response": 1
    }
  },
  {
    "phase": "converter-entry",
    "name": "lower markup depth 64 text",
    "suite": "inline-budget-contract.test.cjs",
    "scope": "inline-budget"
  },
  {
    "phase": "rule-entry",
    "name": "shared run scale minimum",
    "suite": "subtitle-run-scale-contract.test.cjs",
    "scope": "inline-budget"
  },
  {
    "phase": "setup",
    "name": "lower font family ascii 128",
    "suite": "inline-budget-contract.test.cjs",
    "scope": "inline-budget"
  }
];
module.exports={recipes,controls,scope:'inline-budget',fixture:'tests/inline-budget-fixture.cjs',earlyPhase:'http-destroy',earlyOld:"async invoke(mode,body){trace.call('converter-entry',()=>{});",earlyReplacement:"async invoke(mode,body){trace.call('http-destroy',()=>{});trace.call('converter-entry',()=>{});",selfFaults:[{id:'native-http-init-capture',phase:'http-create',file:'tests/inline-budget-fixture.cjs',old:"http.createHttp=()=>trace.call('http-create',()=>{",replacement:"http.createHttp=()=>((phase,operation)=>operation())('http-create',()=>{",status:'detected'},{id:'native-player-init-capture',phase:'player-create',file:'tests/inline-budget-fixture.cjs',old:"media.createAVPlayer=()=>trace.call('player-create',()=>{",replacement:"media.createAVPlayer=()=>((phase,operation)=>operation())('player-create',()=>{",status:'detected'}]};
