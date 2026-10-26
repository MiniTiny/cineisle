module.exports = {
  "recipes": [
    {
      "id": "fourKWidthThresholdPx-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "fourKWidthThresholdPx: number = 3840",
      "replacement": "fourKWidthThresholdPx: number = 3839",
      "name": "page metadata 4k width below",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourKWidthThresholdPx1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "fourKWidthThresholdPx: number = 3840",
      "replacement": "fourKWidthThresholdPx: number = 3841",
      "name": "page metadata 4k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourKWidthThresholdPx-comparison",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Width! >= fourKWidthThresholdPx",
      "replacement": "video.Width! > fourKWidthThresholdPx",
      "name": "page metadata 4k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourKWidthThresholdPx-consumer-remove",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Width! >= fourKWidthThresholdPx",
      "replacement": "false",
      "name": "page metadata 4k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourKHeightThresholdPx-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "fourKHeightThresholdPx: number = 2160",
      "replacement": "fourKHeightThresholdPx: number = 2159",
      "name": "page metadata 4k height below",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourKHeightThresholdPx1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "fourKHeightThresholdPx: number = 2160",
      "replacement": "fourKHeightThresholdPx: number = 2161",
      "name": "page metadata 4k height at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourKHeightThresholdPx-comparison",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Height! >= fourKHeightThresholdPx",
      "replacement": "video.Height! > fourKHeightThresholdPx",
      "name": "page metadata 4k height at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourKHeightThresholdPx-consumer-remove",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Height! >= fourKHeightThresholdPx",
      "replacement": "false",
      "name": "page metadata 4k height at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKWidthThresholdPx-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "eightKWidthThresholdPx: number = 7680",
      "replacement": "eightKWidthThresholdPx: number = 7679",
      "name": "page metadata 8k width below",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKWidthThresholdPx1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "eightKWidthThresholdPx: number = 7680",
      "replacement": "eightKWidthThresholdPx: number = 7681",
      "name": "page metadata 8k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKWidthThresholdPx-comparison",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Width! >= eightKWidthThresholdPx",
      "replacement": "video.Width! > eightKWidthThresholdPx",
      "name": "page metadata 8k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKWidthThresholdPx-consumer-remove",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Width! >= eightKWidthThresholdPx",
      "replacement": "false",
      "name": "page metadata 8k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKHeightThresholdPx-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "eightKHeightThresholdPx: number = 4320",
      "replacement": "eightKHeightThresholdPx: number = 4319",
      "name": "page metadata 8k height below",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKHeightThresholdPx1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "eightKHeightThresholdPx: number = 4320",
      "replacement": "eightKHeightThresholdPx: number = 4321",
      "name": "page metadata 8k height at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKHeightThresholdPx-comparison",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Height! >= eightKHeightThresholdPx",
      "replacement": "video.Height! > eightKHeightThresholdPx",
      "name": "page metadata 8k height at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightKHeightThresholdPx-consumer-remove",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Height! >= eightKHeightThresholdPx",
      "replacement": "false",
      "name": "page metadata 8k height at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "eightK-or-to-and",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Width! >= eightKWidthThresholdPx || video.Height! >= eightKHeightThresholdPx",
      "replacement": "video.Width! >= eightKWidthThresholdPx && video.Height! >= eightKHeightThresholdPx",
      "name": "page metadata 8k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "fourK-or-to-and",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "video.Width! >= fourKWidthThresholdPx || video.Height! >= fourKHeightThresholdPx",
      "replacement": "video.Width! >= fourKWidthThresholdPx && video.Height! >= fourKHeightThresholdPx",
      "name": "page metadata 4k width at",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "positive-width-guard-remove",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "(video.Width ?? 0) > 0",
      "replacement": "true",
      "name": "page metadata positive axes 0,4320",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "positive-height-guard-remove",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "(video.Height ?? 0) > 0",
      "replacement": "true",
      "name": "page metadata positive axes 7680,0",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "minute-factor-59",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "runtimeTicksPerMinute: number = JellyfinTime.ticksPerSecond * 60",
      "replacement": "runtimeTicksPerMinute: number = JellyfinTime.ticksPerSecond * 59",
      "name": "page metadata runtime ticks 599999999",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "minute-factor-61",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "runtimeTicksPerMinute: number = JellyfinTime.ticksPerSecond * 60",
      "replacement": "runtimeTicksPerMinute: number = JellyfinTime.ticksPerSecond * 61",
      "name": "page metadata runtime ticks 600000000",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "runtime-divisor-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "item.RunTimeTicks! / runtimeTicksPerMinute",
      "replacement": "item.RunTimeTicks! / (runtimeTicksPerMinute - 1)",
      "name": "page metadata runtime ticks 599999999",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "runtime-divisor1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "item.RunTimeTicks! / runtimeTicksPerMinute",
      "replacement": "item.RunTimeTicks! / (runtimeTicksPerMinute + 1)",
      "name": "page metadata runtime ticks 600000000",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "runtime-rounding",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "Math.floor(item.RunTimeTicks! / runtimeTicksPerMinute)",
      "replacement": "Math.round(item.RunTimeTicks! / runtimeTicksPerMinute)",
      "name": "page metadata runtime ticks 599999999",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "runtime-finite-guard",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "Number.isFinite(item.RunTimeTicks) &&",
      "replacement": "true &&",
      "name": "page metadata invalid runtime Infinity",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "runtime-positive-guard",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "item.RunTimeTicks! > 0",
      "replacement": "true",
      "name": "page metadata invalid runtime 0",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "shared-time-unit-1",
      "file": "entry/src/main/ets/utils/JellyfinTime.ts",
      "old": "ticksPerMillisecond: number = 10000",
      "replacement": "ticksPerMillisecond: number = 9999",
      "name": "page metadata runtime ticks 599999999",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "shared-time-unit1",
      "file": "entry/src/main/ets/utils/JellyfinTime.ts",
      "old": "ticksPerMillisecond: number = 10000",
      "replacement": "ticksPerMillisecond: number = 10001",
      "name": "page metadata runtime ticks 600000000",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerMiB-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytesPerMiB: number = 1024 * 1024",
      "replacement": "bytesPerMiB: number = 1024 * 1024 - 1",
      "name": "panel metadata size bytes 1048575",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerMiB1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytesPerMiB: number = 1024 * 1024",
      "replacement": "bytesPerMiB: number = 1024 * 1024 + 1",
      "name": "panel metadata size bytes 1048576",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerMiB-comparison",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytes! >= bytesPerMiB",
      "replacement": "bytes! > bytesPerMiB",
      "name": "panel metadata size bytes 1048576",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerGiB-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytesPerGiB: number = bytesPerMiB * 1024",
      "replacement": "bytesPerGiB: number = bytesPerMiB * 1024 - 1",
      "name": "panel metadata size bytes 1073741823",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerGiB1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytesPerGiB: number = bytesPerMiB * 1024",
      "replacement": "bytesPerGiB: number = bytesPerMiB * 1024 + 1",
      "name": "panel metadata size bytes 1073741824",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerGiB-comparison",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytes! >= bytesPerGiB",
      "replacement": "bytes! > bytesPerGiB",
      "name": "panel metadata size bytes 1073741824",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerMiB-divisor-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytes! / bytesPerMiB",
      "replacement": "bytes! / (bytesPerMiB - 1)",
      "name": "panel metadata size bytes 1101004",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerMiB-divisor1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytes! / bytesPerMiB",
      "replacement": "bytes! / (bytesPerMiB + 1)",
      "name": "panel metadata size bytes 1101005",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerGiB-divisor-1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytes! / bytesPerGiB",
      "replacement": "bytes! / (bytesPerGiB - 1)",
      "name": "panel metadata size bytes 1079110533",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "bytesPerGiB-divisor1",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "bytes! / bytesPerGiB",
      "replacement": "bytes! / (bytesPerGiB + 1)",
      "name": "panel metadata size bytes 1079110534",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "mib-precision",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "(bytes! / bytesPerMiB).toFixed(1)",
      "replacement": "(bytes! / bytesPerMiB).toFixed(2)",
      "name": "panel metadata size bytes 1048576",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "gib-precision",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "(bytes! / bytesPerGiB).toFixed(2)",
      "replacement": "(bytes! / bytesPerGiB).toFixed(1)",
      "name": "panel metadata size bytes 1073741824",
      "suite": "detail-presentation-contract.test.cjs"
    },
    {
      "id": "size-integer-guard-remove",
      "file": "entry/src/main/ets/utils/DetailPresentation.ets",
      "old": "!Number.isSafeInteger(bytes)",
      "replacement": "false",
      "name": "page metadata invalid size 0.5",
      "suite": "detail-presentation-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "ui-compile",
      "name": "page metadata runtime ticks 600000000",
      "suite": "detail-presentation-contract.test.cjs",
      "scope": "detail-presentation",
      "nativeInit": "sdk",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "originalCode": "MODULE_NOT_FOUND"
      }
    },
    {
      "phase": "unit-read",
      "name": "page metadata runtime ticks 600000000",
      "suite": "detail-presentation-contract.test.cjs",
      "scope": "detail-presentation",
      "nativeInit": "unit",
      "requiredCalls": {
        "ui-compile": 1,
        "entry": 1
      },
      "details": {
        "originalCode": "EISDIR"
      }
    },
    {
      "phase": "ui-render",
      "name": "page metadata runtime ticks 600000000",
      "suite": "detail-presentation-contract.test.cjs",
      "scope": "detail-presentation",
      "requiredCalls": {
        "ui-compile": 1,
        "entry": 1
      }
    },
    {
      "phase": "setup",
      "name": "helper metadata runtime ticks 600000000",
      "suite": "detail-presentation-contract.test.cjs",
      "scope": "detail-presentation"
    }
  ],
  "scope": "detail-presentation",
  "extraScopes": [
    "entry/src/main/resources/base"
  ],
  "fixture": "tests/detail-presentation-fixture.cjs",
  "earlyPhase": "ui-render",
  "earlyOld": "    trace.call('entry', () => {});",
  "earlyReplacement": "    trace.call('ui-render', () => {}); trace.call('entry', () => {});",
  "selfFaults": [
    {
      "id": "sdk-body-observer-remove",
      "phase": "ui-compile",
      "file": "tests/detail-presentation-fixture.cjs",
      "old": "return trace.call('ui-compile', () => {",
      "replacement": "return ((phase, operation) => operation())('ui-compile', () => {",
      "status": "detected"
    },
    {
      "id": "unit-read-observer-remove",
      "phase": "unit-read",
      "file": "tests/detail-presentation-fixture.cjs",
      "old": "return trace.call('unit-read', () => {",
      "replacement": "return ((phase, operation) => operation())('unit-read', () => {",
      "status": "invalid"
    }
  ]
};
