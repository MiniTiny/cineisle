const recipes = [
  {
    "id": "deadline--1",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "readTimeoutMs: number = 1500",
    "replacement": "readTimeoutMs: number = 1499",
    "name": "attach wallpaper deadline 1499",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "deadline-1",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "readTimeoutMs: number = 1500",
    "replacement": "readTimeoutMs: number = 1501",
    "name": "lower wallpaper deadline 1500",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "deadline-consumer",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "finish(), WallpaperColors.readTimeoutMs",
    "replacement": "finish(), WallpaperColors.readTimeoutMs + 1",
    "name": "attach wallpaper deadline 1500",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "deadline-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "timer = setTimeout(() => finish(), WallpaperColors.readTimeoutMs);",
    "replacement": "timer = -1;",
    "name": "lower wallpaper deadline 1500",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "deadline-clear-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "if (timer >= 0) { clearTimeout(timer); }",
    "replacement": "if (false) { clearTimeout(timer); }",
    "name": "lower wallpaper completion first at 1499",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "cancel-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "cancel = () => finish();",
    "replacement": "cancel = () => {};",
    "name": "lower wallpaper cancellation preserves the shared native RPC and other ticket",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "pending-sharing-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "if (!this.pending) {",
    "replacement": "if (true) {",
    "name": "lower wallpaper cancellation preserves the shared native RPC and other ticket",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "ownership-guard-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "allowed() && revision === this.revision",
    "replacement": "revision === this.revision",
    "name": "lower wallpaper ownership change rejects a response without changing revision",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "revision-guard-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "allowed() && revision === this.revision",
    "replacement": "allowed()",
    "name": "lower wallpaper stop rejects the pending reply",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "epoch-guard-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "if (epoch === this.listenerEpoch)",
    "replacement": "if (true)",
    "name": "lower wallpaper stop and reattach reject callbacks from the old listener epoch",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "event-pending-guard-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "this.pending && this.pendingRevision !== this.revision",
    "replacement": "false",
    "name": "lower wallpaper event supersedes pending native data without a second RPC",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "pending-revision-compare",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "this.pendingRevision !== this.revision",
    "replacement": "this.pendingRevision === this.revision",
    "name": "lower wallpaper cancellation preserves the shared native RPC and other ticket",
    "suite": "wallpaper-deadline-contract.test.cjs"
  },
  {
    "id": "capability-guard-remove",
    "file": "entry/src/main/ets/service/WallpaperColors.ets",
    "old": "!allowed() || !canIUse('SystemCapability.MiscServices.Wallpaper')",
    "replacement": "!allowed()",
    "name": "lower wallpaper unavailable capability avoids native reads and timers",
    "suite": "wallpaper-deadline-contract.test.cjs"
  }
];
const controls = [
  {
    "phase": "wallpaper-read",
    "name": "lower wallpaper deadline 1499",
    "suite": "wallpaper-deadline-contract.test.cjs",
    "scope": "wallpaper-contract",
    "nativeInit": "wallpaper"
  },
  {
    "phase": "preferences-open",
    "name": "attach wallpaper completion first at 1499",
    "suite": "wallpaper-deadline-contract.test.cjs",
    "scope": "wallpaper-contract",
    "nativeInit": "preferences"
  },
  {
    "phase": "wallpaper-on",
    "name": "attach wallpaper completion first at 1499",
    "suite": "wallpaper-deadline-contract.test.cjs",
    "scope": "wallpaper-contract",
    "requiredCalls": {
      "preferences-open": 1
    }
  },
  {
    "phase": "timer-set",
    "name": "lower wallpaper deadline 1500",
    "suite": "wallpaper-deadline-contract.test.cjs",
    "scope": "wallpaper-contract",
    "requiredCalls": {
      "wallpaper-read": 1
    }
  },
  {
    "phase": "window-bars",
    "name": "attach wallpaper completion first at 1499",
    "suite": "wallpaper-deadline-contract.test.cjs",
    "scope": "wallpaper-contract",
    "requiredCalls": {
      "wallpaper-read": 1
    }
  },
  {
    "phase": "storage-publish",
    "name": "attach wallpaper completion first at 1499",
    "suite": "wallpaper-deadline-contract.test.cjs",
    "scope": "wallpaper-contract",
    "requiredCalls": {
      "window-bars": 1
    }
  },
  {
    "phase": "setup",
    "name": "lower wallpaper deadline 1499",
    "suite": "wallpaper-deadline-contract.test.cjs",
    "scope": "wallpaper-contract"
  }
];
module.exports={recipes,controls,scope:'wallpaper-contract',fixture:'tests/wallpaper-contract-fixture.cjs',earlyPhase:'window-bars',earlyOld:'try { await test.action(check); }',earlyReplacement:"try { f.trace().call('window-bars',()=>{}); await test.action(check); }",selfFaults:[{id:'native-wallpaper-observer-remove',phase:'wallpaper-read',file:'tests/wallpaper-contract-fixture.cjs',old:"async type => f.trace().call('wallpaper-read', async () => {",replacement:"async type => ((phase,operation)=>operation())('wallpaper-read', async () => {",status:'detected'},{id:'native-preferences-observer-remove',phase:'preferences-open',file:'tests/wallpaper-contract-fixture.cjs',old:"async (...args) => f.trace().call('preferences-open', async () => {",replacement:"async (...args) => ((phase,operation)=>operation())('preferences-open', async () => {",status:'detected'}]};
