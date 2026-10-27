const recipes=[
  {
    "id": "category-value-all",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "value: '', caption: 'all'",
    "replacement": "value: 'drift-', caption: 'all'",
    "name": "favorite options actual category all",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "category-caption-all",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "caption: 'all'",
    "replacement": "caption: 'drift-all'",
    "name": "favorite options actual category all",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "category-value-Movie",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "value: 'Movie', caption: 'media_movie'",
    "replacement": "value: 'drift-Movie', caption: 'media_movie'",
    "name": "favorite options actual category Movie",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "category-caption-Movie",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "caption: 'media_movie'",
    "replacement": "caption: 'drift-media_movie'",
    "name": "favorite options actual category Movie",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "category-value-Series",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "value: 'Series', caption: 'media_series'",
    "replacement": "value: 'drift-Series', caption: 'media_series'",
    "name": "favorite options actual category Series",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "category-caption-Series",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "caption: 'media_series'",
    "replacement": "caption: 'drift-media_series'",
    "name": "favorite options actual category Series",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "category-value-Episode",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "value: 'Episode', caption: 'media_episode'",
    "replacement": "value: 'drift-Episode', caption: 'media_episode'",
    "name": "favorite options actual category Episode",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "category-caption-Episode",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "caption: 'media_episode'",
    "replacement": "caption: 'drift-media_episode'",
    "name": "favorite options actual category Episode",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "order-value-name",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "value: 'name', caption: 'name_ascending'",
    "replacement": "value: 'drift-name', caption: 'name_ascending'",
    "name": "favorite options actual order name",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "order-caption-name",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "caption: 'name_ascending'",
    "replacement": "caption: 'drift-name_ascending'",
    "name": "favorite options actual order name",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "order-value-nameDesc",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "value: 'nameDesc', caption: 'name_descending'",
    "replacement": "value: 'drift-nameDesc', caption: 'name_descending'",
    "name": "favorite options actual order nameDesc",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "order-caption-nameDesc",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "caption: 'name_descending'",
    "replacement": "caption: 'drift-name_descending'",
    "name": "favorite options actual order nameDesc",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "order-value-continue",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "value: 'continue', caption: 'continue_first'",
    "replacement": "value: 'drift-continue', caption: 'continue_first'",
    "name": "favorite options actual order continue",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "order-caption-continue",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "caption: 'continue_first'",
    "replacement": "caption: 'drift-continue_first'",
    "name": "favorite options actual order continue",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "favoriteCategory-guard-remove",
    "file": "entry/src/main/ets/utils/Experience.ts",
    "old": "favoriteCategories.some((choice: FavoriteChoice) => choice.value === value.favoriteCategory)",
    "replacement": "true",
    "name": "favorite options rejects persisted favoriteCategory Unknown",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "favoriteOrder-guard-remove",
    "file": "entry/src/main/ets/utils/Experience.ts",
    "old": "favoriteOrders.some((choice: FavoriteChoice) => choice.value === value.favoriteOrder)",
    "replacement": "true",
    "name": "favorite options rejects persisted favoriteOrder unknown",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "defaultFavoriteCategory-drift",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "defaultFavoriteCategory: string = ''",
    "replacement": "defaultFavoriteCategory: string = 'drift'",
    "name": "favorite options clear restores original defaults",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "id": "defaultFavoriteOrder-drift",
    "file": "entry/src/main/ets/utils/FavoriteOptions.ts",
    "old": "defaultFavoriteOrder: string = 'name'",
    "replacement": "defaultFavoriteOrder: string = 'drift'",
    "name": "favorite options clear restores original defaults",
    "suite": "favorite-options-contract.test.cjs"
  }
];
const controls=[
  {
    "name": "favorite options actual category Movie",
    "phase": "ui-compile",
    "scope": "favorite-options",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "name": "favorite options actual order nameDesc",
    "phase": "file-write",
    "requiredCalls": {
      "ui-compile": 1,
      "file-tryLock": 1
    },
    "details": {
      "filename": "experience.json.tmp",
      "stage": "business"
    },
    "scope": "favorite-options",
    "suite": "favorite-options-contract.test.cjs"
  },
  {
    "name": "favorite options clear restores original defaults",
    "phase": "setup",
    "scope": "favorite-options",
    "suite": "favorite-options-contract.test.cjs"
  }
];
module.exports={recipes,controls,extraScopes:['entry/src/main/resources'],scope:'favorite-options',fixture:'tests/favorite-options-fixture.cjs',earlyPhase:'file-write',earlyOld:'await t.action(check);',earlyReplacement:"f.trace().call('file-write',()=>{});await t.action(check);"};
