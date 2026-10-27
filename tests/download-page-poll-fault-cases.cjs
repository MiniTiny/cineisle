module.exports = {
  "recipes": [
    {
      "id": "interval-1",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "pagePollIntervalMs: number = 1000",
      "replacement": "pagePollIntervalMs: number = 999",
      "name": "sdk legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "interval1",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "pagePollIntervalMs: number = 1000",
      "replacement": "pagePollIntervalMs: number = 1001",
      "name": "sdk legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "interval-consumer",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "}, pagePollIntervalMs);",
      "replacement": "}, pagePollIntervalMs + 1);",
      "name": "sdk legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "poll-callback-remove",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "setInterval(() => { AppService.pollDownloads(); }, pagePollIntervalMs)",
      "replacement": "setInterval(() => {}, pagePollIntervalMs)",
      "name": "sdk legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "poll-backend-bypass",
      "file": "entry/src/main/ets/service/AppService.ets",
      "old": "if (AppService.polling) { return; } AppService.polling = true;",
      "replacement": "return;",
      "name": "sdk agent first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "show-timer-clear-remove",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "if (this.timer >= 0) { clearInterval(this.timer); }",
      "replacement": "",
      "name": "lower legacy repeated show replaces zero timer and resets deadline",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "show-zero-timer-comparator",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "if (this.timer >= 0) { clearInterval(this.timer); }",
      "replacement": "if (this.timer > 0) { clearInterval(this.timer); }",
      "name": "sdk agent repeated show replaces zero timer and resets deadline",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "hide-timer-clear-remove",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "if (this.timer >= 0) { clearInterval(this.timer); this.timer = -1; }",
      "replacement": "this.timer = -1;",
      "name": "sdk legacy hide stops scheduled queries",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "hide-zero-timer-comparator",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "if (this.timer >= 0) { clearInterval(this.timer); this.timer = -1; }",
      "replacement": "if (this.timer > 0) { clearInterval(this.timer); this.timer = -1; }",
      "name": "lower agent hide stops scheduled queries",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "hide-unsubscribe-remove",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "AppService.unsubscribeDownloads(this.changed);",
      "replacement": "",
      "name": "sdk agent unsubscribe independently blocks core poll notifications",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "old-listener-identity-remove",
      "file": "entry/src/main/ets/service/AppService.ets",
      "old": "if (AppService.downloadListener === listener)",
      "replacement": "if (true)",
      "name": "sdk legacy old page hide preserves newer listener and interval",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "disappear-cleanup-remove",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "aboutToDisappear(): void { this.onPageHide(); }",
      "replacement": "aboutToDisappear(): void {}",
      "name": "lower legacy disappear stops scheduled queries",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "account-mismatch-guard-remove",
      "file": "entry/src/main/ets/pages/Downloads.ets",
      "old": "if (this.client && this.client !== AppService.client)",
      "replacement": "if (false)",
      "name": "sdk agent account mismatch leaves without starting a timer",
      "suite": "download-page-poll-contract.test.cjs"
    },
    {
      "id": "overlap-coalescing-remove",
      "file": "entry/src/main/ets/service/AppService.ets",
      "old": "if (AppService.polling) { return; } AppService.polling = true;",
      "replacement": "AppService.polling = true;",
      "name": "lower legacy overlapping ticks coalesce native query work",
      "suite": "download-page-poll-contract.test.cjs"
    }
  ],
  "controls": [
    {
      "phase": "interval-create",
      "name": "sdk legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs",
      "scope": "download-page-poll",
      "nativeInit": "interval",
      "requiredCalls": {
        "subscribe": 1
      },
      "details": {
        "period": 1000
      }
    },
    {
      "phase": "task-query",
      "name": "lower legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs",
      "scope": "download-page-poll",
      "nativeInit": "query",
      "requiredCalls": {
        "poll": 1,
        "interval-create": 1
      }
    },
    {
      "phase": "agent-query",
      "name": "sdk agent first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs",
      "scope": "download-page-poll",
      "nativeInit": "query",
      "requiredCalls": {
        "poll": 1,
        "interval-create": 1
      }
    },
    {
      "phase": "file-write",
      "name": "sdk legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs",
      "scope": "download-page-poll",
      "nativeInit": "write",
      "requiredCalls": {
        "task-query": 1,
        "poll": 1
      },
      "details": {
        "filename": "downloads.json.tmp"
      }
    },
    {
      "phase": "ui-compile",
      "name": "sdk legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs",
      "scope": "download-page-poll"
    },
    {
      "phase": "setup",
      "name": "lower legacy first interval 999 1000 1001",
      "suite": "download-page-poll-contract.test.cjs",
      "scope": "download-page-poll"
    }
  ],
  "scope": "download-page-poll",
  "extraScopes": [
    "entry/src/main/resources"
  ],
  "fixture": "tests/download-page-poll-fixture.cjs",
  "earlyPhase": "task-query",
  "earlyOld": "h.activate(); const record =",
  "earlyReplacement": "trace.call('task-query', () => {}); h.activate(); const record =",
  "selfFaults": [
    {
      "id": "interval-body-observer-remove",
      "phase": "interval-create",
      "file": "tests/download-page-poll-fixture.cjs",
      "old": "trace.call('interval-create', () => {",
      "replacement": "((phase, operation) => operation())('interval-create', () => {",
      "status": "detected"
    },
    {
      "id": "native-query-observer-remove",
      "phase": "task-query",
      "file": "tests/download-page-poll-fixture.cjs",
      "old": "trace.call(backend === 'agent' ? 'agent-query' : 'task-query', async () => {",
      "replacement": "((phase, operation) => operation())(backend === 'agent' ? 'agent-query' : 'task-query', async () => {",
      "status": "detected"
    },
    {
      "id": "native-file-write-observer-remove",
      "phase": "file-write",
      "file": "tests/download-page-poll-fixture.cjs",
      "old": "trace.call('file-write', () => {",
      "replacement": "((phase, operation) => operation())('file-write', () => {",
      "status": "detected"
    }
  ]
};
