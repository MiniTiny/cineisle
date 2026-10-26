module.exports = {
  "recipes": [
    {
      "id": "error-cap-lower",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "kErrorCodeUtf8BytesLimit = 64",
      "replacement": "kErrorCodeUtf8BytesLimit = 63",
      "name": "lower ASS error bytes 63",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-cap-higher",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "kErrorCodeUtf8BytesLimit = 64",
      "replacement": "kErrorCodeUtf8BytesLimit = 65",
      "name": "async-render ASS error bytes 64",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-budget-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "value.size() < kErrorCodeUtf8BytesLimit",
      "replacement": "true",
      "name": "lower ASS error bytes 65",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-budget-comparator",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "value.size() < kErrorCodeUtf8BytesLimit",
      "replacement": "value.size() <= kErrorCodeUtf8BytesLimit",
      "name": "sync-create ASS error bytes 64",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-budget-consumer",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "value.size() < kErrorCodeUtf8BytesLimit",
      "replacement": "value.size() < kErrorCodeUtf8BytesLimit + 1",
      "name": "sync-render ASS error bytes 64",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-prefix-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "value.rfind(\"ass_\", 0) == 0",
      "replacement": "true",
      "name": "async-create ASS error prefix missing",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-prefix-anywhere",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "value.rfind(\"ass_\", 0) == 0",
      "replacement": "value.find(\"ass_\") != std::string::npos",
      "name": "sync-close ASS error embedded prefix",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-whitelist-remove",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "value.find_first_not_of(\"abcdefghijklmnopqrstuvwxyz_\") == std::string::npos",
      "replacement": "true",
      "name": "lower ASS error unicode",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-whitelist-uppercase",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "value.find_first_not_of(\"abcdefghijklmnopqrstuvwxyz_\")",
      "replacement": "value.find_first_not_of(\"abcdefghijklmnopqrstuvwxyz_A\")",
      "name": "async-render ASS error uppercase",
      "suite": "ass-error-contract.test.cjs"
    },
    {
      "id": "error-fallback-drift",
      "file": "entry/src/main/cpp/ass/NapiAssRenderer.cpp",
      "old": "return \"ass_native_failed\";",
      "replacement": "return \"ass_argument_invalid\";",
      "name": "lower ASS error empty",
      "suite": "ass-error-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "native-create",
      "name": "async-create ASS error bytes 63",
      "suite": "ass-error-contract.test.cjs",
      "scope": "ass-error-contract",
      "nativeInit": true,
      "requiredCalls": {
        "error-configure": 1
      }
    },
    {
      "phase": "native-render",
      "name": "async-render ASS error bytes 63",
      "suite": "ass-error-contract.test.cjs",
      "scope": "ass-error-contract",
      "requiredCalls": {
        "native-create": 1,
        "error-configure": 1
      }
    },
    {
      "phase": "native-close",
      "name": "sync-close ASS error bytes 63",
      "suite": "ass-error-contract.test.cjs",
      "scope": "ass-error-contract",
      "requiredCalls": {
        "native-create": 1
      }
    },
    {
      "phase": "core-code",
      "name": "lower ASS error bytes 63",
      "suite": "ass-error-contract.test.cjs",
      "scope": "ass-error-contract"
    },
    {
      "phase": "setup",
      "name": "async-create ASS error bytes 63",
      "suite": "ass-error-contract.test.cjs",
      "scope": "ass-error-contract"
    }
  ],
  "scope": "ass-error-contract",
  "extraScopes": [
    "entry/src/main/cpp/ass",
    "entry/src/main/cpp/caption"
  ],
  "fixture": "tests/ass-error-contract-fixture.cjs",
  "earlyPhase": "native-render",
  "earlyOld": "let handle;\n      try {",
  "earlyReplacement": "let handle;\n      try {\n        trace.call('native-render', () => {});",
  "selfFaults": [
    {
      "id": "native-ass-init-observer-remove",
      "phase": "native-create",
      "file": "tests/ass-error-contract-fixture.cjs",
      "old": "if (mode.endsWith('create')) result = await trace.call('native-create', create);",
      "replacement": "if (mode.endsWith('create')) result = await create();",
      "status": "detected"
    }
  ]
};
