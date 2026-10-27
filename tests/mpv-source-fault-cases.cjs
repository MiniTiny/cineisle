module.exports = {
  "recipes": [
    {
      "id": "_SOURCE_CONNECT_TIMEOUT_SECONDS-1",
      "file": "scripts/build-native-mpv.py",
      "old": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 30",
      "replacement": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 29",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_SOURCE_CONNECT_TIMEOUT_SECONDS1",
      "file": "scripts/build-native-mpv.py",
      "old": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 30",
      "replacement": "_SOURCE_CONNECT_TIMEOUT_SECONDS = 31",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_SOURCE_CONNECT_TIMEOUT_SECONDS-consumer",
      "file": "scripts/build-native-mpv.py",
      "old": "str(_SOURCE_CONNECT_TIMEOUT_SECONDS)",
      "replacement": "str(_SOURCE_CONNECT_TIMEOUT_SECONDS + 1)",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS-1",
      "file": "scripts/build-native-mpv.py",
      "old": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1800",
      "replacement": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1799",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS1",
      "file": "scripts/build-native-mpv.py",
      "old": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1800",
      "replacement": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS = 1801",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_SOURCE_DOWNLOAD_TIMEOUT_SECONDS-consumer",
      "file": "scripts/build-native-mpv.py",
      "old": "str(_SOURCE_DOWNLOAD_TIMEOUT_SECONDS)",
      "replacement": "str(_SOURCE_DOWNLOAD_TIMEOUT_SECONDS + 1)",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_MAX_SOURCE_ARCHIVE_BYTES-1",
      "file": "scripts/build-native-mpv.py",
      "old": "_MAX_SOURCE_ARCHIVE_BYTES = 100_000_000",
      "replacement": "_MAX_SOURCE_ARCHIVE_BYTES = 99999999",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_MAX_SOURCE_ARCHIVE_BYTES1",
      "file": "scripts/build-native-mpv.py",
      "old": "_MAX_SOURCE_ARCHIVE_BYTES = 100_000_000",
      "replacement": "_MAX_SOURCE_ARCHIVE_BYTES = 100000001",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "_MAX_SOURCE_ARCHIVE_BYTES-consumer",
      "file": "scripts/build-native-mpv.py",
      "old": "str(_MAX_SOURCE_ARCHIVE_BYTES)",
      "replacement": "str(_MAX_SOURCE_ARCHIVE_BYTES + 1)",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "byte-budget-1",
      "file": "scripts/build-native-mpv.py",
      "old": "_MAX_EXTRACTED_SOURCE_BYTES = 2 * 1024 * 1024 * 1024",
      "replacement": "_MAX_EXTRACTED_SOURCE_BYTES = 2 * 1024 * 1024 * 1024 - 1",
      "name": "MPV extract single metadata bytes 2147483648",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "byte-budget1",
      "file": "scripts/build-native-mpv.py",
      "old": "_MAX_EXTRACTED_SOURCE_BYTES = 2 * 1024 * 1024 * 1024",
      "replacement": "_MAX_EXTRACTED_SOURCE_BYTES = 2 * 1024 * 1024 * 1024 + 1",
      "name": "MPV extract single metadata bytes 2147483649",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "bytes-consumer",
      "file": "scripts/build-native-mpv.py",
      "old": "if total > _MAX_EXTRACTED_SOURCE_BYTES:",
      "replacement": "if total + 1 > _MAX_EXTRACTED_SOURCE_BYTES:",
      "name": "MPV extract single metadata bytes 2147483648",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "bytes-comparator",
      "file": "scripts/build-native-mpv.py",
      "old": "if total > _MAX_EXTRACTED_SOURCE_BYTES:",
      "replacement": "if total >= _MAX_EXTRACTED_SOURCE_BYTES:",
      "name": "MPV extract single metadata bytes 2147483648",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "bytes-guard-remove",
      "file": "scripts/build-native-mpv.py",
      "old": "if total > _MAX_EXTRACTED_SOURCE_BYTES:",
      "replacement": "if False:",
      "name": "MPV extract single metadata bytes 2147483649",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "combined-bytes-counter",
      "file": "scripts/build-native-mpv.py",
      "old": "total += member.size",
      "replacement": "total = member.size",
      "name": "MPV extract combined metadata bytes above",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "member-budget-1",
      "file": "scripts/build-native-mpv.py",
      "old": "_MAX_EXTRACTED_SOURCE_MEMBERS = 200_000",
      "replacement": "_MAX_EXTRACTED_SOURCE_MEMBERS = 199999",
      "name": "MPV extract member count including skipped roots 200000",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "member-budget1",
      "file": "scripts/build-native-mpv.py",
      "old": "_MAX_EXTRACTED_SOURCE_MEMBERS = 200_000",
      "replacement": "_MAX_EXTRACTED_SOURCE_MEMBERS = 200001",
      "name": "MPV extract member count including skipped roots 200001",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "members-consumer",
      "file": "scripts/build-native-mpv.py",
      "old": "count > _MAX_EXTRACTED_SOURCE_MEMBERS",
      "replacement": "count + 1 > _MAX_EXTRACTED_SOURCE_MEMBERS",
      "name": "MPV extract member count including skipped roots 200000",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "members-comparator",
      "file": "scripts/build-native-mpv.py",
      "old": "count > _MAX_EXTRACTED_SOURCE_MEMBERS",
      "replacement": "count >= _MAX_EXTRACTED_SOURCE_MEMBERS",
      "name": "MPV extract member count including skipped roots 200000",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "members-guard-remove",
      "file": "scripts/build-native-mpv.py",
      "old": "count > _MAX_EXTRACTED_SOURCE_MEMBERS",
      "replacement": "False",
      "name": "MPV extract member count including skipped roots 200001",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "members-loop-counter-remove",
      "file": "scripts/build-native-mpv.py",
      "old": "count += 1",
      "replacement": "count += 0",
      "name": "MPV extract member count including skipped roots 200001",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "directory-byte-accounting",
      "file": "scripts/build-native-mpv.py",
      "old": "total += member.size",
      "replacement": "total += member.size if member.isfile() else 0",
      "name": "MPV extract directory metadata bytes above",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "root-byte-exclusion",
      "file": "scripts/build-native-mpv.py",
      "old": "if len(path.parts) == 1:",
      "replacement": "if False:",
      "name": "MPV extract root metadata size remains excluded",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "root-directory-check-remove",
      "file": "scripts/build-native-mpv.py",
      "old": "if not member.isdir():",
      "replacement": "if False:",
      "name": "MPV actual small tar root-file keeps original policy",
      "suite": "mpv-source-contract.test.py"
    },
    {
      "id": "atomic-manifest-bypass",
      "file": "scripts/build-native-mpv.py",
      "old": "write_json(destination / '.source-files.json', snapshot(destination))",
      "replacement": "(destination / '.source-files.json').write_text(json.dumps(snapshot(destination), sort_keys=True))",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py"
    }
  ],
  "controls": [
    {
      "phase": "curl-run",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py",
      "scope": "mpv-source",
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
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py",
      "scope": "mpv-source",
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
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py",
      "scope": "mpv-source",
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
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py",
      "scope": "mpv-source",
      "nativeInit": "manifest-write",
      "requiredCalls": {
        "entry": 1,
        "member-extract": 1
      },
      "details": {
        "nativeCauseCode": "EISDIR",
        "filename": ".source-files.json.tmp"
      }
    },
    {
      "phase": "source-load",
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py",
      "scope": "mpv-source",
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
      "name": "MPV source invokes actual curl argv and atomic manifest",
      "suite": "mpv-source-contract.test.py",
      "scope": "mpv-source"
    }
  ],
  "scope": "mpv-source",
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
      "id": "curl-run-observer-remove",
      "phase": "curl-run",
      "file": "tests/source_preparation_fixture.py",
      "old": "return self.tracker.call('curl-run', body)",
      "replacement": "return body()",
      "status": "detected"
    },
    {
      "id": "tar-open-observer-remove",
      "phase": "tar-open",
      "file": "tests/source_preparation_fixture.py",
      "old": "return self.tracker.call('tar-open', body)",
      "replacement": "return body()",
      "status": "detected"
    },
    {
      "id": "manifest-write-observer-remove",
      "phase": "manifest-write",
      "file": "tests/source_preparation_fixture.py",
      "old": "return self.tracker.call('manifest-write', body, {'filename': path.name})",
      "replacement": "return body()",
      "status": "detected"
    },
    {
      "id": "member-extract-observer-remove",
      "phase": "member-extract",
      "file": "tests/source_preparation_fixture.py",
      "old": "result = owner.tracker.call('member-extract', body, {'member': member.name})",
      "replacement": "result = body()",
      "status": "detected"
    }
  ]
};
