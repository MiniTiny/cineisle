const recipes=[
  {
    "id": "events-drift--1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumEventCodeUnits: number = 65536",
    "replacement": "maximumEventCodeUnits: number = 65536 - 1",
    "name": "lower event code units ascii 65536",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "events-drift-1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumEventCodeUnits: number = 65536",
    "replacement": "maximumEventCodeUnits: number = 65536 + 1",
    "name": "lower event code units ascii 65537",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "events-guard-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "events.length > MpvTextSubtitleLimits.maximumEventCodeUnits",
    "replacement": "false",
    "name": "lower event code units ascii 65537",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "events-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "events.length > MpvTextSubtitleLimits.maximumEventCodeUnits",
    "replacement": "events.length >= MpvTextSubtitleLimits.maximumEventCodeUnits",
    "name": "lower event code units ascii 65536",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "lines-drift--1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumDialogueLines: number = 64",
    "replacement": "maximumDialogueLines: number = 64 - 1",
    "name": "lower dialogue count 64",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "lines-drift-1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumDialogueLines: number = 64",
    "replacement": "maximumDialogueLines: number = 64 + 1",
    "name": "lower dialogue count 65",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "lines-guard-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "lines.length > MpvTextSubtitleLimits.maximumDialogueLines",
    "replacement": "false",
    "name": "lower dialogue count 65",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "lines-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "lines.length > MpvTextSubtitleLimits.maximumDialogueLines",
    "replacement": "lines.length >= MpvTextSubtitleLimits.maximumDialogueLines",
    "name": "lower dialogue count 64",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "override-drift--1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumOverrideDistanceCodeUnits: number = 2048",
    "replacement": "maximumOverrideDistanceCodeUnits: number = 2048 - 1",
    "name": "lower override closing distance 2048",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "override-drift-1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumOverrideDistanceCodeUnits: number = 2048",
    "replacement": "maximumOverrideDistanceCodeUnits: number = 2048 + 1",
    "name": "lower override closing distance 2049",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "override-guard-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "end - i > MpvTextSubtitleLimits.maximumOverrideDistanceCodeUnits",
    "replacement": "false",
    "name": "lower override closing distance 2049",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "override-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "end - i > MpvTextSubtitleLimits.maximumOverrideDistanceCodeUnits",
    "replacement": "end - i >= MpvTextSubtitleLimits.maximumOverrideDistanceCodeUnits",
    "name": "lower override closing distance 2048",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "family-drift--1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumFamilyCodeUnits: number = 128",
    "replacement": "maximumFamilyCodeUnits: number = 128 - 1",
    "name": "lower font family code units ascii 128",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "family-drift-1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumFamilyCodeUnits: number = 128",
    "replacement": "maximumFamilyCodeUnits: number = 128 + 1",
    "name": "lower font family code units ascii 129",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "family-guard-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "family.length > MpvTextSubtitleLimits.maximumFamilyCodeUnits",
    "replacement": "false",
    "name": "lower font family code units ascii 129",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "family-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "family.length > MpvTextSubtitleLimits.maximumFamilyCodeUnits",
    "replacement": "family.length >= MpvTextSubtitleLimits.maximumFamilyCodeUnits",
    "name": "lower font family code units ascii 128",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "runs-drift--1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumRuns: number = 4096",
    "replacement": "maximumRuns: number = 4096 - 1",
    "name": "lower tail runs 4096",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "runs-drift-1",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumRuns: number = 4096",
    "replacement": "maximumRuns: number = 4096 + 1",
    "name": "lower tail runs 4097",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "override-runs-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "flush(); if (runs.length > MpvTextSubtitleLimits.maximumRuns) { return undefined; }\n    for (const command",
    "replacement": "flush();\n    for (const command",
    "name": "lower override runs 4097",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "override-runs-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "flush(); if (runs.length > MpvTextSubtitleLimits.maximumRuns) { return undefined; }\n    for (const command",
    "replacement": "flush(); if (runs.length >= MpvTextSubtitleLimits.maximumRuns) { return undefined; }\n    for (const command",
    "name": "lower override runs 4096",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "tail-runs-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "flush(); if (runs.length > MpvTextSubtitleLimits.maximumRuns) { return undefined; } return { runs: runs",
    "replacement": "flush(); return { runs: runs",
    "name": "lower tail runs 4097",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "tail-runs-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "flush(); if (runs.length > MpvTextSubtitleLimits.maximumRuns) { return undefined; } return { runs: runs",
    "replacement": "flush(); if (runs.length >= MpvTextSubtitleLimits.maximumRuns) { return undefined; } return { runs: runs",
    "name": "lower tail runs 4096",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "min-scale-drift-+_0.0002",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "minimumSizeScale: number = 0.125",
    "replacement": "minimumSizeScale: number = 0.125 + 0.0002",
    "name": "lower font size ratio source 1",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "min-scale-drift--_0.0002",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "minimumSizeScale: number = 0.125",
    "replacement": "minimumSizeScale: number = 0.125 - 0.0002",
    "name": "lower font size ratio source 0.999",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "min-scale-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "scale < MpvTextSubtitleLimits.minimumSizeScale",
    "replacement": "false",
    "name": "lower font size ratio source 0.999",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "min-scale-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "scale < MpvTextSubtitleLimits.minimumSizeScale",
    "replacement": "scale <= MpvTextSubtitleLimits.minimumSizeScale",
    "name": "lower font size ratio source 1",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "max-scale-drift--_0.0002",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumSizeScale: number = 8",
    "replacement": "maximumSizeScale: number = 8 - 0.0002",
    "name": "lower font size ratio source 64",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "max-scale-drift-+_0.0002",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "maximumSizeScale: number = 8",
    "replacement": "maximumSizeScale: number = 8 + 0.0002",
    "name": "lower font size ratio source 64.001",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "max-scale-remove",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "scale > MpvTextSubtitleLimits.maximumSizeScale",
    "replacement": "false",
    "name": "lower font size ratio source 64.001",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "max-scale-compare",
    "file": "entry/src/main/ets/utils/MpvTextSubtitle.ts",
    "old": "scale > MpvTextSubtitleLimits.maximumSizeScale",
    "replacement": "scale >= MpvTextSubtitleLimits.maximumSizeScale",
    "name": "lower font size ratio source 64",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "id": "consumer-visibility-drift",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "this.wantedSubtitle && nativeCaption ? 1 : 0",
    "replacement": "this.wantedSubtitle && nativeCaption ? 0 : 1",
    "name": "adapter switches fallback and shared overlay through refresh and caches unchanged packet",
    "suite": "mpv-text-budget-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "lower tail runs 4096",
    "phase": "run-create",
    "scope": "mpv-text-budget",
    "suite": "mpv-text-budget-contract.test.cjs",
    "nativeInit": "run"
  },
  {
    "name": "adapter event code units ascii 65536",
    "phase": "native-create",
    "scope": "mpv-text-budget",
    "suite": "mpv-text-budget-contract.test.cjs",
    "nativeInit": "mpv-text",
    "requiredCalls": {
      "rig-create": 1
    }
  },
  {
    "name": "adapter event code units ascii 65536",
    "phase": "native-snapshot",
    "scope": "mpv-text-budget",
    "suite": "mpv-text-budget-contract.test.cjs",
    "requiredCalls": {
      "native-create": 1
    }
  },
  {
    "name": "adapter event code units ascii 65536",
    "phase": "native-command",
    "scope": "mpv-text-budget",
    "suite": "mpv-text-budget-contract.test.cjs",
    "requiredCalls": {
      "native-create": 1,
      "native-snapshot": 1
    },
    "details": {
      "command": "subtitle-visible"
    }
  },
  {
    "name": "lower event code units ascii 65536",
    "phase": "rig-create",
    "scope": "mpv-text-budget",
    "suite": "mpv-text-budget-contract.test.cjs"
  },
  {
    "name": "lower dialogue count 64",
    "phase": "setup",
    "scope": "mpv-text-budget",
    "suite": "mpv-text-budget-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'mpv-text-budget',fixture:'tests/mpv-text-budget-fixture.cjs',earlyPhase:'native-command',earlyOld:'const result=await observed(r.open());',earlyReplacement:"trace.call('native-command',()=>{},{command:'subtitle-visible'});const result=await observed(r.open());",selfFaults:[{id:'native-mpv-text-init-capture',phase:'native-create',file:'tests/mpv-text-budget-fixture.cjs',old:"trace.call(phase,()=>{",replacement:"((phase,operation)=>operation())(phase,()=>{",status:'detected'},{id:'run-model-init-capture',phase:'run-create',file:'tests/mpv-text-budget-fixture.cjs',old:"return trace.call('run-create',()=>{",replacement:"return ((phase,operation)=>operation())('run-create',()=>{",status:'detected'}]};
