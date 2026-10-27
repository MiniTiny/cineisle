module.exports = {
  "recipes": [
    {
      "id": "timestamp-cap-9007199254740990",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "kMaxExactTimestampMs = 9007199254740991ULL",
      "replacement": "kMaxExactTimestampMs = 9007199254740990ULL",
      "name": "N-API exact timestamp 9007199254740991",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "timestamp-cap-9007199254740992",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "kMaxExactTimestampMs = 9007199254740991ULL",
      "replacement": "kMaxExactTimestampMs = 9007199254740992ULL",
      "name": "N-API rejects timestamp above",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "cap-consumer-drift",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "Integer(env, args[1], kMaxExactTimestampMs)",
      "replacement": "Integer(env, args[1], kMaxExactTimestampMs + 1)",
      "name": "N-API rejects timestamp above",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "cap-consumer-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "Integer(env, args[1], kMaxExactTimestampMs)",
      "replacement": "Integer(env, args[1], UINT64_MAX)",
      "name": "N-API rejects timestamp above",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "upper-comparison",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "number > double(maximum)",
      "replacement": "number >= double(maximum)",
      "name": "lower exact timestamp 9007199254740991",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "upper-guard-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": " || number > double(maximum)",
      "replacement": "",
      "name": "lower rejects timestamp above",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "positive-guard-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "number < 0 || ",
      "replacement": "",
      "name": "lower rejects timestamp negative",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "integer-guard-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "std::floor(number) != number || ",
      "replacement": "",
      "name": "N-API rejects timestamp fraction",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "read-status-guard-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "napi_get_value_double(env, value, &number) != napi_ok || ",
      "replacement": "",
      "name": "N-API rejects timestamp string",
      "suite": "ass-timestamp-contract.test.cjs"
    },
    {
      "id": "timestamp-forward-drift",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "int64_t(Integer(env, args[1], kMaxExactTimestampMs))",
      "replacement": "int64_t(Integer(env, args[1], kMaxExactTimestampMs)) + 1",
      "name": "N-API exact timestamp 9007199254740990",
      "suite": "ass-timestamp-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "native-create",
      "name": "N-API exact timestamp 9007199254740991",
      "nativeInit": true,
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "libraryFailures": 1,
        "numberFailures": 0,
        "actualError": "ass_memory_unavailable"
      },
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp"
    },
    {
      "phase": "native-render",
      "name": "N-API exact timestamp 9007199254740991",
      "nativeInit": "read",
      "requiredCalls": {
        "native-create": 1
      },
      "details": {
        "numberFailures": 1,
        "reads": 1,
        "actualError": "ass_argument_invalid"
      },
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp"
    },
    {
      "phase": "core-integer",
      "name": "lower exact timestamp 9007199254740991",
      "nativeInit": "read",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "numberFailures": 1,
        "reads": 1,
        "actualError": "ass_argument_invalid"
      },
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp"
    },
    {
      "phase": "native-render",
      "name": "N-API exact timestamp 9007199254740991",
      "requiredCalls": {
        "native-create": 1
      },
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp"
    },
    {
      "phase": "setup",
      "name": "N-API exact timestamp 9007199254740991",
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp"
    }
  ],
  "scope": "ass-timestamp",
  "extraScopes": [
    "entry/src/main/cpp/ass",
    "entry/src/main/cpp/caption",
    ".local/native-ass/active-prefix.txt"
  ],
  "fixture": "tests/ass-timestamp-fixture.cjs",
  "earlyPhase": "native-render",
  "earlyOld": "trace.call('entry', () => {});",
  "earlyReplacement": "trace.call('native-render', () => {}); trace.call('entry', () => {});",
  "selfFaults": [
    {
      "id": "native-create-observer-remove",
      "phase": "native-create",
      "file": "tests/ass-timestamp-fixture.cjs",
      "old": "trace.call('native-create', () => attempt(() => n.create('doc', font, ''), creation), creation)",
      "replacement": "attempt(() => n.create('doc', font, ''), creation)",
      "status": "detected"
    },
    {
      "id": "numeric-read-observer-remove",
      "phase": "core-integer",
      "file": "tests/native-entry-fixture/ass-timestamp-entry.cpp",
      "old": "doubleReads.push_back({typeStatus, originalType, status}); return status;",
      "replacement": "return status;",
      "status": "detected"
    }
  ],
  "unannouncedControls": [
    {
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp",
      "id": "library-create",
      "name": "N-API exact timestamp 9007199254740991",
      "phase": "native-create",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "libraryFailures": 1,
        "reads": 0,
        "numberFailures": 0,
        "unexpectedNumberFailures": 0,
        "actualError": "ass_memory_unavailable"
      },
      "fault": {
        "file": "tests/native-entry-fixture/ass-timestamp-engine.cpp",
        "old": "if (failLibrary) return nullptr;",
        "replacement": "return nullptr;"
      },
      "observer": {
        "file": "tests/native-entry-fixture/ass-timestamp-engine.cpp",
        "old": "if (!library) ++libraryFailures;",
        "replacement": "(void) library;"
      },
      "quarantine": {
        "file": "tests/ass-timestamp-fixture.cjs",
        "old": "if (state.libraryFailures > 0 || state.unexpectedNumberFailures > 0)",
        "replacement": "if (false)"
      },
      "protection": {
        "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
        "old": "Integer(env, args[1], kMaxExactTimestampMs)",
        "replacement": "Integer(env, args[1], UINT64_MAX)"
      }
    },
    {
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp",
      "id": "read-lower",
      "name": "lower exact timestamp 9007199254740991",
      "phase": "core-integer",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "reads": 1,
        "numberFailures": 1,
        "unexpectedNumberFailures": 1,
        "originalNumberReads": 1,
        "libraryFailures": 0,
        "actualError": "ass_argument_invalid"
      },
      "fault": {
        "file": "tests/native-entry-fixture/ass-timestamp-entry.cpp",
        "old": "if (readFailure) napi_get_undefined(env, &value);",
        "replacement": "napi_get_undefined(env, &value);"
      },
      "observer": {
        "file": "tests/native-entry-fixture/ass-timestamp-entry.cpp",
        "old": "doubleReads.push_back({typeStatus, originalType, status}); return status;",
        "replacement": "return status;"
      },
      "quarantine": {
        "file": "tests/ass-timestamp-fixture.cjs",
        "old": "if (state.libraryFailures > 0 || state.unexpectedNumberFailures > 0)",
        "replacement": "if (false)"
      },
      "protection": {
        "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
        "old": "napi_get_value_double(env, value, &number) != napi_ok",
        "replacement": "(napi_get_value_double(env, value, &number), false)"
      },
      "coupledDetails": {
        "reads": 1,
        "numberFailures": 1,
        "unexpectedNumberFailures": 1,
        "originalNumberReads": 1,
        "libraryFailures": 0
      }
    },
    {
      "suite": "ass-timestamp-contract.test.cjs",
      "scope": "ass-timestamp",
      "id": "read-N-API",
      "name": "N-API exact timestamp 9007199254740991",
      "phase": "native-render",
      "requiredCalls": {
        "entry": 1,
        "native-create": 1
      },
      "details": {
        "reads": 1,
        "numberFailures": 1,
        "unexpectedNumberFailures": 1,
        "originalNumberReads": 1,
        "libraryFailures": 0,
        "actualError": "ass_argument_invalid"
      },
      "fault": {
        "file": "tests/native-entry-fixture/ass-timestamp-entry.cpp",
        "old": "if (readFailure) napi_get_undefined(env, &value);",
        "replacement": "napi_get_undefined(env, &value);"
      },
      "observer": {
        "file": "tests/native-entry-fixture/ass-timestamp-entry.cpp",
        "old": "doubleReads.push_back({typeStatus, originalType, status}); return status;",
        "replacement": "return status;"
      },
      "quarantine": {
        "file": "tests/ass-timestamp-fixture.cjs",
        "old": "if (state.libraryFailures > 0 || state.unexpectedNumberFailures > 0)",
        "replacement": "if (false)"
      },
      "protection": {
        "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
        "old": "napi_get_value_double(env, value, &number) != napi_ok",
        "replacement": "(napi_get_value_double(env, value, &number), false)"
      },
      "coupledDetails": {
        "reads": 5,
        "numberFailures": 5,
        "unexpectedNumberFailures": 5,
        "originalNumberReads": 5,
        "libraryFailures": 0
      }
    }
  ]
};
