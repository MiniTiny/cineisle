module.exports = {
  "recipes": [
    {
      "id": "_SOURCE_CONNECT_TIMEOUT_SECONDS-1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 30",
      "replacement": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 29",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_SOURCE_CONNECT_TIMEOUT_SECONDS1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 30",
      "replacement": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 31",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_SOURCE_CONNECT_TIMEOUT_SECONDS-consumer",
      "file": "scripts/prepare-native-ass.py",
      "old": "str(_SOURCE_CONNECT_TIMEOUT_SECONDS)",
      "replacement": "str(_SOURCE_CONNECT_TIMEOUT_SECONDS + 1)",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS-1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1800",
      "replacement": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1799",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1800",
      "replacement": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1801",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS-consumer",
      "file": "scripts/prepare-native-ass.py",
      "old": "str(_SOURCE_DOWNLOAD_TIMEOUT_SECONDS)",
      "replacement": "str(_SOURCE_DOWNLOAD_TIMEOUT_SECONDS + 1)",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_MAX_SOURCE_ARCHIVE_BYTES-1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_MAX_SOURCE_ARCHIVE_BYTES = 100_000_000",
      "replacement": "_MAX_SOURCE_ARCHIVE_BYTES = 99999999",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_MAX_SOURCE_ARCHIVE_BYTES1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_MAX_SOURCE_ARCHIVE_BYTES = 100_000_000",
      "replacement": "_MAX_SOURCE_ARCHIVE_BYTES = 100000001",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "_MAX_SOURCE_ARCHIVE_BYTES-consumer",
      "file": "scripts/prepare-native-ass.py",
      "old": "str(_MAX_SOURCE_ARCHIVE_BYTES)",
      "replacement": "str(_MAX_SOURCE_ARCHIVE_BYTES + 1)",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "extract-budget-1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_MAX_EXTRACTED_SOURCE_BYTES = 1024 * 1024 * 1024",
      "replacement": "_MAX_EXTRACTED_SOURCE_BYTES = 1024 * 1024 * 1024 - 1",
      "name": "ASS extract single metadata bytes 1073741824",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "extract-budget1",
      "file": "scripts/prepare-native-ass.py",
      "old": "_MAX_EXTRACTED_SOURCE_BYTES = 1024 * 1024 * 1024",
      "replacement": "_MAX_EXTRACTED_SOURCE_BYTES = 1024 * 1024 * 1024 + 1",
      "name": "ASS extract single metadata bytes 1073741825",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "extract-budget-consumer",
      "file": "scripts/prepare-native-ass.py",
      "old": "if total > _MAX_EXTRACTED_SOURCE_BYTES:",
      "replacement": "if total + 1 > _MAX_EXTRACTED_SOURCE_BYTES:",
      "name": "ASS extract single metadata bytes 1073741824",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "extract-comparison",
      "file": "scripts/prepare-native-ass.py",
      "old": "if total > _MAX_EXTRACTED_SOURCE_BYTES:",
      "replacement": "if total >= _MAX_EXTRACTED_SOURCE_BYTES:",
      "name": "ASS extract single metadata bytes 1073741824",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "extract-guard-remove",
      "file": "scripts/prepare-native-ass.py",
      "old": "if total > _MAX_EXTRACTED_SOURCE_BYTES:",
      "replacement": "if False:",
      "name": "ASS extract single metadata bytes 1073741825",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "extract-combined-reservation",
      "file": "scripts/prepare-native-ass.py",
      "old": "total += member.size",
      "replacement": "total = member.size",
      "name": "ASS extract combined metadata bytes above",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "root-budget-exclusion-remove",
      "file": "scripts/prepare-native-ass.py",
      "old": "if len(parts) == 1 or not (member.isfile() or member.isdir()):",
      "replacement": "if not (member.isfile() or member.isdir()):",
      "name": "ASS extract root metadata remains excluded from budget",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "ignored-member-filter-remove",
      "file": "scripts/prepare-native-ass.py",
      "old": "if len(parts) == 1 or not (member.isfile() or member.isdir()):",
      "replacement": "if len(parts) == 1:",
      "name": "ASS extract links and devices retain original ignored behavior",
      "suite": "ass-source-contract.test.py"
    },
    {
      "id": "python-origin-overwrite",
      "file": "tests/source_preparation_fixture.py",
      "old": "if id(error) not in self.states:",
      "replacement": "if True:",
      "name": "Python tracker retains first originating native failure",
      "suite": "ass-source-contract.test.py"
    }
  ],
  "controls": [
    {
      "phase": "curl-run",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py",
      "scope": "ass-source",
      "nativeInit": "curl-run",
      "requiredCalls": {
        "entry": 1,
        "source-load": 1
      },
      "details": {
        "nativeCauseCode": "EACCES"
      }
    },
    {
      "phase": "tar-open",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py",
      "scope": "ass-source",
      "nativeInit": "tar-open",
      "requiredCalls": {
        "entry": 1,
        "curl-run": 1,
        "hash-read": 2
      },
      "details": {
        "nativeCauseCode": "EISDIR"
      }
    },
    {
      "phase": "member-extract",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py",
      "scope": "ass-source",
      "nativeInit": "member-extract",
      "requiredCalls": {
        "entry": 1,
        "tar-open": 1
      },
      "details": {
        "nativeCauseCode": "ENOTDIR"
      }
    },
    {
      "phase": "manifest-write",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py",
      "scope": "ass-source",
      "nativeInit": "manifest-write",
      "requiredCalls": {
        "entry": 1,
        "member-extract": 1
      },
      "details": {
        "nativeCauseCode": "EISDIR"
      }
    },
    {
      "phase": "source-load",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py",
      "scope": "ass-source",
      "nativeInit": "source-load",
      "requiredCalls": {
        "entry": 1
      },
      "details": {
        "nativeCauseCode": "ENOENT"
      }
    },
    {
      "phase": "setup",
      "name": "ASS source invokes actual curl argv and preserves hash extract order",
      "suite": "ass-source-contract.test.py",
      "scope": "ass-source"
    }
  ],
  "scope": "ass-source",
  "extraScopes": [
    "scripts"
  ],
  "externalCapture": {
    "file": "tests/source_preparation_fixture.py",
    "old": "            self.errors.append(error)\n            raise error",
    "replacement": "            raise error"
  },
  "fixture": "tests/source_preparation_fixture.py",
  "earlyPhase": "tar-open",
  "earlyOld": "        self.tracker.call('entry', lambda: None)",
  "earlyReplacement": "        self.tracker.call('tar-open', lambda: None)\n        self.tracker.call('entry', lambda: None)",
  "selfFaults": [
    {
      "id": "curl-body-observer-remove",
      "phase": "curl-run",
      "file": "tests/source_preparation_fixture.py",
      "old": "return self.tracker.call('curl-run', body)",
      "replacement": "return body()",
      "status": "detected"
    },
    {
      "id": "tar-body-observer-remove",
      "phase": "tar-open",
      "file": "tests/source_preparation_fixture.py",
      "old": "return self.tracker.call('tar-open', body)",
      "replacement": "return body()",
      "status": "detected"
    },
    {
      "id": "manifest-body-observer-remove",
      "phase": "manifest-write",
      "file": "tests/source_preparation_fixture.py",
      "old": "return self.tracker.call('manifest-write', body)",
      "replacement": "return body()",
      "status": "detected"
    }
  ]
};
