module.exports = {
  "recipes": [
    {
      "id": "fallback-0.49",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "fallbackBrightness: number = 0.5",
      "replacement": "fallbackBrightness: number = 0.49",
      "name": "window original brightness negative sentinel",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "fallback-0.51",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "fallbackBrightness: number = 0.5",
      "replacement": "fallbackBrightness: number = 0.51",
      "name": "window original brightness negative sentinel",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "fallback-consumer-remove",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "return value >= 0 ? value : PlaybackWindow.fallbackBrightness;",
      "replacement": "return value;",
      "name": "window original brightness negative sentinel",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "fallback-consumer-drift",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "return value >= 0 ? value : PlaybackWindow.fallbackBrightness;",
      "replacement": "return value >= 0 ? value : 0;",
      "name": "Player brightness gesture reads actual window fallback",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "zero-comparison",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "return value >= 0 ? value",
      "replacement": "return value > 0 ? value",
      "name": "window original brightness zero",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "negative-comparison",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "return value >= 0 ? value",
      "replacement": "return value > -1 ? value",
      "name": "window original brightness other negative",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "finite-behavior-drift",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "return value >= 0 ? value",
      "replacement": "return value >= 0 && Number.isFinite(value) ? value",
      "name": "window original brightness infinity",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "applied-precedence",
      "file": "entry/src/main/ets/service/PlaybackWindow.ets",
      "old": "this.appliedBrightness ?? this.original?.brightness",
      "replacement": "this.original?.brightness ?? this.appliedBrightness",
      "name": "window applied brightness takes precedence and restores original negative mode",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "id": "gesture-cached-value",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "this.window?.brightness ?? this.windowBrightness : this.volume",
      "replacement": "this.windowBrightness : this.volume",
      "name": "Player gesture reads the applied window rather than stale view brightness",
      "suite": "window-brightness-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "window-read",
      "name": "window original brightness negative sentinel",
      "nativeInit": "window",
      "details": {
        "originalError": "window unavailable"
      },
      "scope": "playback-timing",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "phase": "brightness-write",
      "name": "Player rejected brightness write retains original feedback and fallback",
      "nativeInit": "brightness",
      "requiredCalls": {
        "window-read": 1
      },
      "details": {
        "originalError": "native brightness rejected",
        "value": 0.7
      },
      "scope": "playback-timing",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "phase": "brightness-write",
      "name": "Player rejected brightness write retains original feedback and fallback",
      "requiredCalls": {
        "window-read": 1
      },
      "scope": "playback-timing",
      "suite": "window-brightness-contract.test.cjs"
    },
    {
      "phase": "setup",
      "name": "window original brightness negative sentinel",
      "scope": "playback-timing",
      "suite": "window-brightness-contract.test.cjs"
    }
  ],
  "scope": "playback-timing",
  "fixture": "tests/window-brightness-fixture.cjs",
  "earlyPhase": "brightness-write",
  "earlyOld": "async page() { const r = await base.offlinePage()",
  "earlyReplacement": "async page() { f.trace().call('brightness-write', () => {}); const r = await base.offlinePage()",
  "selfFaults": [
    {
      "id": "window-read-observer-remove",
      "phase": "window-read",
      "file": "tests/window-brightness-fixture.cjs",
      "old": "f.trace().call('window-read', async () => {",
      "replacement": "((phase, operation) => operation())('window-read', async () => {",
      "status": "detected"
    },
    {
      "id": "brightness-write-observer-remove",
      "phase": "brightness-write",
      "file": "tests/window-brightness-fixture.cjs",
      "old": "f.trace().call('brightness-write', async () => {",
      "replacement": "((phase, operation) => operation())('brightness-write', async () => {",
      "status": "detected"
    }
  ]
};
