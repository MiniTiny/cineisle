module.exports = {
  "recipes": [
    {
      "id": "helper-callback-match",
      "file": "tests/literal-mutation.cjs",
      "old": "source.replace(old, () => replacement)",
      "replacement": "source.replace(old, replacement)",
      "name": "literal helper replacement match",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "helper-callback-prefix",
      "file": "tests/literal-mutation.cjs",
      "old": "source.replace(old, () => replacement)",
      "replacement": "source.replace(old, replacement)",
      "name": "literal helper replacement prefix",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "helper-callback-suffix",
      "file": "tests/literal-mutation.cjs",
      "old": "source.replace(old, () => replacement)",
      "replacement": "source.replace(old, replacement)",
      "name": "literal helper replacement suffix",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "helper-callback-dollar",
      "file": "tests/literal-mutation.cjs",
      "old": "source.replace(old, () => replacement)",
      "replacement": "source.replace(old, replacement)",
      "name": "literal helper replacement dollar",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "helper-callback-regex-template",
      "file": "tests/literal-mutation.cjs",
      "old": "source.replace(old, () => replacement)",
      "replacement": "source.replace(old, replacement)",
      "name": "literal helper replacement regex-template",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "unique-anchor-missing",
      "file": "tests/literal-mutation.cjs",
      "old": "assert.equal(source.split(old).length, 2, message);",
      "replacement": "",
      "name": "literal anchor refuses missing",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "unique-anchor-ambiguous",
      "file": "tests/literal-mutation.cjs",
      "old": "assert.equal(source.split(old).length, 2, message);",
      "replacement": "",
      "name": "literal anchor refuses ambiguous",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "empty-anchor",
      "file": "tests/literal-mutation.cjs",
      "old": "assert.ok(old.length > 0, 'Empty mutation anchor');",
      "replacement": "",
      "name": "literal anchor refuses empty",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "runner-literal-match",
      "file": "tests/literal-mutation-target.cjs",
      "old": "'literal_original'",
      "replacement": "\"$&\"",
      "name": "literal pipeline target match",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "runner-literal-prefix",
      "file": "tests/literal-mutation-target.cjs",
      "old": "'literal_original'",
      "replacement": "\"$`\"",
      "name": "literal pipeline target prefix",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "runner-literal-suffix",
      "file": "tests/literal-mutation-target.cjs",
      "old": "'literal_original'",
      "replacement": "\"$'\"",
      "name": "literal pipeline target suffix",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "runner-literal-dollar",
      "file": "tests/literal-mutation-target.cjs",
      "old": "'literal_original'",
      "replacement": "\"$$\"",
      "name": "literal pipeline target dollar",
      "suite": "literal-mutation-contract.test.cjs"
    },
    {
      "id": "runner-literal-unicode",
      "file": "tests/literal-mutation-target.cjs",
      "old": "'literal_original'",
      "replacement": "\"中😀\\u0000\\n\"",
      "name": "literal pipeline target unicode",
      "suite": "literal-mutation-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "file-write",
      "name": "literal helper replacement regex-template",
      "suite": "literal-mutation-contract.test.cjs",
      "scope": "literal-mutation",
      "nativeInit": "write"
    },
    {
      "phase": "node-child",
      "name": "literal helper replacement regex-template",
      "suite": "literal-mutation-contract.test.cjs",
      "scope": "literal-mutation",
      "nativeInit": "node",
      "requiredCalls": {
        "file-write": 1
      }
    },
    {
      "phase": "file-read",
      "name": "literal pipeline target match",
      "suite": "literal-mutation-contract.test.cjs",
      "scope": "literal-mutation",
      "nativeInit": "read"
    },
    {
      "phase": "setup",
      "name": "literal helper replacement regex-template",
      "suite": "literal-mutation-contract.test.cjs",
      "scope": "literal-mutation"
    }
  ],
  "scope": "literal-mutation",
  "fixture": "tests/literal-mutation-fixture.cjs",
  "earlyPhase": "node-child",
  "earlyOld": "const target = path.join(directory, 'case.cjs');",
  "earlyReplacement": "trace.call('node-child', () => {}); const target = path.join(directory, 'case.cjs');",
  "selfFaults": [
    {
      "id": "native-write-observer-remove",
      "phase": "file-write",
      "file": "tests/literal-mutation-fixture.cjs",
      "old": "trace.call('file-write', () => {",
      "replacement": "((phase, operation) => operation())('file-write', () => {",
      "status": "detected"
    },
    {
      "id": "native-read-observer-remove",
      "phase": "file-read",
      "file": "tests/literal-mutation-fixture.cjs",
      "old": "trace.call('file-read', () => {",
      "replacement": "((phase, operation) => operation())('file-read', () => {",
      "status": "invalid"
    }
  ]
};
