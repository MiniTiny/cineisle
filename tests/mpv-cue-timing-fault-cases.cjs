const recipes = [
  {
    "id": "duration--1",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "fallbackCueDurationMs: number = 1000",
    "replacement": "fallbackCueDurationMs: number = 999",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "duration-1",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "fallbackCueDurationMs: number = 1000",
    "replacement": "fallbackCueDurationMs: number = 1001",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "duration-consumer",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "start + MpvPlaybackEngine.fallbackCueDurationMs",
    "replacement": "start + MpvPlaybackEngine.fallbackCueDurationMs + 1",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "end-guard-remove",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "Number.isFinite(state.subtitleEnd) && state.subtitleEnd > start",
    "replacement": "true",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "end-compare",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "state.subtitleEnd > start",
    "replacement": "state.subtitleEnd >= start",
    "name": "MPV first-open cue end equal start",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "start-compare",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "state.subtitleStart >= 0",
    "replacement": "state.subtitleStart > 0",
    "name": "MPV first-open cue start zero",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "start-round-remove",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "Math.round(state.subtitleStart)",
    "replacement": "state.subtitleStart",
    "name": "MPV first-open cue start 499.5",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "end-round-remove",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "Math.round(state.subtitleEnd)",
    "replacement": "state.subtitleEnd",
    "name": "MPV first-open cue end fraction rounds zero",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "compare-before-start-round",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "state.subtitleEnd > start",
    "replacement": "state.subtitleEnd > state.subtitleStart",
    "name": "MPV compares the end against the rounded start before rounding the end",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "identity-guard-remove",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "if (identity === this.subtitlePublished) { return; }",
    "replacement": "if (false) { return; }",
    "name": "MPV timer polling uses the fallback and formatted identity deduplication",
    "suite": "mpv-cue-timing-contract.test.cjs"
  },
  {
    "id": "fallback-applied-to-valid-end",
    "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
    "old": "? Math.round(state.subtitleEnd) : start + MpvPlaybackEngine.fallbackCueDurationMs",
    "replacement": "? Math.max(Math.round(state.subtitleEnd), start + MpvPlaybackEngine.fallbackCueDurationMs) : start + MpvPlaybackEngine.fallbackCueDurationMs",
    "name": "MPV first-open cue end duration999",
    "suite": "mpv-cue-timing-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "native-create",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs",
    "scope": "mpv-cue-timing",
    "nativeInit": "mpv-cue"
  },
  {
    "phase": "native-snapshot",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs",
    "scope": "mpv-cue-timing",
    "nativeInit": "mpv-cue-snapshot",
    "requiredCalls": {
      "native-create": 1
    }
  },
  {
    "phase": "native-command",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs",
    "scope": "mpv-cue-timing",
    "requiredCalls": {
      "native-snapshot": 1
    }
  },
  {
    "phase": "rig-create",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs",
    "scope": "mpv-cue-timing"
  },
  {
    "phase": "setup",
    "name": "MPV first-open cue end missing",
    "suite": "mpv-cue-timing-contract.test.cjs",
    "scope": "mpv-cue-timing"
  }
];
module.exports={recipes,controls,scope:'mpv-cue-timing',fixture:'tests/mpv-cue-timing-fixture.cjs',earlyPhase:'native-command',earlyOld:'try { await test.action(check); }',earlyReplacement:"try { trace.call('native-command',()=>{}); await test.action(check); }",selfFaults:[{id:'native-create-observer-remove',phase:'native-create',file:'tests/mpv-cue-timing-fixture.cjs',old:"async (...args) => trace.call(phase, async () => {",replacement:"async (...args) => ((phase,operation)=>operation())(phase, async () => {",status:'detected'},{id:'native-snapshot-observer-remove',phase:'native-snapshot',file:'tests/mpv-cue-timing-fixture.cjs',old:"async (...args) => trace.call(phase, async () => {",replacement:"async (...args) => ((phase,operation)=>operation())(phase, async () => {",status:'detected'}]};
