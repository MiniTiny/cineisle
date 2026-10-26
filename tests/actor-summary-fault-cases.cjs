module.exports = {
  "recipes": [
    {
      "id": "summary-limit-1",
      "file": "entry/src/main/ets/pages/Index.ets",
      "old": "actorSummaryTagLimit: number = 3",
      "replacement": "actorSummaryTagLimit: number = 2",
      "name": "SDK actor summary tags 3 at 1x",
      "suite": "actor-summary-contract.test.cjs"
    },
    {
      "id": "summary-limit+1",
      "file": "entry/src/main/ets/pages/Index.ets",
      "old": "actorSummaryTagLimit: number = 3",
      "replacement": "actorSummaryTagLimit: number = 4",
      "name": "SDK actor summary tags 4 at 1x",
      "suite": "actor-summary-contract.test.cjs"
    },
    {
      "id": "summary-consumer-drift",
      "file": "entry/src/main/ets/pages/Index.ets",
      "old": "actor.tags.slice(0, actorSummaryTagLimit)",
      "replacement": "actor.tags.slice(0, actorSummaryTagLimit + 1)",
      "name": "SDK actor summary tags 4 at 1x",
      "suite": "actor-summary-contract.test.cjs"
    },
    {
      "id": "summary-cap-remove",
      "file": "entry/src/main/ets/pages/Index.ets",
      "old": "actor.tags.slice(0, actorSummaryTagLimit)",
      "replacement": "actor.tags",
      "name": "SDK actor summary tags 4 at 1x",
      "suite": "actor-summary-contract.test.cjs"
    },
    {
      "id": "summary-mutates-business-input",
      "file": "entry/src/main/ets/pages/Index.ets",
      "old": "actor.tags.slice(0, actorSummaryTagLimit)",
      "replacement": "actor.tags.splice(0, actorSummaryTagLimit)",
      "name": "SDK actor summary tags 6 at 1x",
      "suite": "actor-summary-contract.test.cjs"
    },
    {
      "id": "summary-prefix-offset",
      "file": "entry/src/main/ets/pages/Index.ets",
      "old": "actor.tags.slice(0, actorSummaryTagLimit)",
      "replacement": "actor.tags.slice(1, actorSummaryTagLimit)",
      "name": "SDK actor summary tags 3 at 1x",
      "suite": "actor-summary-contract.test.cjs"
    },
    {
      "id": "summary-visibility-guard",
      "file": "entry/src/main/ets/pages/Index.ets",
      "old": "if (this.showTags) {",
      "replacement": "if (true) {",
      "name": "SDK summary hidden tags preserve full profile and previous error feedback",
      "suite": "actor-summary-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "ui-compile",
      "name": "SDK actor summary tags 4 at 1x",
      "suite": "actor-summary-contract.test.cjs",
      "scope": "actor-summary",
      "nativeInit": "sdk",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "originalCode": "MODULE_NOT_FOUND"
      }
    },
    {
      "phase": "profile-rules-read",
      "name": "SDK summary tag action reaches actual profile refresh without business truncation",
      "suite": "actor-summary-contract.test.cjs",
      "scope": "actor-summary",
      "nativeInit": "profile-rules",
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
      "name": "SDK actor summary tags 4 at 1x",
      "suite": "actor-summary-contract.test.cjs",
      "scope": "actor-summary",
      "requiredCalls": {
        "ui-compile": 1,
        "entry": 1
      }
    },
    {
      "phase": "setup",
      "name": "SDK actor summary tags 4 at 1x",
      "suite": "actor-summary-contract.test.cjs",
      "scope": "actor-summary"
    }
  ],
  "scope": "actor-summary",
  "extraScopes": [
    "entry/src/main/resources/base"
  ],
  "fixture": "tests/actor-summary-fixture.cjs",
  "earlyPhase": "ui-render",
  "earlyOld": "render(name, overrides, scale = 1) { trace.call('entry', () => {});",
  "earlyReplacement": "render(name, overrides, scale = 1) { trace.call('ui-render', () => {}); trace.call('entry', () => {});",
  "selfFaults": [
    {
      "id": "sdk-loader-observer-remove",
      "phase": "ui-compile",
      "file": "tests/actor-summary-fixture.cjs",
      "old": "return trace.call('ui-compile', () => {",
      "replacement": "return ((phase, operation) => operation())('ui-compile', () => {",
      "status": "detected"
    },
    {
      "id": "rule-read-observer-remove",
      "phase": "profile-rules-read",
      "file": "tests/actor-summary-fixture.cjs",
      "old": "return trace.call('profile-rules-read', () => {",
      "replacement": "return ((phase, operation) => operation())('profile-rules-read', () => {",
      "status": "invalid"
    }
  ]
};
