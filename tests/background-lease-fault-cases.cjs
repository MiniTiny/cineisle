module.exports = {
  "recipes": [
    {
      "id": "request-code-1",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "backgroundRequestCode: number = 717",
      "replacement": "backgroundRequestCode: number = 716",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "request-code1",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "backgroundRequestCode: number = 717",
      "replacement": "backgroundRequestCode: number = 718",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "consumer-code-drift",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "requestCode: backgroundRequestCode,",
      "replacement": "requestCode: backgroundRequestCode + 1,",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "ability-name-drift",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "abilityName: context.abilityInfo.name",
      "replacement": "abilityName: context.abilityInfo.bundleName",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "bundle-name-drift",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "bundleName: context.abilityInfo.bundleName",
      "replacement": "bundleName: context.abilityInfo.name",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "operation-type-drift",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "operationType: wantAgent.OperationType.START_ABILITY",
      "replacement": "operationType: wantAgent.OperationType.START_ABILITY + 1",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "flag-drift",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG]",
      "replacement": "wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG + 1]",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "actual-agent-substitution",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "modes[0], agent",
      "replacement": "modes[0], { ...agent }",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "single-overload-comparator",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "if (modes.length === 1)",
      "replacement": "if (modes.length > 1)",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "multiple-map-reverse",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "value === background.BackgroundMode.AUDIO_PLAYBACK ? 'audioPlayback' : 'dataTransfer'",
      "replacement": "value === background.BackgroundMode.AUDIO_PLAYBACK ? 'dataTransfer' : 'audioPlayback'",
      "name": "union preserves insertion and mapping 2,1",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "operation-serialization-bypass",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "BackgroundLease.operations.then(async () => {",
      "replacement": "Promise.resolve().then(async () => {",
      "name": "held want serializes overlapping mode addition",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "rollback-alias",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "const previous = new Set(BackgroundLease.modes);",
      "replacement": "const previous = BackgroundLease.modes;",
      "name": "failed union start retains previous audio and permits retry",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "rollback-remove",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "BackgroundLease.modes = previous;",
      "replacement": "",
      "name": "failed final stop rolls back lease and next operation retries stop",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "queue-recovery-remove",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "BackgroundLease.operations = operation.catch(() => {});",
      "replacement": "BackgroundLease.operations = operation;",
      "name": "failed initial want rolls back and next queued operation recovers",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "shared-stop-guard-remove",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "if (!BackgroundLease.modes.size)",
      "replacement": "if (true)",
      "name": "releasing 1 preserves other mode before final stop",
      "suite": "background-lease-contract.test.cjs"
    },
    {
      "id": "empty-stop-guard-remove",
      "file": "entry/src/main/ets/service/BackgroundLease.ets",
      "old": "if (previous.size)",
      "replacement": "if (true)",
      "name": "empty disable performs no native background work",
      "suite": "background-lease-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "want-agent",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs",
      "scope": "background-lease",
      "nativeInit": "want",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "requestCode": 717
      }
    },
    {
      "phase": "background-start",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs",
      "scope": "background-lease",
      "nativeInit": "start",
      "requiredCalls": {
        "want-agent": 1,
        "entry": 1
      }
    },
    {
      "phase": "background-stop",
      "name": "releasing 1 preserves other mode before final stop",
      "suite": "background-lease-contract.test.cjs",
      "scope": "background-lease",
      "nativeInit": "stop",
      "requiredCalls": {
        "background-start": 3,
        "entry": 4
      }
    },
    {
      "phase": "setup",
      "name": "singleton mode 2 uses actual WantAgent payload and numeric overload",
      "suite": "background-lease-contract.test.cjs",
      "scope": "background-lease"
    }
  ],
  "scope": "background-lease",
  "extraScopes": [
    "entry/src/main/resources"
  ],
  "fixture": "tests/background-lease-fixture.cjs",
  "earlyPhase": "background-start",
  "earlyOld": "set(ctx, mode, enabled) { trace.call('entry', () => {});",
  "earlyReplacement": "set(ctx, mode, enabled) { trace.call('background-start', () => {}); trace.call('entry', () => {});",
  "selfFaults": [
    {
      "id": "want-api-observer-remove",
      "phase": "want-agent",
      "file": "tests/background-lease-fixture.cjs",
      "old": "trace.call('want-agent', async () => {",
      "replacement": "((phase, operation) => operation())('want-agent', async () => {",
      "status": "detected"
    },
    {
      "id": "stop-api-observer-remove",
      "phase": "background-stop",
      "file": "tests/background-lease-fixture.cjs",
      "old": "trace.call('background-stop', async () => {",
      "replacement": "((phase, operation) => operation())('background-stop', async () => {",
      "status": "detected"
    }
  ]
};
