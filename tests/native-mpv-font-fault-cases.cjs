module.exports = {
  "recipes": [
    {
      "id": "native-default-54",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "kDefaultSubtitleFontSize = 55",
      "replacement": "kDefaultSubtitleFontSize = 54",
      "name": "core unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "native-default-56",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "kDefaultSubtitleFontSize = 55",
      "replacement": "kDefaultSubtitleFontSize = 56",
      "name": "N-API unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "state-consumer",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "double subtitleFontSize = kDefaultSubtitleFontSize;",
      "replacement": "double subtitleFontSize = kDefaultSubtitleFontSize + 1;",
      "name": "native initial state retains font 55 independently of property reads",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "snapshot-fallback-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "Number(\"sub-font-size\", kDefaultSubtitleFontSize)",
      "replacement": "Number(\"sub-font-size\")",
      "name": "N-API unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "snapshot-fallback-consumer",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "Number(\"sub-font-size\", kDefaultSubtitleFontSize)",
      "replacement": "Number(\"sub-font-size\", kDefaultSubtitleFontSize + 1)",
      "name": "core unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "property-status-guard-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "api.get_property(handle, name, MPV_FORMAT_DOUBLE, &value) < 0 || !std::isfinite(value)",
      "replacement": "!std::isfinite(value)",
      "name": "N-API unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "property-status-comparison",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "api.get_property(handle, name, MPV_FORMAT_DOUBLE, &value) < 0 || !std::isfinite(value)",
      "replacement": "api.get_property(handle, name, MPV_FORMAT_DOUBLE, &value) > 0 || !std::isfinite(value)",
      "name": "core unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "nonfinite-guard-remove",
      "file": "entry/src/main/cpp/mpv/NapiMpv.cpp",
      "old": "api.get_property(handle, name, MPV_FORMAT_DOUBLE, &value) < 0 || !std::isfinite(value)",
      "replacement": "api.get_property(handle, name, MPV_FORMAT_DOUBLE, &value) < 0",
      "name": "core actual font property NaN",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "initial-default-54",
      "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
      "old": "initialSubtitleFontSize: number = 55",
      "replacement": "initialSubtitleFontSize: number = 54",
      "name": "ArkTS initial snapshot retains font 55 before native polling",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "initial-default-56",
      "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
      "old": "initialSubtitleFontSize: number = 55",
      "replacement": "initialSubtitleFontSize: number = 56",
      "name": "ArkTS initial snapshot retains font 55 before native polling",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "initial-consumer",
      "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
      "old": "subtitleFontSize: MpvPlaybackEngine.initialSubtitleFontSize",
      "replacement": "subtitleFontSize: 0",
      "name": "ArkTS initial snapshot retains font 55 before native polling",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "caption-cache-font-remove",
      "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
      "old": "/${state.subtitleFontSize}/${state.subtitleOverflow}/",
      "replacement": "/${state.subtitleOverflow}/",
      "name": "unchanged native events recompute and republish after font property changes",
      "suite": "native-mpv-font-contract.test.cjs"
    },
    {
      "id": "caption-conversion-font-drift",
      "file": "entry/src/main/ets/service/MpvPlaybackEngine.ets",
      "old": "mpvTextSubtitle(selected?.codec ?? '', state.subtitleEvents, state.subtitleFontSize, state.subtitleOverflow)",
      "replacement": "mpvTextSubtitle(selected?.codec ?? '', state.subtitleEvents, 110, state.subtitleOverflow)",
      "name": "actual native to ArkTS font unavailable",
      "suite": "native-mpv-font-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "native-create",
      "name": "core unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs",
      "scope": "native-mpv-font",
      "nativeInit": true
    },
    {
      "phase": "native-create",
      "name": "N-API unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs",
      "scope": "native-mpv-font",
      "nativeInit": true
    },
    {
      "phase": "native-create",
      "name": "actual native to ArkTS font unavailable",
      "suite": "native-mpv-font-contract.test.cjs",
      "scope": "native-mpv-font",
      "nativeInit": true
    },
    {
      "phase": "native-snapshot",
      "name": "core unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs",
      "scope": "native-mpv-font",
      "nativeInit": "snapshot",
      "requiredCalls": {
        "native-create": 1
      }
    },
    {
      "phase": "native-snapshot",
      "name": "N-API unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs",
      "scope": "native-mpv-font",
      "nativeInit": "snapshot",
      "requiredCalls": {
        "native-create": 1
      }
    },
    {
      "phase": "native-snapshot",
      "name": "actual native to ArkTS font unavailable",
      "suite": "native-mpv-font-contract.test.cjs",
      "scope": "native-mpv-font",
      "nativeInit": "snapshot",
      "requiredCalls": {
        "native-create": 1
      }
    },
    {
      "phase": "setup",
      "name": "N-API unavailable font ignores output 110",
      "suite": "native-mpv-font-contract.test.cjs",
      "scope": "native-mpv-font"
    }
  ],
  "scope": "native-mpv-font",
  "extraScopes": [
    "entry/src/main/cpp/mpv"
  ],
  "fixture": "tests/native-mpv-font-fixture.cjs",
  "earlyPhase": "native-snapshot",
  "earlyOld": "async scenario(layer, options, action) {\n      try {\n        configure(options);",
  "earlyReplacement": "async scenario(layer, options, action) {\n      try {\n        trace.call('native-snapshot', () => {});\n        configure(options);",
  "selfFaults": [
    {
      "id": "native-observer-remove",
      "phase": "native-create",
      "file": "tests/native-mpv-font-fixture.cjs",
      "old": "trace.call(phase, async () => {",
      "replacement": "((phase, operation) => operation())(phase, async () => {",
      "status": "detected"
    },
    {
      "id": "native-snapshot-observer-remove",
      "phase": "native-snapshot",
      "file": "tests/native-mpv-font-fixture.cjs",
      "old": "trace.call(phase, async () => {",
      "replacement": "((phase, operation) => operation())(phase, async () => {",
      "status": "detected"
    }
  ]
};
