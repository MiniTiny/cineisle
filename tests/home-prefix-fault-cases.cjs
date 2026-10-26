module.exports = {
  "recipes": [
    {
      "id": "initial-omit-views",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.initialRequests.forEach((r:",
      "replacement": "this.initialRequests.slice(0, 2).forEach((r:",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "initial-omit-resume",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.initialRequests.forEach((r:",
      "replacement": "this.initialRequests.slice(1).forEach((r:",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "initial-extra-cache-requests",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.initialRequests.forEach((r:",
      "replacement": "this.requests.forEach((r:",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "initial-order-reversed",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.initialRequests.forEach((r:",
      "replacement": "[...this.initialRequests].reverse().forEach((r:",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "cache-mutates-initial-set",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.requests = [...this.initialRequests];\n    preview.forEach",
      "replacement": "this.requests = this.initialRequests;\n    preview.forEach",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "views-loses-prefix",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.requests = [...this.initialRequests];\n        libraries.forEach",
      "replacement": "this.requests = this.initialRequests.slice(1);\n        libraries.forEach",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "views-retains-cache-requests",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.requests = [...this.initialRequests];\n        libraries.forEach",
      "replacement": "this.requests = [...this.requests];\n        libraries.forEach",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "views-mutates-initial-set",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "this.requests = [...this.initialRequests];\n        libraries.forEach",
      "replacement": "this.requests = this.initialRequests;\n        libraries.forEach",
      "name": "successful views refresh preserves only initial objects and new library order",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "server-library-order",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "        libraries.forEach((i:",
      "replacement": "        [...libraries].reverse().forEach((i:",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs"
    },
    {
      "id": "cancel-publication-protection",
      "file": "entry/src/main/ets/service/ProgressiveHome.ets",
      "old": "if (!this.alive) { return; }\n    this.publish",
      "replacement": "if (false) { return; }\n    this.publish",
      "name": "cancelled initial requests cannot enqueue libraries or publish late data",
      "suite": "home-prefix-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "create",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs",
      "scope": "home",
      "nativeInit": true
    },
    {
      "phase": "views",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs",
      "scope": "home",
      "requiredCalls": {
        "create": 1
      }
    },
    {
      "phase": "latest",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs",
      "scope": "home",
      "requiredCalls": {
        "views": 1,
        "create": 4
      }
    },
    {
      "phase": "setup",
      "name": "Index initial request set with 3 cached shelves",
      "suite": "home-prefix-contract.test.cjs",
      "scope": "home"
    }
  ],
  "scope": "home",
  "fixture": "tests/home-contract-fixture.cjs",
  "earlyPhase": "latest",
  "earlyOld": "const active = h.activate();",
  "earlyReplacement": "trace.call('latest', () => {}); const active = h.activate();",
  "selfFaults": [
    {
      "id": "http-factory-observer-remove",
      "phase": "create",
      "file": "tests/home-contract-fixture.cjs",
      "old": "trace.call('create', () => {",
      "replacement": "((phase, operation) => operation())('create', () => {"
    }
  ]
};
