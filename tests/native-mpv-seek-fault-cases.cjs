module.exports = {
  "recipes": [
    {
      "id": "seek-cap-lower",
      "file": "entry/src/main/cpp/mpv/MpvLimits.h",
      "old": "kSeekConfirmationToleranceMs = 1000",
      "replacement": "kSeekConfirmationToleranceMs = 999",
      "name": "N-API seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-cap-higher",
      "file": "entry/src/main/cpp/mpv/MpvLimits.h",
      "old": "kSeekConfirmationToleranceMs = 1000",
      "replacement": "kSeekConfirmationToleranceMs = 1001",
      "name": "core seek distance 1001",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-comparator",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "<= limits::kSeekConfirmationToleranceMs",
      "replacement": "< limits::kSeekConfirmationToleranceMs",
      "name": "core seek distance -1000",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-protection-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "restartedAfterSeek && std::abs(state.position - seekTarget) <= limits::kSeekConfirmationToleranceMs",
      "replacement": "restartedAfterSeek",
      "name": "N-API seek distance 1001",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-absolute-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "std::abs(state.position - seekTarget)",
      "replacement": "(state.position - seekTarget)",
      "name": "core seek distance -1001",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-consumer",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "<= limits::kSeekConfirmationToleranceMs",
      "replacement": "<= limits::kSeekConfirmationToleranceMs + 1",
      "name": "N-API seek distance -1001",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-target-drift",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "seekTarget = value;",
      "replacement": "seekTarget = value + 1;",
      "name": "core seek distance -1000",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "restart-prerequisite-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "restartedAfterSeek && std::abs(state.position - seekTarget) <= limits::kSeekConfirmationToleranceMs",
      "replacement": "std::abs(state.position - seekTarget) <= limits::kSeekConfirmationToleranceMs",
      "name": "N-API seek events none",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-event-prerequisite-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "if (seekObserved) restartedAfterSeek = true;",
      "replacement": "restartedAfterSeek = true;",
      "name": "core seek events restart-only",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-observation-reset-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "state.ended = false; seekObserved = false; restartedAfterSeek = false; seekTarget = value;",
      "replacement": "state.ended = false; restartedAfterSeek = false; seekTarget = value;",
      "name": "N-API newer seek clears an older pending event pair",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "restart-observation-reset-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "state.ended = false; seekObserved = false; restartedAfterSeek = false; seekTarget = value;",
      "replacement": "state.ended = false; seekObserved = false; seekTarget = value;",
      "name": "core newer seek clears an older pending event pair",
      "suite": "native-mpv-seek-contract.test.cjs"
    },
    {
      "id": "seek-ack-revision",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "state.seekDone = state.seekRevision;",
      "replacement": "state.seekDone = state.seekRevision - 1;",
      "name": "N-API seek distance 999",
      "suite": "native-mpv-seek-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "native-create",
      "name": "N-API seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs",
      "scope": "native-mpv-seek",
      "nativeInit": true
    },
    {
      "phase": "native-create",
      "name": "core seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs",
      "scope": "native-mpv-seek",
      "nativeInit": true
    },
    {
      "phase": "native-command",
      "name": "N-API seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs",
      "scope": "native-mpv-seek",
      "nativeInit": "seek-command",
      "requiredCalls": {
        "native-create": 1
      }
    },
    {
      "phase": "native-command",
      "name": "core seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs",
      "scope": "native-mpv-seek",
      "nativeInit": "seek-command",
      "requiredCalls": {
        "native-create": 1
      }
    },
    {
      "phase": "native-snapshot",
      "name": "N-API seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs",
      "scope": "native-mpv-seek",
      "requiredCalls": {
        "native-create": 1,
        "native-command": 1
      }
    },
    {
      "phase": "native-snapshot",
      "name": "core seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs",
      "scope": "native-mpv-seek",
      "requiredCalls": {
        "native-create": 1,
        "native-command": 1
      }
    },
    {
      "phase": "setup",
      "name": "core seek distance 1000",
      "suite": "native-mpv-seek-contract.test.cjs",
      "scope": "native-mpv-seek"
    }
  ],
  "scope": "native-mpv-seek",
  "extraScopes": [
    "entry/src/main/cpp/mpv"
  ],
  "fixture": "tests/native-mpv-seek-fixture.cjs",
  "earlyPhase": "native-command",
  "earlyOld": "try {\n        const handle = await native(",
  "earlyReplacement": "try {\n        trace.call('native-command', () => {});\n        const handle = await native(",
  "selfFaults": [
    {
      "id": "native-api-observer-remove",
      "phase": "native-create",
      "file": "tests/native-mpv-seek-fixture.cjs",
      "old": "trace.call(phase, async () => {",
      "replacement": "((phase, operation) => operation())(phase, async () => {",
      "status": "detected"
    },
    {
      "id": "native-command-observer-remove",
      "phase": "native-command",
      "file": "tests/native-mpv-seek-fixture.cjs",
      "old": "trace.call(phase, async () => {",
      "replacement": "((phase, operation) => operation())(phase, async () => {",
      "status": "detected"
    }
  ]
};
