module.exports = {
  "recipes": [
    {
      "id": "minimumResumePercentage-1",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "minimumResumePercentage: number = 10",
      "replacement": "minimumResumePercentage: number = 9",
      "name": "lower offline stop at 9999",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "minimumResumePercentage1",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "minimumResumePercentage: number = 10",
      "replacement": "minimumResumePercentage: number = 11",
      "name": "facade offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "maximumResumePercentage-1",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "maximumResumePercentage: number = 90",
      "replacement": "maximumResumePercentage: number = 89",
      "name": "page offline stop at 90000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "maximumResumePercentage1",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "maximumResumePercentage: number = 90",
      "replacement": "maximumResumePercentage: number = 91",
      "name": "facade offline stop at 91000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "minimum-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "percentage < OfflineStopRules.minimumResumePercentage",
      "replacement": "false",
      "name": "page offline stop at 9999",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "minimum-comparator",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "percentage < OfflineStopRules.minimumResumePercentage",
      "replacement": "percentage <= OfflineStopRules.minimumResumePercentage",
      "name": "lower offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "maximum-position-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "percentage > OfflineStopRules.maximumResumePercentage ? 0 : position",
      "replacement": "false ? 0 : position",
      "name": "facade offline stop at 91000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "maximum-position-comparator",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "percentage > OfflineStopRules.maximumResumePercentage ? 0 : position",
      "replacement": "percentage >= OfflineStopRules.maximumResumePercentage ? 0 : position",
      "name": "facade offline stop at 90000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "maximum-played-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "played: percentage > OfflineStopRules.maximumResumePercentage",
      "replacement": "played: false",
      "name": "page offline stop at 91000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "maximum-played-comparator",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "played: percentage > OfflineStopRules.maximumResumePercentage",
      "replacement": "played: percentage >= OfflineStopRules.maximumResumePercentage",
      "name": "page offline stop at 90000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "minimum-consumer",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "percentage < OfflineStopRules.minimumResumePercentage",
      "replacement": "percentage < OfflineStopRules.minimumResumePercentage + 1",
      "name": "page offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "maximum-consumer",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "played: percentage > OfflineStopRules.maximumResumePercentage",
      "replacement": "played: percentage > OfflineStopRules.maximumResumePercentage + 1",
      "name": "page offline stop at 91000",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "float-position-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "Math.fround(position)",
      "replacement": "position",
      "name": "lower Kotlin float vector 2",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "float-duration-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "Math.fround(duration)",
      "replacement": "duration",
      "name": "facade Kotlin float vector 1",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "float-division-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "Math.fround(Math.fround(position) / Math.fround(duration))",
      "replacement": "Math.fround(position) / Math.fround(duration)",
      "name": "page Kotlin float vector 0",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "float-multiplication-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "Math.fround(Math.fround(Math.fround(position) / Math.fround(duration)) * 100)",
      "replacement": "Math.fround(Math.fround(position) / Math.fround(duration)) * 100",
      "name": "lower Kotlin float vector 0",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "truncate-round",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "Math.trunc(",
      "replacement": "Math.round(",
      "name": "page offline stop at 90999",
      "suite": "offline-stop-contract.test.cjs"
    },
    {
      "id": "truncate-remove",
      "file": "entry/src/main/ets/utils/OfflinePlayback.ts",
      "old": "Math.trunc(Math.fround(Math.fround(Math.fround(position) / Math.fround(duration)) * 100))",
      "replacement": "Math.fround(Math.fround(Math.fround(position) / Math.fround(duration)) * 100)",
      "name": "facade offline stop at 90001",
      "suite": "offline-stop-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "av-create",
      "name": "page offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs",
      "scope": "offline-stop-contract",
      "nativeInit": true
    },
    {
      "phase": "file-write",
      "name": "facade offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs",
      "scope": "offline-stop-contract",
      "nativeInit": "offline-write",
      "requiredCalls": {
        "record-stop": 1
      },
      "details": {
        "filename": "experience.json.tmp"
      }
    },
    {
      "phase": "file-sync",
      "name": "facade offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs",
      "scope": "offline-stop-contract",
      "nativeInit": "offline-sync",
      "requiredCalls": {
        "record-stop": 1,
        "file-write": 1
      },
      "details": {
        "filename": "experience.json.tmp"
      }
    },
    {
      "phase": "file-rename",
      "name": "facade offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs",
      "scope": "offline-stop-contract",
      "nativeInit": "offline-rename",
      "requiredCalls": {
        "record-stop": 1,
        "file-sync": 1
      },
      "details": {
        "filename": "experience.json.tmp"
      }
    },
    {
      "phase": "record-stop",
      "name": "page offline stop at 10000",
      "suite": "offline-stop-contract.test.cjs",
      "scope": "offline-stop-contract",
      "requiredCalls": {
        "av-create": 1
      }
    },
    {
      "phase": "setup",
      "name": "lower Kotlin float vector 0",
      "suite": "offline-stop-contract.test.cjs",
      "scope": "offline-stop-contract"
    }
  ],
  "scope": "offline-stop-contract",
  "fixture": "tests/offline-stop-contract-fixture.cjs",
  "earlyPhase": "file-write",
  "earlyOld": "const { route } = helpers.setup();",
  "earlyReplacement": "trace.call('file-write', () => {}); const { route } = helpers.setup();",
  "selfFaults": [
    {
      "id": "native-av-init-observer-remove",
      "phase": "av-create",
      "file": "tests/offline-stop-contract-fixture.cjs",
      "old": "trace.call('av-create', async () => {",
      "replacement": "((phase, operation) => operation())('av-create', async () => {",
      "status": "detected"
    },
    {
      "id": "native-file-write-observer-remove",
      "phase": "file-write",
      "file": "tests/offline-stop-contract-fixture.cjs",
      "old": "trace.call(name, operation, { filename })",
      "replacement": "operation()",
      "status": "detected"
    }
  ]
};
