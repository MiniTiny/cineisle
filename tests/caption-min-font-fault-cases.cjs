module.exports = {
  "recipes": [
    {
      "id": "font-min-lower",
      "file": "entry/src/main/cpp/caption/NapiCaptionRenderer.cpp",
      "old": "kMinCaptionFontSizePx = 0.01",
      "replacement": "kMinCaptionFontSizePx = 0.0099",
      "name": "N-API caption font below",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "id": "font-min-higher",
      "file": "entry/src/main/cpp/caption/NapiCaptionRenderer.cpp",
      "old": "kMinCaptionFontSizePx = 0.01",
      "replacement": "kMinCaptionFontSizePx = 0.0101",
      "name": "lower caption font at",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "id": "font-min-consumer-drift",
      "file": "entry/src/main/cpp/caption/NapiCaptionRenderer.cpp",
      "old": "entry, \"size\"), kMinCaptionFontSizePx,",
      "replacement": "entry, \"size\"), kMinCaptionFontSizePx + 0.0001,",
      "name": "N-API caption font at",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "id": "font-min-consumer-remove",
      "file": "entry/src/main/cpp/caption/NapiCaptionRenderer.cpp",
      "old": "entry, \"size\"), kMinCaptionFontSizePx,",
      "replacement": "entry, \"size\"), 0,",
      "name": "lower caption font below",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "id": "font-min-comparison",
      "file": "entry/src/main/cpp/caption/NapiCaptionRenderer.cpp",
      "old": "result < minimum",
      "replacement": "result <= minimum",
      "name": "N-API caption font at",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "id": "font-min-guard-remove",
      "file": "entry/src/main/cpp/caption/NapiCaptionRenderer.cpp",
      "old": "result < minimum || ",
      "replacement": "",
      "name": "lower caption font below",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "id": "font-min-finite-guard",
      "file": "entry/src/main/cpp/caption/NapiCaptionRenderer.cpp",
      "old": "!std::isfinite(result) || ",
      "replacement": "",
      "name": "lower caption font NaN",
      "suite": "caption-min-font-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "native-caption",
      "name": "N-API caption font at",
      "nativeInit": "read",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "invalidReads": 1,
        "actualError": "caption_argument_invalid"
      },
      "scope": "caption-min-font",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "phase": "core-read",
      "name": "lower caption font at",
      "nativeInit": "read",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "invalidReads": 1,
        "actualError": "caption_argument_invalid"
      },
      "scope": "caption-min-font",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "phase": "font-collection",
      "name": "N-API caption font at",
      "suite": "caption-min-font-contract.test.cjs",
      "scope": "caption-min-font",
      "nativeInit": "font",
      "requiredCalls": {
        "entry": 1,
        "native-caption": 1
      },
      "details": {
        "fontCalls": 1,
        "fontFailures": 1,
        "actualError": "caption_memory_unavailable"
      }
    },
    {
      "phase": "drawing-result",
      "name": "N-API caption font at",
      "suite": "caption-min-font-contract.test.cjs",
      "scope": "caption-min-font",
      "nativeInit": "style",
      "requiredCalls": {
        "entry": 1,
        "native-caption": 1
      },
      "details": {
        "fontCalls": 1,
        "fontFailures": 0,
        "styleCalls": 1,
        "styleFailures": 1,
        "actualError": "caption_memory_unavailable"
      }
    },
    {
      "phase": "native-caption",
      "name": "N-API caption font at",
      "requiredCalls": {
        "entry": 1
      },
      "scope": "caption-min-font",
      "suite": "caption-min-font-contract.test.cjs"
    },
    {
      "phase": "setup",
      "name": "N-API caption font at",
      "scope": "caption-min-font",
      "suite": "caption-min-font-contract.test.cjs"
    }
  ],
  "scope": "caption-min-font",
  "extraScopes": [
    "entry/src/main/cpp/ass",
    "entry/src/main/cpp/caption",
    ".local/native-ass/active-prefix.txt"
  ],
  "fixture": "tests/caption-min-font-fixture.cjs",
  "earlyPhase": "native-caption",
  "earlyOld": "trace.call('entry', () => {});",
  "earlyReplacement": "trace.call('native-caption', () => {}); trace.call('entry', () => {});",
  "selfFaults": [
    {
      "id": "number-body-observer-remove",
      "phase": "native-caption",
      "file": "tests/native-entry-fixture/caption-input.cpp",
      "old": "if (status == napi_number_expected) ++invalidReads;",
      "replacement": "",
      "status": "detected"
    },
    {
      "id": "caption-operation-observer-remove",
      "phase": "core-read",
      "file": "tests/caption-min-font-fixture.cjs",
      "old": "trace.call(layer === 'lower' ? 'core-read' : 'native-caption', async () => {",
      "replacement": "((phase, operation) => operation())(layer === 'lower' ? 'core-read' : 'native-caption', async () => {",
      "status": "detected"
    },
    {
      "id": "font-body-observer-remove",
      "phase": "font-collection",
      "file": "tests/native-entry-fixture/drawing-layout.cpp",
      "old": "++fontFailures; return nullptr;",
      "replacement": "return nullptr;",
      "status": "invalid"
    },
    {
      "id": "font-origin-observer-remove",
      "phase": "font-collection",
      "file": "tests/caption-min-font-fixture.cjs",
      "old": "trace.call('font-collection', () => {",
      "replacement": "((phase, operation) => operation())('font-collection', () => {",
      "status": "invalid"
    },
    {
      "id": "style-body-observer-remove",
      "phase": "drawing-result",
      "file": "tests/native-entry-fixture/drawing-layout.cpp",
      "old": "++styleFailures; return nullptr;",
      "replacement": "return nullptr;",
      "status": "invalid"
    },
    {
      "id": "unexpected-drawing-result-guard-remove",
      "phase": "drawing-result",
      "file": "tests/caption-min-font-fixture.cjs",
      "old": "if (result.error && !['caption_argument_invalid', 'caption_fixture_budget_admitted'].includes(result.error))",
      "replacement": "if (false)",
      "status": "detected"
    }
  ]
};
