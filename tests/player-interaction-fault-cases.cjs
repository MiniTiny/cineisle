module.exports = {
  "recipes": [
    {
      "id": "fullWidthSeekSpanMs-1",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "fullWidthSeekSpanMs: number = 90000",
      "replacement": "fullWidthSeekSpanMs: number = 89999",
      "name": "sdk pan forward",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "fullWidthSeekSpanMs1",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "fullWidthSeekSpanMs: number = 90000",
      "replacement": "fullWidthSeekSpanMs: number = 90001",
      "name": "sdk pan forward",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "speedHoldTriggerMs-1",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "speedHoldTriggerMs: number = 500",
      "replacement": "speedHoldTriggerMs: number = 499",
      "name": "sdk repeated hold restores original speed",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "speedHoldTriggerMs1",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "speedHoldTriggerMs: number = 500",
      "replacement": "speedHoldTriggerMs: number = 501",
      "name": "sdk repeated hold restores original speed",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "seekSliderStepMs-1",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "seekSliderStepMs: number = 1000",
      "replacement": "seekSliderStepMs: number = 999",
      "name": "sdk slider actual seek 1000",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "seekSliderStepMs1",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "seekSliderStepMs: number = 1000",
      "replacement": "seekSliderStepMs: number = 1001",
      "name": "sdk slider actual seek 1000",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "pan-consumer",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "offset * fullWidthSeekSpanMs /",
      "replacement": "offset * (fullWidthSeekSpanMs + 1) /",
      "name": "lower pan forward",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "hold-consumer",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "duration: speedHoldTriggerMs",
      "replacement": "duration: speedHoldTriggerMs + 1",
      "name": "sdk repeated hold restores original speed",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "slider-consumer",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "step: seekSliderStepMs",
      "replacement": "step: seekSliderStepMs + 1",
      "name": "sdk slider actual seek 1000",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "pan-lower-clamp-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "Math.max(0, Math.min(this.duration, this.seekAnchor + offset * fullWidthSeekSpanMs / Math.max(1, this.surfaceWidth)))",
      "replacement": "Math.min(this.duration, this.seekAnchor + offset * fullWidthSeekSpanMs / Math.max(1, this.surfaceWidth))",
      "name": "lower pan low-clamp",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "pan-upper-clamp-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "Math.max(0, Math.min(this.duration, this.seekAnchor + offset * fullWidthSeekSpanMs / Math.max(1, this.surfaceWidth)))",
      "replacement": "Math.max(0, this.seekAnchor + offset * fullWidthSeekSpanMs / Math.max(1, this.surfaceWidth))",
      "name": "sdk pan high-clamp",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "pan-minimum-denominator-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "offset * fullWidthSeekSpanMs / Math.max(1, this.surfaceWidth)",
      "replacement": "offset * fullWidthSeekSpanMs / this.surfaceWidth",
      "name": "sdk active pan resized width 0",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "pan-minimum-denominator-zero",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "offset * fullWidthSeekSpanMs / Math.max(1, this.surfaceWidth)",
      "replacement": "offset * fullWidthSeekSpanMs / Math.max(0, this.surfaceWidth)",
      "name": "lower active pan resized width 0",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "pan-finite-offset-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "this.seekAnchor < 0 || !Number.isFinite(offset)",
      "replacement": "this.seekAnchor < 0",
      "name": "lower preview rejects nonfinite offsets without replacing the anchor",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "pan-end-guard-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "if (allowed && position >= 0)",
      "replacement": "if (position >= 0)",
      "name": "sdk pending pan cancelled by PIN",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "slider-current-permit-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "return this.alive && this.visible && !this.locked && AppLock.permit() && !this.controlsLocked && !this.busy && !this.settingsBusy && !this.pipActive && this.ownerClient === AppService.client &&",
      "replacement": "return this.alive && this.visible && !this.locked && !this.controlsLocked && !this.busy && !this.settingsBusy && !this.pipActive && this.ownerClient === AppService.client &&",
      "name": "lower slider PIN during drag blocks commit",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "hold-repeat-guard-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "this.state !== 'playing' || this.heldSpeed > 0",
      "replacement": "this.state !== 'playing'",
      "name": "sdk repeated hold restores original speed",
      "suite": "player-interaction-contract.test.cjs"
    },
    {
      "id": "hold-restore-remove",
      "file": "entry/src/main/ets/pages/Player.ets",
      "old": "if (previous > 0) { this.speed = previous;",
      "replacement": "if (false) { this.speed = previous;",
      "name": "sdk hold end restores original speed",
      "suite": "player-interaction-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "av-create",
      "name": "sdk pan forward",
      "suite": "player-interaction-contract.test.cjs",
      "scope": "player-interaction",
      "nativeInit": true
    },
    {
      "phase": "native-seek",
      "name": "sdk pan forward",
      "suite": "player-interaction-contract.test.cjs",
      "scope": "player-interaction",
      "nativeInit": "seek",
      "requiredCalls": {
        "ui-action": 1,
        "controller-seek": 1
      }
    },
    {
      "phase": "native-speed",
      "name": "sdk repeated hold restores original speed",
      "suite": "player-interaction-contract.test.cjs",
      "scope": "player-interaction",
      "nativeInit": "speed",
      "requiredCalls": {
        "ui-action": 1
      }
    },
    {
      "phase": "slider-enum",
      "name": "lower slider actual seek 1000",
      "suite": "player-interaction-contract.test.cjs",
      "scope": "player-interaction",
      "nativeInit": "enum",
      "requiredCalls": {
        "ui-action": 1
      }
    },
    {
      "phase": "ui-compile",
      "name": "sdk pan forward",
      "suite": "player-interaction-contract.test.cjs",
      "scope": "player-interaction",
      "requiredCalls": {
        "av-create": 1,
        "controller-ready": 1
      }
    },
    {
      "phase": "setup",
      "name": "lower pan forward",
      "suite": "player-interaction-contract.test.cjs",
      "scope": "player-interaction"
    }
  ],
  "scope": "player-interaction",
  "fixture": "tests/player-interaction-fixture.cjs",
  "earlyPhase": "native-seek",
  "earlyOld": "const route = h.route();",
  "earlyReplacement": "trace.call('native-seek', () => {}); const route = h.route();",
  "selfFaults": [
    {
      "id": "native-av-observer-remove",
      "phase": "av-create",
      "file": "tests/player-interaction-fixture.cjs",
      "old": "trace.call('av-create', async () => {",
      "replacement": "((phase, operation) => operation())('av-create', async () => {",
      "status": "invalid"
    },
    {
      "id": "native-seek-observer-remove",
      "phase": "native-seek",
      "file": "tests/player-interaction-fixture.cjs",
      "old": "trace.call('native-seek', () => {",
      "replacement": "((phase, operation) => operation())('native-seek', () => {",
      "status": "detected"
    }
  ],
  "extraScopes": [
    "entry/src/main/resources"
  ]
}
