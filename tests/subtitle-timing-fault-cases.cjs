const recipes=[
  {
    "id": "deadline-drift--1",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "completionTimeoutMs: number = 30000",
    "replacement": "completionTimeoutMs: number = 29999",
    "name": "agent subtitle deadline 29999",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "deadline-drift-1",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "completionTimeoutMs: number = 30000",
    "replacement": "completionTimeoutMs: number = 30001",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "deadline-callback-remove",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "setTimeout(() => { finish(true); }, SubtitleTransfer.completionTimeoutMs)",
    "replacement": "setTimeout(() => {}, SubtitleTransfer.completionTimeoutMs)",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "ownership-poll-drift--1",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "ownershipPollIntervalMs: number = 500",
    "replacement": "ownershipPollIntervalMs: number = 499",
    "name": "legacy subtitle ownership watch 499",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "ownership-poll-drift-1",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "ownershipPollIntervalMs: number = 500",
    "replacement": "ownershipPollIntervalMs: number = 501",
    "name": "legacy subtitle ownership watch 500",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "ownership-watch-remove",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "if (!this.owned()) { finish(true); }",
    "replacement": "if (false) { finish(true); }",
    "name": "legacy subtitle ownership watch 500",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "ownership-watch-invert",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "if (!this.owned()) { finish(true); }",
    "replacement": "if (this.owned()) { finish(true); }",
    "name": "agent subtitle ownership watch 500",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "finished-guard-remove",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "if (finished) { return; }",
    "replacement": "if (false) { return; }",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "deadline-failure-flag-drift",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "setTimeout(() => { finish(true); }, SubtitleTransfer.completionTimeoutMs)",
    "replacement": "setTimeout(() => { finish(false); }, SubtitleTransfer.completionTimeoutMs)",
    "name": "legacy subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "timer-registration-after-complete",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "if (!finished) { timer = setTimeout",
    "replacement": "if (true) { timer = setTimeout",
    "name": "agent synchronous completion does not install deadline or ownership timers",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "clear-deadline-remove",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "clearTimeout(timer);",
    "replacement": "void 0;",
    "name": "agent subtitle completes before deadline and late timer does not remove twice",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "clear-watch-remove",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "clearInterval(watch);",
    "replacement": "void 0;",
    "name": "legacy subtitle completes before deadline and late timer does not remove twice",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "cleanup-await-remove",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "await remove?.();",
    "replacement": "remove?.();",
    "name": "agent deadline awaits cleanup before rejecting and unlinks afterwards",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "unlink-before-task-removal",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "try { await remove?.(); }",
    "replacement": "try { if (fs.accessSync(this.path)) { fs.unlinkSync(this.path); } await remove?.(); }",
    "name": "legacy deadline awaits cleanup before rejecting and unlinks afterwards",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "agent-deadline-before-start",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "await task.start();",
    "replacement": "timer = setTimeout(() => { finish(true); }, SubtitleTransfer.completionTimeoutMs); await task.start();",
    "name": "agent deadline starts after asynchronous task startup resolves",
    "suite": "subtitle-timing-contract.test.cjs"
  },
  {
    "id": "legacy-deadline-before-create",
    "file": "entry/src/main/ets/service/SubtitleTransfer.ets",
    "old": "const task = await request.downloadFile(this.context,",
    "replacement": "timer = setTimeout(() => { finish(true); }, SubtitleTransfer.completionTimeoutMs); const task = await request.downloadFile(this.context,",
    "name": "legacy deadline starts after asynchronous task startup resolves",
    "suite": "subtitle-timing-contract.test.cjs"
  }
];
const controls=[
  {
    "phase": "agent-create",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "nativeInit": "agent-subtitle"
  },
  {
    "phase": "legacy-create",
    "name": "legacy subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "nativeInit": "legacy-subtitle"
  },
  {
    "phase": "agent-start",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "agent-create": 1
    }
  },
  {
    "phase": "agent-remove",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "agent-create": 1,
      "agent-start": 1,
      "timer-fire": 1
    }
  },
  {
    "phase": "legacy-delete",
    "name": "legacy subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "legacy-create": 1,
      "timer-fire": 1
    }
  },
  {
    "phase": "file-unlink",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "agent-remove": 1
    },
    "details": {
      "filename": "subtitle.srt.fetch"
    }
  },
  {
    "phase": "timer-set",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "agent-start": 1
    }
  },
  {
    "phase": "interval-set",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "agent-start": 1,
      "timer-set": 1
    }
  },
  {
    "phase": "agent-on",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "agent-create": 1
    },
    "details": {
      "event": "completed"
    }
  },
  {
    "phase": "legacy-on",
    "name": "legacy subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing",
    "requiredCalls": {
      "legacy-create": 1
    },
    "details": {
      "event": "complete"
    }
  },
  {
    "phase": "setup",
    "name": "agent subtitle deadline 30000",
    "suite": "subtitle-timing-contract.test.cjs",
    "scope": "subtitle-timing"
  }
];
module.exports={recipes,controls,scope:'subtitle-timing',fixture:'tests/subtitle-timing-fixture.cjs',earlyPhase:'agent-remove',earlyOld:'try{await test.action(check,time);',earlyReplacement:"try{f.trace().call('agent-remove',()=>{});await test.action(check,time);",selfFaults:[{id:'native-agent-init-capture',phase:'agent-create',file:'tests/subtitle-timing-fixture.cjs',old:"f.trace().call(backend+'-create',async()=>{",replacement:"((phase,operation)=>operation())(backend+'-create',async()=>{",status:'detected'},{id:'native-legacy-init-capture',phase:'legacy-create',file:'tests/subtitle-timing-fixture.cjs',old:"f.trace().call(backend+'-create',async()=>{",replacement:"((phase,operation)=>operation())(backend+'-create',async()=>{",status:'detected'}]};
