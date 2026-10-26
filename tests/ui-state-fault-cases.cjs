const recipes=[
  {
    "id": "paletteStateKey-drift",
    "file": "entry/src/main/ets/service/AppearancePreferences.ets",
    "old": "paletteStateKey: string = 'cineIslePalette'",
    "replacement": "paletteStateKey: string = 'cineIslePaletteDrift'",
    "name": "UI state actual appearance attach publishes original keys in order",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "paletteStatusStateKey-drift",
    "file": "entry/src/main/ets/service/AppearancePreferences.ets",
    "old": "paletteStatusStateKey: string = 'cineIslePaletteStatus'",
    "replacement": "paletteStatusStateKey: string = 'cineIslePaletteStatusDrift'",
    "name": "UI state actual appearance attach publishes original keys in order",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "amoledStateKey-drift",
    "file": "entry/src/main/ets/service/AppearancePreferences.ets",
    "old": "amoledStateKey: string = 'cineIsleAmoled'",
    "replacement": "amoledStateKey: string = 'cineIsleAmoledDrift'",
    "name": "UI state actual appearance attach publishes original keys in order",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "extraInfoStateKey-drift",
    "file": "entry/src/main/ets/service/AppearancePreferences.ets",
    "old": "extraInfoStateKey: string = 'cineIsleExtraInfo'",
    "replacement": "extraInfoStateKey: string = 'cineIsleExtraInfoDrift'",
    "name": "UI state actual appearance attach publishes original keys in order",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "fontScaleStateKey-drift",
    "file": "entry/src/main/ets/entryability/EntryAbility.ets",
    "old": "fontScaleStateKey: string = 'cineIsleFontScale'",
    "replacement": "fontScaleStateKey: string = 'cineIsleFontScaleDrift'",
    "name": "UI state actual configuration entry publishes original viewport keys",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "landscapeStateKey-drift",
    "file": "entry/src/main/ets/entryability/EntryAbility.ets",
    "old": "landscapeStateKey: string = 'cineIsleLandscape'",
    "replacement": "landscapeStateKey: string = 'cineIsleLandscapeDrift'",
    "name": "UI state actual configuration entry publishes original viewport keys",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "lockedStateKey-drift",
    "file": "entry/src/main/ets/service/AppLock.ets",
    "old": "lockedStateKey: string = 'cineIsleLocked'",
    "replacement": "lockedStateKey: string = 'cineIsleLockedDrift'",
    "name": "UI state actual lock initialization publishes closed then unlocked",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "revisionStateKey-drift",
    "file": "entry/src/main/ets/service/PosterCache.ets",
    "old": "revisionStateKey: string = 'cineIslePosterRevision'",
    "replacement": "revisionStateKey: string = 'cineIslePosterRevisionDrift'",
    "name": "UI state actual poster cancellation publishes epoch and honors silent flag",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "issueStateKey-drift",
    "file": "entry/src/main/ets/service/PendingSync.ets",
    "old": "issueStateKey: string = 'cineIsleSyncIssue'",
    "replacement": "issueStateKey: string = 'cineIsleSyncIssueDrift'",
    "name": "UI state actual sync deferred offline",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "failure-status-consumer-bypass",
    "file": "entry/src/main/ets/service/AppearancePreferences.ets",
    "old": "AppStorage.setOrCreate(AppearancePreferences.paletteStatusStateKey, 'dynamic_colors_update_failed')",
    "replacement": "AppStorage.setOrCreate('cineIslePaletteStatuz', 'dynamic_colors_update_failed')",
    "name": "UI state actual native failure recovery publishes original status key",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "subscriber-drift",
    "file": "entry/src/main/ets/components/BrandHeading.ets",
    "old": "@StorageLink('cineIslePalette')",
    "replacement": "@StorageLink('cineIslePalete')",
    "name": "UI state literal subscribers agree with fixed publisher contract",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "id": "valid-key-subscriber-misbinding",
    "file": "entry/src/main/ets/components/BrandHeading.ets",
    "old": "@StorageLink('cineIslePalette')",
    "replacement": "@StorageLink('cineIsleAmoled')",
    "name": "UI state literal subscribers agree with fixed publisher contract",
    "suite": "ui-state-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "UI state actual appearance attach publishes original keys in order",
    "phase": "preferences-get",
    "nativeInit": "preferences",
    "scope": "ui-state",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "name": "UI state actual lock initialization publishes closed then unlocked",
    "phase": "asset-query",
    "nativeInit": "asset",
    "scope": "ui-state",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "name": "UI state actual configuration entry publishes original viewport keys",
    "phase": "storage-publish",
    "requiredCalls": {
      "ability-load": 1
    },
    "details": {
      "key": "cineIsleFontScale"
    },
    "scope": "ui-state",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "name": "UI state literal subscribers agree with fixed publisher contract",
    "phase": "subscriber-read",
    "scope": "ui-state",
    "suite": "ui-state-contract.test.cjs"
  },
  {
    "name": "UI state actual poster cancellation publishes epoch and honors silent flag",
    "phase": "setup",
    "scope": "ui-state",
    "suite": "ui-state-contract.test.cjs"
  }
];
module.exports={recipes,controls,scope:'ui-state',fixture:'tests/ui-state-fixture.cjs',earlyPhase:'storage-publish',earlyOld:'try{await t.action(check);',earlyReplacement:"try{f.trace().call('storage-publish',()=>{});await t.action(check);",selfFaults:[{id:'preferences-init-capture',phase:'preferences-get',file:'tests/ui-state-fixture.cjs',old:"f.trace().call('preferences-get',async()=>{",replacement:"((phase,operation)=>operation())('preferences-get',async()=>{"},{id:'asset-init-capture',phase:'asset-query',file:'tests/ui-state-fixture.cjs',old:"f.trace().call('asset-query',async()=>{",replacement:"((phase,operation)=>operation())('asset-query',async()=>{"}]};
