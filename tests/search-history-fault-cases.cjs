const recipes=[
  {
    "id": "term-drift-127",
    "file": "entry/src/main/ets/utils/SearchHistory.ts",
    "old": "maxTermCodeUnits: number = 128",
    "replacement": "maxTermCodeUnits: number = 127",
    "name": "search history actual term 128",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "term-drift-129",
    "file": "entry/src/main/ets/utils/SearchHistory.ts",
    "old": "maxTermCodeUnits: number = 128",
    "replacement": "maxTermCodeUnits: number = 129",
    "name": "search history actual term 129",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "capacity-drift-19",
    "file": "entry/src/main/ets/utils/SearchHistory.ts",
    "old": "maxEntries: number = 20",
    "replacement": "maxEntries: number = 19",
    "name": "search history actual capacity seed 19",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "capacity-drift-21",
    "file": "entry/src/main/ets/utils/SearchHistory.ts",
    "old": "maxEntries: number = 20",
    "replacement": "maxEntries: number = 21",
    "name": "search history actual capacity seed 20",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "term-clip-remove",
    "file": "entry/src/main/ets/service/ExperienceStore.ets",
    "old": "term.trim().slice(0, SearchHistoryRules.maxTermCodeUnits)",
    "replacement": "term.trim()",
    "name": "search history actual term 129",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "capacity-clip-remove",
    "file": "entry/src/main/ets/service/ExperienceStore.ets",
    "old": "].slice(0, SearchHistoryRules.maxEntries)",
    "replacement": "]",
    "name": "search history independent producer cap 20",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "persist-cap-remove",
    "file": "entry/src/main/ets/utils/Experience.ts",
    "old": "value.searches.length <= SearchHistoryRules.maxEntries",
    "replacement": "true",
    "name": "search history independent persisted capacity 21",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "persist-cap-comparison",
    "file": "entry/src/main/ets/utils/Experience.ts",
    "old": "value.searches.length <= SearchHistoryRules.maxEntries",
    "replacement": "value.searches.length < SearchHistoryRules.maxEntries",
    "name": "search history independent persisted capacity 20",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "trim-order-drift",
    "file": "entry/src/main/ets/service/ExperienceStore.ets",
    "old": "term.trim().slice(0, SearchHistoryRules.maxTermCodeUnits)",
    "replacement": "term.slice(0, SearchHistoryRules.maxTermCodeUnits).trim()",
    "name": "search history trims before clipping full term",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "dedup-remove",
    "file": "entry/src/main/ets/service/ExperienceStore.ets",
    "old": "s.toLowerCase() !== value.toLowerCase()",
    "replacement": "true",
    "name": "search history trims before clipping and deduplicates lowercase only",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "id": "empty-protection-remove",
    "file": "entry/src/main/ets/service/ExperienceStore.ets",
    "old": "if (!value) { return; }",
    "replacement": "if (false) { return; }",
    "name": "search history empty no-op 0",
    "suite": "search-history-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "search history actual SDK submit keeps full query and clipped history",
    "phase": "ui-compile",
    "scope": "search-history",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "name": "search history actual SDK submit keeps full query and clipped history",
    "phase": "file-write",
    "requiredCalls": {
      "ui-compile": 1,
      "file-tryLock": 1
    },
    "details": {
      "filename": "experience.json.tmp",
      "stage": "business"
    },
    "scope": "search-history",
    "suite": "search-history-contract.test.cjs"
  },
  {
    "name": "search history actual term 129",
    "phase": "setup",
    "scope": "search-history",
    "suite": "search-history-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'search-history',fixture:'tests/search-history-fixture.cjs',earlyPhase:'file-write',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('file-write',()=>{});await t.action(check);"};
